import { randomBytes } from 'node:crypto';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_FORMATS,
  UPLOAD_TYPES,
  type AttachmentRef,
  type UploadSignature,
  type UploadSignRequest,
} from '@teamchat/shared';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { Message } from '../models/Message.js';

/**
 * The only file that talks to Cloudinary (Step 5.1).
 *
 * Signed direct upload: the server never receives the file. It hands the browser a signature
 * for exactly one upload (this public id, these formats, valid ~1 hour), the browser sends the
 * bytes to Cloudinary itself, and the message later refers to the file by its public id. On send
 * the server asks Cloudinary what was really stored (size, format, dimensions), because anything
 * the browser reports could be made up.
 */

const ALLOWED_FORMATS = UPLOAD_FORMATS.join(',');
const MIME_BY_FORMAT = Object.fromEntries(
  Object.entries(UPLOAD_TYPES).map(([mime, format]) => [format, mime]),
) as Record<string, string>;

let configured = false;
function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/** Every user's files live under their own prefix; a message may only use the sender's files. */
export const userFolder = (userId: string) => `teamchat/${userId}/`;

/**
 * Signs one upload. Signed fields: timestamp, public_id, allowed_formats, overwrite=false.
 * Cloudinary recomputes the signature with the secret, so the browser can't change the id
 * (another user's folder) or the formats (an .exe). overwrite=false: the signature stays valid
 * for an hour, and without it the same id could be re-uploaded with different content after the
 * message was sent. It CAN'T limit the size: that's checked again on send.
 */
export function signUpload(userId: string, file: UploadSignRequest): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${userFolder(userId)}${randomBytes(12).toString('hex')}`;
  const params = {
    timestamp,
    public_id: publicId,
    allowed_formats: ALLOWED_FORMATS,
    overwrite: 'false',
  };
  const signature = client().utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  logger.debug({ userId, type: file.type, size: file.size }, 'upload signed');
  return {
    // PDFs are stored as "image" resources too (Cloudinary can render their pages).
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    publicId,
    allowedFormats: ALLOWED_FORMATS,
    signature,
  };
}

/** The attachment as stored on the message. */
export interface StoredAttachment {
  url: string;
  publicId: string;
  kind: 'image' | 'file';
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

interface CloudinaryResource {
  public_id: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  secure_url: string;
}

const cloudinaryStatus = (err: unknown): number | undefined =>
  (err as { error?: { http_code?: number } })?.error?.http_code;

const badAttachment = (code: string, message: string) => new AppError(400, code, message);

/**
 * Turns the files named in a message:send into stored attachments: each must be in the sender's
 * folder, exist at Cloudinary, and be an allowed type within 10 MB (as Cloudinary measured it).
 */
export async function resolveAttachments(
  userId: string,
  refs: AttachmentRef[],
): Promise<StoredAttachment[]> {
  const unique = [...new Map(refs.map((r) => [r.publicId, r])).values()];
  return Promise.all(
    unique.map(async ({ publicId, name }) => {
      if (!publicId.startsWith(userFolder(userId))) {
        throw badAttachment('ATTACHMENT_NOT_FOUND', 'File not found');
      }
      let res: CloudinaryResource;
      try {
        res = (await client().api.resource(publicId, {
          resource_type: 'image',
        })) as CloudinaryResource;
      } catch (err) {
        if (cloudinaryStatus(err) === 404) {
          throw badAttachment('ATTACHMENT_NOT_FOUND', 'File not found');
        }
        // Only the status: the SDK's error object can include request details.
        logger.error({ status: cloudinaryStatus(err) }, 'cloudinary lookup failed');
        throw new AppError(502, 'UPLOAD_CHECK_FAILED', 'Could not check the uploaded file');
      }

      const mimeType = MIME_BY_FORMAT[res.format];
      if (!mimeType || res.bytes > MAX_UPLOAD_BYTES) {
        removeFiles([publicId]); // never usable, so don't keep it
        throw mimeType
          ? badAttachment('FILE_TOO_LARGE', `${name} is larger than 10 MB`)
          : badAttachment('FILE_TYPE_NOT_ALLOWED', `${name}: file type not allowed`);
      }
      const isImage = res.format !== 'pdf';
      return {
        url: res.secure_url,
        publicId,
        kind: isImage ? 'image' : 'file',
        name,
        mimeType,
        size: res.bytes,
        ...(isImage && res.width && res.height && { width: res.width, height: res.height }),
      } satisfies StoredAttachment;
    }),
  );
}

/**
 * Best effort, in the background: a failure is logged, never thrown (the message delete has
 * already succeeded). Upload API `destroy`, one call per file: it isn't counted against the
 * Admin API's hourly limit the way `delete_resources` is.
 */
export function removeFiles(publicIds: string[]): void {
  for (const publicId of publicIds) {
    client()
      .uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
      .then((res: { result?: string }) => {
        if (res.result !== 'ok' && res.result !== 'not found') {
          logger.warn({ publicId, result: res.result }, 'cloudinary delete did not succeed');
        }
      })
      .catch((err: unknown) =>
        logger.error({ publicId, status: cloudinaryStatus(err) }, 'cloudinary delete failed'),
      );
  }
}

/**
 * Deletes files the user uploaded but didn't send. Only ids under the user's own prefix (you
 * can't delete someone else's file), and never one that is already on a message (a sent file
 * is deleted only by deleting its message). Returns how many were deleted.
 */
export async function discardUploads(userId: string, publicIds: string[]): Promise<number> {
  const own = [...new Set(publicIds)].filter((id) => id.startsWith(userFolder(userId)));
  if (!own.length) return 0;
  const sent = await Message.find(
    { 'attachments.publicId': { $in: own } },
    { 'attachments.publicId': 1 },
  ).lean<{ attachments: { publicId: string }[] }[]>();
  const onMessages = new Set(sent.flatMap((m) => m.attachments.map((a) => a.publicId)));
  const unsent = own.filter((id) => !onMessages.has(id));
  removeFiles(unsent);
  return unsent.length;
}

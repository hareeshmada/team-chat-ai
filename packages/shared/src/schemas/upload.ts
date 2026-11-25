import { z } from 'zod';

/**
 * File uploads (Step 5.1). The browser uploads straight to Cloudinary with a signature from
 * POST /api/uploads/sign; the message then refers to the uploaded file by its public id, and the
 * server looks the file up at Cloudinary before saving it (it never trusts the client's numbers).
 */

/** 10 MB per file (checked in the browser, in /uploads/sign, and again on send). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Files per message (DESIGN "Realtime UI rules"). */
export const MAX_ATTACHMENTS = 5;

/** Allowed types: MIME type (what the browser reports) → Cloudinary format (what it stores). */
export const UPLOAD_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const;
export type UploadMimeType = keyof typeof UPLOAD_TYPES;
export const UPLOAD_MIME_TYPES = Object.keys(UPLOAD_TYPES) as UploadMimeType[];
export const UPLOAD_FORMATS = Object.values(UPLOAD_TYPES);
/** For `<input type="file" accept>`. */
export const UPLOAD_ACCEPT = [...UPLOAD_MIME_TYPES, '.png,.jpg,.jpeg,.gif,.webp,.pdf'].join(',');

export const ATTACHMENT_NAME_MAX = 200;
const fileNameSchema = z.string().trim().min(1).max(ATTACHMENT_NAME_MAX);

export const uploadSignRequestSchema = z.object({
  name: fileNameSchema,
  type: z.enum(UPLOAD_MIME_TYPES, { error: 'File type not allowed' }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'File is larger than 10 MB'),
});

/**
 * Everything the browser needs for ONE upload to `uploadUrl` (multipart form fields:
 * file, api_key, timestamp, public_id, allowed_formats, overwrite=false, signature). The
 * signature covers timestamp + public_id + allowed_formats + overwrite: changing any of them
 * makes Cloudinary reject the upload.
 */
export const uploadSignatureSchema = z.object({
  uploadUrl: z.string(),
  apiKey: z.string(),
  timestamp: z.number(),
  publicId: z.string(),
  allowedFormats: z.string(),
  signature: z.string(),
});

/**
 * POST /api/uploads/discard: files uploaded but not sent (chip removed, channel or page left).
 * The server deletes only the caller's own files that aren't on any message.
 */
export const discardUploadsSchema = z.object({
  publicIds: z.array(z.string().min(1).max(255)).min(1).max(20),
});

/** What a message:send carries per file: the id the upload got, and the original file name. */
export const attachmentRefSchema = z.object({
  publicId: z.string().min(1).max(255),
  name: fileNameSchema,
});

export const ATTACHMENT_KINDS = ['image', 'file'] as const;

export const attachmentSchema = z.object({
  url: z.string(),
  kind: z.enum(ATTACHMENT_KINDS),
  name: z.string(),
  mimeType: z.string(),
  /** Bytes, as stored at Cloudinary. */
  size: z.number(),
  /** Images only: used to reserve the thumbnail's space before it loads. */
  width: z.number().optional(),
  height: z.number().optional(),
});

export type UploadSignRequest = z.infer<typeof uploadSignRequestSchema>;
export type UploadSignature = z.infer<typeof uploadSignatureSchema>;
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;
export type DiscardUploadsInput = z.infer<typeof discardUploadsSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

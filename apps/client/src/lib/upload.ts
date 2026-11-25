import {
  MAX_UPLOAD_BYTES,
  UPLOAD_MIME_TYPES,
  uploadSignatureSchema,
  type UploadMimeType,
  type UploadSignature,
} from '@teamchat/shared';
import { api } from './api';

/**
 * Direct uploads to Cloudinary (Step 5.1): ask our server for a signature, then send the file
 * from the browser straight to Cloudinary. The file never passes through our server.
 */

export type FileProblem = 'too-large' | 'type';

/** Checked before uploading, so a wrong file fails at once (the server checks again on send). */
export function checkFile(file: File): FileProblem | null {
  if (!UPLOAD_MIME_TYPES.includes(file.type as UploadMimeType)) return 'type';
  if (file.size > MAX_UPLOAD_BYTES) return 'too-large';
  return null;
}

export const requestSignature = (file: File, signal: AbortSignal) =>
  api(
    '/uploads/sign',
    { method: 'POST', body: { name: file.name, type: file.type, size: file.size }, signal },
    uploadSignatureSchema,
  );

/**
 * Asks the server to delete uploaded-but-unsent files. Never throws: if it fails (offline,
 * session over), the orphan-cleanup job deletes them later. `keepalive` for a closing page.
 */
export function discardUploads(publicIds: string[], keepalive = false): void {
  if (!publicIds.length) return;
  api('/uploads/discard', { method: 'POST', body: { publicIds }, keepalive }).catch(() => {});
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * XMLHttpRequest, not fetch: fetch has no upload progress events. `signal` cancels it.
 * Resolves with Cloudinary's public id (the one we signed) and the stored size.
 */
export function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<{ publicId: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('public_id', sig.publicId);
    form.append('allowed_formats', sig.allowedFormats);
    form.append('overwrite', 'false'); // signed by the server: an id can be written only once
    form.append('signature', sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      const body = xhr.response as {
        public_id?: string;
        bytes?: number;
        error?: { message?: string };
      };
      if (xhr.status >= 200 && xhr.status < 300 && body?.public_id) {
        resolve({ publicId: body.public_id, bytes: body.bytes ?? file.size });
      } else {
        reject(new UploadError(body?.error?.message ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new UploadError('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

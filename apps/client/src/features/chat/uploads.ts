import { MAX_ATTACHMENTS, type AttachmentRef } from '@teamchat/shared';
import { useShallow } from 'zustand/react/shallow';
import { ApiError } from '../../lib/api';
import { checkFile, discardUploads, requestSignature, uploadToCloudinary } from '../../lib/upload';
import { useUploadsStore, type UploadItem } from '../../stores/uploads';

/**
 * Composer attachments (Step 5.1): add files (paperclip or drop), upload each straight to
 * Cloudinary with progress, cancel / retry / remove, and hand the ready ones to the message.
 *
 * A file is at Cloudinary as soon as its chip is "ready", before Send. Any file that won't be
 * sent is deleted: ✕ on its chip, leaving the channel, closing/reloading the page, logging out
 * (discardChannelUploads / discardAllUploads). What the browser can't report (a crash, no
 * network) is left to the orphan-cleanup job (Step 5.2).
 */

const store = useUploadsStore.getState;
/** One AbortController per running upload (cancel = abort the sign request or the XHR). */
const running = new Map<string, AbortController>();

function start(item: UploadItem) {
  const controller = new AbortController();
  running.set(item.id, controller);
  // A retry gets a new id; the failed attempt may still have reached Cloudinary.
  const previous = store().items.find((u) => u.id === item.id)?.publicId;
  if (previous) discardUploads([previous]);
  store().update(item.id, {
    status: 'uploading',
    loaded: 0,
    error: undefined,
    publicId: undefined,
  });

  requestSignature(item.file, controller.signal)
    .then((sig) => {
      // Known from the signature on: even a cancelled upload can then be deleted.
      store().update(item.id, { publicId: sig.publicId });
      return uploadToCloudinary(
        item.file,
        sig,
        // The XHR counts the whole multipart body (file + form fields): scale to the file's size.
        (loaded, total) =>
          store().update(item.id, { loaded: Math.round((loaded / total) * item.file.size) }),
        controller.signal,
      );
    })
    .then(({ publicId }) =>
      store().update(item.id, { status: 'ready', publicId, loaded: item.file.size }),
    )
    .catch((err: unknown) => {
      if (controller.signal.aborted) return; // cancelled: the chip is already gone
      store().update(item.id, {
        status: 'failed',
        error: err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed',
      });
    })
    .finally(() => running.delete(item.id));
}

/**
 * Adds files to a channel's composer, up to 5 per message. Wrong type / over 10 MB show as a
 * chip at once (no upload). Files over the 5-file limit are left out (and counted for the notice).
 */
export function addFiles(channelId: string, files: File[]): void {
  const room = MAX_ATTACHMENTS - store().items.filter((u) => u.channelId === channelId).length;
  const taken = files.slice(0, Math.max(0, room));
  const items: UploadItem[] = taken.map((file) => ({
    id: crypto.randomUUID(),
    channelId,
    file,
    status: checkFile(file) ?? 'uploading',
    loaded: 0,
  }));
  store().add(items);
  store().setSkipped(channelId, files.length - taken.length);
  items.filter((u) => u.status === 'uploading').forEach(start);
}

/** Cancels running uploads, removes the chips and deletes their files at Cloudinary. */
function discard(items: UploadItem[], keepalive = false) {
  for (const u of items) {
    running.get(u.id)?.abort();
    running.delete(u.id);
  }
  store().remove(items.map((u) => u.id));
  discardUploads(
    items.flatMap((u) => (u.publicId ? [u.publicId] : [])),
    keepalive,
  );
}

/** ✕ on a chip: cancels the upload or removes the file, and deletes it at Cloudinary. */
export function removeUpload(id: string) {
  const item = store().items.find((u) => u.id === id);
  if (!item) return;
  discard([item]);
  // There's room again, so "5 files max · N not added" no longer applies.
  store().setSkipped(item.channelId, 0);
}

/** Leaving the channel (or the page, with `keepalive`): its unsent files are deleted. */
export function discardChannelUploads(channelId: string, keepalive = false) {
  discard(
    store().items.filter((u) => u.channelId === channelId),
    keepalive,
  );
  store().setSkipped(channelId, 0);
}

/** Before logging out (the token is still valid): every unsent file is deleted. */
export function discardAllUploads() {
  discard(store().items);
}

export function retryUpload(id: string) {
  const item = store().items.find((u) => u.id === id);
  if (item?.status === 'failed') start(item);
}

/** On send: the ready files as message attachments; their chips are cleared. */
export function takeReady(channelId: string): AttachmentRef[] {
  const ready = store().items.filter((u) => u.channelId === channelId && u.status === 'ready');
  store().remove(ready.map((u) => u.id));
  store().setSkipped(channelId, 0);
  return ready.map((u) => ({ publicId: u.publicId!, name: u.file.name.slice(0, 200) }));
}

/** On sign-out: stop everything and forget the chips. */
export function clearUploads() {
  running.forEach((c) => c.abort());
  running.clear();
  store().clear();
}

export const useChannelUploads = (channelId: string) =>
  useUploadsStore(useShallow((s) => s.items.filter((u) => u.channelId === channelId)));

/** "5 files max per message · 2 not added" under the composer. */
export const useSkippedCount = (channelId: string) =>
  useUploadsStore((s) => s.skipped[channelId] ?? 0);

/** Status bar: "uploading 2 files". */
export const useUploadingCount = () =>
  useUploadsStore((s) => s.items.filter((u) => u.status === 'uploading').length);

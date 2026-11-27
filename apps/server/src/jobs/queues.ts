import { createHash } from 'node:crypto';
import { Queue, type ConnectionOptions, type DefaultJobOptions } from 'bullmq';
import { env } from '../config/env.js';

/**
 * BullMQ queues (Step 5.2). The API only ADDS jobs here; the worker process (src/worker.ts)
 * runs them. A job lives in Redis until it's done, so it survives the worker being down: it
 * waits and runs when the worker comes back.
 */

export const QUEUE_NAMES = { inviteEmail: 'invite-email', linkPreview: 'link-preview' } as const;

export interface InviteEmailJobData {
  inviteId: string;
  /** Which version of the invite this email is for (re-inviting changes it; see Invite model). */
  nonce: string;
}

export interface LinkPreviewJobData {
  messageId: string;
  /** The message's first link when the job was added (an edit may change it meanwhile). */
  url: string;
}

/**
 * BullMQ needs its own connections (it uses blocking commands), not the shared fail-fast client.
 * Producer side: fail fast if Redis is down (the request shouldn't hang); the worker side sets
 * `maxRetriesPerRequest: null` so it waits for Redis instead of crashing.
 */
export const producerConnection = (): ConnectionOptions => ({
  url: env.REDIS_URL,
  enableOfflineQueue: false,
  connectTimeout: 2_000,
});
export const workerConnection = (): ConnectionOptions => ({
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
});

/** 3 tries in total, 5 s then 10 s apart. Finished jobs are kept a while for Bull Board. */
export const INVITE_EMAIL_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

/**
 * 2 tries, 3 s apart: a preview that shows up a minute late is useless, and errors that can't
 * pass on a retry (404, blocked address, not HTML) skip the retry entirely (UnrecoverableError).
 */
export const LINK_PREVIEW_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 2,
  backoff: { type: 'fixed', delay: 3_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
};

const ADD_TIMEOUT_MS = 3_000;

let inviteEmailQueue: Queue<InviteEmailJobData> | undefined;
let linkPreviewQueue: Queue<LinkPreviewJobData> | undefined;

function getInviteEmailQueue() {
  inviteEmailQueue ??= new Queue<InviteEmailJobData>(QUEUE_NAMES.inviteEmail, {
    connection: producerConnection(),
    defaultJobOptions: INVITE_EMAIL_JOB_OPTIONS,
  });
  return inviteEmailQueue;
}

function getLinkPreviewQueue() {
  linkPreviewQueue ??= new Queue<LinkPreviewJobData>(QUEUE_NAMES.linkPreview, {
    connection: producerConnection(),
    defaultJobOptions: LINK_PREVIEW_JOB_OPTIONS,
  });
  return linkPreviewQueue;
}

/** Rejects if `work` hasn't finished within 3 s (Redis unreachable): requests never hang on it. */
async function withAddTimeout(work: Promise<unknown>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('queue unavailable')), ADD_TIMEOUT_MS);
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Adds the "send this invite email" job. The job id is derived from the invite + nonce, so adding
 * the same one twice is a no-op (BullMQ ignores a duplicate id). Rejects within 3 s if Redis is
 * unreachable; the caller marks the invite's email as failed.
 */
export async function enqueueInviteEmail(data: InviteEmailJobData): Promise<void> {
  await withAddTimeout(
    getInviteEmailQueue().add('send', data, { jobId: `invite-${data.inviteId}-${data.nonce}` }),
  );
}

/**
 * Adds the "fetch a preview for this message's link" job. One job per message + URL (a hash,
 * since job ids can't hold arbitrary characters), so re-adding the same one is a no-op.
 */
export async function enqueueLinkPreview(data: LinkPreviewJobData): Promise<void> {
  const urlHash = createHash('sha256').update(data.url).digest('hex').slice(0, 16);
  await withAddTimeout(
    getLinkPreviewQueue().add('fetch', data, { jobId: `preview-${data.messageId}-${urlHash}` }),
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([inviteEmailQueue?.close(), linkPreviewQueue?.close()]);
  inviteEmailQueue = undefined;
  linkPreviewQueue = undefined;
}

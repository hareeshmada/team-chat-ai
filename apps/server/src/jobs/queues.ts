import { Queue, type ConnectionOptions, type DefaultJobOptions } from 'bullmq';
import { env } from '../config/env.js';

/**
 * BullMQ queues (Step 5.2). The API only ADDS jobs here; the worker process (src/worker.ts)
 * runs them. A job lives in Redis until it's done, so it survives the worker being down: it
 * waits and runs when the worker comes back.
 */

export const QUEUE_NAMES = { inviteEmail: 'invite-email' } as const;

export interface InviteEmailJobData {
  inviteId: string;
  /** Which version of the invite this email is for (re-inviting changes it; see Invite model). */
  nonce: string;
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

const ADD_TIMEOUT_MS = 3_000;

let inviteEmailQueue: Queue<InviteEmailJobData> | undefined;

function getInviteEmailQueue() {
  inviteEmailQueue ??= new Queue<InviteEmailJobData>(QUEUE_NAMES.inviteEmail, {
    connection: producerConnection(),
    defaultJobOptions: INVITE_EMAIL_JOB_OPTIONS,
  });
  return inviteEmailQueue;
}

/**
 * Adds the "send this invite email" job. The job id is derived from the invite + nonce, so adding
 * the same one twice is a no-op (BullMQ ignores a duplicate id). Rejects within 3 s if Redis is
 * unreachable; the caller marks the invite's email as failed.
 */
export async function enqueueInviteEmail(data: InviteEmailJobData): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('queue unavailable')), ADD_TIMEOUT_MS);
  });
  try {
    await Promise.race([
      getInviteEmailQueue().add('send', data, { jobId: `invite-${data.inviteId}-${data.nonce}` }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeQueues(): Promise<void> {
  await inviteEmailQueue?.close();
  inviteEmailQueue = undefined;
}

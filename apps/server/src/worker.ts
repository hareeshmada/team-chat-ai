import { Worker } from 'bullmq';
import { env } from './config/env.js';
import {
  markInviteEmailFailed,
  processInviteEmail,
  type InviteJobResult,
} from './jobs/inviteEmail.job.js';
import { processLinkPreview, type LinkPreviewJobResult } from './jobs/linkPreview.job.js';
import {
  QUEUE_NAMES,
  workerConnection,
  type InviteEmailJobData,
  type LinkPreviewJobData,
} from './jobs/queues.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { createMailer, smtpConfigured } from './lib/mailer.js';
import { closeRedis, connectRedis } from './lib/redis.js';

/**
 * The background worker (Step 5.2): a separate process from the API (`npm run dev:worker`).
 * Slow or flaky work (sending email over SMTP, fetching other sites for link previews) runs
 * here, so an API request never waits for it and a stuck remote server can't use up the API's
 * resources. Jobs wait in Redis while this is down and run when it starts again. Several
 * workers can run at once; BullMQ gives each job to exactly one of them at a time.
 */

const SHUTDOWN_TIMEOUT_MS = 15_000;

try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB_NAME);
} catch (err) {
  logger.fatal({ err }, 'Failed to connect to MongoDB');
  process.exit(1);
}
// Used to publish "invite updated" / "message updated" events to the API instances.
await connectRedis();

const workers: Worker[] = [];

/** Logs that are the same for every queue: ready, and connection problems (it reconnects). */
function watch(worker: Worker, name: string) {
  worker.on('ready', () => logger.info(`Worker ready (queue: ${name})`));
  worker.on('error', (err) => logger.error({ err: err.message, queue: name }, 'worker error'));
  workers.push(worker);
}

// --- invite-email: only with SMTP settings (without them, invites wait in the queue) ---------
if (smtpConfigured()) {
  const sendMail = createMailer();
  const inviteWorker = new Worker<InviteEmailJobData, InviteJobResult>(
    QUEUE_NAMES.inviteEmail,
    (job) => processInviteEmail(job.data, { sendMail }),
    { connection: workerConnection(), concurrency: 5 },
  );
  watch(inviteWorker, QUEUE_NAMES.inviteEmail);
  inviteWorker.on('completed', (job, result) =>
    logger.info({ jobId: job.id, result }, 'invite-email done'),
  );
  inviteWorker.on('failed', (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    // Only the error message: SMTP errors don't contain the password, but never log the link.
    logger.warn(
      { jobId: job.id, attempt: job.attemptsMade, of: attempts, err: err.message },
      'invite-email attempt failed',
    );
    if (job.attemptsMade >= attempts) {
      markInviteEmailFailed(job.data).catch((e: unknown) =>
        logger.error({ err: e }, 'could not mark invite email failed'),
      );
    }
  });
} else {
  logger.warn(
    'SMTP_HOST, SMTP_USER and SMTP_PASS are not set: invite emails are not sent (see .env.example)',
  );
}

// --- link-preview --------------------------------------------------------------------------
const previewWorker = new Worker<LinkPreviewJobData, LinkPreviewJobResult>(
  QUEUE_NAMES.linkPreview,
  (job) => processLinkPreview(job.data),
  // Mostly waiting on other sites (≤ 5 s each), so several at once is cheap.
  { connection: workerConnection(), concurrency: 10 },
);
watch(previewWorker, QUEUE_NAMES.linkPreview);
// The message id only: the URL is user content (it can carry tokens in its query string).
previewWorker.on('completed', (job, result) =>
  logger.info({ jobId: job.id, messageId: job.data.messageId, result }, 'link-preview done'),
);
previewWorker.on('failed', (job, err) => {
  if (!job) return;
  logger.warn(
    { jobId: job.id, messageId: job.data.messageId, attempt: job.attemptsMade, err: err.message },
    'link-preview attempt failed',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, worker shutting down`);
  setTimeout(() => {
    logger.error(`Worker shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    // Stops taking new jobs and waits for the running ones to finish (a job cut off here would
    // be picked up again later as "stalled", which is why jobs must be safe to repeat).
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([disconnectDb(), closeRedis()]);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

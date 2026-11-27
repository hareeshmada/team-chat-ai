import { createTransport, getTestMessageUrl } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Used only by the worker (Step 5.2). SMTP settings come from env; Ethereal in dev. */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendMail = (message: MailMessage) => Promise<void>;

export const smtpConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

export function createMailer(): SendMail {
  const transport = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
    // Fail an attempt in seconds, not minutes: the job retries with backoff anyway.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return async (message) => {
    const info = await transport.sendMail({ from: env.MAIL_FROM, ...message });
    // Ethereal only: a link to view the caught email (no recipient address logged).
    const preview = env.NODE_ENV !== 'production' ? getTestMessageUrl(info) : false;
    logger.info({ messageId: info.messageId, ...(preview && { preview }) }, 'email sent');
  };
}

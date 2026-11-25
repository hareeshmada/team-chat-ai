import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
    MONGODB_DB_NAME: z.string().min(1).default('teamchatai'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    // AI assistant (Gemini). Required outside tests; tests replace the SDK with a fake.
    GEMINI_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).optional(),
    // Redis (Step 4.4 usage counters; more on Day 5). Started with `docker compose up -d`.
    REDIS_URL: z
      .string()
      .regex(/^rediss?:\/\//, 'REDIS_URL must start with redis://')
      .default('redis://localhost:6379'),
    // Tokens (input + output) each user may spend on AI per day.
    AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(50_000),
    // The allowance resets at midnight in this timezone (IANA name, e.g. Asia/Kolkata).
    AI_USAGE_TIMEZONE: z
      .string()
      .default('UTC')
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'AI_USAGE_TIMEZONE must be an IANA timezone such as UTC or Asia/Kolkata'),
  })
  .refine((e) => e.NODE_ENV === 'test' || (e.GEMINI_API_KEY && e.AI_MODEL), {
    message: 'GEMINI_API_KEY and AI_MODEL are required (get a key at aistudio.google.com)',
    path: ['GEMINI_API_KEY'],
  })
  .refine((e) => e.COOKIE_SAMESITE !== 'none' || e.NODE_ENV === 'production', {
    // Browsers reject SameSite=None cookies that aren't Secure, and we only set Secure in production.
    message:
      'COOKIE_SAMESITE=none requires NODE_ENV=production (SameSite=None cookies must be Secure)',
    path: ['COOKIE_SAMESITE'],
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Logger depends on env, so fall back to console here. Only keys + messages are printed, never values.
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env: Env = parsed.data;

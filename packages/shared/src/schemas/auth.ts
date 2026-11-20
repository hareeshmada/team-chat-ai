import { z } from 'zod';

// Trim + lowercase BEFORE the format check, so "  Foo@Bar.COM " is accepted and stored as "foo@bar.com".
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

export const MAX_PASSWORD_BYTES = 72;

/** UTF-8 byte length without TextEncoder/Buffer, so it runs the same in the browser and Node. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  email: emailSchema,
  // bcrypt only uses the first 72 BYTES, so longer passwords are rejected instead of silently truncated.
  // Count bytes, not characters: "é" is 2 bytes, Telugu/Hindi letters 3, emoji 4.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((pw) => utf8ByteLength(pw) <= MAX_PASSWORD_BYTES, 'Password is too long'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

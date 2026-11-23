import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const channelParamsSchema = z.object({ channelId: objectIdSchema });

export const createChannelSchema = z.object({
  // Slack-style names: "#frontend", "#release-2"
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{1,40}$/, 'Use 1–40 lowercase letters, numbers, - or _'),
  isPrivate: z.boolean().default(false),
});

export const publicChannelSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  isPrivate: z.boolean(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
});

export type CreateChannelInput = z.input<typeof createChannelSchema>;
export type PublicChannel = z.infer<typeof publicChannelSchema>;

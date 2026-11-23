import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const CHANNEL_DESCRIPTION_MAX = 250;

export const channelParamsSchema = z.object({ channelId: objectIdSchema });

export const createChannelSchema = z.object({
  // Slack-style names: "#frontend", "#release-2"
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{1,40}$/, 'Use 1–40 lowercase letters, numbers, - or _'),
  description: z.string().trim().max(CHANNEL_DESCRIPTION_MAX).default(''),
  isPrivate: z.boolean().default(false),
});

export const publicChannelSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  isPrivate: z.boolean(),
  /** Private channels: who can see it. Empty for public channels (every workspace member). */
  memberIds: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
});

export type CreateChannelInput = z.input<typeof createChannelSchema>;
/** After parsing (defaults applied): what a form's submit handler receives. */
export type CreateChannelData = z.output<typeof createChannelSchema>;
export type PublicChannel = z.infer<typeof publicChannelSchema>;

export const channelResponseSchema = z.object({ channel: publicChannelSchema });
export const channelListResponseSchema = z.object({ channels: z.array(publicChannelSchema) });

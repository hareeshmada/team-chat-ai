// Shared Zod schemas, types and socket event names are exported from here.
export const APP_NAME = 'TeamChat AI';

export * from './schemas/health.js';
export * from './schemas/auth.js';
export * from './schemas/common.js';
export * from './schemas/workspace.js';
export * from './schemas/channel.js';
export * from './schemas/message.js';
export * from './schemas/unread.js';
export * from './schemas/notification.js';
export * from './mentions.js';
export * from './socket/events.js';

import {
  aiChatRequestSchema,
  aiConversationParamsSchema,
  aiConversationsQuerySchema,
} from '@teamchat/shared';
import { Router } from 'express';
import * as ai from '../controllers/ai.controller.js';
import { createWriteRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// Every call costs provider quota: 20 questions per minute per user (the daily token limit
// comes in Step 4.4).
const askLimit = createWriteRateLimiter({ limit: 20 });

aiRouter.post('/chat', askLimit, validate({ body: aiChatRequestSchema }), ai.chat);
aiRouter.get(
  '/conversations',
  validate({ query: aiConversationsQuerySchema }),
  ai.listConversations,
);
aiRouter.get(
  '/conversations/:conversationId',
  validate({ params: aiConversationParamsSchema }),
  ai.getConversation,
);

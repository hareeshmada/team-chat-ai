import {
  aiChatRequestSchema,
  aiConversationParamsSchema,
  aiConversationsQuerySchema,
} from '@teamchat/shared';
import { Router } from 'express';
import * as ai from '../controllers/ai.controller.js';
import { aiRequestLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post('/chat', aiRequestLimit, validate({ body: aiChatRequestSchema }), ai.chat);
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
aiRouter.get('/usage', ai.usage);

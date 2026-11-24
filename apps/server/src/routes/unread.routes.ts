import { Router } from 'express';
import * as unread from '../controllers/unread.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const unreadRouter = Router();

unreadRouter.use(requireAuth);

/** Unread + mention counts for every channel you can see, across all your workspaces. */
unreadRouter.get('/', unread.list);

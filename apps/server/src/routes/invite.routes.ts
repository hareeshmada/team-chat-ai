import { inviteTokenParamsSchema } from '@teamchat/shared';
import { Router } from 'express';
import * as invites from '../controllers/invite.controller.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const inviteRouter = Router();

const params = validate({ params: inviteTokenParamsSchema });

// Public (the person has no account yet). Per-IP limit like login: tokens are unguessable, this
// just stops anyone hammering the endpoint.
inviteRouter.get('/:token', createAuthRateLimiter({ limit: 30 }), params, invites.preview);
inviteRouter.post('/:token/accept', requireAuth, params, invites.accept);

import { loginSchema, registerSchema } from '@teamchat/shared';
import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  createAuthRateLimiter(),
  validate({ body: registerSchema }),
  auth.register,
);
authRouter.post('/login', createAuthRateLimiter(), validate({ body: loginSchema }), auth.login);
authRouter.post('/refresh', auth.refresh);
authRouter.post('/logout', auth.logout);
authRouter.get('/me', requireAuth, auth.me);

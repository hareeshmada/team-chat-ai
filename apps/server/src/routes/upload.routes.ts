import { discardUploadsSchema, uploadSignRequestSchema } from '@teamchat/shared';
import { Router } from 'express';
import * as upload from '../controllers/upload.controller.js';
import { uploadDiscardLimit, uploadSignLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

uploadRouter.post(
  '/sign',
  uploadSignLimit,
  validate({ body: uploadSignRequestSchema }),
  upload.sign,
);
uploadRouter.post(
  '/discard',
  uploadDiscardLimit,
  validate({ body: discardUploadsSchema }),
  upload.discard,
);

import type { DiscardUploadsInput, UploadSignRequest } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import { getAuthUser } from '../middleware/requireAuth.js';
import { discardUploads, signUpload } from '../services/upload.service.js';

/** POST /api/uploads/sign: a signature for one direct upload to Cloudinary (never the file itself). */
export const sign: RequestHandler = (req, res) => {
  const { userId } = getAuthUser(req);
  res.json(signUpload(userId, req.body as UploadSignRequest));
};

/** POST /api/uploads/discard: delete uploaded-but-unsent files (204; deletion runs in the background). */
export const discard: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  await discardUploads(userId, (req.body as DiscardUploadsInput).publicIds);
  res.status(204).end();
};

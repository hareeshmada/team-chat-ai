import type { CreateWorkspaceInput, inviteMemberSchema } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as workspaceService from '../services/workspace.service.js';

// req.params / req.body were parsed by validate() with the matching shared schemas.

export const create: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const workspace = await workspaceService.createWorkspace(
    userId,
    req.body as CreateWorkspaceInput,
  );
  res.status(201).json({ workspace });
};

export const listMine: RequestHandler = async (req, res) => {
  const workspaces = await workspaceService.listMyWorkspaces(getAuthUser(req).userId);
  res.json({ workspaces });
};

export const invite: RequestHandler = async (req, res) => {
  const member = await workspaceService.inviteMember(
    req.params.workspaceId as string,
    req.body as z.output<typeof inviteMemberSchema>,
  );
  res.status(201).json({ member });
};

export const listMembers: RequestHandler = async (req, res) => {
  const members = await workspaceService.listMembers(req.params.workspaceId as string);
  res.json({ members });
};

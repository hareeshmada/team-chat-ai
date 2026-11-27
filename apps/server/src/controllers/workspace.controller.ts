import type { CreateWorkspaceInput, inviteMemberSchema } from '@teamchat/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { logger } from '../lib/logger.js';
import { getAuthUser } from '../middleware/requireAuth.js';
import * as inviteService from '../services/invite.service.js';
import { notifyInvite } from '../services/notification.service.js';
import * as workspaceService from '../services/workspace.service.js';
import { broadcastInvite } from '../socket/eventRelay.js';
import { notifyMemberAdded } from '../socket/realtime.js';

// req.params / req.body were parsed by validate() with the matching shared schemas.

export const create: RequestHandler = async (req, res) => {
  const { userId } = getAuthUser(req);
  const workspace = await workspaceService.createWorkspace(
    userId,
    req.body as CreateWorkspaceInput,
  );
  res.status(201).json({ workspace });
  // The creator's other open tabs add it to their switcher; their sockets join its room.
  notifyMemberAdded(workspace, userId);
};

export const listMine: RequestHandler = async (req, res) => {
  const workspaces = await workspaceService.listMyWorkspaces(getAuthUser(req).userId);
  res.json({ workspaces });
};

export const invite: RequestHandler = async (req, res) => {
  const { userId: invitedById } = getAuthUser(req);
  const workspaceId = req.params.workspaceId as string;
  const result = await workspaceService.inviteMember(
    workspaceId,
    req.body as z.output<typeof inviteMemberSchema>,
    invitedById,
  );
  res.status(201).json(result);

  // After the response; a failure here is logged, never thrown.
  try {
    if ('invite' in result) {
      // Other admins with the modal open see the new "pending · sending…" row.
      await broadcastInvite(result.invite.id);
      return;
    }
    // An existing account: tell the invitee's open tabs (no-op without a socket server).
    const { member } = result;
    const workspace = await workspaceService.getPublicWorkspace(workspaceId, member.role);
    notifyMemberAdded(workspace, member.userId);
    await notifyInvite({
      userId: member.userId,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      invitedById,
      role: member.role,
    });
  } catch (err) {
    logger.error({ err }, 'invite notifications failed');
  }
};

export const listInvites: RequestHandler = async (req, res) => {
  const invites = await inviteService.listInvites(req.params.workspaceId as string);
  res.json({ invites });
};

export const listMembers: RequestHandler = async (req, res) => {
  const members = await workspaceService.listMembers(req.params.workspaceId as string);
  res.json({ members });
};

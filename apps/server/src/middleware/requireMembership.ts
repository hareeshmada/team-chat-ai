import { ROLE_RANK, type Role } from '@teamchat/shared';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { Membership, type MembershipDocument } from '../models/Membership.js';
import { getAuthUser } from './requireAuth.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireMembership / requireChannelAccess. */
    membership?: MembershipDocument;
  }
}

export const forbidden = (message = 'You do not have access to this workspace') =>
  new AppError(403, 'FORBIDDEN', message);

/** Is `role` at least `minRole`? (owner > admin > member) */
export function hasRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/**
 * RBAC check for routes with :workspaceId (run after requireAuth and validate({ params })).
 * No membership → 403, also for a workspace that doesn't exist, so outsiders can't probe ids.
 * Role below minRole → 403. Otherwise req.membership is set for the controller.
 * The role is read from the DB on every request (not from the JWT), so a demotion or removal
 * takes effect immediately.
 */
export function requireMembership(minRole: Role = 'member'): RequestHandler {
  return async (req, _res, next) => {
    const { userId } = getAuthUser(req);
    const membership = await Membership.findOne({ workspaceId: req.params.workspaceId, userId });

    if (!membership) throw forbidden();
    if (!hasRole(membership.role, minRole)) {
      throw forbidden(`This action needs the ${minRole} role or higher`);
    }

    req.membership = membership;
    next();
  };
}

/** For handlers behind requireMembership / requireChannelAccess. */
export function getMembership(req: Request): MembershipDocument {
  if (!req.membership) throw new AppError(500, 'INTERNAL_ERROR', 'Membership was not loaded');
  return req.membership;
}

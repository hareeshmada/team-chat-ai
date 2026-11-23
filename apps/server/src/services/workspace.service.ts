import { randomBytes } from 'node:crypto';
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  PublicWorkspace,
  Role,
  WorkspaceMember,
} from '@teamchat/shared';
import { AppError } from '../errors/AppError.js';
import { isDuplicateKeyError } from '../lib/mongoErrors.js';
import { Channel } from '../models/Channel.js';
import { Membership } from '../models/Membership.js';
import { User, type UserDocument } from '../models/User.js';
import { Workspace, type WorkspaceDocument } from '../models/Workspace.js';

export const DEFAULT_CHANNEL = 'general';

function toPublicWorkspace(ws: WorkspaceDocument, role: Role): PublicWorkspace {
  return {
    id: ws._id.toString(),
    name: ws.name,
    slug: ws.slug,
    ownerId: ws.ownerId.toString(),
    role,
    createdAt: ws.createdAt.toISOString(),
  };
}

/** "Acme Corp!" → "acme-corp-k3x9q2". The random suffix keeps slugs unique without a lookup. */
export function makeSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'workspace';
  return `${base}-${randomBytes(4).toString('hex').slice(0, 6)}`;
}

// A 6-hex suffix gives ~16.7M slugs per name, so a clash is rare, but it must not become a 500.
const SLUG_ATTEMPTS = 3;

/** Inserts the workspace, picking a new random slug if the unique slug index rejects one. */
async function insertWithUniqueSlug(
  name: string,
  ownerId: string,
  generateSlug: (name: string) => string,
): Promise<WorkspaceDocument> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await Workspace.create({ name, slug: generateSlug(name), ownerId });
    } catch (err) {
      // slug is the only unique field on Workspace (besides _id), so E11000 here = slug clash.
      if (!isDuplicateKeyError(err) || attempt >= SLUG_ATTEMPTS) throw err;
    }
  }
}

/**
 * Creates the workspace, the creator's owner membership and #general.
 * No transaction: they need a replica set (the in-memory test DB is a single node). Instead,
 * if a later insert fails, the earlier ones are deleted (a compensating action).
 */
export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
  generateSlug: (name: string) => string = makeSlug, // injectable so tests can force a clash
): Promise<PublicWorkspace> {
  const workspace = await insertWithUniqueSlug(input.name, userId, generateSlug);

  try {
    await Membership.create({ workspaceId: workspace._id, userId, role: 'owner' });
    await Channel.create({ workspaceId: workspace._id, name: DEFAULT_CHANNEL, createdBy: userId });
  } catch (err) {
    await Promise.all([
      Membership.deleteMany({ workspaceId: workspace._id }),
      Channel.deleteMany({ workspaceId: workspace._id }),
      Workspace.deleteOne({ _id: workspace._id }),
    ]);
    throw err;
  }

  return toPublicWorkspace(workspace, 'owner');
}

/** Workspaces the user belongs to, with their role in each (oldest first). */
export async function listMyWorkspaces(userId: string): Promise<PublicWorkspace[]> {
  const memberships = await Membership.find({ userId }).lean();
  const roleByWorkspace = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role]));

  const workspaces = await Workspace.find({ _id: { $in: [...roleByWorkspace.keys()] } }).sort({
    _id: 1,
  });
  return workspaces.map((ws) => toPublicWorkspace(ws, roleByWorkspace.get(ws._id.toString())!));
}

function toWorkspaceMember(user: UserDocument, role: Role, joinedAt: Date): WorkspaceMember {
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    role,
    joinedAt: joinedAt.toISOString(),
  };
}

/**
 * Adds an existing user to the workspace (route requires admin+).
 * Unknown emails get 404 for now; pending invites + invite emails come on Day 5.
 */
export async function inviteMember(
  workspaceId: string,
  input: Required<InviteMemberInput>,
): Promise<WorkspaceMember> {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'No account uses this email yet');
  }

  try {
    const membership = await Membership.create({
      workspaceId,
      userId: user._id,
      role: input.role,
    });
    return toWorkspaceMember(user, membership.role, membership.createdAt);
  } catch (err) {
    // The unique { workspaceId, userId } index is the source of truth (no check-then-insert race).
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member');
    }
    throw err;
  }
}

/** All members with their profile and role (owners first, then by join date). */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const memberships = await Membership.find({ workspaceId }).sort({ _id: 1 }).lean();
  const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } });
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const rank = { owner: 0, admin: 1, member: 2 } as const;
  return memberships
    .filter((m) => userById.has(m.userId.toString()))
    .sort((a, b) => rank[a.role] - rank[b.role])
    .map((m) => toWorkspaceMember(userById.get(m.userId.toString())!, m.role, m.createdAt));
}

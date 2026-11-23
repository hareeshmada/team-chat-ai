import type { CreateChannelInput, PublicChannel } from '@teamchat/shared';
import { AppError } from '../errors/AppError.js';
import { isDuplicateKeyError } from '../lib/mongoErrors.js';
import { Channel, type ChannelDocument } from '../models/Channel.js';

function toPublicChannel(channel: ChannelDocument): PublicChannel {
  return {
    id: channel._id.toString(),
    workspaceId: channel.workspaceId.toString(),
    name: channel.name,
    description: channel.description,
    isPrivate: channel.isPrivate,
    memberIds: channel.memberIds.map((id) => id.toString()),
    createdBy: channel.createdBy.toString(),
    createdAt: channel.createdAt.toISOString(),
  };
}

/** Public channels + the private ones this user is in, sorted by name. */
export async function listChannels(workspaceId: string, userId: string): Promise<PublicChannel[]> {
  const channels = await Channel.find({
    workspaceId,
    $or: [{ isPrivate: false }, { memberIds: userId }],
  }).sort({ name: 1 });
  return channels.map(toPublicChannel);
}

export async function createChannel(
  workspaceId: string,
  userId: string,
  input: Required<CreateChannelInput>,
): Promise<PublicChannel> {
  try {
    const channel = await Channel.create({
      workspaceId,
      name: input.name,
      description: input.description,
      isPrivate: input.isPrivate,
      createdBy: userId,
      // The creator is the first member of a private channel.
      memberIds: input.isPrivate ? [userId] : [],
    });
    return toPublicChannel(channel);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'CHANNEL_NAME_TAKEN', `#${input.name} already exists`);
    }
    throw err;
  }
}

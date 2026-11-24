import type { PublicChannel } from '@teamchat/shared';
import { ChannelHeader } from './ChannelHeader';
import { Composer } from './Composer';
import { ConnectionBanner } from './ConnectionBanner';
import { useChannelRoom } from './hooks';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';

/** Header · connection banner · history · typing · composer. Joins the channel's room while open. */
export function ChannelView({ channel }: { channel: PublicChannel }) {
  useChannelRoom(channel.id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChannelHeader channel={channel} />
      <ConnectionBanner />
      <MessageList key={channel.id} channel={channel} />
      {/* Keyed by channel: switching channels remounts them with fresh state (no reset effects). */}
      <TypingIndicator key={`typing-${channel.id}`} channelId={channel.id} />
      <Composer key={`composer-${channel.id}`} channel={channel} />
    </div>
  );
}

import type { PublicChannel } from '@teamchat/shared';
import { DropZone } from '../../components/ui/DropZone';
import { ChannelHeader } from './ChannelHeader';
import { Composer } from './Composer';
import { ConnectionBanner } from './ConnectionBanner';
import { useChannelRoom } from './hooks';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { useFileDrop } from './useFileDrop';

/** Header · connection banner · history · typing · composer. Joins the channel's room while open. */
export function ChannelView({ channel }: { channel: PublicChannel }) {
  useChannelRoom(channel.id);
  const dragging = useFileDrop(channel.id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChannelHeader channel={channel} />
      <ConnectionBanner />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MessageList key={channel.id} channel={channel} />
        {/* Keyed by channel: switching channels remounts them with fresh state (no reset effects). */}
        <TypingIndicator key={`typing-${channel.id}`} channelId={channel.id} />
        {dragging && (
          <div className="absolute inset-0 z-20 flex bg-bg/90 p-3 max-md:hidden">
            <DropZone channelName={channel.name} className="flex-1" />
          </div>
        )}
      </div>
      <Composer key={`composer-${channel.id}`} channel={channel} />
    </div>
  );
}

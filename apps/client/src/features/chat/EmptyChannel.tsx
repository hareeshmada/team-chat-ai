import type { PublicChannel } from '@teamchat/shared';
import { UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth';
import { createdByText } from './format';
import { useShell } from './shellContext';

/** A channel with no messages yet: shown in the message area, the composer stays below. */
export function EmptyChannel({ channel }: { channel: PublicChannel }) {
  const { members, canInvite, openInvite } = useShell();
  const meId = useAuthStore((s) => s.user?.id);
  return (
    <div className="flex flex-col items-start gap-3 px-2 py-10 md:px-7">
      <span
        aria-hidden="true"
        className="inline-flex size-11 items-center justify-center rounded-lg bg-surface-2 font-mono text-xl font-semibold text-accent-fg"
      >
        #
      </span>
      <h2 className="font-mono text-lg font-semibold">#{channel.name}</h2>
      <p className="text-muted">
        This is the very beginning of #{channel.name}. {createdByText(channel, members, meId)}
        {channel.description && (
          <>
            <br />
            {channel.description}
          </>
        )}
      </p>
      {canInvite && (
        <Button variant="secondary" className="h-9 px-3.5 text-[13px]" onClick={openInvite}>
          <UserPlus size={14} aria-hidden /> Invite people
        </Button>
      )}
    </div>
  );
}

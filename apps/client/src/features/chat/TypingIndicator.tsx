import { typingLabel, memberName } from './format';
import { useTypingUsers } from './hooks';
import { useShell } from './shellContext';

/** "arjun is typing…" just above the composer. Keeps its height so the list doesn't jump. */
export function TypingIndicator({ channelId }: { channelId: string }) {
  const { members } = useShell();
  const typing = useTypingUsers(channelId);
  const label = typingLabel(typing.map((id) => memberName(members, id)));

  return (
    <div
      aria-live="polite"
      className="flex h-7 items-center gap-2 px-5 font-mono text-xs text-muted max-md:px-4"
    >
      {label && (
        <>
          <span aria-hidden="true" className="inline-flex gap-[3px]">
            <span className="size-1 rounded-full bg-muted motion-safe:animate-pulse" />
            <span className="size-1 rounded-full bg-muted opacity-60 motion-safe:animate-pulse" />
            <span className="size-1 rounded-full bg-muted opacity-30 motion-safe:animate-pulse" />
          </span>
          {label}
        </>
      )}
    </div>
  );
}

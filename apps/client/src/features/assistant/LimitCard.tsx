import type { AiUsage } from '@teamchat/shared';
import { UsageMeter } from '../../components/ui/UsageMeter';
import { formatTokens, resetClock, resetIn } from './usage';

/** "You've used today's AI allowance" (Step 4.4): the panel's state at the daily limit. */
export function LimitCard({ usage }: { usage: AiUsage }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-lg border border-warning/35 bg-warning/8 p-3.5"
    >
      <span className="font-semibold">You’ve used today’s AI allowance</span>
      <span className="text-muted">
        It resets at {resetClock(usage.resetAt)}, {resetIn(usage.resetAt)}. Messaging your team
        still works as usual.
      </span>
      <UsageMeter used={usage.used} limit={usage.limit} />
      <span className="font-mono text-[11px] text-muted">
        {formatTokens(usage.used)} / {formatTokens(usage.limit)} tokens
      </span>
    </div>
  );
}

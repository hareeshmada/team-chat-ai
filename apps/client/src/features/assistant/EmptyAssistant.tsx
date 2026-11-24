import { Sparkles } from 'lucide-react';

/** Suggestions only fill the ask box; they never send on their own. */
const SUGGESTIONS = [
  'Explain SSE vs WebSockets in two lines',
  'Draft my standup update',
  'Write a regex that matches an email address',
];

export function EmptyAssistant({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent-fg">
        <Sparkles size={16} aria-hidden />
      </span>
      <p className="m-0 text-[15px] font-semibold">What can I help with?</p>
      <p className="m-0 text-muted">
        Ask about code, your channels, or anything else. Only you see this conversation.
      </p>
      <div className="flex flex-col gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-9 cursor-pointer rounded-md border border-border-strong px-2.5 py-2 text-left hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

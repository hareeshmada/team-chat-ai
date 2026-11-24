/** Above the first unread message when a channel is opened (DESIGN §8 NewDivider). */
export function NewDivider() {
  return (
    <div
      role="separator"
      aria-label="New messages"
      className="flex items-center gap-2.5 py-2 font-mono text-[11px] text-accent-fg"
    >
      <span className="h-px flex-1 bg-accent opacity-60" />
      new
    </div>
  );
}

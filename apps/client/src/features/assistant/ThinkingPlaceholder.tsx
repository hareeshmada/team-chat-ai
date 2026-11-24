/** Between sending and the first piece of the answer (Stop is already available). */
export function ThinkingPlaceholder() {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="font-mono text-[11px] text-muted">thinking…</span>
      <span aria-hidden="true" className="h-2.5 w-[90%] rounded-[3px] bg-surface-2" />
      <span aria-hidden="true" className="h-2.5 w-[70%] rounded-[3px] bg-surface-2" />
      <span aria-hidden="true" className="h-2.5 w-[40%] rounded-[3px] bg-surface-2" />
    </div>
  );
}

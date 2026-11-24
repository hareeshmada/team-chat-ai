import { Button } from '../../components/ui/Button';

/**
 * A failed answer: cut off mid-stream (partial text kept above it, "Copy partial") or failed
 * before any text (busy, timeout, …). Retry resends the same question.
 */
export function AiErrorCard({
  title,
  detail,
  onRetry,
  onCopyPartial,
}: {
  title: string;
  detail?: string;
  onRetry: () => void;
  onCopyPartial?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-danger/35 bg-danger/8 px-3 py-2.5"
    >
      <span className="font-semibold">{title}</span>
      {detail && <span className="font-mono text-[11px] text-muted">{detail}</span>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="border-danger text-danger hover:bg-danger/10"
        >
          Retry
        </Button>
        {onCopyPartial && (
          <Button variant="ghost" size="sm" onClick={onCopyPartial} className="px-2.5">
            Copy partial
          </Button>
        )}
      </div>
    </div>
  );
}

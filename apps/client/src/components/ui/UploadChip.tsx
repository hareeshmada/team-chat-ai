import { Image as ImageIcon, X } from 'lucide-react';
import { formatBytes, formatProgress } from '../../lib/bytes';
import { cn } from '../../lib/cn';

export type UploadChipState = 'uploading' | 'ready' | 'failed' | 'too-large' | 'type';

/**
 * One file in the composer (DESIGN §8 "UploadChip"): thumbnail square (image icon or PDF badge),
 * name, and a state line: progress bar + "62% · 3.1 of 5.0 MB" | "ready · 220 KB" |
 * "upload failed" + retry | "too large · 14.2 MB" | "type not allowed". ✕ cancels or removes.
 */
export function UploadChip({
  name,
  size,
  isPdf,
  state,
  loaded = 0,
  error,
  onRemove,
  onRetry,
}: {
  name: string;
  size: number;
  isPdf: boolean;
  state: UploadChipState;
  loaded?: number;
  /** Why it failed (tooltip on "upload failed"). */
  error?: string;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  const bad = state === 'failed' || state === 'too-large' || state === 'type';
  const percent = size > 0 ? Math.min(100, Math.round((loaded / size) * 100)) : 0;

  return (
    <div
      className={cn(
        'flex w-60 items-center gap-2.5 rounded-md border py-1.5 pr-1.5 pl-2 max-md:w-full',
        bad ? 'border-danger/35 bg-danger/8' : 'border-border bg-bg',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded',
          isPdf ? 'bg-danger/12 font-mono text-[9px] font-semibold text-danger' : 'bg-surface-2',
        )}
      >
        {isPdf ? 'PDF' : <ImageIcon size={16} className="text-muted" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[13px]" title={name}>
          {name}
        </span>
        {state === 'uploading' && (
          <>
            <span
              role="progressbar"
              aria-label={`Uploading ${name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="block h-[3px] rounded-sm bg-border"
            >
              <span
                className="block h-[3px] rounded-sm bg-accent transition-[width] duration-150"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="font-mono text-[11px] text-muted">
              {percent}% · {formatProgress(loaded, size)}
            </span>
          </>
        )}
        {state === 'ready' && (
          <span className="font-mono text-[11px] text-success">ready · {formatBytes(size)}</span>
        )}
        {state === 'failed' && (
          <span className="flex items-center gap-2 font-mono text-[11px] text-danger" role="alert">
            <span title={error} className="whitespace-nowrap">
              upload failed
            </span>
            <button
              type="button"
              onClick={onRetry}
              aria-label={`Retry uploading ${name}`}
              className="h-[26px] cursor-pointer rounded border border-danger px-2 hover:bg-danger/10 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              retry
            </button>
          </span>
        )}
        {state === 'too-large' && (
          <span className="font-mono text-[11px] text-danger" role="alert">
            too large · {formatBytes(size)}
          </span>
        )}
        {state === 'type' && (
          <span className="font-mono text-[11px] text-danger" role="alert">
            type not allowed
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={state === 'uploading' ? `Cancel upload of ${name}` : `Remove ${name}`}
        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none max-md:size-11"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

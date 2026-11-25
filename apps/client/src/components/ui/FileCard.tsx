import { Download } from 'lucide-react';
import { formatBytes } from '../../lib/bytes';

/** A non-image attachment (PDF) in a message (DESIGN §8 "FileCard"). */
export function FileCard({
  name,
  size,
  downloadUrl,
}: {
  name: string;
  size: number;
  downloadUrl: string;
}) {
  return (
    <div className="flex w-[360px] max-w-full items-center gap-3 rounded-md border border-border bg-surface py-2.5 pr-2 pl-3">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded bg-danger/12 font-mono text-[10px] font-semibold text-danger"
      >
        PDF
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
        <span className="font-mono text-[11px] text-muted">{formatBytes(size)}</span>
      </span>
      <a
        href={downloadUrl}
        aria-label={`Download ${name}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none max-md:size-11"
      >
        <Download size={16} aria-hidden />
      </a>
    </div>
  );
}

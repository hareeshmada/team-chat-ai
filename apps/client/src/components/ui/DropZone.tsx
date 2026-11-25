import { Upload } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Shown over the message area while files are dragged over the window (DESIGN §8 "DropZone").
 * Purely visual: the drag/drop listeners live with whoever owns the files.
 */
export function DropZone({ channelName, className }: { channelName: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none flex flex-col items-center justify-center gap-2.5 rounded-[10px] border-2 border-dashed border-accent bg-accent/6 p-5 text-center',
        className,
      )}
    >
      <Upload size={28} aria-hidden className="text-accent-fg" />
      <span className="text-base font-semibold">
        Drop to upload to <span className="font-mono">#{channelName}</span>
      </span>
      <span className="font-mono text-xs text-muted">
        png · jpg · gif · webp · pdf — up to 10 MB each, 5 files max
      </span>
    </div>
  );
}

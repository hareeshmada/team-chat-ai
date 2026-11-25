import { useState } from 'react';
import { formatBytes } from '../../lib/bytes';
import { cn } from '../../lib/cn';

/**
 * An image in a message (DESIGN §8 "ImageAttachment"): a link to the original (new tab) showing
 * a small thumbnail. The stored width/height set the box's aspect ratio BEFORE the image loads,
 * so nothing below it jumps (no layout shift); `loading="lazy"` skips images far off screen.
 */
export function ImageAttachment({
  url,
  thumbUrl,
  name,
  size,
  width,
  height,
  caption = true,
  className,
}: {
  url: string;
  thumbUrl: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
  /** "name · 412 KB · 1600×900" under it (off inside the 2-column grid). */
  caption?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const ratio = width && height ? `${width} / ${height}` : '16 / 9';

  const box =
    state === 'failed' ? (
      <div
        role="img"
        aria-label={`${name} could not be loaded`}
        style={{ aspectRatio: ratio }}
        className="flex max-h-[400px] w-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface text-xs text-muted"
      >
        Image unavailable
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs">
          open original
        </a>
      </div>
    ) : (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${name}, ${formatBytes(size)}`}
        style={{ aspectRatio: ratio }}
        className="relative block max-h-[400px] w-full overflow-hidden rounded-md border border-border bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        {state === 'loading' && (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted">
            loading…
          </span>
        )}
        <img
          src={thumbUrl}
          alt=""
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={cn(
            'relative block size-full object-contain transition-opacity',
            state === 'loading' && 'opacity-0',
          )}
        />
      </a>
    );

  return (
    <div className={cn('flex w-[400px] max-w-full flex-col gap-1', className)}>
      {box}
      {caption && (
        <span className="truncate font-mono text-[11px] text-muted" title={name}>
          {[name, formatBytes(size), width && height ? `${width}×${height}` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}

import { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * The card under a message with a link (DESIGN §8 "LinkPreviewCard", Step 5.2): domain, title
 * and a 2-line description, plus a 72px thumbnail when the page has an image. The whole card
 * opens the link in a new tab.
 *
 * The image comes straight from the other site: `no-referrer` so it doesn't learn which chat
 * page it was shown on; if it fails to load, the card falls back to text only.
 */
export function LinkPreviewCard({
  url,
  domain,
  title,
  description,
  imageUrl,
}: {
  url: string;
  domain: string;
  title: string;
  description?: string;
  imageUrl?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'mt-1 grid w-[440px] max-w-full gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-fg no-underline hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none',
        showImage ? 'grid-cols-[minmax(0,1fr)_72px]' : 'grid-cols-[minmax(0,1fr)]',
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-mono text-[11px] text-muted">{domain}</span>
        <span className="line-clamp-2 font-semibold text-accent-fg">{title}</span>
        {description && <span className="line-clamp-2 text-[13px] text-muted">{description}</span>}
      </span>
      {showImage && (
        <img
          src={imageUrl}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="size-[72px] rounded bg-surface-2 object-cover"
        />
      )}
    </a>
  );
}

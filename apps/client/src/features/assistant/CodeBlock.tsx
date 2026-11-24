import { useEffect, useRef, useState, type ComponentProps } from 'react';

/**
 * A fenced code block in an AI reply: language label + copy button over a `pre` that scrolls
 * sideways. `children` is the highlighted `<code>` from rehype-highlight; copy reads the plain
 * text from the DOM, so highlighting markup never ends up on the clipboard.
 */
export function CodeBlock({ language, children }: { language?: string } & ComponentProps<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = () => {
    const text = preRef.current?.textContent ?? '';
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => {}, // clipboard blocked: nothing to do
    );
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg">
      <div className="flex h-7 items-center justify-between border-b border-border pr-1 pl-2.5 font-mono text-[11px] text-muted">
        <span>{language ?? 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="h-6 cursor-pointer rounded px-2 hover:bg-surface-2 hover:text-fg focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre
        ref={preRef}
        className="m-0 overflow-x-auto p-2.5 font-mono text-xs leading-[1.6] text-fg"
        tabIndex={0}
      >
        {children}
      </pre>
    </div>
  );
}

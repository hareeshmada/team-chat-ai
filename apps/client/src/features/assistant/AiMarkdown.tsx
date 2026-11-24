import { isValidElement, memo, type ReactElement } from 'react';
import Markdown, { type Components, type Options } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/cn';
import { CodeBlock } from './CodeBlock';

/**
 * Renders an AI answer as Markdown. Safe by default: react-markdown builds React elements (no
 * innerHTML), raw HTML in the text is NOT rendered (no rehype-raw), and unsafe link protocols
 * such as `javascript:` are dropped by its default urlTransform.
 */
const components: Components = {
  h1: (p) => <h3 className="m-0 text-[15px] font-semibold" {...stripNode(p)} />,
  h2: (p) => <h3 className="m-0 text-[15px] font-semibold" {...stripNode(p)} />,
  h3: (p) => <h3 className="m-0 text-[15px] font-semibold" {...stripNode(p)} />,
  h4: (p) => <h4 className="m-0 text-[13px] font-semibold" {...stripNode(p)} />,
  p: (p) => <p className="m-0" {...stripNode(p)} />,
  ul: (p) => <ul className="m-0 flex list-disc flex-col gap-1 pl-5" {...stripNode(p)} />,
  ol: (p) => <ol className="m-0 flex list-decimal flex-col gap-1 pl-5" {...stripNode(p)} />,
  a: ({ node: _node, ...p }) => (
    <a
      {...p}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-fg underline underline-offset-2 hover:no-underline"
    />
  ),
  blockquote: (p) => (
    <blockquote className="m-0 rounded-md bg-surface px-3 py-1.5 text-muted" {...stripNode(p)} />
  ),
  table: (p) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" {...stripNode(p)} />
    </div>
  ),
  th: (p) => <th className="border border-border px-2 py-1 text-left" {...stripNode(p)} />,
  td: (p) => <td className="border border-border px-2 py-1" {...stripNode(p)} />,
  hr: () => <hr className="m-0 border-border" />,
  // Inline code only: block code is wrapped by `pre` below and keeps rehype-highlight's classes.
  code: ({ node: _node, className, ...p }) =>
    className ? (
      <code className={className} {...p} />
    ) : (
      <code className="rounded bg-surface-2 px-[5px] py-px font-mono text-xs" {...p} />
    ),
  pre: ({ node: _node, children }) => {
    const code = isValidElement(children)
      ? (children as ReactElement<{ className?: string }>)
      : null;
    const language = code?.props.className?.match(/language-([\w+-]+)/)?.[1];
    return <CodeBlock language={language}>{children}</CodeBlock>;
  },
};

function stripNode<T extends { node?: unknown }>({ node: _node, ...rest }: T) {
  return rest;
}

const remarkPlugins: Options['remarkPlugins'] = [remarkGfm];
// detect: false = only highlight blocks that name a language (guessing is slow and often wrong).
const rehypePlugins: Options['rehypePlugins'] = [[rehypeHighlight, { detect: false }]];

export const AiMarkdown = memo(function AiMarkdown({
  text,
  streaming = false,
}: {
  text: string;
  /** Shows the blinking cursor after the last character. */
  streaming?: boolean;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5 break-words', streaming && 'ai-cursor')}>
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {text}
      </Markdown>
    </div>
  );
});

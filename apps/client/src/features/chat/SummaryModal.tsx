import { AI_LIMIT_REACHED, SUMMARY_HEADERS, type PublicChannel } from '@teamchat/shared';
import { Sparkles, Square } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusDot } from '../../components/ui/StatusDot';
import { ApiError } from '../../lib/api';
import { StreamCutError, streamText } from '../../lib/streamText';
import { estimateTokens } from '../assistant/actions';
import { setAiUsageFromError } from '../assistant/usage';
import { formatTime } from './format';

const AiMarkdown = lazy(() =>
  import('../assistant/AiMarkdown').then((m) => ({ default: m.AiMarkdown })),
);

type Status = 'loading' | 'streaming' | 'done' | 'stopped' | 'error';

interface Meta {
  count: number;
  from: string;
  to: string;
}

const errorText = (err: unknown) =>
  err instanceof StreamCutError
    ? 'The summary was cut off.'
    : err instanceof ApiError
      ? err.code === 'AI_BUSY'
        ? 'The AI service is busy. Try again in a moment.'
        : err.code === AI_LIMIT_REACHED
          ? 'Your daily AI allowance is used up. It resets at midnight.'
          : err.code === 'AI_TIMEOUT'
            ? 'That took too long, so it was stopped.'
            : err.message
      : 'Something went wrong. Try again.';

/**
 * "Catch up on #channel" (Step 4.3): streams a private AI summary of the last 100 messages
 * (POST /channels/:id/summary, chunked text). Stop / Esc ends it and keeps what arrived; closing
 * the modal aborts the request. Nothing is saved or posted.
 */
export function SummaryModal({
  channel,
  onClose,
}: {
  channel: PublicChannel;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [text, setText] = useState('');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  /** At the daily limit there's nothing to retry until the reset. */
  const [limited, setLimited] = useState(false);
  const controller = useRef<AbortController | null>(null);

  /** Opens the stream. State only changes in its callbacks (see `retry` for the reset). */
  const start = useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    let buffered = '';
    let frame = 0;
    const flush = () => {
      frame = 0;
      setText(buffered);
    };
    streamText(`/channels/${channel.id}/summary`, {
      body: {},
      signal: c.signal,
      onOpen: (headers) =>
        setMeta({
          count: Number(headers.get(SUMMARY_HEADERS.count) ?? 0),
          from: headers.get(SUMMARY_HEADERS.from) ?? '',
          to: headers.get(SUMMARY_HEADERS.to) ?? '',
        }),
      onChunk: (piece) => {
        buffered += piece;
        setStatus('streaming');
        // One render per frame, however fast the pieces arrive.
        frame ||= requestAnimationFrame(flush);
      },
    })
      .then(() => {
        cancelAnimationFrame(frame);
        flush();
        setStatus('done');
      })
      .catch((err: unknown) => {
        cancelAnimationFrame(frame);
        flush();
        if (c.signal.aborted) {
          setStatus('stopped');
          return;
        }
        if (err instanceof ApiError && err.code === AI_LIMIT_REACHED) {
          setAiUsageFromError(err.details);
          setLimited(true);
        }
        setError(errorText(err));
        setStatus('error');
      });
  }, [channel.id]);

  // Start on open; closing (unmount) aborts the request, which stops Gemini on the server.
  useEffect(() => {
    start();
    return () => controller.current?.abort();
  }, [start]);

  const retry = () => {
    setStatus('loading');
    setText('');
    setError('');
    start();
  };

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const busy = status === 'loading' || status === 'streaming';
  const stop = () => controller.current?.abort();
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => {},
    );
  };

  const range =
    meta?.from && meta.to ? `${formatTime(meta.from)}–${formatTime(meta.to)}` : undefined;
  const summaryMeta = [
    meta && `${meta.count} ${meta.count === 1 ? 'message' : 'messages'}`,
    range,
    text && `~${estimateTokens(text.length).toLocaleString()} tokens`,
  ]
    .filter(Boolean)
    .join(' · ');

  const footer = busy ? (
    <>
      <span className="mr-auto inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-accent-fg">
        <StatusDot status="live" />
        {meta ? `summarizing ${meta.count} messages` : 'reading the channel…'}
      </span>
      <Button variant="secondary" size="sm" onClick={stop} className="h-9 font-mono text-xs">
        <Square size={10} fill="currentColor" aria-hidden /> stop · esc
      </Button>
    </>
  ) : status === 'error' ? (
    <>
      <Button variant="secondary" size="sm" onClick={onClose} className="h-9">
        Close
      </Button>
      {!limited && (
        <Button size="sm" onClick={retry} className="h-9">
          Try again
        </Button>
      )}
    </>
  ) : (
    <>
      <span className="mr-auto min-w-[180px] flex-1 font-mono text-[11px] text-muted">
        {status === 'stopped' ? `stopped · ${summaryMeta}` : summaryMeta}
      </span>
      {text && (
        <Button variant="secondary" size="sm" onClick={copy} className="h-9">
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
      )}
      <Button size="sm" onClick={onClose} className="h-9">
        Done
      </Button>
    </>
  );

  return (
    <Modal
      size="lg"
      // Esc while it's writing stops it (and keeps the text); otherwise Esc closes.
      onClose={busy ? stop : onClose}
      title={
        <span className="flex items-center gap-2.5">
          <Sparkles size={16} aria-hidden className="text-accent-fg" />
          <span>
            Catch up on <span className="font-mono">#{channel.name}</span>
          </span>
        </span>
      }
      footer={footer}
    >
      <div aria-live="polite" aria-busy={busy} className="min-h-[180px] text-sm leading-[1.6]">
        {status === 'error' ? (
          <div role="alert" className="flex flex-col gap-1.5">
            <span className="font-semibold">{error}</span>
            {text && <span className="text-muted">What arrived before it stopped is below.</span>}
          </div>
        ) : null}
        {status === 'loading' ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-muted">reading the channel…</span>
            <span aria-hidden="true" className="h-2.5 w-[90%] rounded-[3px] bg-surface-2" />
            <span aria-hidden="true" className="h-2.5 w-[70%] rounded-[3px] bg-surface-2" />
            <span aria-hidden="true" className="h-2.5 w-[40%] rounded-[3px] bg-surface-2" />
          </div>
        ) : text ? (
          <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
            <AiMarkdown text={text} streaming={status === 'streaming'} variant="summary" />
          </Suspense>
        ) : null}
      </div>
    </Modal>
  );
}

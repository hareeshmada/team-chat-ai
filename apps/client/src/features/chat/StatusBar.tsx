import { slugBase } from '@teamchat/shared';
import { StatusDot, type Status } from '../../components/ui/StatusDot';
import { assistantBusy, useAssistantStore } from '../../stores/assistant';
import { useAuthStore } from '../../stores/auth';
import { useConnectionStore } from '../../stores/connection';
import { useNotificationStreamStore } from '../../stores/notificationStream';
import { formatTime } from './format';
import { useShell } from './shellContext';
import { useUploadingCount } from './uploads';

/** 28px bar under the app: socket state + latency, and who/where you are. */
export function StatusBar() {
  const { workspace } = useShell();
  const user = useAuthStore((s) => s.user);
  const { status, attempt, latencyMs } = useConnectionStore();
  const sse = useNotificationStreamStore();
  const aiStreaming = useAssistantStore((s) => assistantBusy(s.status));
  const uploading = useUploadingCount();
  const sseText =
    sse.status === 'connected'
      ? `sse connected${sse.lastEventAt ? ` · last event ${formatTime(sse.lastEventAt)}` : ''}`
      : sse.status === 'reconnecting'
        ? `sse reconnecting · attempt ${sse.attempt}`
        : sse.status === 'offline'
          ? 'sse offline'
          : 'sse connecting';

  const [dot, text]: [Status | 'down', string] =
    status === 'connected'
      ? ['online', latencyMs === null ? 'ws connected' : `ws connected · ${latencyMs} ms`]
      : status === 'reconnecting'
        ? ['connecting', `ws reconnecting · attempt ${attempt}`]
        : status === 'offline'
          ? ['down', 'ws offline']
          : ['connecting', 'ws connecting'];

  return (
    <footer className="flex min-h-7 flex-wrap items-center gap-4 border-t border-border bg-surface px-3.5 font-mono text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5" role="status">
        {dot === 'down' ? (
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full border border-danger"
          />
        ) : (
          <StatusDot status={dot} />
        )}
        {text}
      </span>
      <span className="inline-flex items-center gap-1.5" role="status">
        {sse.status === 'offline' ? (
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full border border-danger"
          />
        ) : (
          <StatusDot status={sse.status === 'connected' ? 'online' : 'connecting'} />
        )}
        {sseText}
      </span>
      {aiStreaming && (
        <span className="inline-flex items-center gap-1.5 text-accent-fg" role="status">
          <StatusDot status="live" />
          ai stream · http chunked
        </span>
      )}
      {uploading > 0 && (
        <span className="inline-flex items-center gap-1.5 text-accent-fg" role="status">
          <StatusDot status="live" />
          uploading {uploading} {uploading === 1 ? 'file' : 'files'}
        </span>
      )}
      <span className="ml-auto">
        {user?.name.split(' ')[0]?.toLowerCase()}@{slugBase(workspace.name)}
      </span>
    </footer>
  );
}

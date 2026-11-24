import type { NotificationView } from './describe';

/** "**meera** mentioned you in `#frontend`" */
export function NotificationTitle({ view }: { view: NotificationView }) {
  return (
    <>
      {view.actor && <span className="font-semibold text-fg">{view.actor}</span>} {view.action}
      {view.target && <span className="font-mono"> {view.target}</span>}
    </>
  );
}

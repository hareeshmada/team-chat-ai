import { useEffect } from 'react';
import { Toast } from '../../components/ui/Toast';
import { useDesktopNotificationsStore } from '../../stores/desktopNotifications';
import { TOAST_DURATION_MS, useToastStore } from '../../stores/toasts';
import { describeNotification } from './describe';
import { NotificationTitle } from './NotificationTitle';
import { useOpenNotification } from './useOpenNotification';

/**
 * Mention toasts, bottom-right, newest on top, max 3 (DESIGN "Toasts" rules). Lifted above the
 * composer + status bar (not 16px from the bottom edge) so a toast never covers the Send button.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const open = useOpenNotification();

  // An OS notification was clicked: open it here, where the router is available.
  const openRequest = useDesktopNotificationsStore((s) => s.openRequest);
  useEffect(() => {
    if (!openRequest) return;
    useDesktopNotificationsStore.getState().requestOpen(null);
    open(openRequest);
  }, [openRequest, open]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[112px] z-50 max-md:bottom-[88px] flex w-[calc(100%-32px)] max-w-[360px] flex-col gap-2"
    >
      {toasts.map((n) => {
        const view = describeNotification(n);
        return (
          <Toast
            key={n.id}
            icon="@"
            title={<NotificationTitle view={view} />}
            body={view.body}
            durationMs={TOAST_DURATION_MS}
            onDismiss={() => dismiss(n.id)}
            actions={
              <button
                type="button"
                onClick={() => {
                  dismiss(n.id);
                  open(n);
                }}
                className="h-[30px] cursor-pointer rounded-md bg-accent px-3 text-[13px] font-semibold text-on-accent hover:bg-accent-hover focus-visible:ring-[3px] focus-visible:ring-focus-ring focus-visible:outline-none"
              >
                View
              </button>
            }
          />
        );
      })}
    </div>
  );
}

import { BellRing } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useDesktopNotificationsStore } from '../../stores/desktopNotifications';

/**
 * A strip in the notifications dropdown: turn OS notifications for mentions on or off.
 * Hidden where the browser has no Notification API.
 */
export function DesktopNotificationsToggle() {
  const { permission, enabled, enable, disable } = useDesktopNotificationsStore();
  if (permission === 'unsupported') return null;

  return (
    <div className="flex items-center gap-2 border-t border-border py-2 pr-2.5 pl-4 text-[13px]">
      <BellRing size={14} aria-hidden className="shrink-0 text-muted" />
      {permission === 'denied' ? (
        <span className="text-muted">
          Desktop notifications are blocked in your browser’s site settings.
        </span>
      ) : enabled ? (
        <>
          <span className="flex-1 text-muted">Desktop notifications are on for mentions.</span>
          <Button variant="ghost" size="sm" onClick={disable}>
            Turn off
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-muted">Get a desktop alert when you’re mentioned.</span>
          <Button variant="secondary" size="sm" onClick={() => void enable()}>
            Enable
          </Button>
        </>
      )}
    </div>
  );
}

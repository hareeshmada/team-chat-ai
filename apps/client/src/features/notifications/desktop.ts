import type { PublicNotification } from '@teamchat/shared';
import { useDesktopNotificationsStore } from '../../stores/desktopNotifications';
import { describeNotification } from './describe';

/**
 * Shows an OS notification for `n` if the user turned them on and the browser allows it.
 * Returns true if one was shown. `tag` = the notification id, so two open tabs replace each
 * other's pop-up instead of showing it twice.
 */
export function showDesktopNotification(n: PublicNotification): boolean {
  const { enabled, permission, requestOpen } = useDesktopNotificationsStore.getState();
  if (!enabled || permission !== 'granted') return false;

  const view = describeNotification(n);
  const title = [view.actor, view.action, view.target].filter(Boolean).join(' ');
  try {
    const popup = new Notification(title, { body: view.body, tag: n.id });
    popup.onclick = () => {
      window.focus(); // bring the TeamChat tab/window forward
      popup.close();
      requestOpen(n); // the app opens the message (needs the router)
    };
    return true;
  } catch {
    return false; // e.g. some mobile browsers only allow notifications from a service worker
  }
}

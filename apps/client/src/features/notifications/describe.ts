import type { PublicNotification } from '@teamchat/shared';
import { dayLabel, formatTime } from '../chat/format';

/** What a notification says and where it leads, for the dropdown and the toast. */
export interface NotificationView {
  kind: 'mention' | 'invite' | 'info';
  /** "meera" · "mentioned you in" · "#frontend" (actor/target may be empty for system items). */
  actor?: string;
  action: string;
  target?: string;
  body?: string;
  /** App route to open, if any. */
  link?: string;
  /** Message to scroll to (mentions). */
  messageId?: string;
}

export function describeNotification(n: PublicNotification): NotificationView {
  switch (n.type) {
    case 'mention':
      return {
        kind: 'mention',
        actor: n.payload.authorName,
        action: 'mentioned you in',
        target: `#${n.payload.channelName}`,
        body: n.payload.excerpt,
        link: `/app/${n.payload.workspaceId}/${n.payload.channelId}`,
        messageId: n.payload.messageId,
      };
    case 'invite':
      return {
        kind: 'invite',
        actor: n.payload.invitedByName,
        action: 'added you to',
        target: n.payload.workspaceName,
        body: 'You’re a member. Open the workspace switcher to visit.',
        link: `/app/${n.payload.workspaceId}`,
      };
    default:
      return { kind: 'info', action: n.payload.title, body: n.payload.body, link: n.payload.link };
  }
}

/** "10:20" today, otherwise "yesterday" / "Mon, 18 Nov". */
export function notificationTime(iso: string): string {
  const day = dayLabel(iso);
  return day === 'today' ? formatTime(iso) : day;
}

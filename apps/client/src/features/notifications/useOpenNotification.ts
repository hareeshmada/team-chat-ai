import type { PublicNotification } from '@teamchat/shared';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useHighlightStore } from '../../stores/highlight';
import { describeNotification } from './describe';
import { markNotificationsRead } from './queries';

/** Click on a notification, a toast's "View" or an OS notification: mark read, go there, flash. */
export function useOpenNotification() {
  const navigate = useNavigate();
  return useCallback(
    (n: PublicNotification) => {
      const view = describeNotification(n);
      if (!n.readAt) void markNotificationsRead({ ids: [n.id] });
      if (view.messageId) useHighlightStore.getState().set(view.messageId);
      if (view.link) void navigate(view.link);
    },
    [navigate],
  );
}

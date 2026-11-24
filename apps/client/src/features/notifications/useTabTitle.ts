import { useEffect } from 'react';
import { useUnreadNotificationCount } from './queries';

/** "(3) TeamChat AI" while there are unread notifications ("(9+)" from 10). */
export function useTabTitle() {
  const unread = useUnreadNotificationCount();
  useEffect(() => {
    const base = 'TeamChat AI';
    document.title = unread > 0 ? `(${unread > 9 ? '9+' : unread}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unread]);
}

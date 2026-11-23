import { useEffect } from 'react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { reconnectNow } from '../../lib/socket';
import { useConnectionStore } from '../../stores/connection';

const BACK_ONLINE_MS = 3_000;

/** Under the channel header: reconnecting (warning), can't reach (danger), back online (3 s). */
export function ConnectionBanner() {
  const { status, attempt, backOnline, clearBackOnline } = useConnectionStore();

  useEffect(() => {
    if (!backOnline) return;
    const timer = setTimeout(
      clearBackOnline,
      Math.max(0, backOnline.at + BACK_ONLINE_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [backOnline, clearBackOnline]);

  let banner = null;
  if (status === 'reconnecting') {
    banner = (
      <Banner tone="warning" meta={`attempt ${attempt}`}>
        Connection lost. Reconnecting…
      </Banner>
    );
  } else if (status === 'offline') {
    banner = (
      <Banner
        tone="danger"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={reconnectNow}
            className="border-danger text-danger hover:bg-danger/10"
          >
            Retry now
          </Button>
        }
      >
        Can’t reach the server.
      </Banner>
    );
  } else if (status === 'connected' && backOnline) {
    const { missed } = backOnline;
    banner = (
      <Banner tone="success">
        Back online.
        {missed > 0 && ` ${missed} missed ${missed === 1 ? 'message' : 'messages'} loaded.`}
      </Banner>
    );
  }

  return banner && <div className="px-3 pt-2.5 md:px-5">{banner}</div>;
}

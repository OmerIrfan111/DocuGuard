import { useCallback, useEffect, useState } from 'react';
import { listNotifications, markAllRead, markRead } from '../api/notifications';

// Polls notifications every 30s; exposes unread count + mark helpers.
export function useNotifications(enabled = true, interval = 30000) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await listNotifications(10);
      setItems(data.items || []);
      setUnread(data.unread_count || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
  }, [enabled, interval, refresh]);

  const readOne = async (id) => {
    await markRead(id).catch(() => {});
    refresh();
  };
  const readAll = async () => {
    await markAllRead().catch(() => {});
    refresh();
  };

  return { items, unread, refresh, readOne, readAll };
}

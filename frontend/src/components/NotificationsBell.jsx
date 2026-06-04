import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { relativeTime } from '../lib/format';
import { cn } from '../lib/cn';

const TONE = {
  approval: 'bg-ok', rejection: 'bg-risk', violation: 'bg-warn', upload: 'bg-brass',
};

export default function NotificationsBell() {
  const { items, unread, readAll } = useNotifications(true);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-paper"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brass px-1 font-mono text-[10px] font-semibold text-white shadow-seal">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display font-semibold text-ink">Notifications</span>
              {unread > 0 && (
                <button onClick={readAll} className="inline-flex items-center gap-1 text-[12px] text-brass hover:underline">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-ink-faint">You're all caught up.</div>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-paper', !n.read && 'bg-brass-wash/40')}>
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[n.type] || 'bg-ink-faint')} />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-ink">{n.message}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

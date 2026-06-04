import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import NotificationsBell from '../NotificationsBell.jsx';
import Logo from '../ui/Logo.jsx';
import { cn } from '../../lib/cn';

const ROLE_TONE = {
  admin: 'bg-brass-wash text-brass', reviewer: 'bg-ok-wash text-ok', auditor: 'bg-ink/[0.06] text-ink-soft',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (user?.full_name || user?.email || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/80 px-5 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-2 lg:hidden">
        <Logo size={22} className="text-ink" />
        <span className="font-display text-lg font-semibold text-ink">DocuGuard</span>
      </div>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2.5">
        <NotificationsBell />
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors hover:bg-paper">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink font-mono text-[12px] font-semibold text-paper">{initials}</span>
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] font-medium leading-none text-ink">{user?.full_name}</span>
              <span className={cn('mt-0.5 inline-block rounded px-1 font-mono text-[9px] uppercase tracking-wide', ROLE_TONE[user?.role] || 'bg-paper-deep')}>{user?.role}</span>
            </span>
            <ChevronDown size={15} className="text-ink-faint" />
          </button>
          {open && (
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
              <div className="border-b border-line px-4 py-3">
                <div className="truncate text-[13px] font-medium text-ink">{user?.email}</div>
              </div>
              <button onClick={async () => { await logout(); navigate('/login'); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-risk hover:bg-risk-wash">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

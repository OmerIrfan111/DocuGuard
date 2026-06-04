import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, ListChecks, ScrollText, Users, Settings,
} from 'lucide-react';
import Logo from '../ui/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../lib/cn';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload', icon: UploadCloud },
  { to: '/checklists', label: 'Checklists', icon: ListChecks },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['admin', 'auditor'] },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user } = useAuth();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink/20 bg-ink px-4 py-6 text-paper lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brass/15 ring-1 ring-brass/40">
          <Logo size={24} className="text-brass-soft" />
        </div>
        <div>
          <div className="font-display text-xl font-semibold leading-none">DocuGuard</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">Compliance Intel</div>
        </div>
      </div>

      <nav className="mt-9 flex flex-1 flex-col gap-1">
        <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/35">Workspace</div>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              isActive ? 'bg-paper/[0.08] text-paper' : 'text-paper/60 hover:bg-paper/[0.05] hover:text-paper',
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brass" />}
                <Icon size={18} strokeWidth={1.8} className={isActive ? 'text-brass-soft' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-xl border border-paper/10 bg-paper/[0.04] p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">Frameworks</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['HIPAA', 'GDPR', 'SOC 2', 'PCI'].map((f) => (
            <span key={f} className="rounded-md bg-paper/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-paper/65">{f}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}

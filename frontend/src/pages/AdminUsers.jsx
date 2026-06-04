import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Users } from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import { Panel } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { listUsers, updateUserRole, setUserActive } from '../api/users';
import { dateShort } from '../lib/format';
import { cn } from '../lib/cn';

const ROLES = ['admin', 'reviewer', 'auditor'];

export default function AdminUsers() {
  const [users, setUsers] = useState(null);

  const load = () => listUsers().then(setUsers).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try { await updateUserRole(id, role); toast.success('Role updated'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const toggleActive = async (u) => {
    try { await setUserActive(u.id, !u.is_active); toast.success(u.is_active ? 'Deactivated' : 'Reactivated'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <>
      <PageHead eyebrow="Administration" title="User Management"
        sub="Assign roles and control access. Reviewers can act; auditors are read-only." />
      <Panel className="overflow-hidden">
        {!users ? <Spinner className="py-16" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Last login</th>
                  <th className="px-5 py-2.5 font-medium text-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line/70 hover:bg-paper">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink font-mono text-[11px] font-semibold text-paper">
                          {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium text-ink">{u.full_name}</div>
                          <div className="font-mono text-[11px] text-ink-faint">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink focus:border-brass focus:outline-none">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={u.is_active ? 'ok' : 'risk'} dot>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-[12px] text-ink-soft">{u.last_login ? dateShort(u.last_login) : '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => toggleActive(u)}
                        className={cn('relative h-6 w-11 rounded-full transition-colors', u.is_active ? 'bg-ok' : 'bg-paper-deep')}>
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', u.is_active ? 'left-[22px]' : 'left-0.5')} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

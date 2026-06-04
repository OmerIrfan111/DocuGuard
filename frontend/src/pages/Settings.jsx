import { useState } from 'react';
import { toast } from 'react-toastify';
import { KeyRound, BellRing } from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import { Panel, PanelHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../api/auth';
import { cn } from '../lib/cn';

export default function Settings() {
  const { user } = useAuth();
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dg_prefs')) || { approvals: true, uploads: true, rejections: true }; }
    catch { return { approvals: true, uploads: true, rejections: true }; }
  });

  const savePw = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.new_password !== pw.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await changePassword(pw.current_password, pw.new_password);
      toast.success('Password updated');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };

  const togglePref = (k) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next); localStorage.setItem('dg_prefs', JSON.stringify(next));
  };

  const field = 'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brass focus:outline-none';

  return (
    <>
      <PageHead eyebrow="Account" title="Settings" sub="Manage your profile, security, and notification preferences." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Identity" title="Profile" />
          <div className="space-y-4 p-5">
            <div>
              <label className="eyebrow mb-1.5 block">Full name</label>
              <input className={field} defaultValue={user?.full_name} disabled />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">Email</label>
              <input className={cn(field, 'text-ink-faint')} value={user?.email || ''} disabled />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">Role</label>
              <Badge tone="brass">{user?.role}</Badge>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Security" title="Change password" />
          <form className="space-y-4 p-5" onSubmit={savePw}>
            <input type="password" required placeholder="Current password" className={field}
              value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            <input type="password" required placeholder="New password (min 8 chars)" className={field}
              value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            <input type="password" required placeholder="Confirm new password" className={field}
              value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            <Button variant="brass" loading={saving} type="submit"><KeyRound size={15} /> Update password</Button>
          </form>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader eyebrow="Preferences" title="Notifications" />
          <div className="divide-y divide-line">
            {[['approvals', 'Document approvals'], ['rejections', 'Document rejections'], ['uploads', 'New uploads finished processing']].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-brass"><BellRing size={16} /></span>
                  <span className="text-sm font-medium text-ink">{label}</span>
                </div>
                <button onClick={() => togglePref(k)} className={cn('relative h-6 w-11 rounded-full transition-colors', prefs[k] ? 'bg-brass' : 'bg-paper-deep')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', prefs[k] ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
          <p className="px-5 pb-4 font-mono text-[11px] text-ink-faint">Preferences are stored locally in this browser.</p>
        </Panel>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, ListChecks, Lock } from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import { Panel, PanelHeader } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { listChecklists, createChecklist, deleteChecklist } from '../api/compliance';
import { cn } from '../lib/cn';

const DETECTION = ['keyword_required', 'keyword_forbidden', 'pattern', 'nlp_entity'];
const SEVERITY = ['critical', 'warning', 'info'];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
const field = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brass focus:outline-none';

const emptyRule = () => ({
  id: '', category: '', description: '', severity: 'warning',
  detection_type: 'keyword_required', keywords: '', pattern: '', entity_type: '', generic_fix: '',
});

export default function ChecklistBuilder() {
  const { user } = useAuth();
  const canCreate = ['admin', 'reviewer'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const [lists, setLists] = useState(null);
  const [name, setName] = useState('');
  const [rules, setRules] = useState([emptyRule()]);
  const [saving, setSaving] = useState(false);

  const load = () => listChecklists().then(setLists).catch(() => setLists([]));
  useEffect(() => { load(); }, []);

  const updateRule = (i, patch) => setRules((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!name.trim()) return toast.error('Name is required');
    const built = rules.filter((r) => r.id && r.description).map((r) => ({
      id: r.id, category: r.category || 'Custom', description: r.description,
      severity: r.severity, detection_type: r.detection_type, generic_fix: r.generic_fix || '',
      ...(r.detection_type === 'pattern' ? { pattern: r.pattern } : {}),
      ...(['keyword_required', 'keyword_forbidden'].includes(r.detection_type)
        ? { keywords: r.keywords.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
      ...(r.detection_type === 'nlp_entity' ? { entity_type: r.entity_type || 'PERSON' } : {}),
    }));
    if (!built.length) return toast.error('Add at least one complete rule (id + description)');
    setSaving(true);
    try {
      await createChecklist({ name, slug: slugify(name), version: '1.0', rules: built });
      toast.success('Checklist created');
      setName(''); setRules([emptyRule()]); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };

  const remove = async (slug) => {
    if (!confirm(`Delete checklist "${slug}"?`)) return;
    try { await deleteChecklist(slug); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <>
      <PageHead eyebrow="Configuration" title="Checklist Builder"
        sub="Built-in frameworks are read-only. Compose custom checklists from four detection types." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel className="h-fit">
          <PanelHeader eyebrow="Library" title="Checklists" />
          {!lists ? <Spinner className="py-10" /> : (
            <div className="divide-y divide-line">
              {lists.map((c) => (
                <div key={c.slug} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper text-brass"><ListChecks size={16} /></span>
                    <div>
                      <div className="text-sm font-medium text-ink">{c.name}</div>
                      <div className="font-mono text-[11px] text-ink-faint">{c.rule_count} rules</div>
                    </div>
                  </div>
                  {c.is_builtin ? <Badge tone="ink"><Lock size={11} /> Built-in</Badge>
                    : isAdmin ? <button onClick={() => remove(c.slug)} className="rounded-lg p-1.5 text-ink-faint hover:bg-risk-wash hover:text-risk"><Trash2 size={15} /></button>
                    : <Badge tone="brass">Custom</Badge>}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="New" title="Create custom checklist"
            action={canCreate && <Button variant="brass" size="sm" loading={saving} onClick={submit}>Save checklist</Button>} />
          {!canCreate ? (
            <div className="p-6 text-sm text-ink-soft">Auditors cannot create checklists. Ask an admin or reviewer.</div>
          ) : (
            <div className="space-y-5 p-5">
              <div>
                <label className="eyebrow mb-1.5 block">Checklist name</label>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Internal Vendor Review" />
                {name && <div className="mt-1 font-mono text-[11px] text-ink-faint">slug: {slugify(name)}</div>}
              </div>

              <div className="space-y-4">
                {rules.map((r, i) => (
                  <div key={i} className="rounded-xl border border-line bg-paper/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="eyebrow">Rule {i + 1}</span>
                      {rules.length > 1 && <button onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-risk"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className={field} placeholder="Rule ID (e.g. VR-001)" value={r.id} onChange={(e) => updateRule(i, { id: e.target.value })} />
                      <input className={field} placeholder="Category" value={r.category} onChange={(e) => updateRule(i, { category: e.target.value })} />
                      <select className={field} value={r.severity} onChange={(e) => updateRule(i, { severity: e.target.value })}>
                        {SEVERITY.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select className={field} value={r.detection_type} onChange={(e) => updateRule(i, { detection_type: e.target.value })}>
                        {DETECTION.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {r.detection_type === 'pattern' && (
                        <input className={cn(field, 'col-span-2 font-mono')} placeholder="Regex pattern" value={r.pattern} onChange={(e) => updateRule(i, { pattern: e.target.value })} />
                      )}
                      {['keyword_required', 'keyword_forbidden'].includes(r.detection_type) && (
                        <input className={cn(field, 'col-span-2')} placeholder="Keywords (comma separated)" value={r.keywords} onChange={(e) => updateRule(i, { keywords: e.target.value })} />
                      )}
                      {r.detection_type === 'nlp_entity' && (
                        <input className={cn(field, 'col-span-2 font-mono')} placeholder="Entity type (e.g. PERSON, ORG)" value={r.entity_type} onChange={(e) => updateRule(i, { entity_type: e.target.value })} />
                      )}
                      <input className={cn(field, 'col-span-2')} placeholder="Description" value={r.description} onChange={(e) => updateRule(i, { description: e.target.value })} />
                      <input className={cn(field, 'col-span-2')} placeholder="Generic fix suggestion" value={r.generic_fix} onChange={(e) => updateRule(i, { generic_fix: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={() => setRules((r) => [...r, emptyRule()])}><Plus size={15} /> Add rule</Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

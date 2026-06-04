import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Files, Clock, AlertOctagon, Flame, ArrowUpRight, FileText, Inbox,
} from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import StatCard from '../components/StatCard.jsx';
import { Panel } from '../components/ui/Card.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { getStats, listDocuments } from '../api/documents';
import { dateShort } from '../lib/format';
import { cn } from '../lib/cn';

const FILTERS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'pending', label: 'Pending', params: { approval: 'pending' } },
  { key: 'approved', label: 'Approved', params: { approval: 'approved' } },
  { key: 'rejected', label: 'Rejected', params: { approval: 'rejected' } },
  { key: 'high', label: 'High Risk', params: { risk: 'High' } },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filterKey = params.get('filter') || 'all';
  const page = Number(params.get('page') || 1);

  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getStats().then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const filter = FILTERS.find((f) => f.key === filterKey) || FILTERS[0];
    listDocuments({ ...filter.params, page, limit: 8 })
      .then(setData).catch(() => setData({ items: [], total: 0 })).finally(() => setLoading(false));
  }, [filterKey, page]);

  const setFilter = (key) => setParams({ filter: key });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Compliance Dashboard"
        sub="Monitor document intake, risk exposure, and the review queue across every framework."
        actions={<Button variant="brass" onClick={() => navigate('/upload')}><ArrowUpRight size={16} /> Upload documents</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Total Documents" value={stats?.total_documents ?? '—'} icon={Files} tone="ink" />
        <StatCard index={1} label="Pending Review" value={stats?.pending_review ?? '—'} icon={Clock} tone="warn" />
        <StatCard index={2} label="Critical Violations" value={stats?.critical_violations ?? '—'} icon={AlertOctagon} tone="risk" />
        <StatCard index={3} label="High Risk" value={stats?.high_risk ?? '—'} icon={Flame} tone="brass" />
      </div>

      <Panel className="mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                filterKey === f.key ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-deep')}>
              {f.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-ink-faint">
            {data ? `${data.total} document${data.total === 1 ? '' : 's'}` : ''}
          </span>
        </div>

        {loading ? (
          <Spinner className="py-16" label="Loading documents…" />
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Checklist</th>
                  <th className="px-3 py-2.5 font-medium">Risk</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Review</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((d, i) => (
                  <motion.tr
                    key={d.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/documents/${d.id}`)}
                    className="group cursor-pointer border-b border-line/70 transition-colors hover:bg-paper"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink-soft">
                          <FileText size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{d.original_name}</div>
                          <div className="font-mono text-[11px] uppercase text-ink-faint">{d.file_type} · {d.classification || 'unclassified'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5"><Badge tone="ink">{(d.checklist_id || '—').toUpperCase()}</Badge></td>
                    <td className="px-3 py-3.5"><RiskBadge level={d.risk_level} score={d.risk_score} /></td>
                    <td className="px-3 py-3.5"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-3.5"><StatusBadge approval={d.approval_status} /></td>
                    <td className="px-3 py-3.5 font-mono text-[12px] text-ink-soft">{dateShort(d.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <ArrowUpRight size={16} className="ml-auto text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brass" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Inbox} title="No documents here yet"
            hint="Upload a PDF, DOCX, or image to start the compliance pipeline."
            action={<Button variant="brass" onClick={() => navigate('/upload')}>Upload your first document</Button>} />
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="font-mono text-[12px] text-ink-faint">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1}
                onClick={() => setParams({ filter: filterKey, page: String(page - 1) })}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                onClick={() => setParams({ filter: filterKey, page: String(page + 1) })}>Next</Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

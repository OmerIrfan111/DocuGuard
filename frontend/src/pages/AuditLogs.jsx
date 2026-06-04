import { useEffect, useState } from 'react';
import { Download, ScrollText } from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import { Panel } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { listAuditLogs, exportAuditLogsBlob } from '../api/auditLogs';
import { dateTime } from '../lib/format';

const ACTION_TONE = {
  approve: 'ok', reject: 'risk', delete: 'risk', login: 'neutral', logout: 'neutral',
  upload: 'brass', download_report: 'ink', create_checklist: 'warn', register: 'neutral',
};

export default function AuditLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    listAuditLogs({ page, limit: 25, ...(action ? { action } : {}) })
      .then(setData).catch(() => setData({ items: [], total: 0 })).finally(() => setLoading(false));
  }, [action, page]);

  const exportCsv = async () => {
    const blob = await exportAuditLogsBlob(action ? { action } : {});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const actions = ['', 'login', 'logout', 'upload', 'approve', 'reject', 'delete', 'download_report', 'create_checklist'];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;

  return (
    <>
      <PageHead eyebrow="Accountability" title="Audit Trail"
        sub="Every action across the platform, immutably logged."
        actions={<Button variant="outline" onClick={exportCsv}><Download size={16} /> Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a || 'all'} onClick={() => { setAction(a); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${action === a ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-deep'}`}>
            {a ? a.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden">
        {loading ? <Spinner className="py-16" /> : !data?.items?.length ? (
          <EmptyState icon={ScrollText} title="No log entries" hint="Activity will appear here as users act on documents." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-5 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.id} className="border-b border-line/70 hover:bg-paper">
                    <td className="px-5 py-3 font-mono text-[12px] text-ink-soft">{dateTime(x.timestamp)}</td>
                    <td className="px-3 py-3 text-ink">{x.user_email || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-3"><Badge tone={ACTION_TONE[x.action] || 'neutral'}>{(x.action || '').replace('_', ' ')}</Badge></td>
                    <td className="px-3 py-3 text-ink-soft">{x.document_name || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-ink-faint">{x.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="font-mono text-[12px] text-ink-faint">Page {page} / {totalPages} · {data.total} entries</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

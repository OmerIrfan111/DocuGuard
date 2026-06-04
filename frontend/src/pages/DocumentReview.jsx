import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileWarning, ShieldCheck, ShieldAlert, ShieldX, Download, Check, X,
  RefreshCw, Sparkles, FileText, AlertTriangle, Info, Trash2,
} from 'lucide-react';
import { Panel } from '../components/ui/Card.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import RiskMeter from '../components/ui/RiskMeter.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentStatus } from '../hooks/useDocumentStatus';
import {
  getDocument, fetchDocumentBlob, approveDocument, rejectDocument, deleteDocument,
} from '../api/documents';
import { generateReport, downloadReport } from '../api/reports';
import { revalidate } from '../api/compliance';
import { pct } from '../lib/format';
import { cn } from '../lib/cn';

const SEV = {
  critical: { tone: 'risk', icon: ShieldX, label: 'Critical' },
  warning: { tone: 'warn', icon: ShieldAlert, label: 'Warning' },
  info: { tone: 'ink', icon: Info, label: 'Info' },
};

function blobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DocumentReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = ['admin', 'reviewer'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState('overview');
  const [blobUrl, setBlobUrl] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);

  const { status, isProcessing } = useDocumentStatus(id, doc?.status);

  const load = useCallback(() => getDocument(id).then(setDoc).catch(() => toast.error('Document not found')), [id]);
  useEffect(() => { load(); }, [load]);
  // Reload the full record when processing transitions to a terminal state.
  useEffect(() => { if (status === 'completed' || status === 'failed') load(); }, [status, load]);

  useEffect(() => {
    let revoked = false;
    if (id && doc && ['completed', 'validating'].includes(doc.status) !== undefined) {
      fetchDocumentBlob(id).then((b) => { if (!revoked) setBlobUrl(URL.createObjectURL(b)); }).catch(() => {});
    }
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doc?.id]);

  const violations = useMemo(() => {
    const order = { critical: 0, warning: 1, info: 2 };
    return [...(doc?.violations || [])].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }, [doc]);
  const counts = useMemo(() => violations.reduce((acc, v) => { acc[v.severity] = (acc[v.severity] || 0) + 1; return acc; }, {}), [violations]);

  const act = async (fn, okMsg) => {
    setBusy(okMsg); try { await fn(); toast.success(okMsg); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); } finally { setBusy(null); }
  };
  const onApprove = () => act(() => approveDocument(id), 'Document approved');
  const onReject = () => { if (!reason.trim()) return toast.error('A rejection reason is required'); act(() => rejectDocument(id, reason), 'Document rejected'); };
  const onRevalidate = () => act(() => revalidate(id), 'Re-validation started');
  const onDelete = async () => { if (!confirm('Delete this document permanently?')) return; await deleteDocument(id).then(() => { toast.success('Deleted'); navigate('/dashboard'); }).catch(() => toast.error('Delete failed')); };

  const onReport = async (format) => {
    setBusy(`report-${format}`);
    try {
      await generateReport(id, format);
      const blob = await downloadReport(id);
      blobDownload(blob, `audit_report_${id}.${format}`);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Report failed'); } finally { setBusy(null); }
  };

  if (!doc) return <Spinner className="py-24" label="Loading document…" />;

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        {isAdmin && (
          <Button size="sm" variant="ghost" className="text-risk" onClick={onDelete}><Trash2 size={15} /> Delete</Button>
        )}
      </div>

      {/* Status banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper"><FileText size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold text-ink">{doc.original_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase text-ink-faint">
            <span>{doc.file_type}</span><span>·</span><span>{doc.classification || 'unclassified'}</span>
            {typeof doc.confidence_score === 'number' && <><span>·</span><span>{pct(doc.confidence_score)} conf.</span></>}
          </div>
        </div>
        <StatusBadge status={doc.status} />
        <StatusBadge approval={doc.approval_status} />
        <RiskBadge level={doc.risk_level} score={doc.risk_score} />
      </motion.div>

      {isProcessing ? (
        <Panel className="py-20"><Spinner label={`Pipeline running — ${status}…`} /></Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Viewer */}
          <Panel className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="eyebrow">Source document</span>
              {blobUrl && <a href={blobUrl} download={doc.original_name} className="inline-flex items-center gap-1 text-[12px] text-brass hover:underline"><Download size={13} /> Original</a>}
            </div>
            <div className="min-h-[520px] flex-1 bg-paper-deep/40">
              {!blobUrl ? <Spinner className="py-24" label="Loading preview…" />
                : doc.file_type === 'pdf' ? <iframe title="document" src={blobUrl} className="h-[640px] w-full" />
                : ['png', 'jpg', 'jpeg'].includes(doc.file_type) ? <div className="flex justify-center p-4"><img src={blobUrl} alt={doc.original_name} className="max-h-[620px] rounded-lg shadow-card" /></div>
                : <EmptyState icon={FileText} title="Preview not available for DOCX" hint="Download the original to view it, or inspect the detected violations on the right." action={<a href={blobUrl} download={doc.original_name}><Button variant="outline" size="sm"><Download size={15} /> Download original</Button></a>} />}
            </div>
          </Panel>

          {/* Inspector */}
          <Panel className="overflow-hidden">
            <Tabs value={tab} onChange={setTab} tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'violations', label: 'Violations', count: violations.length },
              { value: 'actions', label: 'Actions' },
            ]} />

            <div className="p-5">
              {tab === 'overview' && <Overview doc={doc} counts={counts} />}
              {tab === 'violations' && <Violations violations={violations} />}
              {tab === 'actions' && (
                <Actions doc={doc} canReview={canReview} busy={busy} reason={reason} setReason={setReason}
                  onApprove={onApprove} onReject={onReject} onReport={onReport} onRevalidate={onRevalidate} />
              )}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

function Overview({ doc, counts }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper/50 p-4">
        <div>
          <div className="eyebrow mb-1">Classification</div>
          <div className="font-display text-lg font-semibold text-ink">{doc.classification || 'Unknown'}</div>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-paper-deep">
            <div className="h-full rounded-full bg-brass" style={{ width: pct(doc.confidence_score) }} />
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-faint">{pct(doc.confidence_score)} confidence</div>
        </div>
        <RiskMeter score={doc.risk_score || 0} level={doc.risk_level || 'Low'} size={150} />
      </div>

      <div className="flex gap-3">
        {['critical', 'warning', 'info'].map((s) => (
          <div key={s} className="flex-1 rounded-xl border border-line bg-surface p-3 text-center">
            <div className={cn('stat-num text-2xl font-semibold', s === 'critical' ? 'text-risk' : s === 'warning' ? 'text-warn' : 'text-ink')}>{counts[s] || 0}</div>
            <div className="eyebrow mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles size={13} className="text-brass" /> AI Summary</div>
        <p className="text-sm leading-relaxed text-ink-soft">{doc.summary || 'No summary available (Bedrock unavailable or not configured).'}</p>
      </div>

      {doc.key_clauses?.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Key clauses</div>
          <ul className="space-y-1.5">
            {doc.key_clauses.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />{c}</li>
            ))}
          </ul>
        </div>
      )}

      {doc.document_purpose && (
        <div className="rounded-xl border border-line bg-paper/50 p-3.5">
          <div className="eyebrow mb-1">Purpose</div>
          <p className="text-sm text-ink-soft">{doc.document_purpose}</p>
        </div>
      )}
    </div>
  );
}

function Violations({ violations }) {
  if (!violations.length) {
    return <EmptyState icon={ShieldCheck} title="No violations detected" hint="This document satisfied every rule in the selected checklist." />;
  }
  return (
    <div className="space-y-3">
      {violations.map((v, i) => {
        const meta = SEV[v.severity] || SEV.info;
        const Icon = meta.icon;
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="data text-[12px] font-semibold text-ink">{v.rule_id}</span>
              <Badge tone={meta.tone} dot>{meta.label}</Badge>
            </div>
            <p className="mt-1.5 text-sm font-medium text-ink">{v.description}</p>
            {v.matched_text ? (
              <div className="mt-2 rounded-lg bg-risk-wash/60 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-risk/80">Matched</span>
                <div className="data mt-0.5 break-all text-[13px] text-risk underline decoration-risk/40 decoration-2 underline-offset-2">{v.matched_text}</div>
                {v.offset_start != null && <div className="mt-0.5 font-mono text-[10px] text-ink-faint">offset {v.offset_start}–{v.offset_end}</div>}
              </div>
            ) : (
              <div className="mt-2 rounded-lg bg-warn-wash/60 px-3 py-1.5 font-mono text-[11px] text-warn">Required content absent</div>
            )}
            {v.ai_fix_suggestion && (
              <div className="mt-2.5 flex gap-2 rounded-lg border border-brass/25 bg-brass-wash/40 px-3 py-2">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-brass" />
                <div><span className="font-mono text-[10px] uppercase tracking-wide text-brass">AI fix</span>
                  <p className="text-[13px] leading-snug text-ink-soft">{v.ai_fix_suggestion}</p></div>
              </div>
            )}
            {v.generic_fix && !v.ai_fix_suggestion && <p className="mt-2 text-[13px] text-ink-soft">{v.generic_fix}</p>}
          </motion.div>
        );
      })}
    </div>
  );
}

function Actions({ doc, canReview, busy, reason, setReason, onApprove, onReject, onReport, onRevalidate }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-paper/50 p-4">
        <div className="eyebrow mb-2">Current decision</div>
        <StatusBadge approval={doc.approval_status} />
        {doc.rejection_reason && <p className="mt-2 text-sm text-risk">Reason: {doc.rejection_reason}</p>}
        {doc.approved_by && <p className="mt-1 font-mono text-[11px] text-ink-faint">by {doc.approved_by}</p>}
      </div>

      {canReview ? (
        <>
          <div className="flex gap-2">
            <Button variant="ok" className="flex-1" loading={busy === 'Document approved'} onClick={onApprove}><Check size={16} /> Approve</Button>
            <Button variant="danger" className="flex-1" loading={busy === 'Document rejected'} onClick={onReject}><X size={16} /> Reject</Button>
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Rejection reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Required when rejecting — describe what must be fixed…"
              className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brass focus:outline-none" />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-line bg-paper/50 p-4 text-sm text-ink-soft">
          Your role has read-only access. Reviewers and admins can approve or reject.
        </div>
      )}

      <div className="border-t border-line pt-5">
        <div className="eyebrow mb-2.5">Audit report</div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" loading={busy === 'report-pdf'} onClick={() => onReport('pdf')}><Download size={15} /> PDF</Button>
          <Button variant="outline" className="flex-1" loading={busy === 'report-docx'} onClick={() => onReport('docx')}><Download size={15} /> DOCX</Button>
        </div>
      </div>

      {canReview && (
        <Button variant="ghost" className="w-full" loading={busy === 'Re-validation started'} onClick={onRevalidate}>
          <RefreshCw size={15} /> Re-run compliance check
        </Button>
      )}
    </div>
  );
}

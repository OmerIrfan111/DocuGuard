import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File as FileIcon, X, ShieldCheck } from 'lucide-react';
import { PageHead } from '../components/layout/AppLayout.jsx';
import { Panel } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import { listChecklists } from '../api/compliance';
import { uploadDocuments } from '../api/documents';
import { cn } from '../lib/cn';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};
const MAX = 50 * 1024 * 1024;
const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export default function Upload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [checklist, setChecklist] = useState('hipaa');
  const [progress, setProgress] = useState(null);

  useEffect(() => { listChecklists().then(setChecklists).catch(() => {}); }, []);

  const onDrop = (accepted, rejected) => {
    if (rejected?.length) toast.error(`${rejected.length} file(s) rejected (type or size).`);
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, maxSize: MAX, maxFiles: 10 });

  const remove = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!files.length) return;
    setProgress(0);
    try {
      const res = await uploadDocuments(files, checklist, setProgress);
      toast.success(`${res.count} document(s) uploaded — processing started.`);
      navigate(`/documents/${res.document_ids[0]}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
      setProgress(null);
    }
  };

  return (
    <>
      <PageHead eyebrow="Intake" title="Upload Documents"
        sub="Drop files to extract, classify, and validate them against a compliance framework." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all',
              isDragActive ? 'border-brass bg-brass-wash/50' : 'border-line bg-paper/50 hover:border-brass/60 hover:bg-paper',
            )}
          >
            <input {...getInputProps()} />
            <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-paper shadow-card">
              <UploadCloud size={26} strokeWidth={1.6} />
            </motion.div>
            <p className="font-display text-lg font-semibold text-ink">
              {isDragActive ? 'Release to add files' : 'Drag & drop files here'}
            </p>
            <p className="mt-1 text-sm text-ink-soft">or click to browse — PDF, DOCX, PNG, JPG · max 50 MB · up to 10 files</p>
          </div>

          <AnimatePresence>
            {files.map((f, i) => (
              <motion.div key={`${f.name}-${i}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper text-brass"><FileIcon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{f.name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">{fmtSize(f.size)}</div>
                </div>
                <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep hover:text-risk"><X size={16} /></button>
              </motion.div>
            ))}
          </AnimatePresence>

          {progress !== null && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between font-mono text-[11px] text-ink-soft"><span>Uploading…</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-paper-deep">
                <motion.div className="h-full rounded-full bg-brass" animate={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <div className="eyebrow mb-3">Compliance framework</div>
            <div className="space-y-2">
              {checklists.map((c) => (
                <label key={c.slug}
                  className={cn('flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-3 transition-all',
                    checklist === c.slug ? 'border-brass bg-brass-wash/40 shadow-seal' : 'border-line hover:bg-paper')}>
                  <span className="flex items-center gap-2.5">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', checklist === c.slug ? 'bg-brass text-white' : 'bg-paper-deep text-ink-soft')}>
                      <ShieldCheck size={14} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{c.name}</span>
                      <span className="font-mono text-[10px] uppercase text-ink-faint">{c.rule_count} rules · v{c.version}</span>
                    </span>
                  </span>
                  <input type="radio" name="checklist" className="sr-only" checked={checklist === c.slug} onChange={() => setChecklist(c.slug)} />
                  <span className={cn('h-3.5 w-3.5 rounded-full border-2', checklist === c.slug ? 'border-brass bg-brass' : 'border-line')} />
                </label>
              ))}
            </div>
          </Panel>

          <Button variant="brass" size="lg" className="w-full" disabled={!files.length || progress !== null} loading={progress !== null} onClick={submit}>
            Start compliance analysis
          </Button>
        </div>
      </div>
    </>
  );
}

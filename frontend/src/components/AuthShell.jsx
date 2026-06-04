import Logo from './ui/Logo.jsx';

// Split auth layout: editorial brand panel (left) + form (right).
export default function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'radial-gradient(700px 360px at 80% 0%, rgba(169,119,43,0.20), transparent 60%), radial-gradient(600px 400px at 0% 100%, rgba(196,154,80,0.12), transparent 55%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/15 ring-1 ring-brass/40"><Logo size={26} className="text-brass-soft" /></span>
          <span className="font-display text-2xl font-semibold">DocuGuard</span>
        </div>
        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-brass-soft/80">Document Intelligence</div>
          <h2 className="mt-3 max-w-md font-display text-4xl font-semibold leading-tight">
            Compliance, read between every line.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/65">
            Ingest, classify, and validate documents against HIPAA, GDPR, SOC 2, and PCI-DSS —
            with AI-drafted fixes and audit-ready reports.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['HIPAA', 'GDPR', 'SOC 2', 'PCI-DSS'].map((f) => (
              <span key={f} className="rounded-lg border border-paper/15 bg-paper/[0.05] px-2.5 py-1 font-mono text-[11px] text-paper/70">{f}</span>
            ))}
          </div>
        </div>
        <div className="relative font-mono text-[11px] text-paper/40">Encrypted · Role-based · Audit-logged</div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}

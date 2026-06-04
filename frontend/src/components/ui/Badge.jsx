import { cn } from '../../lib/cn';

export default function Badge({ children, tone = 'neutral', className, dot }) {
  const tones = {
    neutral: 'bg-paper-deep text-ink-soft',
    ink: 'bg-ink/[0.06] text-ink',
    brass: 'bg-brass-wash text-brass',
    ok: 'bg-ok-wash text-ok',
    warn: 'bg-warn-wash text-warn',
    risk: 'bg-risk-wash text-risk',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium',
      tones[tone], className,
    )}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

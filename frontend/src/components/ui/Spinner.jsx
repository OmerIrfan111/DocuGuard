import { cn } from '../../lib/cn';

export default function Spinner({ className, label }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 text-ink-faint', className)}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brass border-t-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

import { cn } from '../../lib/cn';

export function Panel({ className, children, ...props }) {
  return (
    <div className={cn('panel', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({ title, eyebrow, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      </div>
      {action}
    </div>
  );
}

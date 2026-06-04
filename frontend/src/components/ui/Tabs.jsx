import { cn } from '../../lib/cn';

export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line px-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {typeof t.count === 'number' && (
                <span className={cn('data rounded-full px-1.5 text-[11px]',
                  active ? 'bg-brass-wash text-brass' : 'bg-paper-deep text-ink-faint')}>
                  {t.count}
                </span>
              )}
            </span>
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brass" />}
          </button>
        );
      })}
    </div>
  );
}

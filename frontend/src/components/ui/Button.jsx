import { cn } from '../../lib/cn';

const VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink-soft shadow-card',
  brass: 'bg-brass text-white hover:bg-[#956528] shadow-seal',
  outline: 'border border-line bg-surface text-ink hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-paper-deep',
  danger: 'bg-risk text-white hover:bg-[#8a1224] shadow-card',
  ok: 'bg-ok text-white hover:bg-[#15683a] shadow-card',
};
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'h-9 w-9',
};

export default function Button({
  as: Tag = 'button', variant = 'primary', size = 'md', className, children, loading, ...props
}) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
        VARIANTS[variant], SIZES[size], className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </Tag>
  );
}

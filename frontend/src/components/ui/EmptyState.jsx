export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-paper text-brass">
          <Icon size={22} strokeWidth={1.6} />
        </div>
      )}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

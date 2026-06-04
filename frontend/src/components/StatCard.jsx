import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

export default function StatCard({ label, value, icon: Icon, tone = 'ink', index = 0, hint }) {
  const tones = {
    ink: 'text-ink', brass: 'text-brass', risk: 'text-risk', warn: 'text-warn', ok: 'text-ok',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="panel group relative overflow-hidden p-5"
    >
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-paper-deep/60 transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="eyebrow">{label}</div>
          <div className={cn('stat-num mt-2 text-4xl font-semibold', tones[tone])}>{value}</div>
          {hint && <div className="mt-1 text-[12px] text-ink-faint">{hint}</div>}
        </div>
        {Icon && (
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper', tones[tone])}>
            <Icon size={18} strokeWidth={1.8} />
          </span>
        )}
      </div>
    </motion.div>
  );
}

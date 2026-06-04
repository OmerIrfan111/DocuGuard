import { motion } from 'framer-motion';

const COLOR = { Low: '#1A7F46', Medium: '#B0701B', High: '#A8182C' };

// Semicircular gauge (0-100) with an animated needle — the document's risk reading.
export default function RiskMeter({ score = 0, level = 'Low', size = 180 }) {
  const s = Math.max(0, Math.min(100, score));
  const color = COLOR[level] || '#46566F';
  const r = 70;
  const cx = 100;
  const cy = 100;
  const angle = -180 + (s / 100) * 180; // -180deg (left) .. 0deg (right)
  const arc = (from, to, stroke, width) => {
    const a0 = (from * Math.PI) / 180;
    const a1 = (to * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = to - from > 180 ? 1 : 0;
    return <path d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
  };
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 116" width={size} height={size * 0.58}>
        {arc(-180, -120, '#E3F1E8', 12)}
        {arc(-120, -60, '#F7EAD2', 12)}
        {arc(-60, 0, '#F5DEE0', 12)}
        <motion.line
          x1={cx} y1={cy} x2={cx + (r - 10) * Math.cos((angle * Math.PI) / 180)}
          y2={cy + (r - 10) * Math.sin((angle * Math.PI) / 180)}
          stroke={color} strokeWidth={3} strokeLinecap="round"
          initial={{ x2: cx - (r - 10), y2: cy }}
          animate={{ x2: cx + (r - 10) * Math.cos((angle * Math.PI) / 180), y2: cy + (r - 10) * Math.sin((angle * Math.PI) / 180) }}
          transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
      </svg>
      <div className="-mt-3 text-center">
        <div className="stat-num text-3xl font-semibold" style={{ color }}>{s}</div>
        <div className="eyebrow">{level} risk</div>
      </div>
    </div>
  );
}

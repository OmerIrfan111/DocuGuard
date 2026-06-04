import Badge from './Badge';

const MAP = { Low: 'ok', Medium: 'warn', High: 'risk' };

export default function RiskBadge({ level, score }) {
  if (!level) return <Badge tone="neutral">Unscored</Badge>;
  return (
    <Badge tone={MAP[level] || 'neutral'} dot>
      {level}
      {typeof score === 'number' && <span className="data ml-1 opacity-70">{score}</span>}
    </Badge>
  );
}

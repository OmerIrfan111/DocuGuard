import Badge from './Badge';

const STATUS = {
  pending: ['neutral', 'Pending'],
  extracting: ['brass', 'Extracting'],
  classifying: ['brass', 'Classifying'],
  validating: ['brass', 'Validating'],
  completed: ['ink', 'Completed'],
  failed: ['risk', 'Failed'],
};
const APPROVAL = {
  pending: ['warn', 'Awaiting review'],
  approved: ['ok', 'Approved'],
  rejected: ['risk', 'Rejected'],
};

export default function StatusBadge({ status, approval }) {
  if (approval) {
    const [tone, label] = APPROVAL[approval] || ['neutral', approval];
    return <Badge tone={tone} dot>{label}</Badge>;
  }
  const [tone, label] = STATUS[status] || ['neutral', status || '—'];
  const animating = ['extracting', 'classifying', 'validating'].includes(status);
  return (
    <Badge tone={tone}>
      {animating && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </Badge>
  );
}

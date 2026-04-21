import StatusBadge from '@/components/ui/StatusBadge';

export default function Badge({ tone = 'info', children, compact = false }) {
  return <StatusBadge tone={tone} status={children} compact={compact} />;
}

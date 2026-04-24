import { Badge } from '@/components/ui/badge';
import type { DraftStatus } from './types';

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  analyzing: {
    label: 'Analyzing',
    variant: 'outline',
    className: 'border-blue-500/40 text-blue-400',
  },
  needs_clarification: {
    label: 'Needs Clarification',
    variant: 'outline',
    className: 'border-amber-500/40 text-amber-400',
  },
  ready_to_approve: {
    label: 'Ready to Approve',
    variant: 'outline',
    className: 'border-emerald-500/40 text-emerald-400',
  },
  approved: {
    label: 'Approved',
    variant: 'default',
    className: 'bg-emerald-600 text-white',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
  },
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

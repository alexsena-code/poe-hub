'use client';

// Clickable brief row card — shows rank, urgency badge, status badge,
// template label, title, titleEn, effort and score.
// Click expands the detail panel (controlled by parent via onToggleExpand).

import { ContentBrief } from './types';
import { URGENCY_VARIANTS, EFFORT_CLASSES, STATUS_VARIANTS, TEMPLATE_LABELS } from './constants';
import { StatusBadge } from '@/components/ui/status-badge';

interface BriefCardProps {
  brief: ContentBrief;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function BriefCard({ brief: b, expanded, onToggleExpand }: BriefCardProps) {
  return (
    <div
      className="p-4 cursor-pointer hover:bg-surface-hover transition-colors"
      onClick={onToggleExpand}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">#{b.rank}</span>
            <StatusBadge variant={URGENCY_VARIANTS[b.urgency] ?? 'neutral'}>
              {b.urgency}
            </StatusBadge>
            <StatusBadge variant={STATUS_VARIANTS[b.status] ?? 'neutral'}>
              {b.status}
            </StatusBadge>
            <span className="text-[10px] text-muted-foreground">
              {TEMPLATE_LABELS[b.templateType] || b.templateType}
            </span>
          </div>
          <h3 className="text-sm font-medium text-foreground truncate">{b.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.titleEn}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Effort</div>
            <div className={`text-sm font-bold ${EFFORT_CLASSES[b.effort] ?? 'text-muted-foreground'}`}>
              {b.effort}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="text-sm font-bold text-foreground">{b.score}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

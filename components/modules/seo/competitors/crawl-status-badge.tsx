'use client';

// CrawlStatusBadge — coloured pill for crawl run status.
// running = amber (pulsing), completed = green, failed = red.

import type { CrawlRunStatus } from './types';

interface CrawlStatusBadgeProps {
  status: CrawlRunStatus;
}

const STATUS_CONFIG: Record<CrawlRunStatus, { label: string; className: string }> = {
  running: {
    label: 'rodando',
    className: 'bg-amber-500/15 text-amber-400 animate-pulse',
  },
  completed: {
    label: 'concluído',
    className: 'bg-emerald-500/15 text-emerald-400',
  },
  failed: {
    label: 'falhou',
    className: 'bg-red-500/15 text-red-400',
  },
};

export function CrawlStatusBadge({ status }: CrawlStatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

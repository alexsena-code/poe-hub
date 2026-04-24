'use client';

import { PipelineState } from './types';

const STATUS_STYLES: Record<PipelineState['status'], string> = {
  idle: 'bg-foreground/5 text-muted-foreground',
  running: 'bg-blue-500/10 text-blue-400 animate-pulse',
  done: 'bg-green-500/10 text-green-400',
  error: 'bg-red-500/10 text-red-400',
};

export function PipelineStatusBadge({ status }: { status: PipelineState['status'] }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

'use client';

// GapsPanel — shows missing entities + missing headings from ContentScorer response.
// Two-column layout on desktop, stacked on mobile.
// "Missing headings" = H2s shared by 2+ top-10 competitors not found in the draft.
// "Missing entities" = PoE entities ranked pages mention that the draft omits.

import type { ContentScore } from './types';

interface GapsPanelProps {
  score: ContentScore;
}

function GapList({ title, items, emptyMsg }: { title: string; items: string[]; emptyMsg: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-400">{emptyMsg}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-foreground">
              <span className="text-red-400 shrink-0 mt-0.5">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GapsPanel({ score }: GapsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">Content Gaps</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GapList
          title={`Missing Headings (${score.missingHeadings.length})`}
          items={score.missingHeadings}
          emptyMsg="No missing headings — great structure"
        />
        <GapList
          title={`Missing Entities (${score.missingEntities.length})`}
          items={score.missingEntities}
          emptyMsg="No missing entities — good coverage"
        />
      </div>
    </div>
  );
}

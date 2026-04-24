'use client';

// ContentScoreCard — displays the 0-100 content score from POST /api/engine/seo/score.
// Color tiers: green ≥70 (strong match), yellow 40-69 (needs work), red <40 (poor match).
// Includes bar visual + raw centroid similarity for debugging.

import type { ContentScore } from './types';

interface ContentScoreCardProps {
  score: ContentScore;
}

function scoreColor(n: number): { bg: string; text: string; bar: string } {
  if (n >= 70) return { bg: 'bg-emerald-950/30', text: 'text-emerald-400', bar: 'bg-emerald-500' };
  if (n >= 40) return { bg: 'bg-amber-950/30', text: 'text-amber-400', bar: 'bg-amber-500' };
  return { bg: 'bg-red-950/30', text: 'text-red-400', bar: 'bg-red-500' };
}

function scoreTier(n: number): string {
  if (n >= 70) return 'Strong';
  if (n >= 40) return 'Needs Work';
  return 'Poor Match';
}

export function ContentScoreCard({ score }: ContentScoreCardProps) {
  const colors = scoreColor(score.contentScore);

  return (
    <div className={`rounded-lg border border-border p-5 space-y-4 ${colors.bg}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">Content Score</div>

      {/* Score number + tier */}
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${colors.text}`}>
          {score.contentScore}
        </span>
        <span className="text-lg text-muted-foreground mb-1">/ 100</span>
        <span className={`ml-auto text-sm font-medium ${colors.text}`}>
          {scoreTier(score.contentScore)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${score.contentScore}%` }}
        />
      </div>

      {/* Debug: raw cosine similarity */}
      <div className="flex gap-6 text-xs text-muted-foreground pt-1">
        <span>
          Centroid similarity:{' '}
          <span className="font-mono text-foreground">{score.centroidSimilarity.toFixed(3)}</span>
        </span>
        <span>
          Analysis age:{' '}
          <span className="font-mono text-foreground">{score.analysisStaleDays}d</span>
        </span>
        <span>
          Captured:{' '}
          <span className="font-mono text-foreground">
            {new Date(score.analysisCapturedAt).toLocaleDateString('pt-BR')}
          </span>
        </span>
      </div>
    </div>
  );
}

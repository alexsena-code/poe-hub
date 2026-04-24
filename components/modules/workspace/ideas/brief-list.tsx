'use client';

// Renders the list of briefs: loading/empty states + per-brief card +
// collapsible expanded-detail panel. Owns the local "expanded" state so
// at most one brief is open at a time.

import { useState } from 'react';
import { ContentBrief } from './types';
import { IDEAS_API } from './constants';
import { BriefCard } from './brief-card';
import { BriefExpandedDetail } from './brief-expanded-detail';

interface BriefListProps {
  briefs: ContentBrief[];
  loading: boolean;
  generatingContent: number | null;
  msg: string | null;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onToggleDataSource: (id: number, key: string) => Promise<void>;
  onGenerateContent: (id: number) => Promise<void>;
  onExportContent: (id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') => void;
  onDeleteGeneratedPost: (id: number) => Promise<void>;
  onBriefUpdate: (updated: ContentBrief) => void;
  onSetMsg: (msg: string | null) => void;
  onRefresh: () => void;
}

export function BriefList({
  briefs,
  loading,
  generatingContent,
  msg,
  onUpdateStatus,
  onToggleDataSource,
  onGenerateContent,
  onExportContent,
  onDeleteGeneratedPost,
  onBriefUpdate,
  onSetMsg,
  onRefresh,
}: BriefListProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function handleDeleteBrief(id: number) {
    const brief = briefs.find(b => b.id === id);
    if (!brief) return;
    if (!confirm(`Delete idea #${id} "${brief.title}"? This cannot be undone.`)) return;
    fetch(`${IDEAS_API}/ideation/briefs/${id}`, { method: 'DELETE' })
      .then(() => { onSetMsg(`Deleted #${id}`); onRefresh(); })
      .catch(() => onSetMsg('Failed to delete'));
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>;
  }

  if (briefs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground text-sm mb-3">No content briefs yet.</p>
        <p className="text-muted-foreground text-xs">Click &quot;Generate Ideas&quot; to create AI-powered content suggestions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {briefs.map(b => (
        <div key={b.id} className="bg-surface border border-border rounded-lg overflow-hidden">
          <BriefCard
            brief={b}
            expanded={expanded === b.id}
            onToggleExpand={() => setExpanded(expanded === b.id ? null : b.id)}
          />
          {expanded === b.id && (
            <BriefExpandedDetail
              brief={b}
              generatingContent={generatingContent}
              msg={msg}
              onUpdateStatus={onUpdateStatus}
              onToggleDataSource={onToggleDataSource}
              onGenerateContent={onGenerateContent}
              onExportContent={onExportContent}
              onDeleteGeneratedPost={onDeleteGeneratedPost}
              onDeleteBrief={handleDeleteBrief}
              onBriefUpdate={onBriefUpdate}
            />
          )}
        </div>
      ))}
    </div>
  );
}

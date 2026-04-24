'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

// Kept in sync with SlangCandidate in slang page.tsx
export type SlangStatus = 'pending' | 'approved' | 'rejected';
export type SlangCategory = 'crafting' | 'trade' | 'combat' | 'mapping' | 'builds' | 'general';

export interface SlangCandidate {
  id: number;
  term: string;
  definition: string | null;
  contextSnippet: string | null;
  source: string;
  category: string | null;
  usageExamples: string[];
  status: SlangStatus;
  reviewerNotes: string | null;
}

export const CATEGORIES: SlangCategory[] = [
  'crafting',
  'trade',
  'combat',
  'mapping',
  'builds',
  'general',
];

function StatusDot({ status }: { status: SlangStatus }) {
  const colors: Record<SlangStatus, string> = {
    pending: 'bg-amber-400',
    approved: 'bg-emerald-400',
    rejected: 'bg-red-400',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

function SourceBadge({ source }: { source: string }) {
  const cls = source.startsWith('youtube')
    ? 'bg-red-900/30 text-red-300'
    : source === 'reddit'
      ? 'bg-amber-900/30 text-amber-300'
      : source === 'sidia'
        ? 'bg-blue-900/30 text-blue-300'
        : 'bg-surface text-muted-foreground';
  const label = source.startsWith('youtube') ? 'YT' : source;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

interface SlangCardProps {
  slang: SlangCandidate;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSave: (id: number, data: Partial<SlangCandidate>) => void;
}

export function SlangCard({
  slang,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  onSave,
}: SlangCardProps) {
  const [editing, setEditing] = useState(false);
  const [editDef, setEditDef] = useState(slang.definition || '');
  const [editCategory, setEditCategory] = useState(slang.category || 'general');
  const [editExamples, setEditExamples] = useState((slang.usageExamples || []).join('\n'));

  const borderColor: Record<SlangStatus, string> = {
    pending: selected ? 'border-primary' : 'border-border',
    approved: 'border-emerald-800',
    rejected: 'border-red-900',
  };

  const bgColor: Record<SlangStatus, string> = {
    pending: selected ? 'bg-primary/5' : 'bg-surface',
    approved: 'bg-emerald-950/30',
    rejected: 'bg-red-950/20',
  };

  function handleSave() {
    onSave(slang.id, {
      definition: editDef,
      category: editCategory as SlangCategory,
      usageExamples: editExamples.split('\n').filter((e) => e.trim()),
    });
    setEditing(false);
  }

  function handleCancel() {
    setEditDef(slang.definition || '');
    setEditCategory(slang.category || 'general');
    setEditExamples((slang.usageExamples || []).join('\n'));
    setEditing(false);
  }

  return (
    <div
      className={`rounded-lg border p-4 ${borderColor[slang.status]} ${bgColor[slang.status]} transition-colors`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Checkbox only for pending — selection only makes sense before review */}
          {slang.status === 'pending' && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(slang.id)}
              aria-label={`Select "${slang.term}"`}
            />
          )}
          <StatusDot status={slang.status} />
          <span className="font-mono font-bold text-foreground">&quot;{slang.term}&quot;</span>
        </div>
        <div className="flex items-center gap-1.5">
          {slang.source && <SourceBadge source={slang.source} />}
          <span className="text-xs px-2 py-0.5 rounded bg-foreground/10 text-muted-foreground">
            {slang.category}
          </span>
        </div>
      </div>

      {editing ? (
        /* Edit mode */
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Definition</label>
            <textarea
              value={editDef}
              onChange={(e) => setEditDef(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Examples (one per line)
            </label>
            <textarea
              value={editExamples}
              onChange={(e) => setEditExamples(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-md text-sm bg-surface-hover hover:bg-border text-muted-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* View mode */
        <>
          <p className="text-sm text-foreground/80 mb-2">{slang.definition}</p>

          {slang.contextSnippet && (
            <p className="text-xs text-muted-foreground italic mb-2">
              Context: &quot;{slang.contextSnippet}&quot;
            </p>
          )}

          <p className="text-xs text-muted-foreground mb-2">Source: {slang.source}</p>

          {slang.usageExamples && slang.usageExamples.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Examples:</p>
              <ul className="list-disc list-inside text-xs text-foreground/70 space-y-0.5">
                {slang.usageExamples.map((ex, i) => (
                  <li key={i} className="font-mono">
                    &quot;{ex}&quot;
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Individual actions — preserved from original */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
            {slang.status !== 'approved' && (
              <button
                onClick={() => onApprove(slang.id)}
                className="px-3 py-1.5 rounded-md text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Approve
              </button>
            )}
            {slang.status !== 'rejected' && (
              <button
                onClick={() => onReject(slang.id)}
                className="px-3 py-1.5 rounded-md text-xs bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Reject
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-md text-xs bg-surface-hover hover:bg-border text-muted-foreground transition-colors"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

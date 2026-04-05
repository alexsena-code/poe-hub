'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type SlangStatus = 'pending' | 'approved' | 'rejected';
type SlangCategory = 'crafting' | 'trade' | 'combat' | 'mapping' | 'builds' | 'general';

interface SlangCandidate {
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

const CATEGORIES: SlangCategory[] = ['crafting', 'trade', 'combat', 'mapping', 'builds', 'general'];
const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'] as const;

function StatusDot({ status }: { status: SlangStatus }) {
  const colors: Record<SlangStatus, string> = {
    pending: 'bg-amber-400',
    approved: 'bg-emerald-400',
    rejected: 'bg-red-400',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

function SlangCard({
  slang,
  onApprove,
  onReject,
  onSave,
}: {
  slang: SlangCandidate;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSave: (id: number, data: Record<string, any>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editDef, setEditDef] = useState(slang.definition || '');
  const [editCategory, setEditCategory] = useState(slang.category || 'general');
  const [editExamples, setEditExamples] = useState((slang.usageExamples || []).join('\n'));

  const borderColor: Record<SlangStatus, string> = {
    pending: 'border-border',
    approved: 'border-emerald-800',
    rejected: 'border-red-900',
  };

  const bgColor: Record<SlangStatus, string> = {
    pending: 'bg-surface',
    approved: 'bg-emerald-950/30',
    rejected: 'bg-red-950/20',
  };

  function handleSave() {
    onSave(slang.id, {
      definition: editDef,
      category: editCategory,
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
          <StatusDot status={slang.status} />
          <span className="font-mono font-bold text-foreground">
            &quot;{slang.term}&quot;
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {slang.source && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${slang.source.startsWith('youtube') ? 'bg-red-900/30 text-red-300' : slang.source === 'reddit' ? 'bg-amber-900/30 text-amber-300' : 'bg-surface text-muted-foreground'}`}>
              {slang.source.startsWith('youtube') ? 'YT' : slang.source}
            </span>
          )}
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
              onChange={(e) => setEditCategory(e.target.value as SlangCategory)}
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

          {/* Actions */}
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

export default function SlangCuration() {
  const [candidates, setCandidates] = useState<SlangCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | SlangStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SlangCategory>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      params.set('limit', '500');
      const res = await fetch(`${API_URL}/slang?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCandidates(data.items || []);
    } catch {
      // API not available — leave empty
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  async function handleExtract() {
    setExtracting(true);
    try {
      await fetch(`${API_URL}/slang/extract?limit=50`, { method: 'POST' });
      await fetchCandidates();
    } catch {
      // ignore
    } finally {
      setExtracting(false);
    }
  }

  async function handleApprove(id: number) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)),
    );
    try {
      await fetch(`${API_URL}/slang/${id}/approve`, { method: 'POST' });
    } catch {
      await fetchCandidates();
    }
  }

  async function handleReject(id: number) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c)),
    );
    try {
      await fetch(`${API_URL}/slang/${id}/reject`, { method: 'POST' });
    } catch {
      await fetchCandidates();
    }
  }

  async function handleSave(id: number, data: Record<string, any>) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c)),
    );
    try {
      await fetch(`${API_URL}/slang/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      await fetchCandidates();
    }
  }

  const counts = {
    pending: candidates.filter((c) => c.status === 'pending').length,
    approved: candidates.filter((c) => c.status === 'approved').length,
    rejected: candidates.filter((c) => c.status === 'rejected').length,
  };

  const filtered = candidates.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        {/* Title + stats + actions row */}
        <div className="flex items-center gap-6 mb-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Slang Curation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and curate PoE slang terms
            </p>
          </div>

          {/* Inline stats with vertical dividers */}
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</div>
            <div className="text-lg font-bold text-foreground">{counts.pending}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</div>
            <div className="text-lg font-bold text-foreground">{counts.approved}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</div>
            <div className="text-lg font-bold text-foreground">{counts.rejected}</div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {extracting ? 'Extracting...' : 'Extract from Reddit'}
            </button>
          </div>
        </div>

        {/* Tabs row: status tabs LEFT, filter icon + Refresh RIGHT */}
        <div className="flex items-center gap-3">
          {/* Status tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s} {s === 'all' ? `(${candidates.length})` : `(${counts[s as SlangStatus]})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto relative">
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {candidates.length}
            </span>

            {/* Filter icon */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={categoryFilter !== 'all' ? 'p-1.5 rounded bg-foreground/15 text-foreground' : 'p-1.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>

            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); fetchCandidates(); }}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
            >
              Refresh
            </button>

            {/* Filter dropdown */}
            {showFilters && (
              <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-foreground">Filters</span>
                  {categoryFilter !== 'all' && (
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Category</label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setCategoryFilter('all'); setShowFilters(false); }}
                    className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
                      categoryFilter === 'all' ? 'bg-foreground/10 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategoryFilter(c); setShowFilters(false); }}
                      className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
                        categoryFilter === c ? 'bg-foreground/10 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {/* Bulk actions for pending */}
        {statusFilter === 'pending' && filtered.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-surface border border-border rounded-lg">
            <span className="text-xs text-muted-foreground mr-2">{filtered.length} pending</span>
            <button
              onClick={async () => {
                for (const c of filtered) await handleApprove(c.id);
              }}
              className="px-3 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Approve All
            </button>
            <button
              onClick={async () => {
                for (const c of filtered) await handleReject(c.id);
              }}
              className="px-3 py-1 rounded text-xs bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Reject All
            </button>
          </div>
        )}

        {/* Card list */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Loading slang candidates...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm mb-2">No slang candidates found.</p>
            <p className="text-muted-foreground/60 text-xs">
              Click &quot;Extract from Reddit&quot; to discover new slang terms.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((slang) => (
              <SlangCard
                key={slang.id}
                slang={slang}
                onApprove={handleApprove}
                onReject={handleReject}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

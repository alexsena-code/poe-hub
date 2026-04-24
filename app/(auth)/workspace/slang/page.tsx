'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { SlangCard, SlangCandidate, SlangStatus, SlangCategory, CATEGORIES } from '@/components/modules/workspace/slang/slang-card';
import { IngestSidiaButton } from '@/components/modules/workspace/slang/ingest-sidia-button';
import { BulkActionBar, ApproveAllButton } from '@/components/modules/workspace/slang/bulk-action-bar';

const API_URL = '/api/engine';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

// Source value that maps to the sidia.net ingest — matches what the engine stores
const SIDIA_SOURCE = 'sidia';

export default function SlangCuration() {
  const [candidates, setCandidates] = useState<SlangCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SlangCategory>('all');
  const [showFilters, setShowFilters] = useState(false);
  // Selection state: Set of ids — only pending rows participate
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      params.set('limit', '500');
      const res = await fetch(`${API_URL}/slang?${params.toString()}`);
      if (!res.ok) throw new Error(`slang list returned ${res.status}`);
      const data = await res.json();
      setCandidates(data.items || []);
    } catch {
      // Engine may be offline during local dev — leave list empty
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchCandidates();
    // Clear selection when filters change — avoids ghost-selected ids
    setSelectedIds(new Set());
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

  // Optimistic individual approve
  async function handleApprove(id: number) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)),
    );
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    try {
      await fetch(`${API_URL}/slang/${id}/approve`, { method: 'POST' });
    } catch {
      await fetchCandidates();
    }
  }

  // Optimistic individual reject
  async function handleReject(id: number) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c)),
    );
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    try {
      await fetch(`${API_URL}/slang/${id}/reject`, { method: 'POST' });
    } catch {
      await fetchCandidates();
    }
  }

  async function handleSave(id: number, data: Partial<SlangCandidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
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

  // Selection helpers
  function toggleSelectId(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pendingFiltered = candidates.filter((c) => {
    if (c.status !== 'pending') return false;
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    return true;
  });

  function toggleSelectAll() {
    const pendingIds = pendingFiltered.map((c) => c.id);
    const allSelected = pendingIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(pendingIds));
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

  // Pending sidia count — for the contextual "Approve all pending from sidia" button
  const pendingSidiaCount = candidates.filter(
    (c) => c.status === 'pending' && c.source === SIDIA_SOURCE,
  ).length;

  // Pending in current category — for "Approve all in category" button
  const pendingInCategoryCount =
    categoryFilter !== 'all'
      ? candidates.filter((c) => c.status === 'pending' && c.category === categoryFilter).length
      : 0;

  // Whether every visible pending row is checked (for select-all checkbox state)
  const allPendingSelected =
    pendingFiltered.length > 0 && pendingFiltered.every((c) => selectedIds.has(c.id));

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        {/* Title + stats + actions row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Slang Curation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and curate PoE slang terms
            </p>
          </div>

          {/* Inline stats with vertical dividers */}
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</div>
            <div className="text-lg font-bold text-foreground">{counts.pending}</div>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</div>
            <div className="text-lg font-bold text-foreground">{counts.approved}</div>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</div>
            <div className="text-lg font-bold text-foreground">{counts.rejected}</div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            {/* Contextual: approve all pending from sidia — only when filter matches or count > 0 */}
            {pendingSidiaCount > 0 && (
              <ApproveAllButton
                label={`Approve all sidia (${pendingSidiaCount})`}
                payload={{ source: SIDIA_SOURCE, reviewerNotes: 'curated — bulk approved' }}
                onApproveComplete={fetchCandidates}
              />
            )}

            {/* Contextual: approve all pending in current category */}
            {categoryFilter !== 'all' && pendingInCategoryCount > 0 && (
              <ApproveAllButton
                label={`Approve all in '${categoryFilter}' (${pendingInCategoryCount})`}
                payload={{ category: categoryFilter }}
                onApproveComplete={fetchCandidates}
              />
            )}

            {/* Sidia ingest */}
            <IngestSidiaButton onSuccess={fetchCandidates} />

            {/* Legacy Reddit extract */}
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

          {/* Select all checkbox — only shown when viewing pending */}
          {statusFilter === 'pending' && pendingFiltered.length > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors ml-2">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
                className="rounded border-border accent-primary"
              />
              Select all
            </label>
          )}

          <div className="flex items-center gap-2 ml-auto relative">
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {candidates.length}
            </span>

            {/* Filter icon */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={
                categoryFilter !== 'all'
                  ? 'p-1.5 rounded bg-foreground/15 text-foreground'
                  : 'p-1.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
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
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Category
                </label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setCategoryFilter('all'); setShowFilters(false); }}
                    className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
                      categoryFilter === 'all'
                        ? 'bg-foreground/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategoryFilter(c); setShowFilters(false); }}
                      className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
                        categoryFilter === c
                          ? 'bg-foreground/10 text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
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
        {/* Bulk action bar — sticky, visible only when selection active */}
        <BulkActionBar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
          onApproveComplete={fetchCandidates}
        />

        {/* Card list */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Loading slang candidates...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm mb-2">No slang candidates found.</p>
            <p className="text-muted-foreground/60 text-xs">
              Click &quot;Extract from Reddit&quot; or &quot;Ingest sidia.net&quot; to discover new slang terms.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((slang) => (
              <SlangCard
                key={slang.id}
                slang={slang}
                selected={selectedIds.has(slang.id)}
                onToggleSelect={toggleSelectId}
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

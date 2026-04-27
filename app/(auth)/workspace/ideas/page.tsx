'use client';

import { useState } from 'react';
import { BriefStatus, UrgencyFilter } from '@/components/modules/workspace/ideas/types';
import { useIdeasState } from '@/components/modules/workspace/ideas/use-ideas-state';
import { useGenerateFlow } from '@/components/modules/workspace/ideas/use-generate-flow';
import { BriefList } from '@/components/modules/workspace/ideas/brief-list';
import { GenerateControls } from '@/components/modules/workspace/ideas/generate-controls';

export default function IdeasPage() {
  const {
    briefs,
    loading,
    filterStatus,
    setFilterStatus,
    filterUrgency,
    setFilterUrgency,
    counts,
    msg,
    setMsg,
    setBriefs,
    fetchBriefs,
    updateStatus,
    toggleDataSource,
    clearBriefs,
    exportContent,
    deleteGeneratedPost,
  } = useIdeasState();

  // Generate-controls local state
  const [editorialBriefing, setEditorialBriefing] = useState('');
  const [showBriefing, setShowBriefing] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedModel, setSelectedModel] = useState(0);

  // Filter panel toggle
  const [showFilters, setShowFilters] = useState(false);

  function toggleTemplate(t: string) {
    setSelectedTemplates((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  const { generating, generatingContent, handleGenerate, generateContent, generateFromUrl } = useGenerateFlow({
    selectedModel,
    editorialBriefing,
    selectedTemplates,
    setMsg,
    fetchBriefs,
  });

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        {/* Title + stats + action buttons row */}
        <div className="flex items-center gap-6 mb-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Content Ideas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-generated content briefs from trending data
            </p>
          </div>

          {/* Inline stats with vertical dividers */}
          <StatDivider />
          <StatCell label="Pending" value={counts.pending} />
          <StatDivider />
          <StatCell label="Accepted" value={counts.accepted} />
          <StatDivider />
          <StatCell label="Generated" value={counts.generated} />
          <StatDivider />
          <StatCell label="Rejected" value={counts.rejected} />

          {/* Generate controls (buttons + panels) — hidden in "generated" filter */}
          {filterStatus !== 'generated' && (
            <GenerateControls
              generating={generating}
              msg={msg}
              briefs={briefs}
              editorialBriefing={editorialBriefing}
              setEditorialBriefing={setEditorialBriefing}
              showBriefing={showBriefing}
              setShowBriefing={setShowBriefing}
              selectedTemplates={selectedTemplates}
              toggleTemplate={toggleTemplate}
              setSelectedTemplates={setSelectedTemplates}
              showTemplates={showTemplates}
              setShowTemplates={setShowTemplates}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              onGenerate={handleGenerate}
              onClear={clearBriefs}
              onGenerateFromUrl={generateFromUrl}
            />
          )}
        </div>

        {/* Tabs row: status tabs LEFT, filter icon + Refresh RIGHT */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'pending', 'accepted', 'generated', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s as BriefStatus)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  filterStatus === s
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s} ({counts[s as keyof typeof counts] ?? 0})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto relative">
            {/* Filter icon */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={
                filterUrgency !== 'all'
                  ? 'p-1.5 rounded bg-foreground/15 text-foreground'
                  : 'p-1.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground'
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>

            {/* Refresh */}
            <button
              onClick={() => { fetchBriefs(); }}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
            >
              Refresh
            </button>

            {/* Filter dropdown */}
            {showFilters && (
              <UrgencyFilterDropdown
                filterUrgency={filterUrgency}
                onSelect={(u) => { setFilterUrgency(u as UrgencyFilter); setShowFilters(false); }}
                onClear={() => setFilterUrgency('all')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        <BriefList
          briefs={briefs}
          loading={loading}
          generatingContent={generatingContent}
          msg={msg}
          onUpdateStatus={updateStatus}
          onToggleDataSource={toggleDataSource}
          onGenerateContent={generateContent}
          onExportContent={exportContent}
          onDeleteGeneratedPost={deleteGeneratedPost}
          onBriefUpdate={(updated) =>
            setBriefs((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          }
          onSetMsg={setMsg}
          onRefresh={fetchBriefs}
        />
      </div>
    </div>
  );
}

// ── Small layout primitives ──────────────────────────────────────────────────

function StatDivider() {
  return <div className="w-px h-8 bg-border" />;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

interface UrgencyFilterDropdownProps {
  filterUrgency: string;
  onSelect: (u: string) => void;
  onClear: () => void;
}

function UrgencyFilterDropdown({ filterUrgency, onSelect, onClear }: UrgencyFilterDropdownProps) {
  return (
    <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-foreground">Filters</span>
        {filterUrgency !== 'all' && (
          <button
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Category</label>
      <div className="flex flex-col gap-1">
        {['all', 'hot', 'timely', 'evergreen'].map(u => (
          <button
            key={u}
            onClick={() => onSelect(u)}
            className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
              filterUrgency === u
                ? 'bg-foreground/10 text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api/engine';

interface ContentBrief {
  id: number;
  runId: string;
  rank: number;
  title: string;
  titleEn: string;
  templateType: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  cluster: string | null;
  rationale: string;
  dataSources: Record<string, boolean>;
  effort: string;
  urgency: string;
  score: number;
  provider: string;
  model: string;
  status: string;
  generatedPostSlug: string | null;
  createdAt: string;
}

const URGENCY_COLORS: Record<string, string> = {
  hot: 'bg-red-900/40 text-red-300',
  timely: 'bg-amber-900/40 text-amber-300',
  evergreen: 'bg-emerald-900/40 text-emerald-300',
};

const EFFORT_COLORS: Record<string, string> = {
  S: 'text-emerald-400',
  M: 'text-amber-400',
  L: 'text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-700/50 text-zinc-300',
  accepted: 'bg-emerald-900/40 text-emerald-300',
  rejected: 'bg-red-900/40 text-red-300',
  generated: 'bg-blue-900/40 text-blue-300',
};

const TEMPLATE_LABELS: Record<string, string> = {
  build_guide: 'Build Guide',
  mechanic_guide: 'Mechanic Guide',
  tier_list: 'Tier List',
  currency_guide: 'Currency Guide',
  atlas_guide: 'Atlas Guide',
  league_start: 'League Start',
  qa_page: 'Q&A',
  patch_analysis: 'Patch Analysis',
};

export default function IdeasPage() {
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [generatingContent, setGeneratingContent] = useState<number | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<Record<number, any>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Model selection (OpenRouter format) — default uses YAML config
  const MODEL_OPTIONS = [
    { label: 'Default (config YAML)', model: '' },
    { label: 'GPT-4.1 Mini', model: 'openai/gpt-4.1-mini' },
    { label: 'GPT-4.1', model: 'openai/gpt-4.1' },
    { label: 'GPT-5 Mini', model: 'openai/gpt-5-mini' },
    { label: 'Gemini 2.5 Flash Lite', model: 'google/gemini-2.5-flash-lite' },
    { label: 'Gemini 2.5 Flash', model: 'google/gemini-2.5-flash' },
    { label: 'Gemini 3 Flash', model: 'google/gemini-3-flash-preview' },
    { label: 'DeepSeek V3.2', model: 'deepseek/deepseek-v3.2' },
    { label: 'Claude Sonnet 4', model: 'anthropic/claude-sonnet-4-20250514' },
    { label: 'Grok 4.1 Fast', model: 'x-ai/grok-4.1-fast' },
  ];
  const [selectedModel, setSelectedModel] = useState(0);

  // Track polling intervals so we can clean up on unmount
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
    };
  }, []);

  const fetchBriefs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterUrgency !== 'all') params.set('urgency', filterUrgency);
      const res = await fetch(`${API}/ideation/briefs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBriefs(Array.isArray(data) ? data : data.briefs ?? []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [filterStatus, filterUrgency]);

  useEffect(() => { fetchBriefs(); }, [fetchBriefs]);

  async function handleGenerate() {
    setGenerating(true);
    setMsg(null);
    try {
      const opt = MODEL_OPTIONS[selectedModel];
      const res = await fetch(`${API}/ideation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opt.model }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(`Error: ${data.error}`);
        setGenerating(false);
        return;
      }
      const { jobId } = data;
      setMsg('Generating... 0%');

      // Poll for job status
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API}/ideation/jobs/${jobId}`);
          const job = await pollRes.json();

          if (job.status === 'active' || job.status === 'waiting') {
            setMsg(`Generating... ${job.progress ?? 0}%`);
          } else if (job.status === 'completed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            const result = job.result ?? {};
            const count = result.briefCount ?? result.briefs?.length ?? result.count ?? 0;
            const mdl = result.model ?? opt.model;
            const cost = result.costUsd ?? result.cost ?? 0;
            setMsg(`Generated ${count} briefs (${mdl}) — $${Number(cost).toFixed(4)}`);
            fetchBriefs();
            setGenerating(false);
          } else if (job.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setMsg(`Error: ${job.error ?? 'Generation failed'}`);
            setGenerating(false);
          }
        } catch {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setMsg('Failed to check job status');
          setGenerating(false);
        }
      }, 2000);
    } catch (e) {
      setMsg('Failed to generate');
      setGenerating(false);
    }
  }

  async function clearBriefs() {
    if (!confirm('Clear all pending/superseded briefs? Accepted briefs will be kept.')) return;
    try {
      await fetch(`${API}/ideation/briefs?status=pending`, { method: 'DELETE' });
      await fetch(`${API}/ideation/briefs?status=superseded`, { method: 'DELETE' });
      setMsg('Cleared');
      fetchBriefs();
    } catch { setMsg('Failed to clear'); }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await fetch(`${API}/ideation/briefs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchBriefs();
    } catch { /* */ }
  }

  async function generateContent(id: number) {
    setGeneratingContent(id);
    setMsg(null);
    try {
      const res = await fetch(`${API}/ideation/briefs/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) {
        setMsg(`Generation failed: ${data.error}`);
        setGeneratingContent(null);
        return;
      }
      const { jobId } = data;
      setMsg('Generating content... 0%');

      // Poll for job status
      if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
      contentPollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API}/ideation/jobs/${jobId}`);
          const job = await pollRes.json();

          if (job.status === 'active' || job.status === 'waiting') {
            setMsg(`Generating content... ${job.progress ?? 0}%`);
          } else if (job.status === 'completed') {
            if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
            contentPollIntervalRef.current = null;
            const result = job.result ?? {};
            setMsg(`Content generated: "${result.post?.slug || 'done'}"`);
            setGeneratedPosts(prev => ({ ...prev, [id]: result.post }));
            fetchBriefs();
            setGeneratingContent(null);
          } else if (job.status === 'failed') {
            if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
            contentPollIntervalRef.current = null;
            setMsg(`Generation failed: ${job.error ?? 'Unknown error'}`);
            setGeneratingContent(null);
          }
        } catch {
          if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
          contentPollIntervalRef.current = null;
          setMsg('Failed to check job status');
          setGeneratingContent(null);
        }
      }, 2000);
    } catch {
      setMsg('Failed to generate content');
      setGeneratingContent(null);
    }
  }

  function exportContent(id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') {
    window.open(`${API}/ideation/briefs/${id}/export?format=${format}`, '_blank');
  }

  const filtered = briefs;

  const counts = {
    all: briefs.length,
    pending: briefs.filter(b => b.status === 'pending').length,
    accepted: briefs.filter(b => b.status === 'accepted').length,
    rejected: briefs.filter(b => b.status === 'rejected').length,
    generated: briefs.filter(b => b.status === 'generated').length,
  };

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        {/* Title + stats + actions row */}
        <div className="flex items-center gap-6 mb-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Content Ideas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-generated content briefs from trending data
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
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Accepted</div>
            <div className="text-lg font-bold text-foreground">{counts.accepted}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Generated</div>
            <div className="text-lg font-bold text-foreground">{counts.generated}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</div>
            <div className="text-lg font-bold text-foreground">{counts.rejected}</div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 ml-auto">
            {msg && <span className="text-xs text-emerald-400">{msg}</span>}
            {filterStatus !== 'generated' && (
              <>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(Number(e.target.value))}
                  className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground"
                >
                  {MODEL_OPTIONS.map((opt, i) => (
                    <option key={i} value={i}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {generating ? (msg?.startsWith('Generating...') ? msg : 'Generating...') : 'Generate Ideas'}
                </button>
                {briefs.length > 0 && (
                  <button
                    onClick={clearBriefs}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md text-xs transition-colors"
                  >
                    Clear Pending
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs row: status tabs LEFT, filter icon + Refresh RIGHT */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'pending', 'accepted', 'generated', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  filterStatus === s ? 'bg-foreground/10 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
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
              className={filterUrgency !== 'all' ? 'p-1.5 rounded bg-foreground/15 text-foreground' : 'p-1.5 rounded bg-foreground/5 text-muted-foreground hover:text-foreground'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>

            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); fetchBriefs(); }}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
            >
              Refresh
            </button>

            {/* Filter dropdown */}
            {showFilters && (
              <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-foreground">Filters</span>
                  {filterUrgency !== 'all' && (
                    <button
                      onClick={() => setFilterUrgency('all')}
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
                      onClick={() => { setFilterUrgency(u); setShowFilters(false); }}
                      className={`px-3 py-1.5 text-xs capitalize rounded transition-colors text-left ${
                        filterUrgency === u ? 'bg-foreground/10 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                      }`}
                    >
                      {u}
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
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground text-sm mb-3">No content briefs yet.</p>
            <p className="text-muted-foreground text-xs">Click &quot;Generate Ideas&quot; to create AI-powered content suggestions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => (
              <div key={b.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                {/* Brief header */}
                <div
                  className="p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{b.rank}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${URGENCY_COLORS[b.urgency] || 'bg-surface text-muted-foreground'}`}>
                          {b.urgency}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[b.status] || ''}`}>
                          {b.status}
                        </span>
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
                        <div className={`text-sm font-bold ${EFFORT_COLORS[b.effort] || 'text-muted-foreground'}`}>{b.effort}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Score</div>
                        <div className="text-sm font-bold text-foreground">{b.score}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === b.id && (
                  <div className="border-t border-border p-4 bg-background/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: details */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Primary Keyword</div>
                          <div className="text-sm text-foreground font-mono">{b.primaryKeyword}</div>
                        </div>
                        {b.secondaryKeywords.length > 0 && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Secondary Keywords</div>
                            <div className="flex flex-wrap gap-1">
                              {b.secondaryKeywords.map(kw => (
                                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground font-mono">{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Data Sources</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(b.dataSources || {}).map(([key, val]) => (
                              <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded ${val ? 'bg-emerald-900/30 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: rationale + actions */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Rationale</div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{b.rationale}</p>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Model</div>
                          <span className="text-[10px] font-mono text-muted-foreground">{b.model}</span>
                        </div>
                        {/* Status-specific actions */}
                        {b.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'accepted'); }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'rejected'); }}
                              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {b.status === 'accepted' && (
                          <div className="flex gap-2 pt-2 flex-wrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); generateContent(b.id); }}
                              disabled={generatingContent === b.id}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors"
                            >
                              {generatingContent === b.id ? (msg?.startsWith('Generating content...') ? msg : 'Generating...') : 'Generate Content'}
                            </button>
                            <a
                              href={`/new?topic=${encodeURIComponent(b.primaryKeyword)}&template=${encodeURIComponent(b.templateType)}&notes=${encodeURIComponent(b.rationale + '\nKeywords: ' + b.secondaryKeywords.join(', '))}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
                            >
                              Open in Co-Writer
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'pending'); }}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs transition-colors"
                            >
                              Back to Pending
                            </button>
                          </div>
                        )}
                        {b.status === 'rejected' && (
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'accepted'); }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'pending'); }}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs transition-colors"
                            >
                              Back to Pending
                            </button>
                          </div>
                        )}
                        {b.status === 'generated' && (
                          <div className="space-y-2 pt-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Export</div>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); exportContent(b.id, 'md-pt'); }}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs transition-colors"
                              >
                                PT-BR (.md)
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); exportContent(b.id, 'md-en'); }}
                                className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                              >
                                EN (.md)
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); exportContent(b.id, 'json'); }}
                                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors"
                              >
                                JSON
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); updateStatus(b.id, 'accepted'); }}
                                className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs transition-colors"
                              >
                                Re-generate
                              </button>
                            </div>
                            {b.generatedPostSlug && (
                              <div className="text-[10px] text-muted-foreground">
                                Slug: <span className="font-mono text-foreground/70">{b.generatedPostSlug}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delete — always available */}
                        <div className="flex justify-end pt-2 border-t border-border/50 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete idea #${b.id} "${b.title}"? This cannot be undone.`)) {
                                fetch(`${API}/ideation/briefs/${b.id}`, { method: 'DELETE' })
                                  .then(() => { setMsg(`Deleted #${b.id}`); fetchBriefs(); })
                                  .catch(() => setMsg('Failed to delete'));
                              }
                            }}
                            className="px-3 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded text-xs transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ScanEntry {
  id: number;
  scanType: string;
  keywordsFound: number;
  newKeywords: number;
  rejected: number;
  durationMs: number | null;
  runAt: string;
}

interface LlmCosts {
  days: number;
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byNode: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  byDay: Record<string, { calls: number; costUsd: number }>;
}

interface KeybertStatus {
  workerOnline: boolean;
  taskHistory: Array<{
    task: { id: string; modules: string[] };
    result?: { summary: Record<string, unknown>; error?: string; durationMs?: number };
    dispatchedAt: string;
    completedAt?: string;
  }>;
}

interface RecentLlmCall {
  id: number;
  provider: string;
  model: string;
  nodeName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
}

interface PostSection {
  sectionId: string;
  title: string;
  tokensUsed: number;
  hasContent: boolean;
  contentLengthPtBr: number;
  contentLengthEn: number;
}

interface PostSummary {
  slug: string;
  title: { 'pt-br': string; en: string };
  template: string;
  status: string;
  phase: string;
  generatedAt: string;
  updatedAt: string;
  totalTokens: number;
  estimatedCost: number;
  sectionCount: number;
  sections: PostSection[];
  briefing: {
    skill?: string;
    ascendancy?: string;
    topic?: string;
    league?: string;
    templateName?: string;
  } | null;
  dataSnapshot: Record<string, any>;
}

type Tab = 'posts' | 'costs' | 'keybert' | 'scans';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function scanTypeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function statusBadge(status: string, phase: string) {
  const label = phase || status;
  const colors: Record<string, string> = {
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    writing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    draft: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${colors[label] || colors.draft}`}>
      {label}
    </span>
  );
}

export default function LogsTab() {
  const [tab, setTab] = useState<Tab>('posts');
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [costs, setCosts] = useState<LlmCosts | null>(null);
  const [keybert, setKeybert] = useState<KeybertStatus | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentLlmCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [scansRes, costsRes, keybertRes, postsRes, recentRes] = await Promise.all([
        fetch(`${API}/seo/scans?limit=50`),
        fetch(`${API}/seo/pipeline/costs?days=${days}`),
        fetch(`${API}/seo/keybert/status`),
        fetch(`${API}/content/posts`),
        fetch(`${API}/llm/usage/recent?limit=50`),
      ]);
      setScans(await scansRes.json());
      setCosts(await costsRes.json());
      setKeybert(await keybertRes.json());
      const postsData = await postsRes.json();
      setPosts(Array.isArray(postsData) ? postsData : []);
      const recentData = await recentRes.json();
      setRecentCalls(Array.isArray(recentData) ? recentData : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'posts', label: 'Posts Gerados', count: posts.length },
    { key: 'costs', label: 'Custos LLM' },
    { key: 'keybert', label: 'KeyBERT' },
    { key: 'scans', label: 'Scans' },
  ];

  const totalPostCost = posts.reduce((s, p) => s + p.estimatedCost, 0);
  const totalPostTokens = posts.reduce((s, p) => s + p.totalTokens, 0);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Logs & History</h1>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          >
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-foreground/10 text-[10px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {/* Posts Gerados */}
      {tab === 'posts' && (
        <section>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Posts" value={posts.length} />
            <StatCard label="Publicados" value={posts.filter((p) => p.phase === 'published').length} />
            <StatCard label="Total Tokens" value={totalPostTokens.toLocaleString()} />
            <StatCard label="Custo Estimado" value={`$${totalPostCost.toFixed(4)}`} accent />
          </div>

          {/* Posts list */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Post</th>
                  <th className="px-4 py-2.5 font-medium">Template</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Secoes</th>
                  <th className="px-4 py-2.5 font-medium text-right">Tokens</th>
                  <th className="px-4 py-2.5 font-medium text-right">Custo Est.</th>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <>
                    <tr
                      key={post.slug}
                      onClick={() => setExpandedPost(expandedPost === post.slug ? null : post.slug)}
                      className="border-t border-border cursor-pointer hover:bg-surface/50 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="text-foreground font-medium text-xs">{post.title?.['pt-br'] || post.slug}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{post.slug}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-foreground/5 text-[11px] font-mono text-muted-foreground border border-border">
                          {post.template || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{statusBadge(post.status, post.phase)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{post.sectionCount}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{post.totalTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-accent">${post.estimatedCost.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(post.updatedAt || post.generatedAt)}</td>
                    </tr>
                    {expandedPost === post.slug && (
                      <tr key={`${post.slug}-detail`} className="border-t border-border">
                        <td colSpan={7} className="p-0">
                          <PostDetail post={post} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {posts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum post gerado ainda</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* LLM Costs */}
      {tab === 'costs' && costs && (
        <section className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Chamadas" value={costs.total.calls} />
            <StatCard label="Input Tokens" value={costs.total.inputTokens.toLocaleString()} />
            <StatCard label="Output Tokens" value={costs.total.outputTokens.toLocaleString()} />
            <StatCard label="Custo" value={`$${costs.total.costUsd.toFixed(4)}`} accent />
          </div>

          {/* By Node */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por Node</div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-muted-foreground text-left">
                    <th className="px-4 py-2 font-medium">Node</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right">In Tokens</th>
                    <th className="px-4 py-2 font-medium text-right">Out Tokens</th>
                    <th className="px-4 py-2 font-medium text-right">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(costs.byNode).map(([node, v]) => (
                    <tr key={node} className="border-t border-border">
                      <td className="px-4 py-2 text-foreground font-mono text-xs">{node}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{v.calls}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{v.inputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{v.outputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-accent">${v.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent LLM Calls */}
          {recentCalls.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chamadas Recentes (50)</div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface text-muted-foreground text-left">
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Node</th>
                      <th className="px-3 py-2 font-medium">Modelo</th>
                      <th className="px-3 py-2 font-medium text-right">In</th>
                      <th className="px-3 py-2 font-medium text-right">Out</th>
                      <th className="px-3 py-2 font-medium text-right">Custo</th>
                      <th className="px-3 py-2 font-medium text-right">Latencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map((call) => (
                      <tr key={call.id} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{formatDate(call.createdAt)}</td>
                        <td className="px-3 py-1.5 text-foreground font-mono text-xs">{call.nodeName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{call.provider}/{call.model?.split('-').slice(-2).join('-')}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground text-xs">{call.inputTokens?.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground text-xs">{call.outputTokens?.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-accent text-xs">${call.costUsd?.toFixed(5)}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground text-xs">{call.latencyMs ? `${(call.latencyMs / 1000).toFixed(1)}s` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* KeyBERT */}
      {tab === 'keybert' && keybert && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${keybert.workerOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-foreground">
              {keybert.workerOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          {keybert.taskHistory.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-muted-foreground text-left">
                    <th className="px-4 py-2 font-medium">Task ID</th>
                    <th className="px-4 py-2 font-medium">Modules</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Dispatched</th>
                    <th className="px-4 py-2 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {keybert.taskHistory.map((entry) => (
                    <tr key={entry.task.id} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{entry.task.id}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{entry.task.modules.join(', ')}</td>
                      <td className="px-4 py-2">
                        {entry.result?.error ? (
                          <span className="text-red-400 text-xs">Erro</span>
                        ) : entry.completedAt ? (
                          <span className="text-green-400 text-xs">Concluido</span>
                        ) : (
                          <span className="text-amber-400 text-xs">Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(entry.dispatchedAt)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                        {entry.result?.durationMs ? `${(entry.result.durationMs / 1000).toFixed(1)}s` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Scans */}
      {tab === 'scans' && (
        <section>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-muted-foreground text-left">
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium text-right">Found</th>
                  <th className="px-4 py-2 font-medium text-right">New</th>
                  <th className="px-4 py-2 font-medium text-right">Rejected</th>
                  <th className="px-4 py-2 font-medium text-right">Duration</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id} className="border-t border-border">
                    <td className="px-4 py-2 text-foreground text-xs">{scanTypeLabel(scan.scanType)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{scan.keywordsFound}</td>
                    <td className="px-4 py-2 text-right text-green-400">{scan.newKeywords}</td>
                    <td className="px-4 py-2 text-right text-red-400">{scan.rejected}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(scan.runAt)}</td>
                  </tr>
                ))}
                {scans.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum scan registrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Post Detail (expanded row) ─────────────────────────────── */

function PostDetail({ post }: { post: PostSummary }) {
  return (
    <div className="bg-[#0d0d0d] p-5 space-y-4">
      {/* Briefing */}
      {post.briefing && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Briefing</div>
          <div className="flex flex-wrap gap-2">
            {post.briefing.skill && (
              <Tag label="Skill" value={post.briefing.skill} />
            )}
            {post.briefing.ascendancy && (
              <Tag label="Ascendancy" value={post.briefing.ascendancy} />
            )}
            {post.briefing.topic && (
              <Tag label="Topic" value={post.briefing.topic} />
            )}
            {post.briefing.league && (
              <Tag label="League" value={post.briefing.league} />
            )}
            {post.briefing.templateName && (
              <Tag label="Template" value={post.briefing.templateName} />
            )}
          </div>
        </div>
      )}

      {/* Sections breakdown */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Secoes ({post.sections.length})</div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Secao</th>
                <th className="px-3 py-2 text-right font-medium">Tokens</th>
                <th className="px-3 py-2 text-right font-medium">PT-BR</th>
                <th className="px-3 py-2 text-right font-medium">EN</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {post.sections.map((sec) => {
                const pct = post.totalTokens > 0 ? Math.round((sec.tokensUsed / post.totalTokens) * 100) : 0;
                return (
                  <tr key={sec.sectionId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="text-foreground font-medium">{sec.title || sec.sectionId}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{sec.sectionId}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      <div>{sec.tokensUsed.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">{pct}%</div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {sec.contentLengthPtBr > 0 ? `${Math.round(sec.contentLengthPtBr / 1000)}k chars` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {sec.contentLengthEn > 0 ? `${Math.round(sec.contentLengthEn / 1000)}k chars` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {sec.hasContent ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface">
                <td className="px-3 py-2 text-foreground font-semibold">Total</td>
                <td className="px-3 py-2 text-right text-foreground font-semibold">{post.totalTokens.toLocaleString()}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-center text-accent font-semibold">${post.estimatedCost.toFixed(4)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Token distribution bar */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Distribuicao de Tokens</div>
        <div className="flex rounded-lg overflow-hidden h-3 bg-surface border border-border">
          {post.sections.map((sec, i) => {
            const pct = post.totalTokens > 0 ? (sec.tokensUsed / post.totalTokens) * 100 : 0;
            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'];
            return (
              <div
                key={sec.sectionId}
                className={`${colors[i % colors.length]} opacity-60 hover:opacity-100 transition-opacity`}
                style={{ width: `${pct}%` }}
                title={`${sec.title}: ${sec.tokensUsed} tokens (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-1.5">
          {post.sections.map((sec, i) => {
            const colors = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-red-400', 'text-cyan-400', 'text-pink-400', 'text-indigo-400'];
            return (
              <span key={sec.sectionId} className={`text-[10px] ${colors[i % colors.length]}`}>
                {sec.title || sec.sectionId}
              </span>
            );
          })}
        </div>
      </div>

      {/* Research details per section */}
      {Object.entries(post.dataSnapshot).some(([, v]) => v?.research) && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Research (Qdrant + PostgreSQL)</div>
          <div className="space-y-3">
            {Object.entries(post.dataSnapshot).map(([sectionId, data]) => {
              const r = data?.research;
              if (!r) return null;
              return (
                <div key={sectionId} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{sectionId}</span>
                    <span className="text-[10px] text-muted-foreground">{r.durationMs}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                    <div><span className="text-muted-foreground">Query:</span> <span className="text-foreground font-mono">{r.query?.slice(0, 80)}{r.query?.length > 80 ? '...' : ''}</span></div>
                    <div><span className="text-muted-foreground">Tipo:</span> <span className="text-foreground">{r.queryType}</span></div>
                    <div><span className="text-muted-foreground">Collections:</span> <span className="text-foreground">{r.collections?.join(', ')}</span></div>
                    <div><span className="text-muted-foreground">Chunks:</span> <span className="text-foreground">{r.chunkCount}</span></div>
                    <div><span className="text-muted-foreground">PG Data:</span> {r.hasExactData ? <span className="text-emerald-400">Sim</span> : <span className="text-red-400">Nao</span>}</div>
                    <div><span className="text-muted-foreground">Summary:</span> {r.hasSummary ? <span className="text-emerald-400">Sim</span> : <span className="text-muted-foreground">Nao</span>}</div>
                    <div><span className="text-muted-foreground">Page Type:</span> <span className="text-foreground">{r.detectedPageType || '-'}</span></div>
                    <div><span className="text-muted-foreground">Tokens Est.:</span> <span className="text-foreground">{r.tokenEstimate}</span></div>
                  </div>
                  {r.topChunks && r.topChunks.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">Top chunks:</div>
                      <div className="space-y-0.5">
                        {r.topChunks.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className={`font-mono ${c.score > 0.7 ? 'text-emerald-400' : c.score > 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                              {c.score.toFixed(3)}
                            </span>
                            <span className="text-muted-foreground">{c.collection}</span>
                            <span className="text-foreground">{c.pageTitle}</span>
                            {c.section && <span className="text-muted-foreground">/ {c.section}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.hasExactData && r.exactDataPreview && (
                    <div className="mt-2">
                      <div className="text-[10px] text-muted-foreground mb-1">PG Data preview:</div>
                      <pre className="text-[10px] font-mono text-muted-foreground bg-surface rounded p-1.5 overflow-x-auto">{r.exactDataPreview}</pre>
                    </div>
                  )}
                  {r.hasExpandedPages && r.expandedPageTitles?.length > 0 && (
                    <div className="mt-1 text-[10px]">
                      <span className="text-muted-foreground">Expanded pages: </span>
                      <span className="text-foreground">{r.expandedPageTitles.join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw data snapshot (fallback for posts without research logs) */}
      {Object.keys(post.dataSnapshot).length > 0 && !Object.values(post.dataSnapshot).some((v: any) => v?.research) && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data Snapshot</div>
          <pre className="rounded-lg bg-background border border-border p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(post.dataSnapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex gap-6 text-[10px] text-muted-foreground">
        <span>Criado: {formatDate(post.generatedAt)}</span>
        {post.updatedAt !== post.generatedAt && (
          <span>Atualizado: {formatDate(post.updatedAt)}</span>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ──────────────────────────────────────── */

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-xs text-foreground font-medium">{value}</span>
    </div>
  );
}

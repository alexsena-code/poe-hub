"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { PostDetail } from "./post-detail";
import {
  StatCard,
  StatusBadge,
  formatDate,
  scanTypeLabel,
  type KeybertStatus,
  type LlmCosts,
  type PostSummary,
  type RecentLlmCall,
  type ScanEntry,
} from "./logs-shared";

// Extracted from the original /logs route. Combines "Posts Gerados",
// "Custos LLM", "KeyBERT" and "Scans" into one operator dashboard with
// an inner tab bar. Intentionally keeps the same custom underline tab
// style that the operator is already used to — changing it would mean
// a visual change, which is out of scope for this refactor.

const API = '/api/engine';

type InnerTab = 'posts' | 'costs' | 'keybert' | 'scans';

export default function LogsTab() {
  const [tab, setTab] = useState<InnerTab>('posts');
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
      // silent — keep last snapshot
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const INNER_TABS: { key: InnerTab; label: string; count?: number }[] = [
    { key: 'posts', label: 'Posts Gerados', count: posts.length },
    { key: 'costs', label: 'Custos LLM' },
    { key: 'keybert', label: 'KeyBERT' },
    { key: 'scans', label: 'Scans' },
  ];

  const totalPostCost = posts.reduce((s, p) => s + p.estimatedCost, 0);
  const totalPostTokens = posts.reduce((s, p) => s + p.totalTokens, 0);

  return (
    <div className="flex flex-col gap-6 max-w-6xl w-full mt-4">
      <div className="flex items-center justify-end">
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

      {/* Inner tabs — custom underline style preserved from the original page */}
      <div className="flex gap-1 border-b border-border">
        {INNER_TABS.map((t) => (
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

      {tab === 'posts' && (
        <PostsSection
          posts={posts}
          loading={loading}
          totalPostCost={totalPostCost}
          totalPostTokens={totalPostTokens}
          expandedPost={expandedPost}
          setExpandedPost={setExpandedPost}
        />
      )}

      {tab === 'costs' && costs && (
        <CostsSection costs={costs} recentCalls={recentCalls} />
      )}

      {tab === 'keybert' && keybert && <KeybertSection keybert={keybert} />}

      {tab === 'scans' && <ScansSection scans={scans} loading={loading} />}
    </div>
  );
}

/* Posts section -- table of generated content posts with expandable detail */

function PostsSection({
  posts,
  loading,
  totalPostCost,
  totalPostTokens,
  expandedPost,
  setExpandedPost,
}: {
  posts: PostSummary[];
  loading: boolean;
  totalPostCost: number;
  totalPostTokens: number;
  expandedPost: string | null;
  setExpandedPost: (v: string | null) => void;
}) {
  return (
    <section>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard label="Publicados" value={posts.filter((p) => p.phase === 'published').length} />
        <StatCard label="Total Tokens" value={totalPostTokens.toLocaleString()} />
        <StatCard label="Custo Estimado" value={`$${totalPostCost.toFixed(4)}`} accent />
      </div>

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
              <Fragment key={post.slug}>
                <tr
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
                  <td className="px-4 py-2.5"><StatusBadge status={post.status} phase={post.phase} /></td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{post.sectionCount}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{post.totalTokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-accent">${post.estimatedCost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(post.updatedAt || post.generatedAt)}</td>
                </tr>
                {expandedPost === post.slug && (
                  <tr className="border-t border-border">
                    <td colSpan={7} className="p-0">
                      <PostDetail post={post} />
                    </td>
                  </tr>
                )}
              </Fragment>
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
  );
}

/* Costs section -- aggregate LLM spend + by-node + recent calls */

function CostsSection({ costs, recentCalls }: { costs: LlmCosts; recentCalls: RecentLlmCall[] }) {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Chamadas" value={costs.total.calls} />
        <StatCard label="Input Tokens" value={costs.total.inputTokens.toLocaleString()} />
        <StatCard label="Output Tokens" value={costs.total.outputTokens.toLocaleString()} />
        <StatCard label="Custo" value={`$${costs.total.costUsd.toFixed(4)}`} accent />
      </div>

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
  );
}

/* KeyBERT section -- worker status + task history */

function KeybertSection({ keybert }: { keybert: KeybertStatus }) {
  return (
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
  );
}

/* Scans section -- SEO scan history */

function ScansSection({ scans, loading }: { scans: ScanEntry[]; loading: boolean }) {
  return (
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
  );
}

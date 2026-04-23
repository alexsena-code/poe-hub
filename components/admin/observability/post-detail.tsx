// Expanded-row detail shown when the user clicks a row in the posts table
// of the Logs tab. Extracted from the original logs/page.tsx.

import { formatDate, Tag, type PostSummary } from "./logs-shared";

export function PostDetail({ post }: { post: PostSummary }) {
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
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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

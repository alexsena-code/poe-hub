import { AnalyticsStatCard, truncate, type GscKeyword } from "./analytics-shared";

interface GscTotals {
  impressions: number;
  clicks: number;
  avgPos: number;
  avgCtr: number;
}

export function GscPanel({
  keywords,
  totals,
  loading,
}: {
  keywords: GscKeyword[];
  totals: GscTotals;
  loading: boolean;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Google Search Console</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading GSC data...</p>
      ) : keywords.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No GSC data yet. Sync via /dashboard/config &rarr; Pipelines &rarr; GSC Sync.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <AnalyticsStatCard label="Impressions" value={totals.impressions.toLocaleString()} sub="28 days" color="text-foreground" />
            <AnalyticsStatCard label="Clicks" value={totals.clicks.toLocaleString()} sub="28 days" color="text-emerald-400" />
            <AnalyticsStatCard label="Avg CTR" value={`${totals.avgCtr}%`} sub="across queries" color="text-blue-400" />
            <AnalyticsStatCard label="Avg Position" value={String(totals.avgPos)} sub="across queries" color="text-amber-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4">Query</th>
                  <th className="pb-2 text-right pr-4">Impressions</th>
                  <th className="pb-2 text-right pr-4">Clicks</th>
                  <th className="pb-2 text-right pr-4">CTR</th>
                  <th className="pb-2 text-right pr-4">Position</th>
                  <th className="pb-2 text-right">VICE</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 pr-4 text-foreground">{truncate(kw.keyword, 40)}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{kw.impressions?.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">{kw.clicks}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{kw.ctr ? `${(kw.ctr * 100).toFixed(1)}%` : '-'}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{kw.position?.toFixed(1)}</td>
                    <td className="py-2 text-right text-accent">{kw.viceScore?.toFixed(0) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

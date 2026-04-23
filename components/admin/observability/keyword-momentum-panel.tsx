import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { truncate, type CompareResult } from "./analytics-shared";

export function KeywordMomentumPanel({
  compare,
  loading,
  error,
}: {
  compare: CompareResult | null;
  loading: boolean;
  error: string | null;
}) {
  const risingChartData = (compare?.rising ?? []).slice(0, 15).map((r) => ({
    keyword: truncate(r.keyword, 18),
    delta: r.delta,
  }));

  const decliningChartData = (compare?.declining ?? []).slice(0, 10).map((d) => ({
    keyword: truncate(d.keyword, 18),
    delta: Math.abs(d.delta),
  }));

  return (
    <section className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Keyword Momentum</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading scans...</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <div className="space-y-6">
          {risingChartData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-emerald-400 mb-2">
                Rising ({compare!.rising.length} total)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={risingChartData} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#666" />
                  <YAxis
                    type="category"
                    dataKey="keyword"
                    tick={{ fill: '#aaa', fontSize: 12 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
                  />
                  <Bar dataKey="delta" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {decliningChartData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2">
                Declining ({compare!.declining.length} total)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={decliningChartData} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#666" />
                  <YAxis
                    type="category"
                    dataKey="keyword"
                    tick={{ fill: '#aaa', fontSize: 12 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
                  />
                  <Bar dataKey="delta" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(compare?.newKeywords?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-medium text-blue-400 mb-2">
                New Keywords ({compare!.newKeywords.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {compare!.newKeywords.slice(0, 20).map((nk) => (
                  <span
                    key={nk.keyword}
                    className="px-2 py-1 text-xs rounded bg-blue-900/30 text-blue-300 border border-blue-800/40"
                  >
                    {nk.keyword}{' '}
                    <span className="text-blue-500">({nk.score.toFixed(0)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

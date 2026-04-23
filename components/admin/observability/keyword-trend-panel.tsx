import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KeywordHistoryPoint } from "./analytics-shared";

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function KeywordTrendPanel({
  trendKeywords,
  trendData,
  loading,
}: {
  trendKeywords: string[];
  trendData: Record<string, KeywordHistoryPoint[]>;
  loading: boolean;
}) {
  // Pivot to rows keyed by scan date so recharts can render one line per kw
  const lineChartData = (() => {
    const allDates = new Set<string>();
    for (const pts of Object.values(trendData)) {
      for (const p of pts) allDates.add(p.scanDate);
    }
    const sorted = Array.from(allDates).sort();
    return sorted.map((date) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = { date: date.slice(0, 10) };
      for (const kw of trendKeywords) {
        const pt = trendData[kw]?.find((p) => p.scanDate === date);
        row[kw] = pt?.score ?? null;
      }
      return row;
    });
  })();

  return (
    <section className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Keyword Trend Over Time</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading trend data...</p>
      ) : lineChartData.length < 2 ? (
        <p className="text-muted-foreground text-sm">
          Need 2+ scans with keyword history to chart trends.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineChartData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11, fill: '#aaa' }} />
            <YAxis stroke="#666" tick={{ fontSize: 11, fill: '#aaa' }} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
            {trendKeywords.map((kw, i) => (
              <Line
                key={kw}
                type="linear"
                dataKey={kw}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

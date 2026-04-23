import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsStatCard, type PipelineCosts } from "./analytics-shared";

export function LlmCostsPanel({ costs }: { costs: PipelineCosts | null }) {
  if (!costs) return null;

  const byDayData = Object.entries(costs.byDay)
    .sort()
    .slice(-14)
    .map(([day, v]) => ({ day: day.slice(5), calls: v.calls, cost: v.costUsd }));

  return (
    <section className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">LLM Costs (30 days)</h2>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <AnalyticsStatCard label="Total Calls" value={String(costs.total.calls)} sub="30 days" color="text-foreground" />
        <AnalyticsStatCard label="Input Tokens" value={costs.total.inputTokens.toLocaleString()} sub="" color="text-muted-foreground" />
        <AnalyticsStatCard label="Output Tokens" value={costs.total.outputTokens.toLocaleString()} sub="" color="text-muted-foreground" />
        <AnalyticsStatCard label="Total Cost" value={`$${costs.total.costUsd.toFixed(4)}`} sub="USD" color="text-accent" />
      </div>
      {byDayData.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byDayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 10, fill: '#aaa' }} />
            <YAxis stroke="#666" tick={{ fontSize: 10, fill: '#aaa' }} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }} />
            <Bar dataKey="calls" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

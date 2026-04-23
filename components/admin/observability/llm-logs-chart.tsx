// Daily LLM cost + call count chart for the LLM Logs tab. Kept separate
// so the main tab file stays focused on fetching and layout.

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyStat } from "./llm-logs-shared";

export function LlmLogsDailyChart({ daily }: { daily: DailyStat[] }) {
  const chartData = daily.map((d) => ({
    date: d.date.slice(5), // MM-DD
    cost: d.cost,
    calls: d.calls,
  }));

  if (chartData.length < 2) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Daily Breakdown</h2>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="cost"
            orientation="left"
            tick={{ fill: '#10b981', fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <YAxis
            yAxisId="calls"
            orientation="right"
            tick={{ fill: '#38bdf8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            formatter={(value: number, name: string) =>
              name === 'cost' ? [`$${value.toFixed(4)}`, 'Cost'] : [value, 'Calls']
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            yAxisId="calls"
            dataKey="calls"
            fill="#38bdf8"
            opacity={0.15}
            radius={[4, 4, 0, 0]}
            barSize={40}
          />
          <Area
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            stroke="#10b981"
            fill="url(#colorCost)"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

// Session 28: dashboard charts for the SearxNG auto-actions log.
// Pattern lifted from llm-logs-chart.tsx (ComposedChart + dark theme).
//
// AutoActionsByDayChart  — stacked bar of applied/pending_review/skipped per day.
// DiscoveriesByDayChart  — line chart of competitor_discover decisions per day.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface AutoActionDailyRow {
  date: string;
  applied: number;
  pending_review: number;
  skipped: number;
}

export interface DiscoveriesDailyRow {
  date: string;
  applied: number;
  pending_review: number;
}

const COLORS = {
  applied: "#10b981",
  pending_review: "#f59e0b",
  skipped: "#94a3b8",
};

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--surface))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

export function AutoActionsByDayChart({ daily }: { daily: AutoActionDailyRow[] }) {
  if (daily.length < 2) return <EmptyChart label="Auto-actions per day" />;

  return (
    <ChartFrame title="Auto-actions per day (by decision)">
      <BarChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={35} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        <Bar dataKey="applied" stackId="d" fill={COLORS.applied} radius={[0, 0, 0, 0]} />
        <Bar dataKey="pending_review" stackId="d" fill={COLORS.pending_review} />
        <Bar dataKey="skipped" stackId="d" fill={COLORS.skipped} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function DiscoveriesByDayChart({ daily }: { daily: DiscoveriesDailyRow[] }) {
  if (daily.length < 2) return <EmptyChart label="Competitor discoveries per day" />;

  return (
    <ChartFrame title="Competitor discoveries per day">
      <LineChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={35} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        <Line
          type="monotone"
          dataKey="applied"
          name="auto-applied"
          stroke={COLORS.applied}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.applied }}
        />
        <Line
          type="monotone"
          dataKey="pending_review"
          name="pending review"
          stroke={COLORS.pending_review}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.pending_review }}
        />
      </LineChart>
    </ChartFrame>
  );
}

function ChartFrame({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
        {title}
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
        {label}
      </h2>
      <div className="py-12 text-center text-sm text-muted-foreground">
        Not enough data yet — run an auto-action to populate the log.
      </div>
    </div>
  );
}

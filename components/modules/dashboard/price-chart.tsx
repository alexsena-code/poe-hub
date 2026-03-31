"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface PricePoint {
  date: string;
  median: number;
  cnlPrice: number | null;
  league: string;
}

export function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Divine - Historico de Preco</CardTitle>
          <CardDescription>Ultimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem dados de preco disponiveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Gather all values for y-axis range
  const medians = data.map((d) => d.median);
  const cnlPrices = data
    .filter((d) => d.cnlPrice !== null)
    .map((d) => d.cnlPrice as number);
  const allValues = [...medians, ...cnlPrices];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const yRange = maxVal - minVal || 1;
  const yPadding = yRange * 0.1;
  const yMin = minVal - yPadding;
  const yMax = maxVal + yPadding;

  // Map data to coordinates
  const xScale = (i: number) =>
    padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (v: number) =>
    padding.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  // Build SVG path for median line
  const medianPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.median)}`)
    .join(" ");

  // Build SVG path for CNL line
  const cnlPoints = data
    .map((d, i) => ({ x: xScale(i), y: d.cnlPrice, idx: i }))
    .filter((p) => p.y !== null);
  const cnlPath =
    cnlPoints.length > 1
      ? cnlPoints
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${p.x} ${yScale(p.y as number)}`
          )
          .join(" ")
      : null;

  // Y-axis ticks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / (yTickCount - 1);
    return { val, y: yScale(val) };
  });

  // X-axis labels (show ~5 dates)
  const xLabelCount = Math.min(5, data.length);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const dataIdx = Math.round(
      (i / Math.max(xLabelCount - 1, 1)) * (data.length - 1)
    );
    return {
      x: xScale(dataIdx),
      label: new Date(data[dataIdx].date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Divine - Historico de Preco</CardTitle>
        <CardDescription>
          Ultimos 30 dias &mdash; Mediana e CNL (R$)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <text
              key={`ytick-${i}`}
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
            >
              {tick.val.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </text>
          ))}

          {/* X-axis labels */}
          {xLabels.map((label, i) => (
            <text
              key={`xtick-${i}`}
              x={label.x}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
            >
              {label.label}
            </text>
          ))}

          {/* Median line */}
          <path
            d={medianPath}
            fill="none"
            stroke="hsl(220, 70%, 60%)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* CNL line */}
          {cnlPath && (
            <path
              d={cnlPath}
              fill="none"
              stroke="hsl(45, 90%, 55%)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6 3"
            />
          )}

          {/* Median dots */}
          {data.map((d, i) => (
            <circle
              key={`dot-${i}`}
              cx={xScale(i)}
              cy={yScale(d.median)}
              r={2.5}
              fill="hsl(220, 70%, 60%)"
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ backgroundColor: "hsl(220, 70%, 60%)" }}
            />
            Mediana
          </div>
          {cnlPath && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded border-dashed"
                style={{ backgroundColor: "hsl(45, 90%, 55%)" }}
              />
              CNL
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

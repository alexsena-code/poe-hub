import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PnlByDayChart } from "@/components/modules/fills/pnl-by-day-chart";
import type { CxExecutorStat, FillStats, PlanOrder, SignalFreshness } from "@/lib/cx-stats";

// Seções presentacionais da página de STATS do CX. Server components puros
// (recebem dados por props, não fazem I/O). O gráfico de PnL/dia reusa o
// PnlByDayChart do módulo fills (única ilha client, recharts).

function fmt(n: number | null | undefined, dp = 2): string {
  if (n == null) return "-";
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: dp });
}

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
}

// "há X" — frescor legível (segundos/min/horas/dias) a partir de um ISO.
function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `há ${secs}s`;
  if (secs < 3600) return `há ${Math.floor(secs / 60)}min`;
  if (secs < 86400) return `há ${Math.floor(secs / 3600)}h`;
  return `há ${Math.floor(secs / 86400)}d`;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "outline",
  holding: "secondary",
  closed: "default",
  cancelled: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  holding: "Segurando",
  closed: "Fechada",
  cancelled: "Cancelada",
};

function pnlClass(n: number | null): string {
  if (n == null) return "";
  return n >= 0 ? "text-green-500" : "text-destructive";
}

export function ExecutorsCard({ executors }: { executors: CxExecutorStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executores</CardTitle>
      </CardHeader>
      <CardContent>
        {executors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum executor registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Executor</TableHead>
                  <TableHead>PC</TableHead>
                  <TableHead>Liga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Jobs pend.</TableHead>
                  <TableHead>Visto por último</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executors.map((e) => (
                  <TableRow key={e.executorId}>
                    <TableCell className="font-mono text-xs">{e.executorId}</TableCell>
                    <TableCell>{e.pcName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{e.league ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={e.isOnline ? "default" : "outline"}>
                        {e.isOnline ? "online" : "offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{e.pendingJobs}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDateTime(e.lastSeen)} <span className="opacity-70">({timeAgo(e.lastSeen)})</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FillKpis({ stats }: { stats: FillStats }) {
  const t = stats.report.totals;
  const kpis = [
    { label: "PnL realizado (chaos)", value: `${fmt(t.pnlChaos)} c`, cls: pnlClass(t.pnlChaos) },
    { label: "PnL realizado (divine)", value: `${fmt(t.pnlDiv, 4)} d`, cls: pnlClass(t.pnlDiv) },
    { label: "Trades fechados", value: `${t.closed}`, cls: "" },
    { label: "Abertas / Segurando", value: `${t.open} / ${t.holding}`, cls: "" },
    { label: "Fechados (7d)", value: `${stats.closedLast7}`, cls: "" },
    { label: "Velocidade", value: `${fmt(stats.fillsPerDay, 1)}/dia`, cls: "" },
  ];
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PnlDayCard({ stats }: { stats: FillStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>PnL por dia — chaos (últimos 14 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <PnlByDayChart data={stats.byDay} />
      </CardContent>
    </Card>
  );
}

export function RecentFillsCard({ recent }: { recent: FillStats["recent"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos fills</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sem fills registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Compra</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((f) => {
                  const pnl = f.pnlChaos ?? f.pnlDiv;
                  const unit = f.pnlChaos != null ? "c" : f.pnlDiv != null ? "d" : "";
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.item}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[f.status] ?? "outline"} className="text-[10px]">
                          {STATUS_LABEL[f.status] ?? f.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(f.buyRatio)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(f.sellRatio)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(f.qty, 0)}</TableCell>
                      <TableCell className={`text-right font-mono ${pnlClass(pnl)}`}>
                        {pnl != null ? `${fmt(pnl)}${unit}` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(f.at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PlanCard({ orders }: { orders: PlanOrder[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano atual (top ordens ativas)</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Sem plano publicado (o worker cxw ainda não gravou cx_order_plan para esta liga).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Liga</TableHead>
                  <TableHead className="text-right">Buy</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Lucro (div)</TableHead>
                  <TableHead className="text-right">P(fill)</TableHead>
                  <TableHead>Slot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={`${o.league}-${o.item}-${o.priority}`}>
                    <TableCell className="text-right font-mono text-muted-foreground">{o.priority}</TableCell>
                    <TableCell className="font-medium">{o.item}</TableCell>
                    <TableCell className="text-xs">{o.league}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(o.buyRatio, 4)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(o.sellRatio, 4)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(o.qty, 0)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(o.expProfitDiv, 4)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {o.pFill == null ? "-" : `${fmt(o.pFill * 100, 0)}%`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.slotClass === "active" ? "default" : "outline"} className="text-[10px]">
                        {o.slotClass}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SignalsCard({ signals }: { signals: SignalFreshness[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sinais por liga (frescor)</CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum sinal capturado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liga</TableHead>
                  <TableHead className="text-right">Sinais</TableHead>
                  <TableHead>Última captura</TableHead>
                  <TableHead className="text-right">Frescor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <TableRow key={s.league}>
                    <TableCell className="font-medium">{s.league}</TableCell>
                    <TableCell className="text-right font-mono">{s.count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(s.lastCapturedAt)}</TableCell>
                    <TableCell className="text-right text-xs">{timeAgo(s.lastCapturedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

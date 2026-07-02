import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { computeFillReport } from "@/lib/fills-report";
import { PnlByDayChart } from "@/components/modules/fills/pnl-by-day-chart";

const num = (v: unknown) => (v == null ? null : Number(v));
const fmt = (n: number, dp = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: dp });

interface Props {
  searchParams: Promise<{ league?: string }>;
}

export default async function FillsReportsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { league } = await searchParams;
  const where = league ? { league } : {};
  const fills = await prisma.fill.findMany({
    where,
    select: { item: true, status: true, pnlChaos: true, pnlDiv: true, sellFilledAt: true },
  });

  const report = computeFillReport(
    fills.map((f) => ({
      item: f.item,
      status: f.status,
      pnlChaos: num(f.pnlChaos),
      pnlDiv: num(f.pnlDiv),
      sellFilledAt: f.sellFilledAt,
    }))
  );
  const t = report.totals;

  const kpis = [
    { label: "PnL total (chaos)", value: `${fmt(t.pnlChaos)} c`, tone: t.pnlChaos >= 0 },
    { label: "PnL total (divine)", value: `${fmt(t.pnlDiv, 4)} d`, tone: t.pnlDiv >= 0 },
    { label: "Trades fechados", value: `${t.closed}`, tone: true },
    { label: "Win rate", value: t.winRate == null ? "—" : `${fmt(t.winRate * 100, 0)}%`, tone: true },
    { label: "PnL médio/trade", value: t.avgPnlChaos == null ? "—" : `${fmt(t.avgPnlChaos)} c`, tone: (t.avgPnlChaos ?? 0) >= 0 },
    { label: "Abertas / Segurando", value: `${t.open} / ${t.holding}`, tone: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Relatórios — Exchange${league ? ` (${league})` : ""}`}
        actions={
          <Link href="/farm/fills">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-xl font-bold ${k.tone ? "" : "text-destructive"}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PnL por dia */}
      <Card>
        <CardHeader>
          <CardTitle>PnL por dia (chaos)</CardTitle>
        </CardHeader>
        <CardContent>
          <PnlByDayChart data={report.byDay} />
        </CardContent>
      </Card>

      {/* PnL por item */}
      <Card>
        <CardHeader>
          <CardTitle>PnL por item</CardTitle>
        </CardHeader>
        <CardContent>
          {report.byItem.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem dados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-right py-2 font-medium">Trades</th>
                    <th className="text-right py-2 font-medium">PnL chaos</th>
                    <th className="text-right py-2 font-medium">PnL divine</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byItem.map((r) => (
                    <tr key={r.item} className="border-b last:border-0">
                      <td className="py-2">{r.item}</td>
                      <td className="text-right py-2 font-mono">{r.trades}</td>
                      <td className={`text-right py-2 font-mono ${r.pnlChaos >= 0 ? "" : "text-destructive"}`}>{fmt(r.pnlChaos)}</td>
                      <td className={`text-right py-2 font-mono ${r.pnlDiv >= 0 ? "" : "text-destructive"}`}>{fmt(r.pnlDiv, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getItemDetail } from "@/lib/cx-mock";
import { PriceVolumeChart, FillCurveChart } from "@/components/modules/signals/item-charts";

interface Props {
  params: Promise<{ item: string }>;
}

const f = (v: number | null, dp = 2, sfx = "") =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: dp }) + sfx;

export default async function ItemDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { item } = await params;
  const detail = getItemDetail(decodeURIComponent(item));
  if (!detail) notFound();
  const s = detail.signal;

  const kpis = [
    { label: "bid / ask", value: `${f(s.bid)} / ${f(s.ask)}` },
    { label: "MM buy / sell", value: `${f(s.mmBuy)} / ${f(s.mmSell)}` },
    { label: "VAMP (fair)", value: f(s.fairVamp) },
    { label: "spread MM", value: f(s.mmSpreadPct, 1, "%") },
    { label: "OBI", value: f(s.obi, 2) },
    { label: "slippage", value: f(s.slipPct, 1, "%") },
    { label: "½-vida", value: f(s.halfLifeH, 0, "h") },
    { label: "drift/dia", value: f(s.driftDay, 1, "%") },
    { label: "vol", value: f(s.volPct, 1, "%") },
    { label: "Kelly", value: f(s.kelly, 2) },
    { label: "markout", value: f(s.markoutPct, 1, "%") },
    { label: "liq/h", value: f(s.liqPerH, 0) },
    { label: "P(round-trip)", value: f(s.pRoundtrip, 2) },
    { label: "E[T] fill", value: f(s.eTFillH, 1, "h") },
    { label: "cap (div)", value: f(s.capDiv, 1) },
    { label: "conf", value: s.conf },
  ];

  const maxAsk = Math.max(...detail.book.asks.map((l) => l.qty), 1);
  const maxBid = Math.max(...detail.book.bids.map((l) => l.qty), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.item}
        actions={
          <Link href="/farm/signals">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
          </Link>
        }
      />

      {/* Indicadores */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="py-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-base font-bold font-mono">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preço + volume */}
        <Card>
          <CardHeader><CardTitle>Preço & volume (48h)</CardTitle></CardHeader>
          <CardContent><PriceVolumeChart data={detail.priceSeries} /></CardContent>
        </Card>

        {/* Curva de fill-prob */}
        <Card>
          <CardHeader><CardTitle>P(fill) por profundidade</CardTitle></CardHeader>
          <CardContent><FillCurveChart data={detail.fillCurve} /></CardContent>
        </Card>
      </div>

      {/* Book (escada) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-green-500">BID (você vende)</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {detail.book.bids.map((l) => (
              <BookRow key={l.price} price={l.price} qty={l.qty} pct={(l.qty / maxBid) * 100} tone="green" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-destructive">ASK (você compra)</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {detail.book.asks.map((l) => (
              <BookRow key={l.price} price={l.price} qty={l.qty} pct={(l.qty / maxAsk) * 100} tone="red" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BookRow({ price, qty, pct, tone }: { price: number; qty: number; pct: number; tone: "green" | "red" }) {
  const bg = tone === "green" ? "bg-green-500/15" : "bg-destructive/15";
  return (
    <div className="relative flex justify-between items-center text-sm font-mono px-2 py-1 rounded">
      <div className={`absolute inset-y-0 left-0 rounded ${bg}`} style={{ width: `${pct}%` }} />
      <span className="relative">{price.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} c</span>
      <span className="relative text-muted-foreground">{qty.toLocaleString("pt-BR")}</span>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import type { CxSignal } from "@/lib/cx-signals";

type NumKey = {
  [K in keyof CxSignal]: CxSignal[K] extends number | null ? K : never;
}[keyof CxSignal];

interface Col {
  key: NumKey;
  label: string;
  desc: string; // texto do tooltip (shadcn)
  dp?: number;
  suffix?: string;
  signed?: boolean;
}

// Ordem "book -> Tier 1 -> fill-prob". label = nome curto; desc = explicação (tooltip).
const COLS: Col[] = [
  { key: "bid", label: "Bid", desc: "Melhor preço de COMPRA no book (a maior oferta de compra). É onde você vende na hora, batendo numa ordem existente." },
  { key: "ask", label: "Ask", desc: "Melhor preço de VENDA no book (a menor oferta de venda). É onde você compra na hora, batendo numa ordem existente." },
  { key: "spreadPct", label: "Spread", desc: "Distância entre ask e bid, em %. Book mais 'largo' = mais caro atravessar de um lado ao outro.", dp: 1, suffix: "%" },
  { key: "mmBuy", label: "MM compra", desc: "Onde POSTAR sua ordem de compra e esperar encher: um nível com fila real e num valor 'redondo' (razão de inteiros que o Currency Exchange aceita)." },
  { key: "mmSell", label: "MM venda", desc: "Onde POSTAR sua ordem de venda e esperar encher — mesma lógica do MM compra." },
  { key: "mmSpreadPct", label: "Spread MM", desc: "Lucro bruto do flip se as duas pernas encherem. Ex.: comprar a 6 e vender a 9 = +50%.", dp: 1, suffix: "%" },
  { key: "fairVamp", label: "Fair (VAMP)", desc: "Preço 'justo' do item, ponderado pelo volume nos topos do book. Referência melhor que a média simples entre bid e ask." },
  { key: "obi", label: "OBI", desc: "Desequilíbrio do book (−1 a +1). Positivo = mais gente querendo comprar (tende a subir); negativo = mais querendo vender.", dp: 2, signed: true },
  { key: "slipPct", label: "Slippage", desc: "Quanto o preço médio piora quando você executa o tamanho-alvo de uma vez, 'comendo' vários níveis do book.", dp: 1, suffix: "%" },
  { key: "halfLifeH", label: "Meia-vida", desc: "Quando o preço se afasta da média, é o tempo (em horas) pra ele voltar METADE do caminho. Menor = reverte mais rápido. Vazio = não costuma voltar.", dp: 0, suffix: "h" },
  { key: "driftDay", label: "Drift/dia", desc: "Tendência do preço por dia. Negativo = está caindo (risco de 'faca caindo': comprar e ver desvalorizar).", dp: 1, suffix: "%", signed: true },
  { key: "volPct", label: "Volatilidade", desc: "O quanto o preço balança por hora, em %. Maior = mais imprevisível.", dp: 1, suffix: "%" },
  { key: "kelly", label: "Kelly (¼)", desc: "Quanto do seu caixa a fórmula de Kelly (versão conservadora, ¼) sugere alocar neste flip, dado o lucro esperado e o risco.", dp: 2 },
  { key: "markoutPct", label: "Markout", desc: "Seleção adversa: o quanto o preço tende a andar CONTRA você logo depois que sua ordem enche (sinal de ter pego o 'lado ruim').", dp: 1, suffix: "%" },
  { key: "liqPerH", label: "Liquidez/h", desc: "Quantos itens são negociados por hora (dado da API Exchange). Mais liquidez = enche mais rápido.", dp: 0 },
  { key: "pFillBuy", label: "P(compra)", desc: "Chance da sua ordem de COMPRA encher dentro do horizonte definido.", dp: 2 },
  { key: "pFillSell", label: "P(venda)", desc: "Chance da sua ordem de VENDA encher dentro do horizonte.", dp: 2 },
  { key: "pRoundtrip", label: "P(round-trip)", desc: "Chance de fechar o flip inteiro (comprar E vender) no horizonte = P(compra) × P(venda).", dp: 2 },
  { key: "eTFillH", label: "Tempo fill", desc: "Horas estimadas pra encher a perna mais lenta — a que 'trava' o flip.", dp: 1, suffix: "h" },
  { key: "capDiv", label: "Capacidade", desc: "Maior tamanho do flip, em divines, que o book aguenta — limitado pelo lado mais raso.", dp: 1 },
];

const CONF_DESC = "Confiança do sinal. ok = tem fila de verdade dos dois lados e é líquido; fina = book raso perto do topo; baixa = ilíquido.";
const API_DESC = "Faixa de preço (mín..máx) da API oficial do Currency Exchange. OK = nosso book bate com o oficial; DIV = diverge (vale investigar).";
const CONF_VARIANT: Record<string, "default" | "secondary" | "outline"> = { ok: "default", fina: "secondary", baixa: "outline" };
const STORAGE_KEY = "cx-signals-hidden-cols";

function fmt(v: number | null, dp = 2, suffix = ""): string {
  if (v === null || v === undefined) return "-";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: dp }) + suffix;
}

// Conteúdo do tooltip shadcn: título em negrito + explicação
function TipBody({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="max-w-[16rem] space-y-1">
      <p className="font-semibold">{title}</p>
      <p className="text-xs leading-relaxed opacity-90">{desc}</p>
    </div>
  );
}

export function SignalsTable({ signals }: { signals: CxSignal[] }) {
  const [confFilter, setConfFilter] = useState<"all" | "ok">("all");
  const [sortKey, setSortKey] = useState<NumKey>("pRoundtrip");
  const [asc, setAsc] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
  }, []);
  function toggleCol(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const rows = useMemo(() => {
    const filtered = confFilter === "ok" ? signals.filter((s) => s.conf === "ok") : signals;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return asc ? av - bv : bv - av;
    });
  }, [signals, confFilter, sortKey, asc]);

  function toggleSort(key: NumKey) {
    if (key === sortKey) setAsc((v) => !v);
    else { setSortKey(key); setAsc(false); }
  }

  const showConf = !hidden.has("conf");
  const showApi = !hidden.has("apiExchange");
  const visibleCols = COLS.filter((c) => !hidden.has(c.key));
  const toggleables = [
    { key: "conf", label: "Confiança" },
    ...COLS.map((c) => ({ key: c.key as string, label: c.label })),
    { key: "apiExchange", label: "API Exchange" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant={confFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setConfFilter("all")}>Todos</Button>
          <Button variant={confFilter === "ok" ? "default" : "outline"} size="sm" onClick={() => setConfFilter("ok")}>Só conf ok</Button>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><SlidersHorizontal className="mr-2 h-4 w-4" /> Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
              <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleables.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.key}
                  checked={!hidden.has(t.key)}
                  onCheckedChange={() => toggleCol(t.key)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {t.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = "/api/signals/export"; }}>
            <Download className="mr-2 h-4 w-4" /> Exportar XLSX
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Item</TableHead>
                {showConf && (
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/40">Conf</span>
                      </TooltipTrigger>
                      <TooltipContent><TipBody title="Confiança" desc={CONF_DESC} /></TooltipContent>
                    </Tooltip>
                  </TableHead>
                )}
                {visibleCols.map((c) => (
                  <TableHead key={c.key} className="text-right whitespace-nowrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          <ArrowUpDown className={`h-3 w-3 ${sortKey === c.key ? "text-foreground" : "text-muted-foreground/40"}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><TipBody title={c.label} desc={c.desc} /></TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
                {showApi && (
                  <TableHead className="whitespace-nowrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/40">API Exchange</span>
                      </TooltipTrigger>
                      <TooltipContent><TipBody title="API Exchange" desc={API_DESC} /></TooltipContent>
                    </Tooltip>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.item}>
                  <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">
                    <Link href={`/farm/signals/${encodeURIComponent(s.item)}`} className="hover:underline">{s.item}</Link>
                  </TableCell>
                  {showConf && (
                    <TableCell><Badge variant={CONF_VARIANT[s.conf]} className="text-[10px]">{s.conf}</Badge></TableCell>
                  )}
                  {visibleCols.map((c) => {
                    const v = s[c.key];
                    const cls = c.signed && v != null ? (v >= 0 ? "text-green-500" : "text-destructive") : "";
                    return (
                      <TableCell key={c.key} className={`text-right font-mono whitespace-nowrap ${cls}`}>
                        {fmt(v, c.dp ?? 2, c.suffix ?? "")}
                      </TableCell>
                    );
                  })}
                  {showApi && (
                    <TableCell className="whitespace-nowrap text-xs">
                      {s.cxapiLo != null && s.cxapiHi != null
                        ? <span className={s.cxapiOk ? "text-green-500" : "text-destructive"}>[{s.cxapiLo}..{s.cxapiHi}] {s.cxapiOk ? "OK" : "DIV"}</span>
                        : "-"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Passe o mouse no cabeçalho p/ ver o que cada indicador significa. Clique p/ ordenar. Use "Colunas" p/ ocultar/mostrar. Clique no item p/ o detalhe.
        </p>
      </div>
    </TooltipProvider>
  );
}

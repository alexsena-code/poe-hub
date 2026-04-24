"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { PriceStatsCards } from "@/components/modules/prices/price-stats-cards";
import { PriceChart } from "@/components/modules/prices/price-chart";
import { PriceHistoryTable } from "@/components/modules/prices/price-history-table";
import { CrossLeaguePriceChart } from "@/components/modules/prices/cross-league-price-chart";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Settings, RefreshCw, X, Terminal } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useLeagues } from "@/hooks/use-leagues";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const POE_CHANNELS: Record<string, string> = {
  poe1: "1376913719245799521",
  poe2: "1376913719245799515",
};

export default function PricesPage() {
  const [poeVersion, setPoeVersion] = useState<"poe1" | "poe2">("poe1");
  const [statsItem, setStatsItem] = useState<"divine" | "chaos" | "mirror">("divine");
  const { activeLeagues } = useLeagues();
  const currentLeague = activeLeagues.find((l) => l.poeVersion === poeVersion)?.name;
  const [scraping, setScraping] = useState(false);
  const [logs, setLogs] = useState<{ type: "log" | "error" | "done"; text: string }[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  async function handleScrape() {
    setScraping(true);
    setLogs([]);
    setShowLogs(true);

    try {
      const res = await fetch("/api/prices/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: false }),
      });

      if (!res.ok || !res.body) {
        toast.error("Erro ao iniciar scraper.");
        setScraping(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)/);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1] as "log" | "error" | "done";
          const text = JSON.parse(dataMatch[1]);

          setLogs((prev) => [...prev, { type: event, text }]);

          if (event === "done") {
            if (text === "success") {
              toast.success("Scrape concluido!");
            } else {
              toast.error(`Scrape falhou: ${text}`);
            }
          }
        }
      }
    } catch {
      toast.error("Erro ao conectar com o scraper.");
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historico de Precos"
        description="Acompanhe a evolucao dos precos coletados do Discord."
        actions={
          <>
            <Button onClick={handleScrape} disabled={scraping}>
              {scraping ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {scraping ? "Scraping..." : "Atualizar Precos"}
            </Button>
            <Link href="/farm/prices/sources">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Sources
              </Button>
            </Link>
          </>
        }
      />

      {showLogs && (
        <div className="rounded-lg border bg-zinc-950 text-zinc-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Terminal className="h-4 w-4" />
              Scraper Log
              {scraping && <Spinner size="xs" />}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => setShowLogs(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div ref={logContainerRef} className="p-4 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
            {logs.length === 0 && (
              <span className="text-zinc-500">Aguardando output...</span>
            )}
            {logs.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.type === "error"
                    ? "text-red-400"
                    : entry.type === "done"
                      ? "text-emerald-400 font-bold mt-2"
                      : entry.text.startsWith("===")
                        ? "text-cyan-400 font-bold mt-1"
                        : entry.text.startsWith("---")
                          ? "text-yellow-400 mt-1"
                          : "text-zinc-300"
                }
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={poeVersion} onValueChange={(v) => setPoeVersion(v as "poe1" | "poe2")}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="poe1">PoE 1</SelectItem>
              <SelectItem value="poe2">PoE 2</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statsItem} onValueChange={(v) => setStatsItem(v as "divine" | "chaos" | "mirror")}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="divine">Divine</SelectItem>
              <SelectItem value="chaos">Chaos</SelectItem>
              <SelectItem value="mirror">Mirror</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <PriceStatsCards item={statsItem} league={currentLeague} channelId={POE_CHANNELS[poeVersion]} />
      </div>

      <PriceChart
        item={statsItem}
        league={currentLeague}
        channelId={POE_CHANNELS[poeVersion]}
      />

      <CrossLeaguePriceChart item={statsItem} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Historico Detalhado</h2>
        <PriceHistoryTable />
      </div>
    </div>
  );
}

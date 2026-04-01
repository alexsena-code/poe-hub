"use client";

import { useState } from "react";
import Link from "next/link";
import { PriceStatsCards } from "@/components/modules/prices/price-stats-cards";
import { PriceChart } from "@/components/modules/prices/price-chart";
import { PriceHistoryTable } from "@/components/modules/prices/price-history-table";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Historico de Precos</h1>
          <p className="text-muted-foreground">
            Acompanhe a evolucao dos precos coletados do Discord.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/prices/sources">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Sources
            </Button>
          </Link>
        </div>
      </div>

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
        <PriceStatsCards item={statsItem} channelId={POE_CHANNELS[poeVersion]} />
      </div>

      <PriceChart
        item={statsItem}
        channelId={POE_CHANNELS[poeVersion]}
      />

      <div>
        <h2 className="text-xl font-semibold mb-4">Historico Detalhado</h2>
        <PriceHistoryTable />
      </div>
    </div>
  );
}

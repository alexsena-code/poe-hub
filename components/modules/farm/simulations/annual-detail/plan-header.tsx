"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlanResponse } from "./types";
import type { AnnualRollup } from "@/lib/annual-plan-calculator";

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}

function SummaryCard({ label, value, hint, tone }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-xl font-mono font-semibold tabular-nums mt-1",
            tone === "good" && "text-green-500",
            tone === "bad" && "text-destructive"
          )}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

interface PlanHeaderProps {
  plan: PlanResponse;
  rollup: AnnualRollup | null;
  dirty: boolean;
  saving: boolean;
  onNameChange: (v: string) => void;
  onYearChange: (v: number) => void;
  onNotesChange: (v: string) => void;
  onSave: () => void;
  formatMoney: (v: number, currency: string) => string;
}

export function PlanHeader({
  plan,
  rollup,
  dirty,
  saving,
  onNameChange,
  onYearChange,
  onNotesChange,
  onSave,
  formatMoney,
}: PlanHeaderProps) {
  const fmt = (v: number) => formatMoney(v, "usd");

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/farm/simulations/annual">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Input
                className="text-2xl font-bold h-auto border-0 bg-transparent px-0 focus-visible:ring-0"
                value={plan.name}
                onChange={(e) => onNameChange(e.target.value)}
              />
              <Input
                type="number"
                className="w-24 text-lg font-mono"
                value={plan.year}
                onChange={(e) => onYearChange(Number(e.target.value))}
              />
            </div>
            <Input
              placeholder="Notas (opcional)"
              className="text-sm text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0"
              value={plan.notes ?? ""}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
          <Button onClick={onSave} disabled={!dirty || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      {rollup && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Receita anual" value={fmt(rollup.leagueRevenue)} />
          <SummaryCard
            label="Custo das ligas"
            value={fmt(rollup.leagueOperationalCost + rollup.leagueOneTimeCost)}
            hint={`Op.: ${fmt(rollup.leagueOperationalCost)} · Único: ${fmt(rollup.leagueOneTimeCost)}`}
          />
          <SummaryCard label="Custo fixo anual" value={fmt(rollup.annualFixedCost)} />
          <SummaryCard
            label="Lucro anual"
            value={fmt(rollup.profit)}
            tone={rollup.profit >= 0 ? "good" : "bad"}
          />
          <SummaryCard
            label="ROI"
            value={`${rollup.roi >= 0 ? "+" : ""}${rollup.roi.toFixed(1)}%`}
            tone={rollup.roi >= 0 ? "good" : "bad"}
          />
        </div>
      )}
    </div>
  );
}

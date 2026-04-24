"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EditableNum } from "@/components/ui/editable-num";
import type { CustomCostEntry } from "./types";

interface FixedCostsPanelProps {
  costs: CustomCostEntry[];
  onAdd: () => void;
  onUpdate: (costId: string, patch: Partial<CustomCostEntry>) => void;
  onRemove: (costId: string) => void;
  formatMoney: (v: number, currency: string) => string;
}

function calcAnnual(cc: CustomCostEntry): number {
  if (cc.cadence === "daily") return cc.amount * 365;
  if (cc.cadence === "monthly") return cc.amount * 12;
  return cc.amount; // one_time
}

export function FixedCostsPanel({
  costs,
  onAdd,
  onUpdate,
  onRemove,
  formatMoney,
}: FixedCostsPanelProps) {
  const fmt = (v: number) => formatMoney(v, "usd");

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold">Custos fixos anuais</p>
            <p className="text-xs text-muted-foreground">
              Custos que rodam o ano todo independente de liga (VPS, eletricidade). Diário × 365, mensal × 12.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar custo
          </Button>
        </div>

        {costs.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Nenhum custo fixo anual.
          </p>
        ) : (
          <div className="space-y-2">
            {costs.map((cc) => (
              <FixedCostRow
                key={cc.id}
                cc={cc}
                annual={fmt(calcAnnual(cc))}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FixedCostRowProps {
  cc: CustomCostEntry;
  annual: string;
  onUpdate: (costId: string, patch: Partial<CustomCostEntry>) => void;
  onRemove: (costId: string) => void;
}

function FixedCostRow({ cc, annual, onUpdate, onRemove }: FixedCostRowProps) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 items-center p-2 rounded-md border bg-muted/30">
      <Input
        placeholder="Nome"
        value={cc.name}
        onChange={(e) => onUpdate(cc.id, { name: e.target.value })}
      />
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-muted-foreground">$</span>
        <EditableNum
          value={cc.amount}
          decimals={2}
          onChange={(v) => onUpdate(cc.id, { amount: v })}
        />
      </div>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={cc.cadence}
        onChange={(e) =>
          onUpdate(cc.id, { cadence: e.target.value as CustomCostEntry["cadence"] })
        }
      >
        <option value="daily">Diário</option>
        <option value="monthly">Mensal</option>
        <option value="one_time">Único</option>
      </select>
      <div className="text-right text-sm">
        <span className="text-muted-foreground text-xs">anual: </span>
        <span className="font-mono font-medium">{annual}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={() => onRemove(cc.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

"use client";

// Section B: editable costs table (fixed costs + custom costs) with
// cost-config selector per simulation. All mutations bubble up via callbacks
// so state lives in the orchestrator.

import Link from "next/link";
import { Save, Plus, X } from "lucide-react";
import { EditableNum } from "@/components/ui/editable-num";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Simulation, CostConfigOption, CustomCost } from "./types";

// Fixed cost rows rendered in order
const FIXED_COST_ROWS: {
  key: keyof Pick<
    Simulation,
    | "proxyCostPerBotMonthly"
    | "levelingCostPerBot"
    | "stashPackCostPerBot"
    | "expluginsKeyCostDaily"
    | "dpbKeyCostDaily"
  >;
  label: string;
  decimals: 2 | 4;
}[] = [
  { key: "proxyCostPerBotMonthly", label: "Proxy/bot (mensal)", decimals: 2 },
  { key: "levelingCostPerBot", label: "Leveling/bot (único)", decimals: 2 },
  { key: "stashPackCostPerBot", label: "Stash pack/bot (único)", decimals: 2 },
  { key: "expluginsKeyCostDaily", label: "Explugins key (diário)", decimals: 4 },
  { key: "dpbKeyCostDaily", label: "DPB key (diário)", decimals: 4 },
];

interface CostPanelProps {
  simulations: Simulation[];
  simNames: string[];
  dirty: Set<string>;
  costConfigs: CostConfigOption[];
  onApplyConfig: (simIndex: number, configId: string) => void;
  onUpdateSimCost: (
    simIndex: number,
    field: (typeof FIXED_COST_ROWS)[number]["key"],
    value: number
  ) => void;
  onUpdateCustomCost: (simIndex: number, costId: string, patch: Partial<CustomCost>) => void;
  onAddCustomCost: (simIndex: number) => void;
  onRemoveCustomCost: (simIndex: number, costId: string) => void;
  onSave: (simIndex: number) => void;
}

export function CostPanel({
  simulations,
  simNames,
  dirty,
  costConfigs,
  onApplyConfig,
  onUpdateSimCost,
  onUpdateCustomCost,
  onAddCustomCost,
  onRemoveCustomCost,
  onSave,
}: CostPanelProps) {
  const maxCustoms = Math.max(
    ...simulations.map((s) => (s.customCosts ?? []).length),
    0
  );

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold">Custos (editáveis)</p>
            <p className="text-xs text-muted-foreground">
              Edite diretamente os custos desta simulação, ou troque o setup de custos para
              snapshotar novos valores. Valores em USD.
            </p>
          </div>
          <Link
            href="/admin/config/costs"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Gerenciar setups
          </Link>
        </div>

        {/* Cost config selector per simulation */}
        <div
          className="grid gap-2 mb-3 px-1"
          style={{ gridTemplateColumns: `12rem repeat(${simulations.length}, 1fr)` }}
        >
          <div className="text-xs text-muted-foreground font-medium self-center">
            Setup de custos
          </div>
          {simulations.map((sim, si) => {
            const linkedId = sim.costLinks?.[0]?.costConfigId ?? "";
            return (
              <select
                key={sim.id}
                className="h-8 text-xs rounded-md border border-input bg-background px-2"
                value={linkedId}
                onChange={(e) => onApplyConfig(si, e.target.value)}
              >
                <option value="" disabled>
                  Selecionar setup…
                </option>
                {costConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isDefault ? " (padrão)" : ""}
                  </option>
                ))}
              </select>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Custo</TableHead>
                {simulations.map((sim, si) => (
                  <TableHead key={sim.id} className="text-right border-l border-border/50">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-foreground">{simNames[si]}</span>
                      {dirty.has(sim.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Salvar"
                          onClick={() => onSave(si)}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Fixed cost rows */}
              {FIXED_COST_ROWS.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-sm text-muted-foreground">{row.label}</TableCell>
                  {simulations.map((sim, si) => (
                    <TableCell key={sim.id} className="text-right border-l border-border/50">
                      <EditableNum
                        value={Number(sim[row.key] ?? 0)}
                        decimals={row.decimals}
                        onChange={(v) => onUpdateSimCost(si, row.key, v)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {/* Custom costs section header */}
              <TableRow>
                <TableCell
                  colSpan={1 + simulations.length}
                  className="pt-5 pb-1 text-xs uppercase tracking-wider text-muted-foreground font-medium"
                >
                  Custos adicionais
                </TableCell>
              </TableRow>

              {/* Custom cost rows (aligned by index across simulations) */}
              {maxCustoms === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={1 + simulations.length}
                    className="text-center text-xs text-muted-foreground py-2"
                  >
                    Nenhum custo adicional — use o botão + abaixo de cada simulação para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                Array.from({ length: maxCustoms }, (_, idx) => (
                  <TableRow key={`custom-row-${idx}`}>
                    <TableCell className="text-xs text-muted-foreground align-top pt-3">
                      #{idx + 1}
                    </TableCell>
                    {simulations.map((sim, si) => {
                      const cc = (sim.customCosts ?? [])[idx];
                      if (!cc) {
                        return (
                          <TableCell
                            key={sim.id}
                            className="text-right border-l border-border/50 text-muted-foreground text-xs"
                          >
                            —
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={sim.id} className="border-l border-border/50 align-top py-2">
                          <div className="grid grid-cols-[1fr_auto] gap-1 items-center">
                            <input
                              className="h-7 px-1.5 text-xs bg-background border border-input rounded-sm"
                              value={cc.name}
                              onChange={(e) =>
                                onUpdateCustomCost(si, cc.id, { name: e.target.value })
                              }
                              placeholder="Nome"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              title="Remover"
                              onClick={() => onRemoveCustomCost(si, cc.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <div className="flex items-center gap-1 col-span-2 justify-end">
                              <EditableNum
                                value={cc.amount}
                                decimals={2}
                                onChange={(v) => onUpdateCustomCost(si, cc.id, { amount: v })}
                              />
                              <select
                                className="h-6 text-xs bg-background border border-input rounded-sm px-1"
                                value={cc.cadence}
                                onChange={(e) =>
                                  onUpdateCustomCost(si, cc.id, {
                                    cadence: e.target.value as CustomCost["cadence"],
                                  })
                                }
                              >
                                <option value="daily">Diário</option>
                                <option value="monthly">Mensal</option>
                                <option value="one_time">Único</option>
                              </select>
                              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={cc.perBot}
                                  onChange={(e) =>
                                    onUpdateCustomCost(si, cc.id, { perBot: e.target.checked })
                                  }
                                />
                                /bot
                              </label>
                            </div>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}

              {/* Add-row buttons */}
              <TableRow>
                <TableCell />
                {simulations.map((sim, si) => (
                  <TableCell key={sim.id} className="text-right border-l border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onAddCustomCost(si)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Adicionar
                    </Button>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

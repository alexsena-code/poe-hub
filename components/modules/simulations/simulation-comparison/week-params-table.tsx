"use client";

// Section C: editable per-week defaults (bots / div-per-hour / hours-per-day).
// EditableNum cells update immediately in local state; save is triggered by the
// dirty-indicator Save button in the column header.

import React from "react";
import { Save } from "lucide-react";
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
import type { Simulation } from "./types";

interface WeekParamsTableProps {
  simulations: Simulation[];
  simNames: string[];
  allWeekNumbers: number[];
  dirty: Set<string>;
  onUpdateWeekDefault: (
    simIndex: number,
    weekNumber: number,
    field: string,
    value: number
  ) => void;
  onSave: (simIndex: number) => void;
}

export function WeekParamsTable({
  simulations,
  simNames,
  allWeekNumbers,
  dirty,
  onUpdateWeekDefault,
  onSave,
}: WeekParamsTableProps) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="font-semibold mb-3">Parametros por Semana</p>
        <p className="text-xs text-muted-foreground mb-4">
          Clique em um valor para editar. Os calculos atualizam em tempo real.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Semana</TableHead>
                {simulations.map((sim, si) => (
                  <TableHead
                    key={sim.id}
                    colSpan={3}
                    className="text-center border-l border-border/50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-foreground">{simNames[si]}</span>
                      {dirty.has(sim.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Salvar alteracoes"
                          onClick={() => onSave(si)}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead />
                {simulations.map((sim) => (
                  <React.Fragment key={sim.id}>
                    <TableHead className="text-center border-l border-border/50 text-xs font-normal text-muted-foreground">
                      Bots
                    </TableHead>
                    <TableHead className="text-center text-xs font-normal text-muted-foreground">
                      Div/hr
                    </TableHead>
                    <TableHead className="text-center text-xs font-normal text-muted-foreground">
                      Hrs/dia
                    </TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allWeekNumbers.map((wn) => (
                <TableRow key={wn}>
                  <TableCell className="text-sm font-medium">S{wn}</TableCell>
                  {simulations.map((sim, si) => {
                    const week = sim.weeks.find((w) => w.weekNumber === wn);
                    if (!week) {
                      return (
                        <React.Fragment key={sim.id}>
                          <TableCell className="text-center border-l border-border/50 text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">—</TableCell>
                          <TableCell className="text-center text-muted-foreground">—</TableCell>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={sim.id}>
                        <TableCell className="text-center border-l border-border/50">
                          <EditableNum
                            value={week.defaultActiveBots}
                            type="int"
                            onChange={(v) =>
                              onUpdateWeekDefault(si, wn, "defaultActiveBots", v)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <EditableNum
                            value={Number(week.defaultDivinePerHour)}
                            type="int"
                            onChange={(v) =>
                              onUpdateWeekDefault(si, wn, "defaultDivinePerHour", v)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <EditableNum
                            value={Number(week.defaultHoursPerDay)}
                            type="int"
                            onChange={(v) =>
                              onUpdateWeekDefault(si, wn, "defaultHoursPerDay", v)
                            }
                          />
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

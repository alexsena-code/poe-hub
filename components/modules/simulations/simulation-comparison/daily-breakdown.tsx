"use client";

// Section E: Accordion with a per-day breakdown table for each week.
// Shows price / divines / revenue / profit per day per simulation, with
// locked days (before startDayOffset) rendered muted at 40% opacity.

import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { customPerBotDaily, customGlobalDaily, resolveField } from "./helpers";
import type { Simulation } from "./types";

interface DailyBreakdownProps {
  simulations: Simulation[];
  simNames: string[];
  allWeekNumbers: number[];
  formatMoney: (v: number, currency: "usd" | "brl") => string;
}

const DAYS_PER_WEEK = 7;

export function DailyBreakdown({
  simulations,
  simNames,
  allWeekNumbers,
  formatMoney,
}: DailyBreakdownProps) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="font-semibold mb-3">Breakdown Diario</p>
        <Accordion type="multiple" className="space-y-2">
          {allWeekNumbers.map((wn) => {
            // Gather the SimulationWeek for each simulation for this week number
            const weeksPerSim = simulations.map((sim) =>
              sim.weeks.find((w) => w.weekNumber === wn)
            );

            return (
              <AccordionItem
                key={wn}
                value={`week-${wn}`}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="text-sm font-medium">Semana {wn}</span>
                    {weeksPerSim[0]?.label && (
                      <span className="text-xs text-muted-foreground">
                        ({weeksPerSim[0].label})
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Dia</TableHead>
                          {simNames.map((name) => (
                            <TableHead
                              key={name}
                              colSpan={4}
                              className="text-center border-l border-border/50 text-xs"
                            >
                              {name}
                            </TableHead>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableHead />
                          {simulations.map((sim) => (
                            <React.Fragment key={sim.id}>
                              <TableHead className="text-right border-l border-border/50 text-xs font-normal text-muted-foreground">
                                Preco
                              </TableHead>
                              <TableHead className="text-right text-xs font-normal text-muted-foreground">
                                Divines
                              </TableHead>
                              <TableHead className="text-right text-xs font-normal text-muted-foreground">
                                Receita
                              </TableHead>
                              <TableHead className="text-right text-xs font-normal text-muted-foreground">
                                Lucro
                              </TableHead>
                            </React.Fragment>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: DAYS_PER_WEEK }, (_, di) => {
                          const dayNum = di + 1;
                          const globalIdx = (wn - 1) * 7 + di;

                          return (
                            <TableRow key={dayNum}>
                              <TableCell className="text-xs font-medium text-muted-foreground">
                                D{dayNum}
                              </TableCell>
                              {simulations.map((sim, si) => {
                                const week = weeksPerSim[si];
                                if (!week) {
                                  return (
                                    <React.Fragment key={sim.id}>
                                      <TableCell className="text-right border-l border-border/50 text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                    </React.Fragment>
                                  );
                                }

                                const day = week.days.find((d) => d.dayNumber === dayNum);
                                if (!day) {
                                  return (
                                    <React.Fragment key={sim.id}>
                                      <TableCell className="text-right border-l border-border/50 text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                    </React.Fragment>
                                  );
                                }

                                const isLocked = globalIdx < (sim.startDayOffset ?? 0);
                                const bots = resolveField(day, "activeBots", week) ?? 0;
                                const dph = resolveField(day, "divinePerHour", week);
                                const hours = resolveField(day, "hoursPerDay", week);
                                const priceBrl = resolveField(day, "divinePriceBrl", week);
                                const priceUsd = resolveField(day, "divinePriceUsd", week);
                                const price = priceBrl ?? priceUsd;

                                const divines =
                                  !isLocked && bots && dph && hours
                                    ? bots * Number(dph) * Number(hours)
                                    : 0;
                                const revenue = divines * (price ?? 0);

                                // Daily cost per bot
                                const hasCost =
                                  sim.proxyCostPerBotMonthly != null &&
                                  sim.expluginsKeyCostDaily != null &&
                                  sim.dpbKeyCostDaily != null;
                                const cpb = customPerBotDaily(sim.customCosts);
                                const cg = customGlobalDaily(sim.customCosts);
                                const costPerBotDailyVal = hasCost
                                  ? Number(sim.expluginsKeyCostDaily) +
                                    Number(sim.dpbKeyCostDaily) +
                                    Number(sim.proxyCostPerBotMonthly) / 30 +
                                    cpb
                                  : cpb;
                                const dayCost = bots * costPerBotDailyVal + cg;
                                const profit = revenue - dayCost;

                                const muted = isLocked ? " opacity-40" : "";
                                const curr = priceBrl != null ? ("brl" as const) : ("usd" as const);

                                return (
                                  <React.Fragment key={sim.id}>
                                    <TableCell
                                      className={`text-right border-l border-border/50 font-mono text-xs tabular-nums${muted}`}
                                    >
                                      {price != null ? formatMoney(price, curr) : "—"}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right font-mono text-xs tabular-nums${muted}`}
                                    >
                                      {divines > 0 ? divines.toFixed(0) : "—"}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right font-mono text-xs tabular-nums${muted}`}
                                    >
                                      {revenue > 0 ? formatMoney(revenue, curr) : "—"}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right font-mono text-xs tabular-nums${muted} ${
                                        !isLocked && revenue > 0
                                          ? profit >= 0
                                            ? "text-green-500"
                                            : "text-destructive"
                                          : ""
                                      }`}
                                    >
                                      {!isLocked && revenue > 0
                                        ? formatMoney(profit, curr)
                                        : "—"}
                                    </TableCell>
                                  </React.Fragment>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

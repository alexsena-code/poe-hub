"use client";

// Accordion listing each simulation week, with WeekEditor inside each item.
// Computes per-week revenue preview for the accordion trigger label.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { WeekEditor, type SimulationWeek } from "../week-editor";
import { resolveField } from "./utils";
import type { CostConfig } from "./types";
import type { DisplayCurrency } from "@/components/currency-provider";

interface SimulationWeeksAccordionProps {
  simulationId: string;
  sortedWeeks: SimulationWeek[];
  costConfig: CostConfig | null;
  startDayOffset: number;
  formatMoney: (val: number, currency: DisplayCurrency) => string;
  onWeekUpdated: (updatedWeek: SimulationWeek) => void;
}

export function SimulationWeeksAccordion({
  simulationId,
  sortedWeeks,
  costConfig,
  startDayOffset,
  formatMoney,
  onWeekUpdated,
}: SimulationWeeksAccordionProps) {
  return (
    <Accordion
      type="multiple"
      defaultValue={sortedWeeks.map((w) => `week-${w.weekNumber}`)}
      className="space-y-2"
    >
      {sortedWeeks.map((week) => {
        const weekRevenue = calcWeekRevenue(week);

        return (
          <AccordionItem
            key={week.weekNumber}
            value={`week-${week.weekNumber}`}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 text-left">
                <span className="text-base font-semibold">
                  Semana {week.weekNumber}
                </span>
                {week.label && (
                  <span className="text-sm text-muted-foreground">
                    ({week.label})
                  </span>
                )}
                <Badge variant="outline" className="font-mono text-xs">
                  {week.defaultActiveBots} bots
                </Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  Receita: {formatMoney(weekRevenue, "usd")}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WeekEditor
                simulationId={simulationId}
                week={week}
                costConfig={costConfig}
                startDayOffset={startDayOffset}
                onWeekUpdated={onWeekUpdated}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/** Quick USD revenue estimate for the accordion trigger badge. */
function calcWeekRevenue(week: SimulationWeek): number {
  let revenue = 0;
  for (const day of week.days) {
    const bots = resolveField(day, "activeBots", week);
    const dph = resolveField(day, "divinePerHour", week);
    const hours = resolveField(day, "hoursPerDay", week);
    const price = resolveField(day, "divinePriceUsd", week);
    if (bots !== null && dph !== null && hours !== null && price !== null) {
      revenue += bots * dph * hours * price;
    }
  }
  return revenue;
}

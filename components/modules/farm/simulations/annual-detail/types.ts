"use client";

import type { CustomCostEntry } from "@/lib/simulation-calculator";
import type { SimulationSnapshot } from "@/lib/annual-plan-calculator";

export type { CustomCostEntry, SimulationSnapshot };

export interface PlanResponse {
  id: string;
  name: string;
  year: number;
  annualCustomCosts: CustomCostEntry[] | null;
  notes: string | null;
  simulationLinks: {
    position: number;
    simulationId: string;
    repeatCount: number;
    simulation: SimulationSnapshot;
  }[];
}

export interface SimulationListItem {
  id: string;
  name: string;
  league: string;
  kind: "operational" | "forecast";
  durationWeeks: number;
}

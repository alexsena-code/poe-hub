export interface ParamChange {
  path: string;
  label: string;
  valueA: number | string | null;
  valueB: number | string | null;
}

interface WeekData {
  weekNumber: number;
  label: string | null;
  defaultActiveBots: number;
  defaultDivinePerHour: number;
  defaultHoursPerDay: number;
  defaultDivinePriceUsd: number | null;
  defaultDivinePriceBrl: number | null;
}

interface SimData {
  name: string;
  league: string;
  durationWeeks: number;
  startDayOffset: number;
  costConfigName: string | null;
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  weeks: WeekData[];
}

const WEEK_FIELD_LABELS: Record<string, string> = {
  defaultActiveBots: "Bots",
  defaultDivinePerHour: "Div/hr",
  defaultHoursPerDay: "Horas/dia",
  defaultDivinePriceUsd: "Preco USD",
  defaultDivinePriceBrl: "Preco BRL",
};

const SIM_FIELD_LABELS: Record<string, string> = {
  league: "Liga",
  durationWeeks: "Semanas",
  startDayOffset: "Offset inicio",
  costConfigName: "Config de custo",
  proxyCostPerBotMonthly: "Proxy/mes",
  levelingCostPerBot: "Leveling/bot",
  stashPackCostPerBot: "Stash/bot",
  expluginsKeyCostDaily: "ExPlugins/dia",
  dpbKeyCostDaily: "DPB/dia",
};

export function diffSimulations(simA: SimData, simB: SimData): ParamChange[] {
  const changes: ParamChange[] = [];

  // Compare simulation-level fields
  for (const field of Object.keys(SIM_FIELD_LABELS)) {
    const a = (simA as unknown as Record<string, unknown>)[field];
    const b = (simB as unknown as Record<string, unknown>)[field];
    if (String(a ?? "") !== String(b ?? "")) {
      changes.push({
        path: field,
        label: SIM_FIELD_LABELS[field],
        valueA: a as string | number | null,
        valueB: b as string | number | null,
      });
    }
  }

  // Compare week-level defaults
  const maxWeeks = Math.max(simA.weeks.length, simB.weeks.length);
  for (let i = 0; i < maxWeeks; i++) {
    const weekA = simA.weeks[i];
    const weekB = simB.weeks[i];

    if (!weekA || !weekB) {
      changes.push({
        path: `week${i + 1}`,
        label: `Semana ${i + 1}`,
        valueA: weekA ? "existe" : "n/a",
        valueB: weekB ? "existe" : "n/a",
      });
      continue;
    }

    for (const field of Object.keys(WEEK_FIELD_LABELS)) {
      const a = (weekA as unknown as Record<string, unknown>)[field];
      const b = (weekB as unknown as Record<string, unknown>)[field];
      if (String(a ?? "") !== String(b ?? "")) {
        changes.push({
          path: `week${i + 1}.${field}`,
          label: `${WEEK_FIELD_LABELS[field]} (S${i + 1})`,
          valueA: a as number | null,
          valueB: b as number | null,
        });
      }
    }
  }

  return changes;
}

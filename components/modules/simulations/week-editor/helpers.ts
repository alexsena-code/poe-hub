// Pure calculation and formatting helpers for the week editor.
// No React — safe to import from both client and server contexts.

import type { SimulationDay, SimulationWeek, InheritableField } from "./types";

/** Format a date string as dd/mm (pt-BR) for the day column label. */
export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Format a number as USD without currency conversion. */
export function fmtUsd(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `$${Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a number with pt-BR locale (used for divine counts and raw numbers). */
export function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "-";
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Resolve an inheritable field value: returns the day-level override if set,
 * otherwise falls back to the week default. Returns null only when neither is set.
 */
export function resolveField(
  day: SimulationDay,
  field: InheritableField,
  week: SimulationWeek
): number | null {
  const dayVal = day[field];
  if (dayVal !== null && dayVal !== undefined) return Number(dayVal);

  const defaultMap: Record<InheritableField, keyof SimulationWeek> = {
    activeBots: "defaultActiveBots",
    divinePerHour: "defaultDivinePerHour",
    hoursPerDay: "defaultHoursPerDay",
    divinePriceUsd: "defaultDivinePriceUsd",
    divinePriceBrl: "defaultDivinePriceBrl",
  };

  const weekVal = week[defaultMap[field]];
  return weekVal !== null && weekVal !== undefined ? Number(weekVal) : null;
}

/** Returns true when the day has a local override for the given field (not inheriting from week). */
export function isOverridden(day: SimulationDay, field: InheritableField): boolean {
  return day[field] !== null && day[field] !== undefined;
}

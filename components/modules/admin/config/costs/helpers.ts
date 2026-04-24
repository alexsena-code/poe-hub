// Pure helpers for the costs module — no React imports, safe for server use.

import { CustomCost } from "./types";

/** Human-readable cadence label in pt-BR. */
export function cadenceLabel(c: CustomCost["cadence"]): string {
  if (c === "daily") return "Diário";
  if (c === "monthly") return "Mensal";
  return "Único";
}

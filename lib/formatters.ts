/**
 * Shared formatting utilities for the PoE Hub UI.
 *
 * Convention from user memory: all dates displayed in pt-BR dd/mm/yyyy format.
 * Cost is always 5 decimal places to show micro-cost differences between models.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Format a date value as dd/MM/yyyy HH:mm in pt-BR locale.
 * @example formatDateTimeBr("2026-04-24T10:00:00Z") → "24/04/2026 10:00"
 */
export function formatDateTimeBr(value: string | Date): string {
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "-";
  }
}

/**
 * Format a date value as dd/MM/yyyy in pt-BR locale.
 * @example formatDateBr("2026-04-24T10:00:00Z") → "24/04/2026"
 */
export function formatDateBr(value: string | Date): string {
  try {
    return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

/**
 * Format a USD cost with 5 decimal places.
 * @example formatCostUsd(0.01234) → "$0.01234"
 */
export function formatCostUsd(value: number): string {
  return `$${value.toFixed(5)}`;
}

/**
 * Format milliseconds as a human-readable duration string.
 * @example formatDurationMs(192500) → "3m 12s"
 * @example formatDurationMs(4500) → "4s"
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

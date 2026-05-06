// Forward-fills sparse historical price series with compounded daily decay.
// Used by the simulation price-import route and the scenario-tester overlay so
// sim days that fall past the last known DailyPrice still get a sensible price
// instead of contributing R$ 0 to revenue.

/** Compounded daily decay applied past the last known datapoint. 10% / day. */
export const PRICE_DECAY_PER_DAY = 0.1;

export interface PriceRow {
  /** "yyyy-mm-dd" UTC date string. */
  date: string;
  /** Price in any unit (BRL, USD — caller picks). Must be > 0. */
  price: number;
}

export interface ExtrapolatedPrice {
  price: number;
  /** True when the value came from the input rows verbatim (no decay applied). */
  fromHistorical: boolean;
}

/**
 * Returns an extrapolated price for `targetDate` based on a sorted historical
 * series. Behavior:
 *
 * - Direct hit: returns the row's price, fromHistorical=true.
 * - After last known: lastPrice × (1 - decay)^daysAfter, fromHistorical=false.
 * - Inside a gap: lastPriceBefore × (1 - decay)^daysSince, fromHistorical=false.
 * - Before first known: returns the first row's price as-is (no reverse decay)
 *   and fromHistorical=false (it's an assumption, not a real datapoint).
 *
 * Returns null only when `sortedRows` is empty or `targetDate` is malformed.
 *
 * Caller MUST pass rows already sorted ascending by date — we don't re-sort.
 *
 * @example
 *   const rows = [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 90 }];
 *   extrapolatePrice(rows, "2026-01-04");  // { price: 72.9, fromHistorical: false }
 */
export function extrapolatePrice(
  sortedRows: ReadonlyArray<PriceRow>,
  targetDate: string,
  decayPerDay: number = PRICE_DECAY_PER_DAY,
): ExtrapolatedPrice | null {
  if (sortedRows.length === 0) return null;
  if (decayPerDay < 0 || decayPerDay >= 1) {
    throw new Error(
      `bad decayPerDay: ${decayPerDay} (expected fraction in [0, 1))`,
    );
  }
  const targetMs = parseUtcDateMs(targetDate);
  if (targetMs == null) return null;

  const first = sortedRows[0];
  const firstMs = parseUtcDateMs(first.date);
  if (firstMs == null) return null;

  if (targetMs < firstMs) return { price: first.price, fromHistorical: false };

  // Walk forward until we cross targetDate. Stops at the last row at-or-before.
  let anchor = first;
  let anchorMs = firstMs;
  for (let i = 1; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const ms = parseUtcDateMs(row.date);
    if (ms == null) continue;
    if (ms > targetMs) break;
    anchor = row;
    anchorMs = ms;
  }

  const daysSince = Math.round((targetMs - anchorMs) / 86_400_000);
  if (daysSince === 0) return { price: anchor.price, fromHistorical: true };

  const factor = Math.pow(1 - decayPerDay, daysSince);
  return { price: anchor.price * factor, fromHistorical: false };
}

function parseUtcDateMs(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

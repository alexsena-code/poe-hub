/**
 * Shared helper for resolving a PoE currency's CDN icon URL at insert time.
 *
 * Used by every currency insertion point (side-panel-assets click, slash command,
 * drag-drop) so the editor chip and the preview pane render the same icon.
 *
 * Delegates to fetchItemRaw — already fail-soft (returns null on engine
 * unreachable / 404 / timeout), so this wrapper never throws either.
 *
 * Session 09.a — icon parity between editor chip and preview.
 *
 * @example
 * const iconUrl = await resolveCurrencyIcon("Divine Orb");
 * editor.commands.insertPoeCurrency({ currencyName: "Divine Orb", iconUrl });
 */

import { fetchItemRaw } from '../preview/fetch-helpers';

/**
 * Resolves the CDN icon URL for a PoE currency name.
 *
 * Returns `null` when:
 *   - `name` is blank
 *   - the engine is unreachable or returns 404
 *   - the response doesn't include an `iconUrl`
 *
 * Never throws — callers can insert the chip unconditionally and fall back
 * to the ◈ glyph when the result is null.
 */
export async function resolveCurrencyIcon(name: string): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const data = await fetchItemRaw(trimmed);
  return data?.iconUrl ?? null;
}

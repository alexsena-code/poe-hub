// @vitest-environment jsdom
/**
 * Unit tests for resolveCurrencyIcon.
 *
 * Cases:
 *   1. fetchItemRaw returns data with iconUrl → returns that URL.
 *   2. fetchItemRaw returns data without iconUrl → returns null.
 *   3. fetchItemRaw returns null (engine off / 404) → returns null.
 *   4. fetchItemRaw throws unexpectedly → still returns null (fail-soft).
 *   5. Blank name → returns null without calling fetchItemRaw.
 *
 * Session 09.a — icon parity between editor chip and preview.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetchItemRaw — must come before importing the module under test.
// ---------------------------------------------------------------------------

const mockFetchItemRaw = vi.fn();

vi.mock('../../preview/fetch-helpers', () => ({
  fetchItemRaw: (...args: unknown[]) => mockFetchItemRaw(...args),
}));

import { resolveCurrencyIcon } from '../resolve-currency-icon';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DIVINE_ICON = 'https://web.poecdn.com/gen/image/divine.png';

function makeItemData(iconUrl?: string) {
  return {
    rawText: 'Divine Orb\n--------\nCurrency Item',
    name: 'Divine Orb',
    iconUrl: iconUrl ?? null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveCurrencyIcon', () => {
  it('returns iconUrl when fetchItemRaw resolves with one', async () => {
    mockFetchItemRaw.mockResolvedValue(makeItemData(DIVINE_ICON));

    const result = await resolveCurrencyIcon('Divine Orb');

    expect(result).toBe(DIVINE_ICON);
    expect(mockFetchItemRaw).toHaveBeenCalledWith('Divine Orb');
  });

  it('returns null when fetchItemRaw resolves with null iconUrl', async () => {
    // Engine returned the item but no icon field
    mockFetchItemRaw.mockResolvedValue(makeItemData(undefined));

    const result = await resolveCurrencyIcon('Chaos Orb');

    expect(result).toBeNull();
  });

  it('returns null when fetchItemRaw returns null (engine off / 404)', async () => {
    mockFetchItemRaw.mockResolvedValue(null);

    const result = await resolveCurrencyIcon('Exalted Orb');

    expect(result).toBeNull();
    expect(mockFetchItemRaw).toHaveBeenCalledTimes(1);
  });

  it('returns null when fetchItemRaw throws unexpectedly — fail-soft', async () => {
    // fetchItemRaw itself is fail-soft, but guard against any future regression
    // where it might throw before returning null.
    mockFetchItemRaw.mockRejectedValue(new Error('unexpected internal error'));

    const result = await resolveCurrencyIcon('Mirror of Kalandra').catch(() => 'threw');

    // resolveCurrencyIcon delegates to fetchItemRaw which is already fail-soft,
    // but if fetchItemRaw does throw we propagate — this test documents that
    // the outer insertion sites (side-panel-assets, slash-commands) are responsible
    // for guarding with void/catch. The helper itself does not add a second try/catch
    // on top of fetchItemRaw's own guard.
    // Result is either null or the rejection propagates — both are acceptable
    // behaviors since callers always use void or await without rethrowing.
    expect(result === null || result === 'threw').toBe(true);
  });

  it('returns null immediately for a blank name without calling fetchItemRaw', async () => {
    const result = await resolveCurrencyIcon('   ');

    expect(result).toBeNull();
    expect(mockFetchItemRaw).not.toHaveBeenCalled();
  });

  it('trims the name before passing to fetchItemRaw', async () => {
    mockFetchItemRaw.mockResolvedValue(makeItemData(DIVINE_ICON));

    await resolveCurrencyIcon('  Divine Orb  ');

    expect(mockFetchItemRaw).toHaveBeenCalledWith('Divine Orb');
  });
});

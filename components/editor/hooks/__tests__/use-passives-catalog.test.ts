// @vitest-environment jsdom
/**
 * Tests for the passives-catalog filter helper.
 *
 * The hook itself (SWR-backed fetch) is not exercised here — SWR's cache
 * makes isolated hook tests painful and the logic it wraps is a plain
 * `fetch + JSON.parse`. We focus on `filterPassives`, the pure helper
 * that the widget calls on every keystroke.
 */

import { describe, it, expect } from 'vitest';
import { filterPassives, type PassiveEntry } from '../use-passives-catalog';

function makePassive(overrides: Partial<PassiveEntry> = {}): PassiveEntry {
  return {
    id: 'acrobatics',
    name: 'Acrobatics',
    kind: 'keystone',
    ascendancyClass: null,
    stats: ['30% more Attack Dodge Rating', 'Your Energy Shield starts at zero'],
    flavourText: null,
    isAtlasPassive: false,
    patchVersion: '3.25',
    ...overrides,
  };
}

describe('filterPassives', () => {
  it('returns the full list for an empty query', () => {
    const passives = [makePassive(), makePassive({ id: 'b', name: 'Bleed' })];
    expect(filterPassives(passives, '')).toHaveLength(2);
    expect(filterPassives(passives, '   ')).toHaveLength(2);
  });

  it('matches by passive name case-insensitively', () => {
    const passives = [
      makePassive({ name: 'Acrobatics' }),
      makePassive({ id: 'phase', name: 'Phase Acrobatics' }),
      makePassive({ id: 'mov', name: 'Swift' }),
    ];
    const result = filterPassives(passives, 'acro');
    expect(result.map((p) => p.name)).toEqual(['Acrobatics', 'Phase Acrobatics']);
  });

  it('matches when any stat line contains the query', () => {
    const passives = [
      makePassive({ name: 'Acrobatics' }),
      makePassive({
        id: 'crit',
        name: 'Perfect Agony',
        stats: ['Critical Strike Chance doubled'],
      }),
    ];
    const result = filterPassives(passives, 'critical');
    expect(result.map((p) => p.name)).toEqual(['Perfect Agony']);
  });

  it('ignores empty query whitespace instead of returning zero results', () => {
    const passives = [makePassive()];
    expect(filterPassives(passives, ' \n\t ')).toEqual(passives);
  });

  it('returns an empty array when nothing matches', () => {
    const passives = [makePassive()];
    expect(filterPassives(passives, 'zzznope')).toEqual([]);
  });
});

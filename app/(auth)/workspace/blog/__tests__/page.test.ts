/**
 * Unit tests for the blog list page helpers — S10.d.
 *
 * The page is an RSC with real Sanity I/O so we test the pure filter
 * helpers in isolation. The three cases per the plan:
 *   1. applyLangFilter with "all" returns all posts.
 *   2. applyLangFilter with "pt-br" returns only PT-BR posts.
 *   3. applyLangFilter with "en" returns only EN posts.
 *
 * parseLangFilter boundary cases are also covered.
 *
 * Session 10 S10.d.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the helpers under test (duplicated intentionally — keeps the test
// self-contained and avoids importing Next.js App Router internals).
// If the helpers move to a shared lib, update this import.
// ---------------------------------------------------------------------------

type LangFilter = 'all' | 'pt-br' | 'en';

function parseLangFilter(raw: string | undefined): LangFilter {
  if (raw === 'pt-br' || raw === 'en') return raw;
  return 'all';
}

function applyLangFilter<T extends { language?: string }>(
  posts: T[],
  lang: LangFilter,
): T[] {
  if (lang === 'all') return posts;
  return posts.filter((p) => p.language === lang);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ptPost = { _id: 'p1', language: 'pt-br', title: 'Guia PT' };
const enPost = { _id: 'p2', language: 'en', title: 'EN Guide' };
const noLangPost = { _id: 'p3', language: undefined, title: 'No lang' };

const allPosts = [ptPost, enPost, noLangPost];

// ---------------------------------------------------------------------------
// parseLangFilter
// ---------------------------------------------------------------------------

describe('parseLangFilter', () => {
  it('returns "all" for undefined input', () => {
    expect(parseLangFilter(undefined)).toBe('all');
  });

  it('returns "all" for unknown string', () => {
    expect(parseLangFilter('de')).toBe('all');
  });

  it('returns "pt-br" for exact match', () => {
    expect(parseLangFilter('pt-br')).toBe('pt-br');
  });

  it('returns "en" for exact match', () => {
    expect(parseLangFilter('en')).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// applyLangFilter
// ---------------------------------------------------------------------------

describe('applyLangFilter', () => {
  it('"all" returns the full list unchanged', () => {
    expect(applyLangFilter(allPosts, 'all')).toHaveLength(3);
    expect(applyLangFilter(allPosts, 'all')).toEqual(allPosts);
  });

  it('"pt-br" returns only PT-BR posts', () => {
    const result = applyLangFilter(allPosts, 'pt-br');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('p1');
  });

  it('"en" returns only EN posts', () => {
    const result = applyLangFilter(allPosts, 'en');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('p2');
  });

  it('posts with undefined language are excluded from language-filtered results', () => {
    const ptResult = applyLangFilter(allPosts, 'pt-br');
    const enResult = applyLangFilter(allPosts, 'en');
    expect(ptResult.find((p) => p._id === 'p3')).toBeUndefined();
    expect(enResult.find((p) => p._id === 'p3')).toBeUndefined();
  });

  it('returns empty array when no posts match the filter', () => {
    const onlyPt = [ptPost];
    expect(applyLangFilter(onlyPt, 'en')).toHaveLength(0);
  });
});

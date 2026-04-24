'use client';
/**
 * SWR wrappers for Sanity reference data — authors and categories.
 * Used by editor-sidebar.tsx to populate async select dropdowns.
 *
 * Cache keys include language for categories so switching PT-BR/EN
 * invalidates and re-fetches the correct locale set.
 * Dedup window: 30 seconds — ref data changes rarely.
 *
 * Session 08.e.
 */

import useSWR from 'swr';
import type { AuthorRef, CategoryRef } from '@/lib/sanity/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEDUP_MS = 30_000;

// ─── Generic fetcher ──────────────────────────────────────────────────────────

async function refsFetcher(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[use-sanity-refs] fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

// ─── Authors ──────────────────────────────────────────────────────────────────

export interface UseAuthorsReturn {
  authors: AuthorRef[];
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Fetches all Sanity author refs for the author dropdown.
 *
 * @example
 * const { authors, isLoading } = useAuthors();
 */
export function useAuthors(): UseAuthorsReturn {
  const { data, error, isLoading } = useSWR<AuthorRef[]>(
    '/api/sanity/refs?kind=authors',
    refsFetcher as (url: string) => Promise<AuthorRef[]>,
    { dedupingInterval: DEDUP_MS, revalidateOnFocus: false },
  );

  return {
    authors: data ?? [],
    isLoading,
    error: error as Error | undefined,
  };
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface UseCategoriesReturn {
  categories: CategoryRef[];
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Fetches Sanity category refs filtered by language.
 * Cache key includes language — switching locales triggers a re-fetch.
 *
 * @example
 * const { categories, isLoading } = useCategories('pt-br');
 */
export function useCategories(language: 'pt-br' | 'en'): UseCategoriesReturn {
  const { data, error, isLoading } = useSWR<CategoryRef[]>(
    `/api/sanity/refs?kind=categories&language=${language}`,
    refsFetcher as (url: string) => Promise<CategoryRef[]>,
    { dedupingInterval: DEDUP_MS, revalidateOnFocus: false },
  );

  return {
    categories: data ?? [],
    isLoading,
    error: error as Error | undefined,
  };
}

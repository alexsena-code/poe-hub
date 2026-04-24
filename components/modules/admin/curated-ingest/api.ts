/**
 * Thin client for /api/engine/knowledge/curated-ingest/*.
 * All calls go through the poe-hub engine proxy (app/api/engine/[...path]).
 */

import type {
  CuratedCollection,
  CuratedIngestDraft,
  DraftStatus,
  ResolvedClarification,
} from './types';

const BASE = '/api/engine/knowledge/curated-ingest';

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    // Engine errors are usually { statusCode, message } from Nest HttpException
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      const msg = Array.isArray(parsed.message)
        ? parsed.message.join('; ')
        : parsed.message ?? text;
      throw new Error(`HTTP ${res.status}: ${msg}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('HTTP ')) throw err;
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return JSON.parse(text) as T;
}

export async function analyzeDraft(input: {
  rawText?: string;
  url?: string;
  targetCollection: CuratedCollection;
  language?: string;
}): Promise<CuratedIngestDraft> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<CuratedIngestDraft>(res);
}

export async function clarifyDraft(
  id: number,
  answers: ResolvedClarification[],
): Promise<CuratedIngestDraft> {
  const res = await fetch(`${BASE}/${id}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  return parseJsonOrThrow<CuratedIngestDraft>(res);
}

export async function approveDraft(
  id: number,
  approvedBy?: string,
): Promise<CuratedIngestDraft> {
  const res = await fetch(`${BASE}/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(approvedBy ? { approvedBy } : {}),
  });
  return parseJsonOrThrow<CuratedIngestDraft>(res);
}

export async function rejectDraft(id: number): Promise<CuratedIngestDraft> {
  const res = await fetch(`${BASE}/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJsonOrThrow<CuratedIngestDraft>(res);
}

export async function listDrafts(filter?: {
  status?: DraftStatus | DraftStatus[];
  collection?: CuratedCollection;
  limit?: number;
}): Promise<CuratedIngestDraft[]> {
  const params = new URLSearchParams();
  // Engine accepts a single status string; if multiple requested, we pull
  // them one-by-one and concat client-side to keep the API contract tight.
  if (filter?.collection) params.set('collection', filter.collection);
  if (filter?.limit) params.set('limit', String(filter.limit));

  const statuses = Array.isArray(filter?.status)
    ? filter.status
    : filter?.status
    ? [filter.status]
    : [undefined];

  const results: CuratedIngestDraft[] = [];
  for (const s of statuses) {
    const query = new URLSearchParams(params);
    if (s) query.set('status', s);
    const res = await fetch(`${BASE}?${query.toString()}`);
    const batch = await parseJsonOrThrow<CuratedIngestDraft[]>(res);
    results.push(...batch);
  }
  // Dedupe by id in case of overlap + sort by createdAt desc.
  const map = new Map<number, CuratedIngestDraft>();
  for (const d of results) map.set(d.id, d);
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getDraft(id: number): Promise<CuratedIngestDraft> {
  const res = await fetch(`${BASE}/${id}`);
  return parseJsonOrThrow<CuratedIngestDraft>(res);
}

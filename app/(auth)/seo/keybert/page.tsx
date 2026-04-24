// RSC shell — fetches initial KeyBERT status server-side; polling + dispatch in client island.
// S05.a migration: was 209L 'use client'; now RSC + KeybertClient island.
import { fetchEngine } from "@/lib/fetch-engine";
import { KeybertClient } from "@/components/modules/seo/keybert/keybert-client";

interface TaskEntry {
  task: { id: string; modules: string[] };
  result?: { summary: Record<string, unknown>; error?: string; durationMs?: number };
  dispatchedAt: string;
  completedAt?: string;
}

interface KeybertStatus {
  workerOnline: boolean;
  taskHistory: TaskEntry[];
}

export default async function KeybertPage() {
  // If the engine is down at request time, render offline state so the client
  // island can still poll and recover once the worker comes back.
  let initialStatus: KeybertStatus = { workerOnline: false, taskHistory: [] };
  try {
    initialStatus = await fetchEngine<KeybertStatus>("/api/engine/seo/keybert/status");
  } catch {
    // Engine down — client island shows offline badge and continues polling
  }

  return <KeybertClient initialStatus={initialStatus} />;
}

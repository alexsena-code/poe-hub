/**
 * Pure helper functions for the benchmark compare page.
 *
 * Kept pure (no side effects, no imports from Next.js or Prisma) so they can
 * be tested in Node without jsdom and used server-side inside the RSC shell.
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

import type { BenchmarkCollectorEvent, BenchmarkLlmEvent } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Delta computation
// ---------------------------------------------------------------------------

export interface DeltaResult {
  /** Absolute difference: b - a */
  delta: number;
  /** Percentage difference: ((b - a) / a) * 100. Null when a === 0 (div by zero). */
  percent: number | null;
}

/**
 * Computes the absolute and percentage difference between two numeric values.
 * Convention: delta > 0 means B is higher; delta < 0 means B is lower.
 *
 * @example
 * computeDelta(100, 120) // { delta: 20, percent: 20 }
 * computeDelta(0, 50)    // { delta: 50, percent: null }
 */
export function computeDelta(a: number, b: number): DeltaResult {
  const delta = b - a;
  if (a === 0) return { delta, percent: null };
  return { delta, percent: (delta / a) * 100 };
}

// ---------------------------------------------------------------------------
// Per-node aggregation
// ---------------------------------------------------------------------------

export interface NodeAggregate {
  callCount: number;
  totalCost: number;
  totalLatency: number;
  maxLatency: number;
}

/**
 * Aggregates LLM events by node label.
 * Only processes events with kind === "llm"; qdrant events are ignored.
 *
 * @example
 * aggregateByNode([{ kind:"llm", node:"write", costUsd:0.01, latencyMs:200, ... }])
 * // Map { "write" => { callCount:1, totalCost:0.01, totalLatency:200, maxLatency:200 } }
 */
export function aggregateByNode(
  events: BenchmarkCollectorEvent[],
): Map<string, NodeAggregate> {
  const map = new Map<string, NodeAggregate>();

  for (const ev of events) {
    if (ev.kind !== "llm") continue;
    const llm = ev as { kind: "llm" } & BenchmarkLlmEvent;
    const existing = map.get(llm.node);

    if (!existing) {
      map.set(llm.node, {
        callCount: 1,
        totalCost: llm.costUsd,
        totalLatency: llm.latencyMs,
        maxLatency: llm.latencyMs,
      });
    } else {
      existing.callCount += 1;
      existing.totalCost += llm.costUsd;
      existing.totalLatency += llm.latencyMs;
      existing.maxLatency = Math.max(existing.maxLatency, llm.latencyMs);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Event pairing
// ---------------------------------------------------------------------------

export interface EventPair {
  node: string;
  /** Event from run A, if one was matched. */
  a?: BenchmarkCollectorEvent & { kind: "llm" };
  /** Event from run B, if one was matched. */
  b?: BenchmarkCollectorEvent & { kind: "llm" };
}

type LlmEvent = BenchmarkCollectorEvent & { kind: "llm" };

/**
 * Pairs LLM events from run A and run B by node name + tOffsetMs rank.
 * "Rank" means: among all events in the same node, sort by tOffsetMs ascending
 * and match the Nth event of A to the Nth event of B.
 *
 * Events that only appear in one side are still included (with the other side
 * as undefined) so the UI can flag them as missing.
 *
 * @example
 * pairEventsByNode([{node:"write", tOffsetMs:100}], [{node:"write", tOffsetMs:200}])
 * // [{ node:"write", a:{...}, b:{...} }]
 */
export function pairEventsByNode(
  eventsA: BenchmarkCollectorEvent[],
  eventsB: BenchmarkCollectorEvent[],
): EventPair[] {
  const llmA = eventsA.filter((e): e is LlmEvent => e.kind === "llm");
  const llmB = eventsB.filter((e): e is LlmEvent => e.kind === "llm");

  // Group by node
  const byNodeA = groupLlmByNode(llmA);
  const byNodeB = groupLlmByNode(llmB);

  const allNodes = new Set([...byNodeA.keys(), ...byNodeB.keys()]);
  const pairs: EventPair[] = [];

  for (const node of allNodes) {
    const aList = byNodeA.get(node) ?? [];
    const bList = byNodeB.get(node) ?? [];
    const maxLen = Math.max(aList.length, bList.length);

    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        node,
        a: aList[i],
        b: bList[i],
      });
    }
  }

  return pairs;
}

function groupLlmByNode(events: LlmEvent[]): Map<string, LlmEvent[]> {
  const map = new Map<string, LlmEvent[]>();

  // Sort by tOffsetMs so rank assignment is stable
  const sorted = [...events].sort((x, y) => x.tOffsetMs - y.tOffsetMs);

  for (const ev of sorted) {
    const list = map.get(ev.node) ?? [];
    list.push(ev);
    map.set(ev.node, list);
  }

  return map;
}

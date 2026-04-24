/**
 * Unit tests for lib/benchmark-compare.ts
 *
 * All functions are pure — no mocking needed. Tests cover:
 *   - computeDelta: positive, negative, zero-a, zero-b, equal values
 *   - aggregateByNode: single event, multiple nodes, qdrant events ignored
 *   - pairEventsByNode: same node, different nodes, unmatched sides, rank ordering
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

import { describe, it, expect } from "vitest";
import {
  computeDelta,
  aggregateByNode,
  pairEventsByNode,
} from "@/lib/benchmark-compare";
import type { BenchmarkCollectorEvent, BenchmarkLlmEvent } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLlmEvent(
  node: string,
  tOffsetMs: number,
  overrides: Partial<BenchmarkLlmEvent> = {},
): BenchmarkCollectorEvent & { kind: "llm" } {
  return {
    kind: "llm",
    node,
    model: "test/model",
    systemPrompt: "",
    userMessage: "",
    response: "",
    inputTokens: 100,
    outputTokens: 50,
    costUsd: overrides.costUsd ?? 0.01,
    latencyMs: overrides.latencyMs ?? 200,
    tOffsetMs,
    ...overrides,
  };
}

function makeQdrantEvent(tOffsetMs: number): BenchmarkCollectorEvent {
  return {
    kind: "qdrant",
    collection: "test_collection",
    queryText: "test query",
    limit: 5,
    resultCount: 3,
    chunks: [],
    durationMs: 50,
    tOffsetMs,
  };
}

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

describe("computeDelta", () => {
  it("positive delta: b > a", () => {
    const result = computeDelta(100, 120);
    expect(result.delta).toBeCloseTo(20);
    expect(result.percent).toBeCloseTo(20);
  });

  it("negative delta: b < a", () => {
    const result = computeDelta(200, 150);
    expect(result.delta).toBeCloseTo(-50);
    expect(result.percent).toBeCloseTo(-25);
  });

  it("zero delta: a === b", () => {
    const result = computeDelta(100, 100);
    expect(result.delta).toBe(0);
    expect(result.percent).toBe(0);
  });

  it("div-by-zero when a === 0: percent is null", () => {
    const result = computeDelta(0, 50);
    expect(result.delta).toBe(50);
    expect(result.percent).toBeNull();
  });

  it("b === 0 with non-zero a: returns -100%", () => {
    const result = computeDelta(80, 0);
    expect(result.delta).toBeCloseTo(-80);
    expect(result.percent).toBeCloseTo(-100);
  });
});

// ---------------------------------------------------------------------------
// aggregateByNode
// ---------------------------------------------------------------------------

describe("aggregateByNode", () => {
  it("single llm event aggregates correctly", () => {
    const events = [makeLlmEvent("write", 0, { costUsd: 0.02, latencyMs: 300 })];
    const map = aggregateByNode(events);

    expect(map.size).toBe(1);
    const agg = map.get("write")!;
    expect(agg.callCount).toBe(1);
    expect(agg.totalCost).toBeCloseTo(0.02);
    expect(agg.totalLatency).toBe(300);
    expect(agg.maxLatency).toBe(300);
  });

  it("two events on same node sum cost and latency, tracks maxLatency", () => {
    const events = [
      makeLlmEvent("critique", 0, { costUsd: 0.01, latencyMs: 100 }),
      makeLlmEvent("critique", 500, { costUsd: 0.03, latencyMs: 400 }),
    ];
    const map = aggregateByNode(events);

    const agg = map.get("critique")!;
    expect(agg.callCount).toBe(2);
    expect(agg.totalCost).toBeCloseTo(0.04);
    expect(agg.totalLatency).toBe(500);
    expect(agg.maxLatency).toBe(400);
  });

  it("multiple distinct nodes produce separate entries", () => {
    const events = [
      makeLlmEvent("write", 0),
      makeLlmEvent("critique", 100),
      makeLlmEvent("write", 200),
    ];
    const map = aggregateByNode(events);

    expect(map.size).toBe(2);
    expect(map.get("write")!.callCount).toBe(2);
    expect(map.get("critique")!.callCount).toBe(1);
  });

  it("qdrant events are ignored", () => {
    const events = [
      makeLlmEvent("write", 0),
      makeQdrantEvent(50),
      makeQdrantEvent(100),
    ];
    const map = aggregateByNode(events);

    expect(map.size).toBe(1);
    expect(map.has("write")).toBe(true);
  });

  it("empty events list returns empty map", () => {
    expect(aggregateByNode([])).toEqual(new Map());
  });
});

// ---------------------------------------------------------------------------
// pairEventsByNode
// ---------------------------------------------------------------------------

describe("pairEventsByNode", () => {
  it("one event per side, same node → single paired entry", () => {
    const a = [makeLlmEvent("write", 0)];
    const b = [makeLlmEvent("write", 10)];
    const pairs = pairEventsByNode(a, b);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].node).toBe("write");
    expect(pairs[0].a).toBeDefined();
    expect(pairs[0].b).toBeDefined();
  });

  it("event only in A → b is undefined in the pair", () => {
    const a = [makeLlmEvent("write", 0)];
    const b: BenchmarkCollectorEvent[] = [];
    const pairs = pairEventsByNode(a, b);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBeDefined();
    expect(pairs[0].b).toBeUndefined();
  });

  it("event only in B → a is undefined in the pair", () => {
    const a: BenchmarkCollectorEvent[] = [];
    const b = [makeLlmEvent("critique", 100)];
    const pairs = pairEventsByNode(a, b);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBeUndefined();
    expect(pairs[0].b).toBeDefined();
  });

  it("two A events, one B event for same node → first B paired, second A unpaired", () => {
    const a = [
      makeLlmEvent("write", 0),
      makeLlmEvent("write", 500),
    ];
    const b = [makeLlmEvent("write", 50)];
    const pairs = pairEventsByNode(a, b);

    expect(pairs).toHaveLength(2);
    expect(pairs[0].a?.tOffsetMs).toBe(0);
    expect(pairs[0].b?.tOffsetMs).toBe(50);
    expect(pairs[1].a?.tOffsetMs).toBe(500);
    expect(pairs[1].b).toBeUndefined();
  });

  it("events sorted by tOffsetMs before pairing (rank is stable)", () => {
    // A has two write events, out of order
    const a = [
      makeLlmEvent("write", 800),
      makeLlmEvent("write", 200),
    ];
    const b = [
      makeLlmEvent("write", 100),
      makeLlmEvent("write", 600),
    ];
    const pairs = pairEventsByNode(a, b);

    // After sort: A = [200, 800], B = [100, 600]
    expect(pairs[0].a?.tOffsetMs).toBe(200);
    expect(pairs[0].b?.tOffsetMs).toBe(100);
    expect(pairs[1].a?.tOffsetMs).toBe(800);
    expect(pairs[1].b?.tOffsetMs).toBe(600);
  });
});

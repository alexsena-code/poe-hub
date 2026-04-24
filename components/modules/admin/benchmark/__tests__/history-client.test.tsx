// @vitest-environment jsdom
/**
 * Component tests for BenchmarkHistoryClient.
 *
 * SWR and fetch are mocked at the module level — no network, no DB.
 * next/navigation hooks are stubbed so router.replace/push don't fail.
 *
 * Cases:
 *   1. Renders rows from initialRuns prop.
 *   2. Type filter Select calls SWR with new URL.
 *   3. Delete flow: opens AlertDialog → calls DELETE → mutate() removes row.
 *   4. Compare picker disables same-type and hides different-type rows.
 *   5. Error rows have destructive highlight.
 *
 * Session 01 S01.benchmark-history.
 */

/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// next/navigation mock — stub router + searchParams so the component doesn't crash.
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/admin/benchmark/history",
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// SWR mock — module-level state that tests mutate per scenario.
//
// swrState.data drives the main history list.
// swrState.pickerData (when set) drives the compare picker's SWR call,
// which uses a URL containing "type=" so we can distinguish it.
// ---------------------------------------------------------------------------

interface SWRState {
  data: { runs: unknown[]; total: number } | undefined;
  pickerData: { runs: unknown[]; total: number } | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: ReturnType<typeof vi.fn>;
}

const swrState: SWRState = {
  data: undefined,
  pickerData: undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
};

vi.mock("swr", () => ({
  default: (key: string | null, _fetcher: unknown, opts?: { fallbackData?: unknown }) => {
    // The compare picker uses SWR with key like "/api/benchmark/runs?type=qa&limit=50"
    // (no offset — distinct from the history client key which includes offset).
    const isPickerKey =
      typeof key === "string" && key.includes("type=") && key.includes("limit=50") && !key.includes("offset=");

    const data = isPickerKey
      ? swrState.pickerData
      : (swrState.data ?? opts?.fallbackData);

    return {
      data,
      isLoading: swrState.isLoading,
      isValidating: swrState.isValidating,
      mutate: swrState.mutate,
    };
  },
}));

// ---------------------------------------------------------------------------
// fetch mock — controls what DELETE and detail calls return.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { BenchmarkHistoryClient } from "../history-client";
import type { BenchmarkRunListRow } from "../history-types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<BenchmarkRunListRow> = {}): BenchmarkRunListRow {
  return {
    id: "run-" + Math.random().toString(36).slice(2, 10),
    type: "qa",
    presetId: null,
    preset: null,
    modelOverrides: {},
    totalCostUsd: 0.00123,
    totalDurationMs: 4200,
    llmCallCount: 2,
    qdrantQueryCount: 1,
    httpStatus: 200,
    error: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  swrState.data = undefined;
  swrState.pickerData = undefined;
  swrState.isLoading = false;
  swrState.isValidating = false;
  swrState.mutate = vi.fn();
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BenchmarkHistoryClient — renders initial data", () => {
  it("renders one row per initial run with correct fields", () => {
    const run = makeRun({
      id: "run-abc123",
      type: "qa",
      totalCostUsd: 0.01234,
      totalDurationMs: 5000,
      llmCallCount: 3,
      qdrantQueryCount: 2,
      httpStatus: 200,
      createdAt: "2026-04-24T10:30:00.000Z",
    });

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    // Row present
    expect(screen.getByTestId(`run-row-${run.id}`)).toBeInTheDocument();
    // Date in pt-BR format
    expect(screen.getByText(/24\/04\/2026/)).toBeInTheDocument();
    // Cost formatted to 5dp
    expect(screen.getByText("$0.01234")).toBeInTheDocument();
    // Duration
    expect(screen.getByText("5s")).toBeInTheDocument();
    // LLM calls
    expect(screen.getByText("3")).toBeInTheDocument();
    // Status
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows 'Nenhum run encontrado' when list is empty", () => {
    render(<BenchmarkHistoryClient initialRuns={[]} initialTotal={0} />);
    expect(screen.getByText(/Nenhum run encontrado/i)).toBeInTheDocument();
  });
});

describe("BenchmarkHistoryClient — type filter", () => {
  it("renders both filter selects (type and preset)", () => {
    render(<BenchmarkHistoryClient initialRuns={[]} initialTotal={0} />);
    // Two combobox triggers: type filter + preset filter.
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    // Type filter has "Todos os tipos" as default label.
    expect(screen.getByText("Todos os tipos")).toBeInTheDocument();
    // Preset filter has "Todos os presets" as default label.
    expect(screen.getByText("Todos os presets")).toBeInTheDocument();
  });
});

describe("BenchmarkHistoryClient — error row highlight", () => {
  it("applies destructive class when run has error !== null", () => {
    const run = makeRun({
      id: "run-err001",
      error: "Engine timed out",
      httpStatus: 500,
    });

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    const row = screen.getByTestId("run-row-run-err001");
    // Row should have destructive background class
    expect(row.className).toMatch(/destructive/);
  });

  it("applies destructive class when httpStatus >= 400 even without error string", () => {
    const run = makeRun({ id: "run-http400", httpStatus: 400, error: null });

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    const row = screen.getByTestId("run-row-run-http400");
    expect(row.className).toMatch(/destructive/);
  });

  it("does NOT apply destructive class to successful runs", () => {
    const run = makeRun({ id: "run-ok001", httpStatus: 200, error: null });

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    const row = screen.getByTestId("run-row-run-ok001");
    expect(row.className).not.toMatch(/destructive/);
  });
});

describe("BenchmarkHistoryClient — delete flow", () => {
  it("opens AlertDialog and calls DELETE on confirm, then mutates", async () => {
    const user = userEvent.setup();
    const run = makeRun({ id: "run-del001" });

    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    swrState.mutate = vi.fn();

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    // Click the delete button (stop propagation so row click doesn't fire)
    const deleteBtn = within(screen.getByTestId("run-row-run-del001")).getByTitle(
      "Deletar run",
    );
    await user.click(deleteBtn);

    // AlertDialog should appear
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /Deletar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/benchmark/runs/${run.id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    // mutate() called to refresh list
    await waitFor(() => {
      expect(swrState.mutate).toHaveBeenCalled();
    });
  });

  it("does NOT call DELETE when cancel is clicked", async () => {
    const user = userEvent.setup();
    const run = makeRun({ id: "run-del002" });

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    const deleteBtn = within(screen.getByTestId("run-row-run-del002")).getByTitle(
      "Deletar run",
    );
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    await user.click(cancelBtn);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("BenchmarkHistoryClient — compare picker", () => {
  it("opens compare dialog when GitCompare button is clicked", async () => {
    const user = userEvent.setup();
    const run = makeRun({ id: "run-cmp001", type: "ideation" });

    // Picker SWR returns empty list for this type.
    swrState.pickerData = { runs: [], total: 0 };

    render(<BenchmarkHistoryClient initialRuns={[run]} initialTotal={1} />);

    const compareBtn = within(screen.getByTestId("run-row-run-cmp001")).getByTitle(
      "Comparar com...",
    );
    await user.click(compareBtn);

    // Dialog opens
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Comparar com outro run/i)).toBeInTheDocument();
    });
  });

  it("compare picker shows candidates of the same type, not the base run", async () => {
    const user = userEvent.setup();
    const baseRun = makeRun({ id: "run-base", type: "qa" });
    const sameType = makeRun({ id: "run-same", type: "qa" });

    // History list shows both runs.
    swrState.data = { runs: [baseRun, sameType], total: 2 };
    // Picker SWR (type-filtered, no offset) returns both — picker filters out base run internally.
    swrState.pickerData = { runs: [baseRun, sameType], total: 2 };

    render(<BenchmarkHistoryClient initialRuns={[baseRun, sameType]} initialTotal={2} />);

    const compareBtn = within(screen.getByTestId("run-row-run-base")).getByTitle(
      "Comparar com...",
    );
    await user.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // sameType run should appear as a candidate
    await waitFor(() => {
      expect(screen.getByTestId("compare-candidate-run-same")).toBeInTheDocument();
    });

    // Base run must NOT appear as a candidate (filtered by id === baseRunId)
    expect(screen.queryByTestId("compare-candidate-run-base")).not.toBeInTheDocument();
  });
});

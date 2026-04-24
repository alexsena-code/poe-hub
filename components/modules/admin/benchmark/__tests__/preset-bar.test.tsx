// @vitest-environment jsdom
/**
 * Tests for PresetBar.
 *
 * The SWR hook (useBenchmarkPresets) is mocked at the module level.
 * Each test controls the hook's return value via a shared mutable object
 * that vi.mock() captures by reference — same pattern as model-pricing-card.test.tsx.
 *
 * Cases covered:
 *  1. Dropdown renders preset names when presets exist.
 *  2. Selecting a preset calls onLoad with the right payload + id.
 *  3. Empty-state message shown in dropdown when there are no presets.
 *  4. "Save as preset" dialog submits → createPreset called with correct args.
 *  5. "Manage" dialog lists presets and delete flow calls deletePreset.
 */

/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── jsdom polyfills ─────────────────────────────────────────────────────────

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Radix UI's Select uses Pointer Events API + scrollIntoView which jsdom doesn't implement.
// Polyfill all the methods @radix-ui/react-select calls during open/item-focus events.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// ─── Sonner mock — avoid rendering the Toaster portal in jsdom ───────────────

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ─── Hook mock ───────────────────────────────────────────────────────────────

import type { BenchmarkPreset, UseBenchmarkPresetsResult } from "../use-benchmark-presets";

// vi.fn() without type params — assign the compatible types in hookState below.
const createPresetMock = vi.fn();
const deletePresetMock = vi.fn();
const mutateMock = vi.fn();

// Type assertion needed because vi.fn() returns a generic Mock that isn't
// directly assignable to the typed function signatures in UseBenchmarkPresetsResult.
const hookState = {
  presets: [] as BenchmarkPreset[],
  isLoading: false,
  error: null,
  mutate: mutateMock,
  createPreset: createPresetMock as UseBenchmarkPresetsResult["createPreset"],
  deletePreset: deletePresetMock as UseBenchmarkPresetsResult["deletePreset"],
};

vi.mock("../use-benchmark-presets", () => ({
  useBenchmarkPresets: () => hookState,
}));

// ─── Subject ─────────────────────────────────────────────────────────────────

import { PresetBar } from "../preset-bar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePreset(overrides: Partial<BenchmarkPreset> = {}): BenchmarkPreset {
  return {
    id: "preset-1",
    name: "RF Juggernaut baseline",
    type: "qa",
    payload: { question: "best flasks for RF?" },
    notes: null,
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  hookState.presets = [];
  hookState.isLoading = false;
  hookState.error = null;
  createPresetMock.mockReset();
  deletePresetMock.mockReset();
  mutateMock.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PresetBar", () => {
  it("renders the preset name in the dropdown when presets exist", async () => {
    hookState.presets = [makePreset()];
    const onLoad = vi.fn();
    render(<PresetBar type="qa" currentValues={{}} onLoad={onLoad} />);

    // Open the select
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);

    expect(screen.getByText("RF Juggernaut baseline")).toBeInTheDocument();
  });

  it("calls onLoad with the preset payload and id when an item is selected", async () => {
    const preset = makePreset();
    hookState.presets = [preset];
    const onLoad = vi.fn();
    render(<PresetBar type="qa" currentValues={{}} onLoad={onLoad} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("RF Juggernaut baseline"));

    expect(onLoad).toHaveBeenCalledWith(preset.payload, preset.id);
  });

  it("shows empty-state message in dropdown when no presets exist", async () => {
    hookState.presets = [];
    render(<PresetBar type="qa" currentValues={{}} onLoad={vi.fn()} />);

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText(/Nenhum preset/i)).toBeInTheDocument();
  });

  it("opens Save dialog and calls createPreset with correct args on submit", async () => {
    const payload = { question: "some question" };
    createPresetMock.mockResolvedValue(makePreset());
    render(<PresetBar type="qa" currentValues={payload} onLoad={vi.fn()} />);

    // Open the save dialog
    await userEvent.click(screen.getByRole("button", { name: /salvar como preset/i }));

    const nameInput = screen.getByPlaceholderText(/RF Juggernaut baseline/i);
    await userEvent.type(nameInput, "My test preset");

    const notesTextarea = screen.getByPlaceholderText(/Contexto ou observações/i);
    await userEvent.type(notesTextarea, "some notes");

    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => {
      expect(createPresetMock).toHaveBeenCalledWith({
        name: "My test preset",
        type: "qa",
        payload,
        notes: "some notes",
      });
    });
  });

  it("rejects save when name is empty and shows error toast", async () => {
    const { toast } = await import("sonner");
    render(<PresetBar type="qa" currentValues={{}} onLoad={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /salvar como preset/i }));
    // Don't type a name — leave it blank
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(createPresetMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Nome é obrigatório");
  });

  it("Manage dialog lists presets and delete flow calls deletePreset", async () => {
    const preset = makePreset({ id: "p-abc", name: "Delete me" });
    hookState.presets = [preset];
    deletePresetMock.mockResolvedValue(undefined);

    render(<PresetBar type="qa" currentValues={{}} onLoad={vi.fn()} />);

    // Open manage dialog
    await userEvent.click(screen.getByRole("button", { name: /gerenciar/i }));

    // Preset name appears in the list
    expect(screen.getByText("Delete me")).toBeInTheDocument();

    // Click delete — triggers confirm dialog
    await userEvent.click(screen.getByRole("button", { name: /excluir/i }));

    // Confirm dialog appears — click confirm
    const confirmBtn = await screen.findByRole("button", { name: /^excluir$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletePresetMock).toHaveBeenCalledWith("p-abc");
    });
  });
});

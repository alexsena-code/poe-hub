// @vitest-environment jsdom
/**
 * Tests for ModelCombobox — autocomplete picker for OpenRouter models.
 *
 * The hook `useOpenRouterModels` is mocked; Radix Popover + cmdk Command
 * need the same pointer-related polyfills used by PresetBar tests.
 */

/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── jsdom polyfills for Radix + cmdk ────────────────────────────────────────

if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ─── Hook mock ────────────────────────────────────────────────────────────────

interface MockState {
  models: Array<{
    id: string;
    name: string;
    contextLength: number;
    inputPricePer1M: number;
    outputPricePer1M: number;
  }>;
  isLoading: boolean;
  error: Error | null;
}

const mockState: MockState = {
  models: [
    {
      id: "anthropic/claude-sonnet-4.6",
      name: "Claude Sonnet 4.6",
      contextLength: 200_000,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      contextLength: 128_000,
      inputPricePer1M: 2.5,
      outputPricePer1M: 10,
    },
    {
      id: "moonshotai/kimi-k2-thinking",
      name: "Kimi K2 Thinking",
      contextLength: 200_000,
      inputPricePer1M: 0.6,
      outputPricePer1M: 2.5,
    },
  ],
  isLoading: false,
  error: null,
};

vi.mock("../use-openrouter-models", () => ({
  useOpenRouterModels: () => ({ ...mockState, refresh: vi.fn() }),
}));

import { ModelCombobox } from "../model-combobox";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockState.isLoading = false;
  mockState.error = null;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ModelCombobox", () => {
  it("renders placeholder when value is empty", () => {
    render(<ModelCombobox value="" onChange={vi.fn()} placeholder="Pick one..." />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick one...");
  });

  it("shows the selected model's name on the trigger when value matches a catalog entry", () => {
    render(
      <ModelCombobox value="openai/gpt-4o" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("GPT-4o");
  });

  it("falls back to the raw id on the trigger when value is not in the catalog", () => {
    render(
      <ModelCombobox value="custom/model-xyz" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("custom/model-xyz");
  });

  it("opens and lists all models when clicked", async () => {
    render(<ModelCombobox value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4.6")).toBeInTheDocument();
      expect(screen.getByText("GPT-4o")).toBeInTheDocument();
      expect(screen.getByText("Kimi K2 Thinking")).toBeInTheDocument();
    });
  });

  it("filters by substring in name or id", async () => {
    render(<ModelCombobox value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText(/Buscar modelo/i);
    await userEvent.type(input, "kimi");
    await waitFor(() => {
      expect(screen.getByText("Kimi K2 Thinking")).toBeInTheDocument();
      expect(screen.queryByText("GPT-4o")).not.toBeInTheDocument();
    });
  });

  it("calls onChange with the selected model id", async () => {
    const onChange = vi.fn();
    render(<ModelCombobox value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Kimi K2 Thinking"));
    expect(onChange).toHaveBeenCalledWith("moonshotai/kimi-k2-thinking");
  });

  it("offers a custom entry when the query does not match any model id", async () => {
    const onChange = vi.fn();
    render(<ModelCombobox value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText(/Buscar modelo/i);
    await userEvent.type(input, "new/model-id");
    const customOption = await screen.findByText("new/model-id");
    await userEvent.click(customOption);
    expect(onChange).toHaveBeenCalledWith("new/model-id");
  });

  it("clears the selection when the clear button is pressed", async () => {
    const onChange = vi.fn();
    render(<ModelCombobox value="openai/gpt-4o" onChange={onChange} />);
    const clear = screen.getByRole("button", { name: /Limpar seleção/i });
    await userEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders a loading hint while the catalog is fetching", async () => {
    mockState.isLoading = true;
    mockState.models = [];
    render(<ModelCombobox value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText(/Carregando catálogo/i)).toBeInTheDocument();
  });

  it("renders an error message when the catalog fetch fails", async () => {
    mockState.error = new Error("network down");
    mockState.models = [];
    render(<ModelCombobox value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });
});

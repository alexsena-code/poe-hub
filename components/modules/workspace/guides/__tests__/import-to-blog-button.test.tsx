/**
 * Tests for ImportToBlogButton.
 *
 * We mock:
 *   - next/navigation (useRouter) to prevent navigation side-effects.
 *   - global fetch to control the POST /api/sanity/draft-from-guide response.
 *   - sonner (toast) to assert notifications.
 *
 * Session 10.e.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

// ─── Component import (after mocks) ───────────────────────────────────────────

import { ImportToBlogButton } from "../import-to-blog-button";
import type { PostDetail } from "@/lib/content-api";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const GUIDE: PostDetail = {
  slug: "chaos-orb-farming",
  title: { "pt-br": "Farmar Caos", en: "Farm Chaos" },
  template: "build_guide",
  status: "published",
  generatedAt: "2026-04-24T00:00:00.000Z",
  sections: [
    {
      id: "s1",
      heading: "Intro",
      content: { "pt-br": "Intro PT.", en: "Intro EN." },
      order: 0,
    },
  ],
  meta: {
    title: { "pt-br": "Farmar Caos", en: "Farm Chaos" },
    description: { "pt-br": "Como farmar.", en: "How to farm." },
  },
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("ImportToBlogButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Editar no Blog' button", () => {
    render(<ImportToBlogButton guide={GUIDE} />);
    expect(screen.getByRole("button", { name: /editar no blog/i })).toBeInTheDocument();
  });

  it("opens the language selection dialog on click", async () => {
    render(<ImportToBlogButton guide={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: /editar no blog/i }));
    await waitFor(() => {
      expect(screen.getByText(/importar para o blog/i)).toBeInTheDocument();
    });
    // Both language checkboxes should be visible
    expect(screen.getByLabelText(/PT-BR/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/EN/i)).toBeInTheDocument();
  });

  it("closes dialog when 'Cancelar' is clicked", async () => {
    render(<ImportToBlogButton guide={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: /editar no blog/i }));
    await waitFor(() => screen.getByText(/importar para o blog/i));

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByText(/importar para o blog/i)).not.toBeInTheDocument();
    });
  });

  it("POSTs with correct body and navigates after success", async () => {
    const drafts = [
      { id: "draft-ptbr-1", language: "pt-br", slug: "chaos-orb-farming", title: "Farmar Caos" },
      { id: "draft-en-1",   language: "en",    slug: "chaos-orb-farming", title: "Farm Chaos" },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ drafts }),
    } as unknown as Response);

    render(<ImportToBlogButton guide={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: /editar no blog/i }));
    await waitFor(() => screen.getByText(/importar para o blog/i));

    // Click "Criar drafts" with both languages selected (default)
    fireEvent.click(screen.getByRole("button", { name: /criar drafts/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sanity/draft-from-guide",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ guideSlug: "chaos-orb-farming", languages: ["pt-br", "en"] }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("2 drafts"),
        expect.anything(),
      );
      expect(mockPush).toHaveBeenCalledWith("/workspace/blog/draft-ptbr-1/edit");
    });
  });

  it("shows error toast when POST fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Engine unavailable" }),
    } as unknown as Response);

    render(<ImportToBlogButton guide={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: /editar no blog/i }));
    await waitFor(() => screen.getByText(/importar para o blog/i));
    fireEvent.click(screen.getByRole("button", { name: /criar drafts/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Engine unavailable"),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

/**
 * Tests for PostRow — the client row in /workspace/blog list that carries
 * the "delete draft" action for drafts.
 *
 * Mocks: next/navigation (useRouter), sonner (toast), global fetch.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

// ─── Component import after mocks ─────────────────────────────────────────────

import { PostRow, type BlogListRow } from "../post-row";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DRAFT: BlogListRow = {
  _id: "drafts.abc123",
  title: "Meu rascunho",
  slug: { current: "meu-rascunho" },
  language: "pt-br",
  _updatedAt: "2026-04-24T10:00:00.000Z",
};

const PUBLISHED: BlogListRow = {
  _id: "abc123",
  title: "Post publicado",
  slug: { current: "post-publicado" },
  language: "en",
  publishedAt: "2026-04-20T10:00:00.000Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PostRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and slug", () => {
    render(<PostRow post={DRAFT} isDraft />);
    expect(screen.getByText("Meu rascunho")).toBeInTheDocument();
    expect(screen.getByText("/meu-rascunho")).toBeInTheDocument();
  });

  it("does NOT show delete button when isDraft=false", () => {
    render(<PostRow post={PUBLISHED} isDraft={false} />);
    expect(
      screen.queryByRole("button", { name: /deletar rascunho/i }),
    ).not.toBeInTheDocument();
  });

  it("shows delete button when isDraft=true", () => {
    render(<PostRow post={DRAFT} isDraft />);
    expect(
      screen.getByRole("button", { name: /deletar rascunho/i }),
    ).toBeInTheDocument();
  });

  it("opens confirmation dialog on delete button click", async () => {
    render(<PostRow post={DRAFT} isDraft />);
    fireEvent.click(screen.getByRole("button", { name: /deletar rascunho/i }));
    await waitFor(() => {
      expect(screen.getByText(/deletar rascunho\?/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^deletar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("calls DELETE /api/sanity/draft/<bareId> and refreshes on success", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as unknown as Response);

    render(<PostRow post={DRAFT} isDraft />);
    fireEvent.click(screen.getByRole("button", { name: /deletar rascunho/i }));
    await waitFor(() => screen.getByText(/deletar rascunho\?/i));

    fireEvent.click(screen.getByRole("button", { name: /^deletar$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sanity/draft/abc123",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  it("strips drafts. prefix from id before calling DELETE", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as unknown as Response);

    render(<PostRow post={{ ...DRAFT, _id: "drafts.xyz" }} isDraft />);
    fireEvent.click(screen.getByRole("button", { name: /deletar rascunho/i }));
    await waitFor(() => screen.getByText(/deletar rascunho\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^deletar$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sanity/draft/xyz",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("shows error toast and does NOT refresh when DELETE fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ error: "Sanity unreachable" }),
    } as unknown as Response);

    render(<PostRow post={DRAFT} isDraft />);
    fireEvent.click(screen.getByRole("button", { name: /deletar rascunho/i }));
    await waitFor(() => screen.getByText(/deletar rascunho\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^deletar$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});

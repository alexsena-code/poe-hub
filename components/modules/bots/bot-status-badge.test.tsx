/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BotStatusBadge } from "./bot-status-badge";

describe("BotStatusBadge", () => {
  it("renders 'Ativo' for active status", () => {
    render(<BotStatusBadge status="active" />);
    expect(screen.getByText("Ativo")).toBeDefined();
  });

  it("renders 'Inativo' for inactive status", () => {
    render(<BotStatusBadge status="inactive" />);
    expect(screen.getByText("Inativo")).toBeDefined();
  });

  it("renders 'Banido' for banned status", () => {
    render(<BotStatusBadge status="banned" />);
    expect(screen.getByText("Banido")).toBeDefined();
  });

  it("renders 'Manutenção' for maintenance status", () => {
    render(<BotStatusBadge status="maintenance" />);
    expect(screen.getByText("Manutenção")).toBeDefined();
  });

  it("applies success theme color for active", () => {
    const { container } = render(<BotStatusBadge status="active" />);
    const badge = container.firstChild as HTMLElement;
    // Session 01 S01.f: moved from bg-green-900 (hardcoded tailwind) to
    // bg-success (theme-driven via --color-success in globals.css).
    expect(badge.className).toContain("bg-success");
    expect(badge.getAttribute("data-status")).toBe("active");
  });

  it("applies destructive theme color for banned", () => {
    const { container } = render(<BotStatusBadge status="banned" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-destructive");
    expect(badge.getAttribute("data-status")).toBe("banned");
  });
});

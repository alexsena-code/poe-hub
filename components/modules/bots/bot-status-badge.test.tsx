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

  it("applies green class for active", () => {
    const { container } = render(<BotStatusBadge status="active" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-green-900");
  });

  it("applies red class for banned", () => {
    const { container } = render(<BotStatusBadge status="banned" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-red-900");
  });
});

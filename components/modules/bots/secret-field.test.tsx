/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SecretField } from "./secret-field";

describe("SecretField", () => {
  it("shows masked value by default", () => {
    render(<SecretField value="my-secret" />);
    expect(screen.getByText("••••••••")).toBeDefined();
  });

  it("shows actual value after toggle", async () => {
    render(<SecretField value="my-secret" />);

    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn);

    expect(screen.getByText("my-secret")).toBeDefined();
  });

  it("hides value when toggled again", async () => {
    render(<SecretField value="my-secret" />);

    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn); // show
    fireEvent.click(toggleBtn); // hide

    expect(screen.getByText("••••••••")).toBeDefined();
  });

  it("calls onReveal when toggling for first time", async () => {
    const onReveal = vi.fn().mockResolvedValue("revealed-secret");
    render(<SecretField value="placeholder" onReveal={onReveal} />);

    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(onReveal).toHaveBeenCalledOnce();
      expect(screen.getByText("revealed-secret")).toBeDefined();
    });
  });

  it("shows copy button when value is visible", async () => {
    render(<SecretField value="my-secret" />);

    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2); // toggle + copy
  });
});

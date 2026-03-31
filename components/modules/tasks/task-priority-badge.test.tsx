// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskPriorityBadge, type TaskPriority } from "./task-priority-badge";

describe("TaskPriorityBadge", () => {
  const cases: { priority: TaskPriority; label: string; colorClass: string }[] = [
    { priority: "low", label: "Baixa", colorClass: "text-zinc-400" },
    { priority: "medium", label: "Média", colorClass: "text-blue-400" },
    { priority: "high", label: "Alta", colorClass: "text-yellow-400" },
    { priority: "urgent", label: "Urgente", colorClass: "text-red-400" },
  ];

  for (const { priority, label, colorClass } of cases) {
    it(`should render "${label}" for priority "${priority}"`, () => {
      render(<TaskPriorityBadge priority={priority} />);
      const badge = screen.getByText(label);
      expect(badge).toBeDefined();
    });

    it(`should include the color class "${colorClass}" for priority "${priority}"`, () => {
      const { container } = render(<TaskPriorityBadge priority={priority} />);
      const badge = container.querySelector("[data-slot='badge']");
      expect(badge).not.toBeNull();
      expect(badge!.className).toContain(colorClass);
    });
  }

  it("should accept additional className prop", () => {
    const { container } = render(
      <TaskPriorityBadge priority="high" className="my-custom-class" />
    );
    const badge = container.querySelector("[data-slot='badge']");
    expect(badge!.className).toContain("my-custom-class");
  });
});

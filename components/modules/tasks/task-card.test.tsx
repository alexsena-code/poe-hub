// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard, type Task } from "./task-card";

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task Title",
    description: "Some description",
    status: "backlog",
    priority: "medium",
    assignedTo: null,
    createdBy: "user-1",
    dueDate: null,
    league: null,
    module: null,
    position: 0,
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2025-06-01T00:00:00.000Z",
    assignee: null,
    creator: { id: "user-1", username: "admin" },
    ...overrides,
  };
}

describe("TaskCard", () => {
  const onClick = vi.fn();

  it("should render the task title", () => {
    render(<TaskCard task={buildTask()} onClick={onClick} />);
    expect(screen.getByText("Test Task Title")).toBeDefined();
  });

  it("should render the priority badge", () => {
    render(<TaskCard task={buildTask({ priority: "urgent" })} onClick={onClick} />);
    expect(screen.getByText("Urgente")).toBeDefined();
  });

  it("should render the due date in pt-BR format", () => {
    const task = buildTask({ dueDate: "2025-12-15" });
    render(<TaskCard task={task} onClick={onClick} />);
    // pt-BR format — get expected from same logic the component uses
    const expected = new Date("2025-12-15").toLocaleDateString("pt-BR");
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("should render the module badge when module is set", () => {
    const task = buildTask({ module: "bots" });
    render(<TaskCard task={task} onClick={onClick} />);
    expect(screen.getByText("Bots")).toBeDefined();
  });

  it("should render translated module label for sales", () => {
    const task = buildTask({ module: "sales" });
    render(<TaskCard task={task} onClick={onClick} />);
    expect(screen.getByText("Vendas")).toBeDefined();
  });

  it("should not render module badge when module is null", () => {
    const task = buildTask({ module: null });
    render(<TaskCard task={task} onClick={onClick} />);
    expect(screen.queryByText("Bots")).toBeNull();
    expect(screen.queryByText("Vendas")).toBeNull();
  });

  it("should render assignee initial when assigned", () => {
    const task = buildTask({
      assignedTo: "user-2",
      assignee: { id: "user-2", username: "maria" },
    });
    render(<TaskCard task={task} onClick={onClick} />);
    expect(screen.getByText("M")).toBeDefined();
  });

  it("should not render due date when dueDate is null", () => {
    const task = buildTask({ dueDate: null });
    const { container } = render(<TaskCard task={task} onClick={onClick} />);
    // Calendar icon should not be present
    const calendarIcons = container.querySelectorAll(".lucide-calendar");
    expect(calendarIcons).toHaveLength(0);
  });
});

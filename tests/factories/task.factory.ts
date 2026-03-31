import { prisma } from "@/lib/prisma";

let counter = 0;

const TEST_USER_ID = "test-user-id";

export function buildTaskInput(overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    title: `Test Task ${counter}`,
    description: `Description for task ${counter}`,
    status: "backlog" as const,
    priority: "medium" as const,
    module: null,
    dueDate: null,
    league: null,
    assignedTo: null,
    ...overrides,
  };
}

export async function createTestUser(
  overrides: { id?: string; username?: string; role?: string } = {}
) {
  const id = overrides.id ?? TEST_USER_ID;
  const username = overrides.username ?? "test-admin";

  // Upsert to avoid duplicate errors across test runs
  return prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      username,
      passwordHash: "$2a$10$placeholder-hash-for-tests",
      role: (overrides.role as "admin" | "operator") ?? "admin",
    },
  });
}

export async function createTask(overrides: Record<string, unknown> = {}) {
  const input = buildTaskInput(overrides);
  const createdBy =
    (input.assignedTo as string | null) !== null
      ? (overrides.createdBy as string) ?? TEST_USER_ID
      : (overrides.createdBy as string) ?? TEST_USER_ID;

  return prisma.task.create({
    data: {
      title: input.title as string,
      description: input.description as string | null,
      status: input.status as "backlog" | "todo" | "in_progress" | "done",
      priority: input.priority as "low" | "medium" | "high" | "urgent",
      module: input.module as
        | "bots"
        | "prices"
        | "sales"
        | "simulations"
        | "infra"
        | "other"
        | null,
      dueDate: input.dueDate ? new Date(input.dueDate as string) : null,
      league: input.league as string | null,
      assignedTo: input.assignedTo as string | null,
      createdBy,
      position: (overrides.position as number) ?? 0,
    },
  });
}

export async function cleanupTasks() {
  await prisma.task.deleteMany();
}

export async function cleanupTestUsers() {
  // Delete tasks first (FK constraint), then users
  await prisma.task.deleteMany();
  await prisma.user.deleteMany({
    where: { id: { in: [TEST_USER_ID] } },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskSchema } from "@/lib/validations/task";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const assignedTo = searchParams.get("assignedTo");
  const module = searchParams.get("module");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }
  if (priority) {
    where.priority = priority;
  }
  if (assignedTo) {
    where.assignedTo = assignedTo;
  }
  if (module) {
    where.module = module;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, username: true } },
        creator: { select: { id: true, username: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return NextResponse.json({
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = (session.user as { id: string }).id;

  // If no position given, place at end of the target status column
  let position = data.position;
  if (position === undefined) {
    const lastTask = await prisma.task.findFirst({
      where: { status: data.status || "backlog" },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (lastTask?.position ?? -1) + 1;
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      status: data.status || "backlog",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo || null,
      createdBy: userId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      module: data.module ?? null,
      position,
    },
    include: {
      assignee: { select: { id: true, username: true } },
      creator: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}

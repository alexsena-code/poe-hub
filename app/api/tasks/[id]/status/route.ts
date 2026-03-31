import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTaskStatusSchema } from "@/lib/validations/task";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateTaskStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { status, position } = parsed.data;

  const updateData: Record<string, unknown> = { status };

  if (position !== undefined) {
    updateData.position = position;
  } else if (status !== existing.status) {
    // Moving to a new column — place at the end
    const lastTask = await prisma.task.findFirst({
      where: { status },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    updateData.position = (lastTask?.position ?? -1) + 1;
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      assignee: { select: { id: true, username: true } },
      creator: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({ id: task.id, status: task.status, position: task.position });
}

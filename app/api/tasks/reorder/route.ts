import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reorderTasksSchema } from "@/lib/validations/task";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reorderTasksSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { tasks } = parsed.data;

  // Verify all task IDs exist
  const taskIds = tasks.map((t) => t.id);
  const existingCount = await prisma.task.count({
    where: { id: { in: taskIds } },
  });

  if (existingCount !== taskIds.length) {
    return NextResponse.json(
      { error: "One or more task IDs not found" },
      { status: 404 }
    );
  }

  // Batch update in a single transaction
  await prisma.$transaction(
    tasks.map((t) =>
      prisma.task.update({
        where: { id: t.id },
        data: { status: t.status, position: t.position },
      })
    )
  );

  return NextResponse.json({ success: true, updated: tasks.length });
}

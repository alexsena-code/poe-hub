import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMessageSchema } from "@/lib/validations/chat";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { username: session.user?.name ?? "" },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  const conversation = await prisma.chatConversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      role: data.role,
      content: data.content,
      layers: data.layers ?? undefined,
      tokenEstimate: data.tokenEstimate ?? null,
      latencyMs: data.latencyMs ?? null,
      detectedPageType: data.detectedPageType ?? null,
      cost: data.cost ?? undefined,
    },
  });

  // Touch conversation updatedAt
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  // Auto-generate title from first user message if conversation has no title
  if (!conversation.title && data.role === "user") {
    updateData.title = data.content.slice(0, 60);
  }

  await prisma.chatConversation.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(message, { status: 201 });
}

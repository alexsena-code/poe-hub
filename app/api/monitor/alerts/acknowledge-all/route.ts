import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const result = await prisma.botAlert.updateMany({
    where: { acknowledged: false },
    data: {
      acknowledged: true,
      acknowledgedAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    acknowledgedCount: result.count,
  });
}

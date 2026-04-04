import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { z } from "zod/v4";

const updateProxySchema = z.object({
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, "Username obrigatorio"),
  password: z.string().min(1, "Password obrigatorio"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can access proxy credentials
  if (session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.proxyConfig.findFirst();

  if (!config) {
    return NextResponse.json(null);
  }

  const reveal = request.nextUrl.searchParams.get("reveal") === "true";

  return NextResponse.json({
    id: config.id,
    port: config.port,
    username: decrypt(config.username),
    password: reveal ? decrypt(config.password) : "••••••••",
    notes: config.notes,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateProxySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const encryptedUsername = encrypt(data.username);
  const encryptedPassword = encrypt(data.password);

  const existing = await prisma.proxyConfig.findFirst();

  let config;
  if (existing) {
    config = await prisma.proxyConfig.update({
      where: { id: existing.id },
      data: {
        port: data.port,
        username: encryptedUsername,
        password: encryptedPassword,
        notes: data.notes ?? null,
      },
    });
  } else {
    config = await prisma.proxyConfig.create({
      data: {
        port: data.port,
        username: encryptedUsername,
        password: encryptedPassword,
        notes: data.notes ?? null,
      },
    });
  }

  return NextResponse.json({
    id: config.id,
    port: config.port,
    username: data.username,
    password: data.password,
    notes: config.notes,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  });
}

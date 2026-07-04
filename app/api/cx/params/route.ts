import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paramFiltersSchema, upsertParamSchema } from "@/lib/validations/cx";

/** Lista parâmetros (cx_params), opcionalmente filtrando por scope/scopeKey. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { scope, scopeKey } = parsed.data;

  const where: Prisma.CxParamsWhereInput = {};
  if (scope) where.scope = scope;
  if (scopeKey) where.scopeKey = scopeKey;

  const params = await prisma.cxParams.findMany({
    where,
    orderBy: [{ scope: "asc" }, { scopeKey: "asc" }, { key: "asc" }],
  });

  return NextResponse.json({ data: params });
}

/**
 * Upsert de um parâmetro. Se body.pushTo (executorId) vier, também cria um
 * cx_job param_update {key: value} pro executor — o drain do ws-server entrega.
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = upsertParamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const userId = session.user?.id ?? null;

  const param = await prisma.cxParams.upsert({
    where: {
      scope_scopeKey_key: { scope: d.scope, scopeKey: d.scopeKey, key: d.key },
    },
    update: { value: d.value as Prisma.InputJsonValue, updatedBy: userId },
    create: {
      scope: d.scope,
      scopeKey: d.scopeKey,
      key: d.key,
      value: d.value as Prisma.InputJsonValue,
      updatedBy: userId,
    },
  });

  let job = null;
  if (d.pushTo) {
    job = await prisma.cxJob.create({
      data: {
        executorId: d.pushTo,
        type: "param_update",
        payload: { [d.key]: d.value } as Prisma.InputJsonValue,
        requestedBy: userId,
      },
    });
  }

  return NextResponse.json({ data: param, job });
}

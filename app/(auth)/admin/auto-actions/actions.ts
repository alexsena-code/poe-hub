"use server";

// Session 29: Server Actions for the auto-actions admin page. Wraps
// the engine API so the client component doesn't need to know auth
// details or the proxy path layout.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface DecideResult {
  ok: boolean;
  error?: string;
}

export async function decideOnLog(
  logId: number,
  decision: "applied" | "rejected",
): Promise<DecideResult> {
  if (!Number.isFinite(logId) || logId <= 0) {
    return { ok: false, error: `bad logId: ${logId}` };
  }
  if (decision !== "applied" && decision !== "rejected") {
    return { ok: false, error: `bad decision: ${decision}` };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const url = `${proto}://${host}/api/engine/seo/auto-actions/log/${logId}/decision`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: h.get("cookie") ?? "",
      },
      body: JSON.stringify({ decision }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/auto-actions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

"use server";

// Session 29: Server Actions for the auto-actions admin page. Wraps
// the engine API so the client component doesn't need to know auth
// details or the proxy path layout.
//
// Session 33 (BUG 2 fix): added bulkDecide + rejectAllPending so the
// pending review queue can be drained without clicking row-by-row.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface DecideResult {
  ok: boolean;
  error?: string;
}

export interface BulkDecideResult {
  ok: boolean;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ logId: number; error: string }>;
  error?: string;
}

export interface RejectAllPendingResult {
  ok: boolean;
  rejected?: number;
  error?: string;
}

async function engineUrl(path: string): Promise<{ url: string; cookie: string }> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  return { url: `${proto}://${host}/api/engine/seo/auto-actions${path}`, cookie: h.get("cookie") ?? "" };
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

  const { url, cookie } = await engineUrl(`/log/${logId}/decision`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
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

export async function bulkDecideAction(
  logIds: number[],
  decision: "applied" | "rejected",
): Promise<BulkDecideResult> {
  if (!Array.isArray(logIds) || logIds.length === 0) {
    return { ok: false, error: "no logIds selected" };
  }
  if (decision !== "applied" && decision !== "rejected") {
    return { ok: false, error: `bad decision: ${decision}` };
  }
  const valid = logIds.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
  if (valid.length === 0) {
    return { ok: false, error: "no valid logIds in selection" };
  }

  const { url, cookie } = await engineUrl(`/bulk-decide`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ logIds: valid, decision }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      succeeded?: number;
      failed?: number;
      errors?: Array<{ logId: number; error: string }>;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/auto-actions");
    return {
      ok: !!body?.ok,
      succeeded: body?.succeeded ?? 0,
      failed: body?.failed ?? 0,
      errors: body?.errors ?? [],
      error: body?.error,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function rejectAllPendingAction(
  actionType?: string,
): Promise<RejectAllPendingResult> {
  const { url, cookie } = await engineUrl(`/reject-all-pending`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(actionType ? { actionType } : {}),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      rejected?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/auto-actions");
    return { ok: !!body?.ok, rejected: body?.rejected ?? 0, error: body?.error };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

"use server";

// Session 31 (A): Server Action wrapping `PUT /seo/domain-lists/:listType`.
// Engine validates again on its side (≤500 entries, lowercase + trim + dedup);
// this layer just forwards and surfaces the error message back to the UI so
// toast.error renders something useful.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const LIST_TYPES = ["off-topic", "social", "marketplace-rmt", "generic-news"] as const;
type ListType = (typeof LIST_TYPES)[number];

export interface SaveDomainListResult {
  ok: boolean;
  count?: number;
  error?: string;
}

export async function saveDomainList(
  listType: ListType,
  domains: string[],
): Promise<SaveDomainListResult> {
  if (!LIST_TYPES.includes(listType)) {
    return { ok: false, error: `unknown listType: ${listType}` };
  }
  if (!Array.isArray(domains)) {
    return { ok: false, error: "domains must be an array" };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const url = `${proto}://${host}/api/engine/seo/domain-lists/${listType}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: h.get("cookie") ?? "",
      },
      body: JSON.stringify({ domains }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: (body?.message as string) ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/domain-lists");
    return { ok: true, count: typeof body?.count === "number" ? body.count : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

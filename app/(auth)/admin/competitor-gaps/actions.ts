"use server";

// Session 31 (B): Server Action wrapping `POST /seo/competitors/import-gaps`.
// The engine endpoint is bulk + sem body; aqui só cuidamos de cookie auth e
// surface o shape de resposta `{imported, skipped, details}` para o toast.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface ImportGapsResult {
  ok: boolean;
  imported?: number;
  skipped?: number;
  details?: {
    already_covered?: string[];
    too_short?: string[];
    db_error?: string[];
    imported?: Array<{ keyword: string; competitors: string[]; category: string }>;
  };
  error?: string;
}

export async function importGapsAction(): Promise<ImportGapsResult> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const url = `${proto}://${host}/api/engine/seo/competitors/import-gaps`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: h.get("cookie") ?? "",
      },
      body: "{}",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      imported?: number;
      skipped?: number;
      details?: ImportGapsResult["details"];
      message?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/competitor-gaps");
    return {
      ok: true,
      imported: body?.imported ?? 0,
      skipped: body?.skipped ?? 0,
      details: body?.details,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

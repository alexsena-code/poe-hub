"use server";

// Session 31 (B): Server Action wrapping `POST /seo/competitors/import-gaps`.
// The engine endpoint is bulk + sem body; aqui só cuidamos de cookie auth e
// surface o shape de resposta `{imported, skipped, details}` para o toast.
//
// Session 33 (BUG 1 fix): added enrich/embed/full-pipeline triggers so the
// operator can run the missing pipeline steps from the gaps UI (was the
// reason the table sat empty: pages crawled but never enriched/embedded).

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

export interface PipelineActionResult {
  ok: boolean;
  status?: string;
  message?: string;
  error?: string;
}

async function engineUrl(path: string): Promise<{ url: string; cookie: string }> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  return { url: `${proto}://${host}/api/engine/seo/competitors${path}`, cookie: h.get("cookie") ?? "" };
}

export async function importGapsAction(): Promise<ImportGapsResult> {
  const { url, cookie } = await engineUrl(`/import-gaps`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
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

async function pipelineCall(path: string, body: Record<string, unknown> = {}): Promise<PipelineActionResult> {
  const { url, cookie } = await engineUrl(path);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      ok?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    revalidatePath("/admin/competitor-gaps");
    return {
      ok: true,
      status: data?.status ?? "started",
      message: data?.message,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runEnrichAction(limit = 100): Promise<PipelineActionResult> {
  return pipelineCall(`/enrich`, { limit });
}

export async function runEmbedAction(limit = 100): Promise<PipelineActionResult> {
  return pipelineCall(`/embed`, { limit });
}

export async function runFullPipelineAction(limit = 100): Promise<PipelineActionResult> {
  return pipelineCall(`/full-pipeline`, { limit });
}

export async function runCrawlAction(): Promise<PipelineActionResult> {
  return pipelineCall(`/crawl`);
}

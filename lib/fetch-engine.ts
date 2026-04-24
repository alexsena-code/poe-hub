import { headers } from "next/headers";

/**
 * Shared fetch helper for Server Components that need to consume authenticated
 * routes within this same app (e.g. /api/dashboard, /api/engine/*). Forwards
 * the original request cookie so the NextAuth session is preserved.
 *
 * Session 04 S04.a — introduced during Tier 1 RSC migrations.
 *
 * Usage:
 *   const data = await fetchEngine<DashboardData>("/api/dashboard");
 */
export async function fetchEngine<T>(path: string, init?: RequestInit): Promise<T> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}${path}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      cookie: h.get("cookie") ?? "",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `fetchEngine ${path} failed: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

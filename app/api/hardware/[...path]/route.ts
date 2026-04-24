import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Hardware service runs separately (Python FastAPI); this proxy exposes it
// server-side so RSC pages can consume it via /api/hardware/<path> through
// fetchEngine (cookie forward + same-origin).
// Env fallback order: HARDWARE_API_URL (server-only) →
// NEXT_PUBLIC_HARDWARE_API_URL (also browser) → localhost dev default.
const HARDWARE_API_URL =
  process.env.HARDWARE_API_URL ||
  process.env.NEXT_PUBLIC_HARDWARE_API_URL ||
  "http://localhost:8001";

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized (no session)" }, { status: 401 });
  }

  const { path } = await params;
  const target = `${HARDWARE_API_URL}/api/${path.join("/")}`;
  const url = new URL(target);

  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers();
  headers.set("Content-Type", req.headers.get("Content-Type") || "application/json");

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(url.toString(), init);
  const data = await res.text();

  if (res.status >= 400) {
    console.warn(`[hardware-proxy] ${req.method} ${url.toString()} → ${res.status}`);
  }

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;

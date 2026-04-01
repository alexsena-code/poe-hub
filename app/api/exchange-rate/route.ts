import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface ExchangeRateApiResponse {
  result: string;
  rates: Record<string, number>;
}

interface CachedRate {
  rate: number;
  updatedAt: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATE = 5.0;

let cache: CachedRate | null = null;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  if (cache !== null && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ rate: cache.rate, updatedAt: cache.updatedAt });
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API responded with ${response.status}`);
    }

    const data = (await response.json()) as ExchangeRateApiResponse;

    if (data.result !== "success" || typeof data.rates?.BRL !== "number") {
      throw new Error("Unexpected response shape from exchange rate API");
    }

    const updatedAt = new Date().toISOString();
    cache = { rate: data.rates.BRL, updatedAt, fetchedAt: now };

    return NextResponse.json({ rate: cache.rate, updatedAt: cache.updatedAt });
  } catch {
    if (cache !== null) {
      return NextResponse.json({ rate: cache.rate, updatedAt: cache.updatedAt });
    }

    const updatedAt = new Date().toISOString();
    return NextResponse.json({ rate: FALLBACK_RATE, updatedAt });
  }
}

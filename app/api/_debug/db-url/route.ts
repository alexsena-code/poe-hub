// TEMPORARY DEBUG ENDPOINT — remover após diagnóstico de DATABASE_URL na Vercel.
// Retorna info da env sem expor a senha.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ParsedUrl =
  | { exists: false }
  | {
      exists: true;
      length: number;
      protocol: string;
      user: string;
      host: string;
      port: string;
      database: string;
      hasPassword: boolean;
      passwordLength: number;
    }
  | { exists: true; length: number; parseError: string };

function parseUrl(url: string | undefined): ParsedUrl {
  if (!url) return { exists: false };
  try {
    const u = new URL(url);
    return {
      exists: true,
      length: url.length,
      protocol: u.protocol,
      user: decodeURIComponent(u.username),
      host: u.hostname,
      port: u.port,
      database: u.pathname.slice(1),
      hasPassword: u.password.length > 0,
      passwordLength: u.password.length,
    };
  } catch (err) {
    return {
      exists: true,
      length: url.length,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  return NextResponse.json({
    runtimeRegion: process.env.VERCEL_REGION ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    nodeVersion: process.version,
    envs: {
      DATABASE_URL: parseUrl(process.env.DATABASE_URL),
      POSTGRES_URL: parseUrl(process.env.POSTGRES_URL),
      POSTGRES_PRISMA_URL: parseUrl(process.env.POSTGRES_PRISMA_URL),
      POSTGRES_URL_NON_POOLING: parseUrl(process.env.POSTGRES_URL_NON_POOLING),
      DATABASE_URL_UNPOOLED: parseUrl(process.env.DATABASE_URL_UNPOOLED),
      PRISMA_DATABASE_URL: parseUrl(process.env.PRISMA_DATABASE_URL),
    },
  });
}

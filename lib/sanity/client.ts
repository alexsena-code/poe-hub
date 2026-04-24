import { createClient, type SanityClient } from "@sanity/client";

/**
 * Validates and returns server-side Sanity config (write token included).
 * Throws with the exact env var name if any required value is missing.
 * Never call this from client-side code — the write token must stay server-only.
 *
 * Usage: const client = buildSanityClient()
 */
function getSanityConfig() {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing environment variable: SANITY_PROJECT_ID");
  }

  const dataset = process.env.SANITY_DATASET;
  if (!dataset) {
    throw new Error("Missing environment variable: SANITY_DATASET");
  }

  const apiVersion = process.env.SANITY_API_VERSION;
  if (!apiVersion) {
    throw new Error("Missing environment variable: SANITY_API_VERSION");
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing environment variable: SANITY_API_WRITE_TOKEN");
  }

  return { projectId, dataset, apiVersion, token };
}

/**
 * Server-only Sanity client with write token.
 * perspective=published + useCdn=false ensures we always read the latest
 * committed data (no CDN cache), which matters when we read-back after writes.
 *
 * Lazily initialised so env validation only runs on first import in a
 * request context (not at build time when vars may be absent).
 */
let _serverClient: SanityClient | null = null;

export function getSanityClient(): SanityClient {
  if (_serverClient) return _serverClient;

  const { projectId, dataset, apiVersion, token } = getSanityConfig();

  _serverClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    perspective: "published",
  });

  return _serverClient;
}

// Convenience alias — most internal modules just import this directly.
export const sanityClient = {
  get: () => getSanityClient(),
};

/**
 * Public config for client-side imageBuilder (no token, uses NEXT_PUBLIC_ vars).
 * Safe to import in browser bundles.
 */
export const sanityPublicConfig = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-05-21",
  useCdn: true,
};

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
 *
 * perspective=raw: returns BOTH `drafts.<id>` documents AND published ones
 * without filtering or substitution. The hub's queries filter draft vs
 * published explicitly via `_id in path("drafts.**")` so we need raw access.
 * `published` would silently strip drafts and break LIST_DRAFTS_QUERY.
 *
 * useCdn=false: read latest committed state, important for read-after-write
 * (e.g. reading back a draft we just createOrReplace'd).
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
    perspective: "raw",
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
 *
 * Lazy-validated: throws a precise error when projectId or dataset are missing
 * or empty. Common cause is marking the NEXT_PUBLIC_SANITY_* envs as
 * "Sensitive" in Vercel, which removes them from the build-time bundle and
 * silently inlines empty strings — producing CDN URLs like
 * https://cdn.sanity.io/images/// (404). Failing visibly here surfaces that
 * misconfiguration instead of letting Next/Image return a misleading 404.
 */
export interface SanityPublicConfig {
  projectId: string;
  dataset: string;
  apiVersion: string;
  useCdn: boolean;
}

export function getSanityPublicConfig(): SanityPublicConfig {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  if (!projectId) {
    throw new Error(
      `Missing or empty environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID (got ${JSON.stringify(projectId)}). ` +
        `In Vercel, ensure this var is NOT marked "Sensitive" — Sensitive envs are stripped from the client bundle ` +
        `at build time, which produces broken CDN URLs like https://cdn.sanity.io/images///hash.webp.`,
    );
  }
  if (!dataset) {
    throw new Error(
      `Missing or empty environment variable: NEXT_PUBLIC_SANITY_DATASET (got ${JSON.stringify(dataset)}). ` +
        `In Vercel, ensure this var is NOT marked "Sensitive" — Sensitive envs are stripped from the client bundle.`,
    );
  }

  return {
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-05-21",
    useCdn: true,
  };
}

// RSC shell — fetches proxy config server-side; form + PUT mutation in client island.
// S05.a migration: was 229L 'use client'; now RSC + ProxyClient island.
// Sensitive fields (username, password) are decrypted by /api/proxy-config before
// being forwarded here; they are never logged or leaked in route responses.
import { fetchEngine } from "@/lib/fetch-engine";
import { ProxyClient } from "@/components/modules/admin/config/proxy-client";

interface ProxyConfig {
  port: number;
  username: string;
  password: string;
  notes?: string;
}

export default async function ProxySettingsPage() {
  // Null means no config saved yet; ProxyClient falls back to defaults (port 8080).
  let initialConfig: ProxyConfig | null = null;
  try {
    initialConfig = await fetchEngine<ProxyConfig>("/api/proxy-config");
  } catch {
    // Not found or 500 — client island renders with empty defaults
  }

  return <ProxyClient initialConfig={initialConfig} />;
}

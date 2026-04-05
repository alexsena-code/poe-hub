import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Syncs the active proxy list to the content engine API.
 * Builds proxy URLs from ProxyConfig credentials + active Bot IPs,
 * then PUTs them to the engine's /config/proxies endpoint.
 */
export async function syncProxiesToEngine(): Promise<void> {
  const engineUrl = process.env.ENGINE_API_URL;
  const engineKey = process.env.ENGINE_API_KEY;

  if (!engineUrl || !engineKey) {
    console.warn("[sync-proxies] ENGINE_API_URL or ENGINE_API_KEY not set, skipping sync");
    return;
  }

  const config = await prisma.proxyConfig.findFirst();
  if (!config) {
    console.warn("[sync-proxies] No ProxyConfig found, syncing empty proxy list");
    await pushProxies(engineUrl, engineKey, []);
    return;
  }

  const username = decrypt(config.username);
  const password = decrypt(config.password);
  const port = config.port;

  const activeBots = await prisma.bot.findMany({
    where: { status: "active" },
    select: { proxyIp: true },
  });

  const proxies = activeBots
    .filter((bot) => bot.proxyIp)
    .map((bot) => `http://${username}:${password}@${bot.proxyIp}:${port}`);

  await pushProxies(engineUrl, engineKey, proxies);
}

async function pushProxies(
  engineUrl: string,
  engineKey: string,
  proxies: string[],
): Promise<void> {
  const url = `${engineUrl}/config/proxies`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": engineKey,
    },
    body: JSON.stringify({ proxies }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[sync-proxies] Engine API returned ${res.status}: ${body}`,
    );
    return;
  }

  console.log(`[sync-proxies] Synced ${proxies.length} proxies to engine`);
}

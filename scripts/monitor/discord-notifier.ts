/**
 * DreamPoeBot Monitor — Discord Webhook Notifier
 *
 * Sends rich embed notifications to a Discord channel when alerts fire.
 * Rate-limited to 1 message per instance per minute to avoid spam.
 */

import type { BotAlert, AlertSeverity } from "./types.js";

// ============================================================
// Configuration
// ============================================================

const WEBHOOK_URL = process.env.DISCORD_MONITOR_WEBHOOK_URL ?? "";

/** Max 1 Discord message per instance per 60 seconds */
const RATE_LIMIT_MS = 60_000;

// Discord embed colour codes by severity
const SEVERITY_COLOR: Record<AlertSeverity, number> = {
  low: 0x3498db, // blue
  medium: 0xf1c40f, // yellow
  high: 0xe67e22, // orange
  critical: 0xe74c3c, // red
};

// ============================================================
// Rate-limit state
// ============================================================

/** instanceId → last notification epoch ms */
const lastNotified = new Map<string, number>();

// ============================================================
// Public API
// ============================================================

/**
 * Send a Discord embed for the given alert.
 * Silently skips if:
 *   - DISCORD_MONITOR_WEBHOOK_URL is not set
 *   - The same instance was notified less than RATE_LIMIT_MS ago
 */
export async function notifyDiscord(alert: BotAlert): Promise<void> {
  if (!WEBHOOK_URL) return;

  const now = Date.now();
  const last = lastNotified.get(alert.instanceId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return;

  lastNotified.set(alert.instanceId, now);

  const payload = buildPayload(alert);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        `[Discord] Webhook request failed: ${res.status} ${res.statusText}`
      );
    }
  } catch (err) {
    console.error("[Discord] Failed to send webhook:", err);
  }
}

// ============================================================
// Helpers
// ============================================================

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
}

interface WebhookPayload {
  username: string;
  embeds: DiscordEmbed[];
}

function buildPayload(alert: BotAlert): WebhookPayload {
  const color = SEVERITY_COLOR[alert.severity];

  const fields: DiscordEmbed["fields"] = [
    { name: "Severity", value: alert.severity.toUpperCase(), inline: true },
    { name: "Type", value: alert.type.toUpperCase(), inline: true },
    { name: "Instance", value: alert.instanceId, inline: false },
  ];

  if (alert.details) {
    const detailLines = Object.entries(alert.details)
      .map(([k, v]) => `**${k}:** ${String(v)}`)
      .join("\n");
    if (detailLines) {
      fields.push({ name: "Details", value: detailLines.slice(0, 1024), inline: false });
    }
  }

  return {
    username: "PoE Bot Monitor",
    embeds: [
      {
        title: alert.title.slice(0, 256),
        description: alert.message.slice(0, 4096),
        color,
        fields,
        footer: { text: "DreamPoeBot Monitor" },
        timestamp: alert.createdAt,
      },
    ],
  };
}

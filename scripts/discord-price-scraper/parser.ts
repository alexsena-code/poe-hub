/**
 * Discord Price Scraper — Parser Module
 *
 * Parses DiscordChatExporter JSON format and extracts price entries.
 */

export interface DiscordMessage {
  id: string;
  type: string;
  timestamp: string;
  timestampEdited: string | null;
  callEndedTimestamp: string | null;
  isPinned: boolean;
  content: string;
  author: {
    id: string;
    name: string;
    discriminator: string;
    nickname: string | null;
    color: string | null;
    isBot: boolean;
    roles: unknown[];
    avatarUrl: string;
  };
  attachments: unknown[];
  embeds: unknown[];
  stickers: unknown[];
  reactions: unknown[];
  mentions: unknown[];
}

export interface DiscordExport {
  guild: {
    id: string;
    name: string;
    iconUrl: string;
  };
  channel: {
    id: string;
    type: string;
    categoryId: string;
    category: string;
    name: string;
    topic: string | null;
  };
  dateRange: {
    after: string | null;
    before: string | null;
  };
  messages: DiscordMessage[];
  messageCount: number;
}

export interface ParsedPriceEntry {
  discordMessageId: string;
  discordChannelId: string;
  discordServerId: string;
  authorDiscordId: string;
  authorName: string;
  isCnl: boolean;
  price: number;
  currency: "divine" | "chaos" | "usd" | "brl" | "other";
  item: string | null;
  rawMessage: string;
  messageTimestamp: Date;
  league: string | null;
}

export interface ParseResult {
  entries: ParsedPriceEntry[];
  skipped: number;
  errors: string[];
}

/**
 * Price extraction patterns. Each pattern has a regex and a currency mapping.
 * Patterns are tried in order; first match wins.
 */
const PRICE_PATTERNS: Array<{
  regex: RegExp;
  currency: ParsedPriceEntry["currency"];
  priceGroup: number;
  itemGroup?: number;
}> = [
  // "divine 4.50", "div 4.50", "divine: 4.50", "div: 4.50"
  { regex: /\bdivine[s]?\s*:?\s*(\d+[.,]?\d*)/i, currency: "divine", priceGroup: 1 },
  // "4.50 divine", "4.50 div", "4,50 divines"
  { regex: /(\d+[.,]?\d*)\s*divine[s]?/i, currency: "divine", priceGroup: 1 },
  // "4.5 div", "4,5 div"
  { regex: /(\d+[.,]?\d*)\s*div\b/i, currency: "divine", priceGroup: 1 },
  // "div 4.50", "div: 4.50"
  { regex: /\bdiv\s*:?\s*(\d+[.,]?\d*)/i, currency: "divine", priceGroup: 1 },
  // "chaos 450", "chaos: 450"
  { regex: /\bchaos\s*:?\s*(\d+[.,]?\d*)/i, currency: "chaos", priceGroup: 1 },
  // "450 chaos"
  { regex: /(\d+[.,]?\d*)\s*chaos/i, currency: "chaos", priceGroup: 1 },
  // "$4.50", "$ 4.50", "USD 4.50", "usd: 4.50"
  { regex: /\$\s*(\d+[.,]?\d*)/i, currency: "usd", priceGroup: 1 },
  { regex: /\busd\s*:?\s*(\d+[.,]?\d*)/i, currency: "usd", priceGroup: 1 },
  { regex: /(\d+[.,]?\d*)\s*usd/i, currency: "usd", priceGroup: 1 },
  // "R$25", "R$ 25", "BRL 25", "brl: 25"
  { regex: /R\$\s*(\d+[.,]?\d*)/i, currency: "brl", priceGroup: 1 },
  { regex: /\bbrl\s*:?\s*(\d+[.,]?\d*)/i, currency: "brl", priceGroup: 1 },
  { regex: /(\d+[.,]?\d*)\s*brl/i, currency: "brl", priceGroup: 1 },
  // Standalone number with context hint (fallback — only if message is short, likely a price post)
  // e.g., "4.50" alone in a short message from a price channel
  { regex: /^(\d+[.,]\d+)$/, currency: "divine", priceGroup: 1 },
];

/**
 * Normalize a price string to a number.
 * Handles both "4.50" and "4,50" formats.
 */
function normalizePrice(raw: string): number {
  // Replace comma with dot for decimal parsing
  const normalized = raw.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value) || value <= 0) {
    throw new Error(`Invalid price value: ${raw}`);
  }
  return value;
}

/**
 * Extract price information from a message content string.
 * Returns null if no price pattern is found.
 */
export function extractPrice(
  content: string
): { price: number; currency: ParsedPriceEntry["currency"]; item: string | null } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  for (const pattern of PRICE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match && match[pattern.priceGroup]) {
      try {
        const price = normalizePrice(match[pattern.priceGroup]);
        const item = pattern.itemGroup ? match[pattern.itemGroup] || null : null;
        return { price, currency: pattern.currency, item };
      } catch {
        // Price normalization failed, try next pattern
        continue;
      }
    }
  }

  return null;
}

/**
 * Parse a DiscordChatExporter JSON export and extract price entries.
 */
export function parseExport(
  data: DiscordExport,
  cnlAuthorIds: string[],
  league: string | null = null
): ParseResult {
  const entries: ParsedPriceEntry[] = [];
  let skipped = 0;
  const errors: string[] = [];

  const cnlSet = new Set(cnlAuthorIds);

  for (const message of data.messages) {
    // Skip bot messages and system messages
    if (message.author.isBot) {
      skipped++;
      continue;
    }
    if (message.type !== "Default" && message.type !== "Reply") {
      skipped++;
      continue;
    }
    if (!message.content || !message.content.trim()) {
      skipped++;
      continue;
    }

    try {
      const priceData = extractPrice(message.content);
      if (!priceData) {
        skipped++;
        continue;
      }

      entries.push({
        discordMessageId: message.id,
        discordChannelId: data.channel.id,
        discordServerId: data.guild.id,
        authorDiscordId: message.author.id,
        authorName: message.author.nickname || message.author.name,
        isCnl: cnlSet.has(message.author.id),
        price: priceData.price,
        currency: priceData.currency,
        item: priceData.item,
        rawMessage: message.content,
        messageTimestamp: new Date(message.timestamp),
        league,
      });
    } catch (err) {
      const errorMsg = `Error parsing message ${message.id}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errorMsg);
    }
  }

  return { entries, skipped, errors };
}

/**
 * Discord Price Message Parser
 * Calibrated with real data from "Cnlgaming & Phoenix Store" server (2026-03-31)
 *
 * Recognized patterns:
 * - "R$ 0,25 cada" / "R$0,23" / "R$: 0,23 cada" / "R$; 0,23 cada"
 * - "0.205 BRL" (CNL format)
 * - "Valor: R$ 0,22" / "Valor: 0,18"
 * - "Price:0.20 cada"
 * - Bulk: "300 divines R$60" / "200 div 40 reais"
 * - Mirror: "Mirror of Kalandra Valor: R$ 200"
 */

export interface DiscordExport {
  guild: { id: string; name: string };
  channel: { id: string; name: string };
  messages: DiscordMessage[];
}

export interface DiscordMessage {
  id: string;
  type: string;
  timestamp: string;
  content: string;
  author: {
    id: string;
    name: string;
    nickname: string;
    isBot: boolean;
  };
}

export interface ParsedPrice {
  discordMessageId: string;
  discordChannelId: string;
  discordServerId: string;
  authorDiscordId: string;
  authorName: string;
  isCnl: boolean;
  price: number;
  currency: "divine" | "chaos" | "usd" | "brl" | "other";
  item: string;
  rawMessage: string;
  messageTimestamp: string;
  league: string | null;
  operation: "sell" | "buy";
  quantity: number | null;
  isSold: boolean;
}

export interface ParseResult {
  entries: ParsedPrice[];
  skipped: number;
  errors: string[];
}

function detectOperation(content: string): "sell" | "buy" {
  if (/\bcompr[oe]\b/i.test(content)) return "buy";
  return "sell";
}

function detectItem(content: string): string {
  // If message primarily sells/buys mirror (and not divine prices), classify as mirror
  // Check if "mirror" appears in a pricing context without divine pricing
  const hasDivinePrice = /divine\s*(?:orb)?[:\s]*R\$|R\$.*divine|divine.*(?:valor|price|preço)|compra\s*divines?\s*\d/i.test(content);
  const hasMirrorOnly = /mirror\s*(of\s*kalandra)?/i.test(content) && !hasDivinePrice;
  if (hasMirrorOnly) return "mirror";
  if (/chaos\s*orb/i.test(content) && !hasDivinePrice) return "chaos";
  return "divine";
}

/**
 * Detect if message is from CNL by content pattern (fallback when author ID not in cnlAuthorIds).
 * CNL posts follow a distinctive template with "CNLGAMING.COM" and "BRL" pricing.
 */
function isCnlByContent(content: string): boolean {
  return /cnlgaming\.com/i.test(content) && /BRL/i.test(content);
}

function isSoldMessage(content: string): boolean {
  if (/\bvendido\b/i.test(content)) return true;
  const stripped = content.replace(/~~[^~]+~~/g, "");
  const totalLen = content.replace(/~~/g, "").length;
  if (totalLen > 0 && stripped.trim().length / totalLen < 0.3) return true;
  return false;
}

function parseBrlNumber(str: string): number {
  return parseFloat(str.replace(",", "."));
}

function extractUnitPrice(content: string, item: string): { price: number; quantity: number | null } | null {
  const cleaned = content.replace(/~~[^~]+~~/g, "").replace(/\*+/g, "");

  // "0.205 BRL" (CNL format) — test BEFORE R$ to avoid false matches
  const brlMatch = cleaned.match(/(\d+[.,]\d+)\s*BRL/i);
  if (brlMatch) return { price: parseBrlNumber(brlMatch[1]), quantity: null };

  // "Valor: R$ 0,22" / "Valor:** R$ 0,22" / "Valor: 0,18"
  const valorMatch = cleaned.match(/Valor[:\s*]*\s*(?:R\$[:\s;]*)?\s*(\d+[.,]\d+)/i);
  if (valorMatch) return { price: parseBrlNumber(valorMatch[1]), quantity: null };

  // "Price:0.20" / "Preço: R$0,22"
  const priceMatch = cleaned.match(/(?:Price|Preço)[:\s]*(?:R\$[:\s;]*)?\s*(\d+[.,]\d+)/i);
  if (priceMatch) return { price: parseBrlNumber(priceMatch[1]), quantity: null };

  // Bulk: "300 divines R$60,00" / "300 div = 60 reais" / "860 Divs R$ 137,60" — BEFORE unit R$ match
  const bulkMatch = cleaned.match(/(\d+)\s*(?:divines?|divs?)\s*(?:=\s*)?(?:R\$\s*)?(\d+[.,]?\d*)\s*(?:reais|R\$)?/i)
    || cleaned.match(/(\d+)\s*(?:divines?|divs?)\s*R\$\s*(\d+[.,]?\d*)/i);
  if (bulkMatch) {
    const qty = parseInt(bulkMatch[1]);
    const total = parseBrlNumber(bulkMatch[2]);
    if (qty > 1 && total > 1) return { price: Math.round((total / qty) * 100) / 100, quantity: qty };
  }

  // "R$ 0,25 cada" / "R$0,23" / "R$: 0,23" / "R$; 0,23"
  const unitMatch = cleaned.match(/R\$[:\s;]*\s*(\d+[.,]\d+)\s*(cada|\/\s*(?:unid|cada))?/i);
  if (unitMatch) return { price: parseBrlNumber(unitMatch[1]), quantity: null };

  // Mirror price: "R$ 200,00" / "R$ 150"
  if (item === "mirror") {
    const mirrorMatch = cleaned.match(/(?:Valor[:\s]*)?R\$[:\s;]*\s*(\d+[.,]?\d*)/i);
    if (mirrorMatch) return { price: parseBrlNumber(mirrorMatch[1]), quantity: null };
  }

  return null;
}

function extractStock(content: string): number | null {
  const match = content.match(/(?:Estoque|Stock|Disponíve(?:l|is))[:\s]*(\d+)\+?/i);
  return match ? parseInt(match[1]) : null;
}

function shouldSkip(rawContent: string, isBot: boolean): boolean {
  if (isBot) return true;
  const content = rawContent.replace(/\*+/g, "");
  if (content.length < 10) return true;
  if (/\bvendo\s+build\b/i.test(content)) return true;
  if (/\bfa[çc]o\b.*\b(level|leveling|atos)\b/i.test(content)) return true;
  if (/\bwts\s+softcore\b/i.test(content) && !/divine|mirror/i.test(content)) return true;
  if (/\bmain\s+skills?\b/i.test(content) && !/divine|mirror/i.test(content)) return true;
  // Only skip Smoother KE if that's the ONLY product (not if it also has divine/mirror prices)
  if (/\bsmoother\s+ke\b/i.test(content) && !/divine|div\b|mirror/i.test(content)) return true;
  if (!/divine|div\b|mirror|chaos|currency|r\$|\breais\b|brl/i.test(content)) return true;
  return false;
}

export function parseExport(
  data: DiscordExport,
  cnlAuthorIds: Set<string>,
  leagueOverride?: string
): ParseResult {
  const entries: ParsedPrice[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const msg of data.messages) {
    if (shouldSkip(msg.content, msg.author.isBot)) {
      skipped++;
      continue;
    }

    const isSold = isSoldMessage(msg.content);
    let item = detectItem(msg.content);
    const operation = detectOperation(msg.content);

    const extracted = extractUnitPrice(msg.content, item);

    // Sanity check: if price < R$1, it's divine (mirrors cost R$100+)
    if (extracted && item === "mirror" && extracted.price < 1) {
      item = "divine";
    }
    if (!extracted) {
      skipped++;
      continue;
    }

    // League resolved by date in the scraper, not from message text
    const league = leagueOverride || null;
    const stock = extractStock(msg.content);

    // CNL: by author ID or by content pattern (fallback for unknown periods)
    const isCnl = cnlAuthorIds.has(msg.author.id) || isCnlByContent(msg.content);

    entries.push({
      discordMessageId: msg.id,
      discordChannelId: data.channel.id,
      discordServerId: data.guild.id,
      authorDiscordId: msg.author.id,
      authorName: msg.author.nickname || msg.author.name,
      isCnl,
      price: extracted.price,
      currency: "brl",
      item,
      rawMessage: msg.content,
      messageTimestamp: msg.timestamp,
      league,
      operation,
      quantity: stock ?? extracted.quantity,
      isSold,
    });
  }

  return { entries, skipped, errors };
}

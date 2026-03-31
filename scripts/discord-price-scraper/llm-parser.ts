/**
 * LLM-based Discord Price Parser using Gemini 2.0 Flash-Lite
 *
 * Sends batches of messages to the LLM for classification and extraction.
 * Much more accurate than regex for varied message formats.
 */

import { GoogleGenAI } from "@google/genai";

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
  currency: "brl";
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

interface LlmExtracted {
  index: number;
  skip: boolean;
  item?: string;
  price?: number;
  operation?: "sell" | "buy";
  quantity?: number | null;
  isSold?: boolean;
}

const SYSTEM_PROMPT = `You are a parser for a Path of Exile Discord trading channel.
You will receive a batch of Discord messages. For each message, extract trading information.

Rules:
- Only extract CURRENCY trades: Divine Orb, Mirror of Kalandra, Chaos Orb, Exalted Orb
- SKIP messages about: account sales, build sales, skin sales, leveling services, supporter packs, non-trading messages
- Prices are in BRL (R$ or reais). Extract the UNIT price per item.
- For bulk offers like "300 divines R$60", calculate unit price: 60/300 = 0.20
- "Compro" = buy, "Vendo" = sell (default is sell)
- Messages wrapped in ~~strikethrough~~ or containing "Vendido" are sold (isSold: true)
- If a message mentions multiple items, extract the PRIMARY one (usually divine)
- Divine price typically ranges R$0.01 to R$20. Mirror ranges R$50 to R$500.

Respond with a JSON array. For each message, return:
- index: message index in the batch (0-based)
- skip: true if message should be ignored (not a currency trade)
- item: "divine", "mirror", "chaos", or "exalted"
- price: unit price in BRL (number)
- operation: "sell" or "buy"
- quantity: stock quantity if mentioned, null otherwise
- isSold: true if already sold

Example input:
[0] "Vendo Divine Valor: R$ 0,23 cada Estoque: 200"
[1] "Vendo conta com skins R$800"
[2] "Compro 100 divines 20 reais"

Example response:
[{"index":0,"skip":false,"item":"divine","price":0.23,"operation":"sell","quantity":200,"isSold":false},{"index":1,"skip":true},{"index":2,"skip":false,"item":"divine","price":0.20,"operation":"buy","quantity":100,"isSold":false}]

RESPOND ONLY WITH THE JSON ARRAY. No markdown, no explanation.`;

const BATCH_SIZE = 30;
const MAX_RETRIES = 3;
const CONCURRENCY = 10;

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function isCnl(authorId: string, content: string, cnlAuthorIds: Set<string>): boolean {
  if (cnlAuthorIds.has(authorId)) return true;
  return /cnlgaming/i.test(content) && /BRL/i.test(content);
}

function preFilter(msg: DiscordMessage): boolean {
  if (msg.author.isBot) return false;
  if (msg.content.length < 10) return false;
  const c = msg.content.toLowerCase();
  // Must have some currency or price reference
  if (!/divine|div\b|mirror|chaos|exalted|currency|r\$|\breais\b|brl/i.test(c)) return false;
  return true;
}

async function parseBatch(messages: { index: number; content: string }[]): Promise<LlmExtracted[]> {
  const client = getClient();

  const batchText = messages
    .map((m) => `[${m.index}] "${m.content.replace(/[\n\r]+/g, " ").substring(0, 300)}"`)
    .join("\n");

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: batchText }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0,
          maxOutputTokens: 2048,
        },
      });

      const text = response.text?.trim() || "[]";
      // Clean markdown if present
      const cleaned = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
      const parsed: LlmExtracted[] = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        console.log(`    Retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  return [];
}

export async function parseExport(
  data: DiscordExport,
  cnlAuthorIds: Set<string>,
  leagueOverride?: string,
): Promise<ParseResult> {
  const entries: ParsedPrice[] = [];
  const errors: string[] = [];
  let skipped = 0;

  // Pre-filter messages
  const candidates = data.messages.filter((m) => preFilter(m));
  skipped += data.messages.length - candidates.length;

  console.log(`    Pre-filtered: ${candidates.length} candidates from ${data.messages.length} messages`);
  console.log(`    Processing with ${CONCURRENCY} concurrent batches of ${BATCH_SIZE}...`);

  // Build all batches upfront
  const allBatches: { startIdx: number; batch: typeof candidates }[] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    allBatches.push({ startIdx: i, batch: candidates.slice(i, i + BATCH_SIZE) });
  }

  // Process batches with concurrency limit
  let batchesDone = 0;

  async function processSingleBatch(batchInfo: typeof allBatches[0]) {
    const { startIdx, batch } = batchInfo;
    const batchInput = batch.map((m, idx) => ({ index: idx, content: m.content }));

    try {
      const results = await parseBatch(batchInput);

      const batchEntries: ParsedPrice[] = [];
      let batchSkipped = 0;

      for (const result of results) {
        if (result.skip || !result.price || !result.item) {
          batchSkipped++;
          continue;
        }

        const msg = batch[result.index];
        if (!msg) continue;

        batchEntries.push({
          discordMessageId: msg.id,
          discordChannelId: data.channel.id,
          discordServerId: data.guild.id,
          authorDiscordId: msg.author.id,
          authorName: msg.author.nickname || msg.author.name,
          isCnl: isCnl(msg.author.id, msg.content, cnlAuthorIds),
          price: result.price,
          currency: "brl",
          item: result.item,
          rawMessage: msg.content,
          messageTimestamp: msg.timestamp,
          league: leagueOverride || null,
          operation: result.operation || "sell",
          quantity: result.quantity ?? null,
          isSold: result.isSold ?? false,
        });
      }

      return { entries: batchEntries, skipped: batchSkipped, error: null };
    } catch (err) {
      const errMsg = `Batch ${startIdx}: ${err instanceof Error ? err.message : String(err)}`;
      return { entries: [] as ParsedPrice[], skipped: batch.length, error: errMsg };
    }
  }

  // Run with concurrency pool
  for (let i = 0; i < allBatches.length; i += CONCURRENCY) {
    const chunk = allBatches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(processSingleBatch));

    for (const r of results) {
      entries.push(...r.entries);
      skipped += r.skipped;
      if (r.error) {
        errors.push(r.error);
        console.error(`    ERROR: ${r.error}`);
      }
    }

    batchesDone += chunk.length;
    const msgsProcessed = Math.min(batchesDone * BATCH_SIZE, candidates.length);
    console.log(`    Progress: ${msgsProcessed}/${candidates.length} (${entries.length} extracted)`);
  }

  return { entries, skipped, errors };
}

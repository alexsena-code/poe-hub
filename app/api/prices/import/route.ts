import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as path from "path";
import * as fs from "fs";

// DiscordChatExporter full-history exports can be large; a single operator
// uploading from disk is fine up to this ceiling.
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const EXPORTS_DIR = path.resolve(process.cwd(), "exports");

interface DiscordExportShape {
  guild?: { id?: string; name?: string };
  channel?: { id?: string; name?: string };
  messages?: unknown[];
}

/**
 * POST /api/prices/import
 *
 * Accepts a multipart/form-data body with a single `file` field containing a
 * DiscordChatExporter JSON export. Validates the shape and writes it to
 * exports/<channel.id>.json so the scraper's --from-cache mode can parse and
 * ingest it without touching Discord (see scripts/discord-price-scraper).
 *
 * Returns: { channelId, channelName, serverName, messages, savedAs }
 * Errors: 401 | 400 (parse / shape) | 413 (too large) | 500
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json(
      { error: `Arquivo grande demais — máximo ${MAX_BYTES / 1024 / 1024}MB` },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Falha ao ler o corpo multipart" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Campo `file` ausente ou inválido no form data" },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Arquivo grande demais — máximo ${MAX_BYTES / 1024 / 1024}MB` },
      { status: 413 },
    );
  }

  const text = Buffer.from(arrayBuffer).toString("utf-8");

  let parsed: DiscordExportShape;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `JSON inválido: ${detail}` }, { status: 400 });
  }

  const channelId = parsed.channel?.id;
  if (!channelId || !parsed.guild?.id || !Array.isArray(parsed.messages)) {
    return NextResponse.json(
      {
        error:
          "JSON não parece um export do DiscordChatExporter " +
          "(esperado { guild.id, channel.id, messages[] })",
      },
      { status: 400 },
    );
  }

  try {
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    } else {
      // Drop stale exports (e.g. leftovers from a Discord scrape) so the
      // subsequent --from-cache run parses only this uploaded file and doesn't
      // waste LLM calls re-processing old channels.
      for (const stale of fs.readdirSync(EXPORTS_DIR)) {
        if (stale.endsWith(".json")) fs.unlinkSync(path.join(EXPORTS_DIR, stale));
      }
    }
    const savedAs = path.join(EXPORTS_DIR, `${channelId}.json`);
    fs.writeFileSync(savedAs, text, "utf-8");

    return NextResponse.json(
      {
        channelId,
        channelName: parsed.channel?.name ?? channelId,
        serverName: parsed.guild?.name ?? "",
        messages: parsed.messages.length,
        savedAs: `exports/${channelId}.json`,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[prices.import] falha ao salvar export do canal ${channelId}: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

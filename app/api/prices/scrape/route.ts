import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const full = body.full === true;

  // Clear cached exports so the scraper does a fresh Discord export
  const exportsDir = path.resolve(process.cwd(), "exports");
  if (fs.existsSync(exportsDir)) {
    for (const file of fs.readdirSync(exportsDir)) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(exportsDir, file));
      }
    }
  }

  const scriptPath = path.resolve(process.cwd(), "scripts/discord-price-scraper/index.ts");
  const args = ["tsx", scriptPath, ...(full ? ["--full"] : [])];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("log", "Limpando cache de exports antigos...");

      const child = spawn("npx", args, {
        env: { ...process.env },
        shell: true,
        timeout: 1800000,
      });

      child.stdout.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter((l: string) => l.trim());
        for (const line of lines) {
          send("log", line);
        }
      });

      child.stderr.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter((l: string) => l.trim());
        for (const line of lines) {
          send("error", line);
        }
      });

      child.on("close", (code) => {
        send("done", code === 0 ? "success" : `failed (exit code ${code})`);
        controller.close();
      });

      child.on("error", (err) => {
        send("error", `Failed to start scraper: ${err.message}`);
        send("done", "failed");
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

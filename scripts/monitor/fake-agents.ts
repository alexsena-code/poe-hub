/**
 * Fake agent simulator — sends real DPB logs to the monitor WS server.
 * Simulates multiple bots from multiple PCs.
 *
 * Usage: npx tsx scripts/monitor/fake-agents.ts [--server ws://localhost:8766/ws/agent]
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import WebSocket from "ws";

const LOGS_DIR = "C:\\Users\\alexa\\Documents\\poebot\\poebot\\DreamPoeBot\\Logs";
const SERVER_URL = process.argv.includes("--server")
  ? process.argv[process.argv.indexOf("--server") + 1]
  : "ws://localhost:8766/ws/agent";

// Simulate 3 PCs with different bots
const FAKE_PCS = [
  { pcName: "PC-FARM-01", configs: ["GrandMother", "SisterNova", "LuizBot"] },
  { pcName: "PC-FARM-02", configs: ["TankBoy", "SpeedRunner", "MageKing"] },
  { pcName: "PC-FARM-03", configs: ["Shadow01", "Archer02", "Necro03", "Golem04", "Fire05", "Ice06"] },
];

// Load real log files
function loadLogFiles(): string[][] {
  const files = readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .slice(-12); // last 12 files

  return files.map((f) => {
    const content = readFileSync(join(LOGS_DIR, f), "utf-8");
    return content.split("\n").filter((line) => line.trim().length > 0);
  });
}

function generateInstanceId(pcName: string, configName: string): string {
  return createHash("sha256").update(`${pcName}${configName}`).digest("hex").slice(0, 12);
}

interface FakeBot {
  instanceId: string;
  pcName: string;
  configName: string;
  lines: string[];
  lineIndex: number;
  ws: WebSocket | null;
}

async function simulateBot(bot: FakeBot): Promise<void> {
  return new Promise((resolve) => {
    const ws = new WebSocket(SERVER_URL);
    bot.ws = ws;

    ws.on("open", () => {
      console.log(`[${bot.pcName}/${bot.configName}] Connected`);

      // Register (snake_case like Python agent)
      ws.send(JSON.stringify({
        type: "register",
        instance_id: bot.instanceId,
        pc_name: bot.pcName,
        config_name: bot.configName,
        data: {
          version: "0.3.28.15",
          character: bot.configName,
          log_file: `DreamPoeBot ${bot.configName}.txt`,
        },
      }));

      // Send logs in batches
      let batchNum = 0;
      const sendBatch = () => {
        if (bot.lineIndex >= bot.lines.length) {
          // Loop back to start
          bot.lineIndex = 0;
          batchNum = 0;
        }

        const batch = bot.lines.slice(bot.lineIndex, bot.lineIndex + 20);
        bot.lineIndex += 20;
        batchNum++;

        if (batch.length > 0) {
          ws.send(JSON.stringify({
            type: "logs",
            instance_id: bot.instanceId,
            config_name: bot.configName,
            pc_name: bot.pcName,
            data: { logs: batch },
          }));
        }

        // Send next batch after random delay (0.5-3s)
        const delay = 500 + Math.random() * 2500;
        setTimeout(sendBatch, delay);
      };

      // Start sending after short delay
      setTimeout(sendBatch, 1000 + Math.random() * 2000);

      // Heartbeat every 30s
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "heartbeat",
            instance_id: bot.instanceId,
          }));
        }
      }, 30000);
    });

    ws.on("error", (err) => {
      console.error(`[${bot.pcName}/${bot.configName}] Error:`, err.message);
    });

    ws.on("close", () => {
      console.log(`[${bot.pcName}/${bot.configName}] Disconnected`);
      resolve();
    });
  });
}

async function main() {
  console.log(`Loading logs from: ${LOGS_DIR}`);
  console.log(`Server: ${SERVER_URL}`);

  const logFiles = loadLogFiles();
  console.log(`Loaded ${logFiles.length} log files`);

  if (logFiles.length === 0) {
    console.error("No log files found!");
    process.exit(1);
  }

  const bots: FakeBot[] = [];
  let fileIndex = 0;

  for (const pc of FAKE_PCS) {
    for (const config of pc.configs) {
      const lines = logFiles[fileIndex % logFiles.length];
      fileIndex++;

      bots.push({
        instanceId: generateInstanceId(pc.pcName, config),
        pcName: pc.pcName,
        configName: config,
        lines,
        lineIndex: 0,
        ws: null,
      });
    }
  }

  console.log(`\nSimulating ${bots.length} bots across ${FAKE_PCS.length} PCs:`);
  for (const pc of FAKE_PCS) {
    console.log(`  ${pc.pcName}: ${pc.configs.join(", ")}`);
  }
  console.log();

  // Connect all bots with slight delay between each
  for (const bot of bots) {
    simulateBot(bot);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("All bots connected! Press Ctrl+C to stop.\n");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nDisconnecting all bots...");
    for (const bot of bots) {
      if (bot.ws && bot.ws.readyState === WebSocket.OPEN) {
        bot.ws.send(JSON.stringify({
          type: "disconnect",
          instance_id: bot.instanceId,
        }));
        bot.ws.close();
      }
    }
    setTimeout(() => process.exit(0), 1000);
  });
}

main().catch(console.error);

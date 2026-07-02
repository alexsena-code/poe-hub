/**
 * DreamPoeBot Monitor — WebSocket Server
 *
 * Standalone process — run with: npx tsx scripts/monitor/ws-server.ts
 *
 * Accepts two endpoint paths:
 *   /ws/agent     — bot agents on farm PCs
 *   /ws/dashboard — dashboard clients (browser / Next.js page)
 */

import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma.js";
import {
  alertEngine,
  parseLine,
  extractCharacterName,
  extractLeague,
  extractArea,
  extractVersion,
  isHideoutArea,
} from "./alert-engine.js";
import { notifyDiscord } from "./discord-notifier.js";
import { handleExecutorConnection } from "./cx-executor-handler.js";
import type {
  InstanceInfo,
  LogEntry,
  BotAlert,
  MonitorState,
  DashboardStats,
  AgentMessage,
  DashboardCommand,
  DashboardMessage,
} from "./types.js";

// ============================================================
// Configuration
// ============================================================

const PORT = Number(process.env.MONITOR_WS_PORT ?? 8766);

/** Maximum log entries kept per instance (circular buffer) */
const LOG_BUFFER_SIZE = 300;

/** Maximum alerts kept in memory */
const ALERTS_MAX = 200;

/** Mark instance offline after this many ms without logs */
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

/** Alert if in hideout for longer than this */
const HIDEOUT_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

/** Background checker interval */
const CHECKER_INTERVAL_MS = 30_000; // 30 s

/** Stats broadcast interval */
const STATS_INTERVAL_MS = 5_000; // 5 s

// ============================================================
// In-memory state
// ============================================================

const state: MonitorState = {
  instances: new Map(),
  logs: new Map(),
  alerts: [],
  agentConnections: new Map(),
  dashboardConnections: new Set(),
};

// ============================================================
// WebSocket Server bootstrap
// ============================================================

const wss = new WebSocketServer({ port: PORT });

console.log(`[Monitor] WebSocket server listening on ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = req.url ?? "";

  if (url.startsWith("/ws/agent")) {
    handleAgentConnection(ws);
  } else if (url.startsWith("/ws/executor")) {
    handleExecutorConnection(ws);
  } else if (url.startsWith("/ws/dashboard")) {
    handleDashboardConnection(ws);
  } else {
    console.warn(`[Monitor] Unknown path: ${url} — closing connection`);
    ws.close(4000, "Unknown path");
  }
});

wss.on("error", (err) => {
  console.error("[Monitor] Server error:", err);
});

// ============================================================
// Agent connection handler
// ============================================================

function handleAgentConnection(ws: WebSocket): void {
  let instanceId: string | null = null;

  ws.on("message", async (raw) => {
    let msg: AgentMessage;
    try {
      const parsed = JSON.parse(raw.toString());
      // Normalize snake_case → camelCase (Python agent sends snake_case)
      msg = {
        ...parsed,
        instanceId: parsed.instanceId ?? parsed.instance_id,
        pcName: parsed.pcName ?? parsed.pc_name,
        configName: parsed.configName ?? parsed.config_name,
      } as AgentMessage;
    } catch {
      console.warn("[Agent] Received invalid JSON — ignoring");
      return;
    }

    instanceId = msg.instanceId;

    try {
      switch (msg.type) {
        case "register":
          await handleAgentRegister(ws, msg);
          break;
        case "logs":
          await handleAgentLogs(msg);
          break;
        case "heartbeat":
          handleHeartbeat(msg.instanceId);
          break;
        case "disconnect":
          await handleAgentDisconnect(msg.instanceId, true);
          break;
        default:
          console.warn(`[Agent] Unknown message type: ${(msg as { type: string }).type}`);
      }
    } catch (err) {
      console.error(`[Agent] Error handling message type "${msg.type}":`, err);
    }
  });

  ws.on("close", async () => {
    if (instanceId) {
      await handleAgentDisconnect(instanceId, false);
    }
  });

  ws.on("error", (err) => {
    console.error("[Agent WS] Error:", err.message);
  });
}

// ============================================================
// Agent message handlers
// ============================================================

async function handleAgentRegister(
  ws: WebSocket,
  msg: Extract<AgentMessage, { type: "register" }>
): Promise<void> {
  const { instanceId, pcName, configName, data } = msg;

  // Evict duplicate — same pcName+configName with a different instanceId
  if (configName !== "unknown") {
    for (const [oldId, oldInst] of state.instances) {
      if (
        oldId !== instanceId &&
        oldInst.pcName === pcName &&
        oldInst.configName === configName
      ) {
        state.instances.delete(oldId);
        state.logs.delete(oldId);
        state.agentConnections.delete(oldId);
        alertEngine.clearInstanceState(oldId);
        await broadcastToDashboards({
          type: "instance_removed",
          data: { instanceId: oldId },
        });
        console.log(`[~] Evicted duplicate instance: ${oldId} → ${instanceId}`);
      }
    }
  }

  const now = new Date().toISOString();

  if (state.instances.has(instanceId)) {
    // Reconnect: update existing instance
    const inst = state.instances.get(instanceId)!;
    inst.isOnline = true;
    inst.status = "running";
    inst.lastSeen = now;
    inst.connectedAt = now;
    if (data.version) inst.botVersion = data.version;
    if (data.character) inst.characterName = data.character;
    if (data.league) inst.league = data.league;
    if (data.botId) inst.botId = data.botId;
    if (configName !== "unknown") inst.configName = configName;
    console.log(`[+] Reconnected: ${configName} (${pcName})`);
  } else {
    // New instance
    const inst: InstanceInfo = {
      id: instanceId,
      pcName,
      configName,
      characterName: data.character ?? null,
      league: data.league ?? null,
      currentArea: null,
      botVersion: data.version ?? "unknown",
      isOnline: true,
      lastSeen: now,
      connectedAt: now,
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      botId: data.botId ?? null,
      status: "initializing",
      hideoutSince: null,
    };
    state.instances.set(instanceId, inst);
    state.logs.set(instanceId, []);
    console.log(`[+] Registered: ${configName} (${pcName})`);
  }

  state.agentConnections.set(instanceId, ws);

  // Persist to DB (upsert by pcName+configName)
  await upsertBotInstance(instanceId);

  await broadcastToDashboards({
    type: "instance_connected",
    data: state.instances.get(instanceId)!,
  });
}

async function handleAgentLogs(
  msg: Extract<AgentMessage, { type: "logs" }>
): Promise<void> {
  const { instanceId, data } = msg;
  const inst = state.instances.get(instanceId);
  if (!inst) return;

  const logBuffer = state.logs.get(instanceId) ?? [];
  const newEntries: LogEntry[] = [];
  const newAlerts: BotAlert[] = [];

  for (const raw of data.logs) {
    const parsed = parseLine(raw);
    if (!parsed) continue;

    inst.totalLogs++;
    inst.lastSeen = new Date().toISOString();

    if (parsed.level === "ERROR" || parsed.level === "FATAL") {
      inst.errorCount++;
      inst.status = "error";
    } else if (parsed.level === "WARN") {
      inst.warnCount++;
    } else if (inst.status !== "error") {
      inst.status = "running";
    }

    // Extract metadata from log content
    const charName = extractCharacterName(parsed.message);
    if (charName) inst.characterName = charName;

    const league = extractLeague(parsed.message);
    if (league) inst.league = league;

    const area = extractArea(parsed.message);
    if (area) {
      inst.currentArea = area;

      if (isHideoutArea(area)) {
        // Record when we first entered hideout
        if (!inst.hideoutSince) {
          inst.hideoutSince = new Date().toISOString();
        }
      } else {
        // Left hideout
        inst.hideoutSince = null;
      }
    }

    const version = extractVersion(parsed.message);
    if (version) inst.botVersion = version;

    const entry: LogEntry = {
      timestamp: parsed.timestamp.toISOString(),
      level: parsed.level,
      source: parsed.source,
      message: parsed.message,
      raw,
      instanceId,
    };

    // Circular buffer — drop oldest entries when over limit
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE) {
      logBuffer.splice(0, logBuffer.length - LOG_BUFFER_SIZE);
    }

    newEntries.push(entry);

    // Run alert checks
    const alerts = alertEngine.checkForAlerts(instanceId, entry);
    newAlerts.push(...alerts);
  }

  state.logs.set(instanceId, logBuffer);

  // Broadcast the latest batch to dashboards (capped at 50 per payload)
  if (newEntries.length > 0) {
    await broadcastToDashboards({
      type: "logs",
      data: {
        instanceId,
        entries: newEntries.slice(-50),
      },
    });
    await broadcastToDashboards({
      type: "instance_update",
      data: inst,
    });
  }

  // Process alerts
  for (const alert of newAlerts) {
    await emitAlert(alert);
  }

  // Periodically persist stats to DB (every 50 log entries to limit write pressure)
  if (inst.totalLogs % 50 === 0) {
    await upsertBotInstance(instanceId).catch(() => {
      // Non-critical — don't crash on DB write failure
    });
  }
}

function handleHeartbeat(instanceId: string): void {
  const inst = state.instances.get(instanceId);
  if (inst) {
    inst.lastSeen = new Date().toISOString();
    inst.isOnline = true;
  }
}

async function handleAgentDisconnect(
  instanceId: string,
  graceful: boolean
): Promise<void> {
  const inst = state.instances.get(instanceId);
  if (inst) {
    inst.isOnline = false;
    inst.status = "offline";

    console.log(
      `[-] Disconnected: ${inst.configName} (${inst.pcName}) graceful=${graceful}`
    );

    if (!graceful) {
      const crashAlert = alertEngine.buildCrashAlert(
        instanceId,
        inst.configName,
        inst.pcName
      );
      await emitAlert(crashAlert);
    }

    await broadcastToDashboards({
      type: "instance_disconnected",
      data: { instanceId },
    });

    // Persist offline status
    await upsertBotInstance(instanceId).catch(() => {});
  }

  state.agentConnections.delete(instanceId);
}

// ============================================================
// Dashboard connection handler
// ============================================================

function handleDashboardConnection(ws: WebSocket): void {
  state.dashboardConnections.add(ws);
  console.log(
    `[Dashboard] Client connected (total: ${state.dashboardConnections.size})`
  );

  // Send initial state snapshot
  sendInitialState(ws);

  ws.on("message", (raw) => {
    let cmd: DashboardCommand;
    try {
      cmd = JSON.parse(raw.toString()) as DashboardCommand;
    } catch {
      return;
    }
    handleDashboardCommand(ws, cmd);
  });

  ws.on("close", () => {
    state.dashboardConnections.delete(ws);
    console.log(
      `[Dashboard] Client disconnected (remaining: ${state.dashboardConnections.size})`
    );
  });

  ws.on("error", (err) => {
    console.error("[Dashboard WS] Error:", err.message);
    state.dashboardConnections.delete(ws);
  });
}

function sendInitialState(ws: WebSocket): void {
  safeSend(ws, {
    type: "instances",
    data: { instances: Array.from(state.instances.values()) },
  });

  safeSend(ws, {
    type: "stats",
    data: buildStats(),
  });

  const unacked = state.alerts.filter((a) => !a.acknowledged).slice(-20);
  safeSend(ws, {
    type: "alerts",
    data: { alerts: unacked },
  });
}

function handleDashboardCommand(ws: WebSocket, cmd: DashboardCommand): void {
  switch (cmd.type) {
    case "get_logs": {
      const limit = cmd.limit ?? 100;
      const buffer = state.logs.get(cmd.instanceId);
      if (buffer) {
        safeSend(ws, {
          type: "logs",
          data: {
            instanceId: cmd.instanceId,
            entries: buffer.slice(-limit),
          },
        });
      }
      break;
    }

    case "acknowledge_alert": {
      const alert = state.alerts.find((a) => a.id === cmd.alertId);
      if (alert) {
        alert.acknowledged = true;
        // Also update in DB
        prisma.botAlert
          .update({
            where: { id: cmd.alertId },
            data: { acknowledged: true, acknowledgedAt: new Date() },
          })
          .catch(() => {});
      }
      break;
    }

    case "get_stats": {
      safeSend(ws, { type: "stats", data: buildStats() });
      break;
    }

    default:
      console.warn(
        `[Dashboard] Unknown command type: ${(cmd as { type: string }).type}`
      );
  }
}

// ============================================================
// Alert emission — memory + DB + Discord
// ============================================================

async function emitAlert(alert: BotAlert): Promise<void> {
  // Append to in-memory buffer (capped)
  state.alerts.push(alert);
  if (state.alerts.length > ALERTS_MAX) {
    state.alerts.splice(0, state.alerts.length - ALERTS_MAX);
  }

  // Broadcast to dashboards
  await broadcastToDashboards({ type: "alert", data: alert });

  // Persist to PostgreSQL
  await saveAlertToDB(alert);

  // Discord notification (fire-and-forget)
  notifyDiscord(alert).catch(() => {});
}

// ============================================================
// Background tasks
// ============================================================

/** Detects inactivity and hideout overstays */
function startInactivityChecker(): void {
  setInterval(async () => {
    const now = Date.now();

    for (const [instanceId, inst] of state.instances) {
      if (!inst.isOnline) continue;

      const lastSeenMs = new Date(inst.lastSeen).getTime();

      // Inactivity check
      if (now - lastSeenMs > INACTIVITY_THRESHOLD_MS) {
        const alert = alertEngine.buildInactivityAlert(instanceId, inst.configName);
        if (alert) await emitAlert(alert);

        // Mark offline
        inst.isOnline = false;
        inst.status = "offline";
        await broadcastToDashboards({
          type: "instance_disconnected",
          data: { instanceId },
        });
        await upsertBotInstance(instanceId).catch(() => {});
      }

      // Hideout check
      if (inst.hideoutSince) {
        const hideoutMs = now - new Date(inst.hideoutSince).getTime();
        if (hideoutMs > HIDEOUT_THRESHOLD_MS) {
          const minutes = Math.floor(hideoutMs / 60_000);
          const alert = alertEngine.buildHideoutAlert(
            instanceId,
            inst.configName,
            minutes
          );
          if (alert) await emitAlert(alert);
        }
      }
    }
  }, CHECKER_INTERVAL_MS);
}

/** Broadcasts summary stats to all dashboard clients */
function startStatsBroadcaster(): void {
  setInterval(async () => {
    await broadcastToDashboards({ type: "stats", data: buildStats() });
  }, STATS_INTERVAL_MS);
}

// ============================================================
// Utility helpers
// ============================================================

function buildStats(): DashboardStats {
  const instances = Array.from(state.instances.values());
  return {
    totalInstances: instances.length,
    onlineInstances: instances.filter((i) => i.isOnline).length,
    errorInstances: instances.filter((i) => i.status === "error").length,
    unacknowledgedAlerts: state.alerts.filter((a) => !a.acknowledged).length,
  };
}

async function broadcastToDashboards(msg: DashboardMessage): Promise<void> {
  const dead: WebSocket[] = [];
  const json = JSON.stringify(msg);

  for (const ws of state.dashboardConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json, (err) => {
        if (err) dead.push(ws);
      });
    } else {
      dead.push(ws);
    }
  }

  for (const ws of dead) {
    state.dashboardConnections.delete(ws);
  }
}

function safeSend(ws: WebSocket, msg: DashboardMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ============================================================
// Database helpers
// ============================================================

/**
 * Upsert the BotInstance row identified by (pcName, configName).
 * Stores the ephemeral instanceId in the DB row as well so the
 * dashboard can correlate in-memory state with persisted records.
 */
async function upsertBotInstance(instanceId: string): Promise<void> {
  const inst = state.instances.get(instanceId);
  if (!inst) return;

  try {
    const record = await prisma.botInstance.upsert({
      where: {
        pcName_configName: {
          pcName: inst.pcName,
          configName: inst.configName,
        },
      },
      update: {
        characterName: inst.characterName,
        league: inst.league,
        currentArea: inst.currentArea,
        botVersion: inst.botVersion,
        isOnline: inst.isOnline,
        lastSeen: inst.lastSeen ? new Date(inst.lastSeen) : null,
        connectedAt: inst.connectedAt ? new Date(inst.connectedAt) : null,
        totalLogs: inst.totalLogs,
        errorCount: inst.errorCount,
        warnCount: inst.warnCount,
        botId: inst.botId,
      },
      create: {
        pcName: inst.pcName,
        configName: inst.configName,
        characterName: inst.characterName,
        league: inst.league,
        currentArea: inst.currentArea,
        botVersion: inst.botVersion,
        isOnline: inst.isOnline,
        lastSeen: inst.lastSeen ? new Date(inst.lastSeen) : null,
        connectedAt: inst.connectedAt ? new Date(inst.connectedAt) : null,
        totalLogs: inst.totalLogs,
        errorCount: inst.errorCount,
        warnCount: inst.warnCount,
        botId: inst.botId,
      },
    });

    // Store the DB row id back on the in-memory instance
    inst.dbId = record.id;
  } catch (err) {
    console.error(`[DB] upsertBotInstance failed for ${inst.configName}:`, err);
  }
}

/**
 * Map monitor AlertType → Prisma BotAlertType enum value.
 * "crash" maps to "error" since the schema uses BotAlertType.
 */
function mapAlertType(type: string): string {
  const map: Record<string, string> = {
    error: "error",
    loop: "loop",
    persistent_loop: "loop",
    inactivity: "inactivity",
    hideout: "hideout",
    keyword: "keyword",
    crash: "error",
    stuck: "stuck",
  };
  return map[type] ?? "error";
}

function mapAlertSeverity(sev: string): string {
  const allowed = ["low", "medium", "high", "critical"];
  return allowed.includes(sev) ? sev : "medium";
}

async function saveAlertToDB(alert: BotAlert): Promise<void> {
  // Resolve the DB instance id — prefer the one stored on the in-memory struct
  const inst = state.instances.get(alert.instanceId);
  if (!inst?.dbId) {
    // Instance may not have been persisted yet — silently skip
    return;
  }

  try {
    const dbRecord = await prisma.botAlert.create({
      data: {
        id: alert.id,
        instanceId: inst.dbId,
        type: mapAlertType(alert.type) as Parameters<
          typeof prisma.botAlert.create
        >[0]["data"]["type"],
        severity: mapAlertSeverity(alert.severity) as Parameters<
          typeof prisma.botAlert.create
        >[0]["data"]["severity"],
        title: alert.title.slice(0, 255),
        message: alert.message.slice(0, 1000),
        details: alert.details ? JSON.stringify(alert.details) : null,
        acknowledged: false,
      },
    });

    // Keep the in-memory id in sync with whatever Prisma returned
    alert.id = dbRecord.id;
  } catch (err) {
    console.error(`[DB] saveAlertToDB failed for instance ${inst.configName}:`, err);
  }
}

// ============================================================
// Bootstrap
// ============================================================

startInactivityChecker();
startStatsBroadcaster();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Monitor] Shutting down...");

  // Mark all online instances as offline
  for (const [instanceId, inst] of state.instances) {
    if (inst.isOnline) {
      inst.isOnline = false;
      inst.status = "offline";
      await upsertBotInstance(instanceId).catch(() => {});
    }
  }

  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

/**
 * DreamPoeBot Monitor — Alert Detection Engine
 *
 * TypeScript port of log_parser.py.
 * Pure functions (parseLine) plus stateful class (AlertEngine) for loop/cooldown tracking.
 */

import { randomUUID } from "crypto";
import type {
  ParsedLog,
  LogLevel,
  LogEntry,
  BotAlert,
  AlertType,
  AlertSeverity,
  AlertEngineInstanceState,
  LoopEntry,
} from "./types.js";

// ============================================================
// Configuration constants (mirrors config.py)
// ============================================================

const ALERT_INACTIVITY_SECONDS = 300; // 5 min
const ALERT_LOOP_THRESHOLD = 10; // same pattern N times…
const ALERT_LOOP_WINDOW_SECONDS = 30; // …within this many seconds
const ALERT_PERSISTENT_LOOP_THRESHOLD = 50;
const ALERT_PERSISTENT_LOOP_WINDOW_SECONDS = 300; // 5 min
const ALERT_COOLDOWN_SECONDS = 60;

/** Fast-loop patterns: 10 hits in 30 s → alert */
export const LOOP_PATTERNS: string[] = [
  "[StuckDetection] Small range stuck count",
  "[StuckDetection] Large range stuck count",
  "[StuckDetection] Stuck detected",
  "[Vendor] Failed to sell",
  "[Vendor] Unable to sell",
  "[Vendor] Retrying sell",
  "[NPC] Failed to",
  "[NPC] Retrying",
  "area hash is 0; aborting",
  "Not in game yet",
];

/** Persistent-loop patterns: 50 hits in 5 min → alert */
export const PERSISTENT_LOOP_PATTERNS: string[] = [
  "[WalkablePosition] Fail to find any walkable position",
  "ExilePather.FindPath failed",
  "[MoveTowards] Fail to move towards",
];

/** Log lines containing any of these are silently dropped */
export const IGNORE_PATTERNS: string[] = [
  "[SqPluginLoader]",
  "DEBUG Logger - [RateLimit]",
  "[SqCanUse] Ignoring costs",
  "Waiting for",
  "[WalkablePosition] Walkable position for",
];

/**
 * ERROR-level lines containing any of these are NOT forwarded as alerts
 * (known false positives from DreamPoeBot).
 */
export const IGNORE_ERROR_PATTERNS: string[] = [
  "Target object is null",
  "Ignoring costs",
  "object reference not set",
  "[SqCanUse]",
  "NullReferenceException",
  "ObjectDisposedException",
  "SocketException",
];

/** Any word from this list in the message body triggers a CRITICAL keyword alert */
export const CRITICAL_KEYWORDS: string[] = [
  "crash",
  "banned",
  "kicked",
  "login failed",
  "disconnected",
  "fatal",
  "character died",
  "instance crashed",
];

// ============================================================
// Log line regex
// Format: 2026-03-17 15:03:43,183 [1] INFO  Logger - Message here
// ============================================================

const LOG_PATTERN =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+\[(\d+)\]\s+(DEBUG|INFO|WARN|ERROR|FATAL)\s+(\S+)\s+-\s+(.*)$/;

const CHARACTER_PATTERN =
  /(?:Selecting character: '([^']+)'|Setting character name to: (\S+))/;
const LEAGUE_PATTERN = /\[Start\] League: (\w+)/;
const AREA_PATTERN = /(?:\[Events\] Area changed \([^)]*\s*->\s*([^:]+):|CurrentArea:\s*([^\s,]+))/i;
const ENTERING_AREA_PATTERN = /Entering area[: ]+(.+)/i;
const VERSION_PATTERN = /DreamPoeBot Version: ([\d.]+)/;

// ============================================================
// parseLine — pure function, no side effects
// ============================================================

/**
 * Parse a single raw log line into a structured object.
 * Returns null for blank lines, ignored patterns, or malformed lines.
 */
export function parseLine(raw: string): ParsedLog | null {
  const line = raw.trim();
  if (!line) return null;

  // Drop known spam patterns before attempting regex (fast-path)
  for (const pattern of IGNORE_PATTERNS) {
    if (line.includes(pattern)) return null;
  }

  const match = LOG_PATTERN.exec(line);
  if (!match) return null;

  const [, timestampStr, , levelStr, source, message] = match;

  // Parse timestamp: "2026-03-17 15:03:43,183" → replace comma with dot for ms
  const normalized = timestampStr.replace(",", ".");
  const timestamp = new Date(normalized);
  if (isNaN(timestamp.getTime())) return null;

  return {
    timestamp,
    level: levelStr as LogLevel,
    source,
    message,
  };
}

// ============================================================
// Extraction helpers
// ============================================================

export function extractCharacterName(message: string): string | null {
  const m = CHARACTER_PATTERN.exec(message);
  if (!m) return null;
  return m[1] ?? m[2] ?? null;
}

export function extractLeague(message: string): string | null {
  const m = LEAGUE_PATTERN.exec(message);
  return m ? m[1] : null;
}

/**
 * Extract current area from a log message.
 * Handles "[Events] Area changed" and "Entering area" formats.
 */
export function extractArea(message: string): string | null {
  const m1 = AREA_PATTERN.exec(message);
  if (m1) return (m1[1] ?? m1[2] ?? "").trim() || null;

  const m2 = ENTERING_AREA_PATTERN.exec(message);
  if (m2) return m2[1].trim() || null;

  return null;
}

export function extractVersion(message: string): string | null {
  const m = VERSION_PATTERN.exec(message);
  return m ? m[1] : null;
}

export function isHideoutArea(area: string | null): boolean {
  if (!area) return false;
  return area.toLowerCase().includes("hideout");
}

// ============================================================
// AlertEngine — stateful, one instance shared by ws-server
// ============================================================

export class AlertEngine {
  private instanceStates = new Map<string, AlertEngineInstanceState>();

  private getOrCreateState(instanceId: string): AlertEngineInstanceState {
    let s = this.instanceStates.get(instanceId);
    if (!s) {
      s = {
        recentMessages: [],
        persistentMessages: [],
        lastAlerts: new Map(),
      };
      this.instanceStates.set(instanceId, s);
    }
    return s;
  }

  /**
   * Main entry point called for each parsed log entry.
   * Returns zero or more alerts to emit.
   */
  checkForAlerts(instanceId: string, entry: LogEntry): BotAlert[] {
    const alerts: BotAlert[] = [];
    const state = this.getOrCreateState(instanceId);

    // 1. ERROR level (excluding known false positives)
    if (entry.level === "ERROR" || entry.level === "FATAL") {
      const isFalsePositive = IGNORE_ERROR_PATTERNS.some((p) =>
        entry.message.toLowerCase().includes(p.toLowerCase())
      );
      if (!isFalsePositive) {
        const alert = this.buildAlert({
          instanceId,
          type: "error",
          severity: "high",
          title: `Error in ${entry.source}`,
          message: entry.message.slice(0, 200),
          details: {
            source: entry.source,
            fullMessage: entry.message,
            timestamp: entry.timestamp,
          },
        });
        if (this.shouldSend(state, alert)) alerts.push(alert);
      }
    }

    // 2. Critical keyword scan
    const kwAlert = this.checkKeyword(instanceId, entry, state);
    if (kwAlert) alerts.push(kwAlert);

    // 3. Fast loop detection (10x in 30s)
    const loopAlert = this.checkFastLoop(instanceId, entry, state);
    if (loopAlert) alerts.push(loopAlert);

    // 4. Persistent loop detection (50x in 5min)
    const persistentAlert = this.checkPersistentLoop(instanceId, entry, state);
    if (persistentAlert) alerts.push(persistentAlert);

    return alerts;
  }

  /**
   * Called by the inactivity background checker, not by log processing.
   */
  buildInactivityAlert(instanceId: string, configName: string): BotAlert | null {
    const state = this.getOrCreateState(instanceId);
    const alert = this.buildAlert({
      instanceId,
      type: "inactivity",
      severity: "medium",
      title: `Inactivity: ${configName}`,
      message: `No logs received for ${ALERT_INACTIVITY_SECONDS / 60} minutes.`,
      details: { configName },
    });
    // Use a longer cooldown for inactivity (match inactivity window)
    if (this.shouldSend(state, alert, ALERT_INACTIVITY_SECONDS)) return alert;
    return null;
  }

  /**
   * Called by the hideout background checker.
   */
  buildHideoutAlert(
    instanceId: string,
    configName: string,
    minutesInHideout: number
  ): BotAlert | null {
    const state = this.getOrCreateState(instanceId);
    const alert = this.buildAlert({
      instanceId,
      type: "hideout",
      severity: "medium",
      title: `Stuck in Hideout: ${configName}`,
      message: `Instance has been in hideout for ${minutesInHideout} minutes.`,
      details: { configName, minutesInHideout },
    });
    // Cooldown matches inactivity window to avoid repeated hideout pings
    if (this.shouldSend(state, alert, ALERT_INACTIVITY_SECONDS)) return alert;
    return null;
  }

  /**
   * Build an alert for an unexpected agent disconnect.
   */
  buildCrashAlert(instanceId: string, configName: string, pcName: string): BotAlert {
    return this.buildAlert({
      instanceId,
      type: "crash",
      severity: "critical",
      title: `Instance disconnected: ${configName}`,
      message: `${configName} (${pcName}) lost connection unexpectedly.`,
      details: { pcName },
    });
  }

  /** Remove per-instance state when instance is evicted from memory */
  clearInstanceState(instanceId: string): void {
    this.instanceStates.delete(instanceId);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private checkKeyword(
    instanceId: string,
    entry: LogEntry,
    state: AlertEngineInstanceState
  ): BotAlert | null {
    const lower = entry.message.toLowerCase();
    for (const kw of CRITICAL_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        const alert = this.buildAlert({
          instanceId,
          type: "keyword",
          severity: "critical",
          title: `Critical keyword detected: "${kw}"`,
          message: entry.message.slice(0, 200),
          details: {
            keyword: kw,
            source: entry.source,
            fullMessage: entry.message,
          },
        });
        if (this.shouldSend(state, alert)) return alert;
      }
    }
    return null;
  }

  private checkFastLoop(
    instanceId: string,
    entry: LogEntry,
    state: AlertEngineInstanceState
  ): BotAlert | null {
    let matchedPattern: string | null = null;
    for (const p of LOOP_PATTERNS) {
      if (entry.message.includes(p)) {
        matchedPattern = p;
        break;
      }
    }
    if (!matchedPattern) return null;

    const nowMs = new Date(entry.timestamp).getTime();
    state.recentMessages.push({ ts: nowMs, pattern: matchedPattern });

    // Trim entries outside the window
    const windowStart = nowMs - ALERT_LOOP_WINDOW_SECONDS * 1000;
    state.recentMessages = state.recentMessages.filter((e) => e.ts >= windowStart);

    const count = state.recentMessages.filter(
      (e) => e.pattern === matchedPattern
    ).length;

    if (count >= ALERT_LOOP_THRESHOLD) {
      const alert = this.buildAlert({
        instanceId,
        type: "loop",
        severity: "high",
        title: `Loop detected (fast)`,
        message: `Action repeated ${count}x in ${ALERT_LOOP_WINDOW_SECONDS}s: ${matchedPattern}`,
        details: {
          pattern: matchedPattern,
          count,
          windowSeconds: ALERT_LOOP_WINDOW_SECONDS,
        },
      });
      if (this.shouldSend(state, alert)) return alert;
    }

    return null;
  }

  private checkPersistentLoop(
    instanceId: string,
    entry: LogEntry,
    state: AlertEngineInstanceState
  ): BotAlert | null {
    let matchedPattern: string | null = null;
    for (const p of PERSISTENT_LOOP_PATTERNS) {
      if (entry.message.includes(p)) {
        matchedPattern = p;
        break;
      }
    }
    if (!matchedPattern) return null;

    const nowMs = new Date(entry.timestamp).getTime();
    state.persistentMessages.push({ ts: nowMs, pattern: matchedPattern });

    // Trim old entries outside the 5-min window
    const windowStart = nowMs - ALERT_PERSISTENT_LOOP_WINDOW_SECONDS * 1000;
    state.persistentMessages = state.persistentMessages.filter(
      (e) => e.ts >= windowStart
    );

    const count = state.persistentMessages.filter(
      (e) => e.pattern === matchedPattern
    ).length;

    if (count >= ALERT_PERSISTENT_LOOP_THRESHOLD) {
      const minutes = Math.round(ALERT_PERSISTENT_LOOP_WINDOW_SECONDS / 60);
      const alert = this.buildAlert({
        instanceId,
        type: "persistent_loop",
        severity: "high",
        title: `Navigation loop detected`,
        message: `Repeated failure ${count}x in ${minutes} minutes: ${matchedPattern}`,
        details: {
          pattern: matchedPattern,
          count,
          windowMinutes: minutes,
        },
      });
      if (this.shouldSend(state, alert)) return alert;
    }

    return null;
  }

  private buildAlert(params: {
    instanceId: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    details?: Record<string, unknown>;
  }): BotAlert {
    return {
      id: randomUUID(),
      instanceId: params.instanceId,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      details: params.details ?? null,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Returns true and records the timestamp if the alert can be sent.
   * Prevents duplicate alerts of the same type for the same instance within the cooldown window.
   */
  private shouldSend(
    state: AlertEngineInstanceState,
    alert: BotAlert,
    cooldownSeconds = ALERT_COOLDOWN_SECONDS
  ): boolean {
    const key = `${alert.instanceId}:${alert.type}:${alert.title}`;
    const now = Date.now();
    const last = state.lastAlerts.get(key);

    if (last !== undefined && now - last < cooldownSeconds * 1000) {
      return false;
    }

    state.lastAlerts.set(key, now);
    return true;
  }
}

// Singleton exported for use in ws-server
export const alertEngine = new AlertEngine();

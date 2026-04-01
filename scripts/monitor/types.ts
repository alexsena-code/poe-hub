/**
 * DreamPoeBot Monitor — TypeScript type definitions
 */

// ============================================================
// Enums
// ============================================================

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export type AlertType =
  | "error"
  | "loop"
  | "persistent_loop"
  | "inactivity"
  | "hideout"
  | "keyword"
  | "crash";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

// ============================================================
// Core data models
// ============================================================

export interface InstanceInfo {
  /** Unique ephemeral ID sent by the agent on register */
  id: string;
  pcName: string;
  configName: string;
  characterName: string | null;
  league: string | null;
  currentArea: string | null;
  botVersion: string;
  isOnline: boolean;
  /** ISO string */
  lastSeen: string;
  /** ISO string */
  connectedAt: string;
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  /** FK to bots table — may be null when no mapping exists */
  botId: string | null;
  /** Internal status label */
  status: "initializing" | "running" | "idle" | "error" | "offline";
  /** DB row id — set after upsert */
  dbId?: string;
  /** Hideout entry timestamp (ISO) — used for hideout alert */
  hideoutSince: string | null;
}

export interface LogEntry {
  timestamp: string; // ISO
  level: LogLevel;
  source: string;
  message: string;
  raw: string;
  instanceId: string;
}

export interface ParsedLog {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

export interface BotAlert {
  id: string;
  instanceId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details: Record<string, unknown> | null;
  acknowledged: boolean;
  createdAt: string; // ISO
}

// ============================================================
// In-memory state shape
// ============================================================

export interface MonitorState {
  instances: Map<string, InstanceInfo>;
  /** Circular buffer — capped at LOG_BUFFER_SIZE per instance */
  logs: Map<string, LogEntry[]>;
  /** Recent alerts — capped at ALERTS_MAX */
  alerts: BotAlert[];
  agentConnections: Map<string, import("ws").WebSocket>;
  dashboardConnections: Set<import("ws").WebSocket>;
}

export interface DashboardStats {
  totalInstances: number;
  onlineInstances: number;
  errorInstances: number;
  unacknowledgedAlerts: number;
}

// ============================================================
// WebSocket message types — Agent → Server
// ============================================================

export interface AgentRegisterMessage {
  type: "register";
  instanceId: string;
  pcName: string;
  configName: string;
  data: {
    version?: string;
    character?: string;
    league?: string;
    logFile?: string;
    pid?: number;
    botId?: string;
  };
}

export interface AgentLogsMessage {
  type: "logs";
  instanceId: string;
  pcName: string;
  configName: string;
  data: {
    logs: string[];
  };
}

export interface AgentHeartbeatMessage {
  type: "heartbeat";
  instanceId: string;
  pcName: string;
  configName: string;
  data?: Record<string, unknown>;
}

export interface AgentDisconnectMessage {
  type: "disconnect";
  instanceId: string;
  pcName: string;
  configName: string;
  data?: Record<string, unknown>;
}

export type AgentMessage =
  | AgentRegisterMessage
  | AgentLogsMessage
  | AgentHeartbeatMessage
  | AgentDisconnectMessage;

// ============================================================
// WebSocket message types — Server → Dashboard
// ============================================================

export interface DashboardInstancesMessage {
  type: "instances";
  data: { instances: InstanceInfo[] };
}

export interface DashboardStatsMessage {
  type: "stats";
  data: DashboardStats;
}

export interface DashboardAlertsMessage {
  type: "alerts";
  data: { alerts: BotAlert[] };
}

export interface DashboardLogsMessage {
  type: "logs";
  data: { instanceId: string; entries: LogEntry[] };
}

export interface DashboardAlertMessage {
  type: "alert";
  data: BotAlert;
}

export interface DashboardInstanceConnectedMessage {
  type: "instance_connected";
  data: InstanceInfo;
}

export interface DashboardInstanceUpdateMessage {
  type: "instance_update";
  data: InstanceInfo;
}

export interface DashboardInstanceDisconnectedMessage {
  type: "instance_disconnected";
  data: { instanceId: string };
}

export interface DashboardInstanceRemovedMessage {
  type: "instance_removed";
  data: { instanceId: string };
}

export type DashboardMessage =
  | DashboardInstancesMessage
  | DashboardStatsMessage
  | DashboardAlertsMessage
  | DashboardLogsMessage
  | DashboardAlertMessage
  | DashboardInstanceConnectedMessage
  | DashboardInstanceUpdateMessage
  | DashboardInstanceDisconnectedMessage
  | DashboardInstanceRemovedMessage;

// ============================================================
// WebSocket message types — Dashboard → Server (commands)
// ============================================================

export interface DashboardGetLogsCommand {
  type: "get_logs";
  instanceId: string;
  limit?: number;
}

export interface DashboardAcknowledgeAlertCommand {
  type: "acknowledge_alert";
  alertId: string;
}

export interface DashboardGetStatsCommand {
  type: "get_stats";
}

export type DashboardCommand =
  | DashboardGetLogsCommand
  | DashboardAcknowledgeAlertCommand
  | DashboardGetStatsCommand;

// ============================================================
// Alert engine internal state
// ============================================================

export interface LoopEntry {
  ts: number; // epoch ms
  pattern: string;
}

export interface AlertEngineInstanceState {
  /** recent_messages for fast loop detection */
  recentMessages: LoopEntry[];
  /** recent_messages for persistent loop detection */
  persistentMessages: LoopEntry[];
  /** alert_type:title -> last sent epoch ms */
  lastAlerts: Map<string, number>;
}

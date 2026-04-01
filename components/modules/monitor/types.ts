export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface BotAlert {
  id: string;
  instanceId: string;
  instanceName: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface InstanceInfo {
  id: string;
  configName: string;
  characterName: string | null;
  currentArea: string | null;
  pc: string;
  online: boolean;
  uptime: number | null;
  errors: number;
  warns: number;
  hasRecentAlert: boolean;
  logs: LogEntry[];
}

export type WsMessage =
  | { type: "instances"; data: InstanceInfo[] }
  | { type: "logs"; instanceId: string; logs: LogEntry[] }
  | { type: "alert"; alert: BotAlert }
  | { type: "status"; instanceId: string; data: Partial<InstanceInfo> }
  | { type: "stats"; data: { online: number; total: number; alertsToday: number } };

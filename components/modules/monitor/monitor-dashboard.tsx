"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MonitorStats } from "./monitor-stats";
import { PcGroup } from "./pc-group";
import { LogViewer } from "./log-viewer";
import { AlertPanel } from "./alert-panel";
import type {
  BotAlert,
  InstanceInfo,
  LogEntry,
  WsMessage,
} from "./types";

// Set NEXT_PUBLIC_MONITOR_WS_URL in .env for ngrok/remote access
// e.g. NEXT_PUBLIC_MONITOR_WS_URL=wss://xyz.ngrok-free.app/ws/dashboard
const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL
  || (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8766/ws/dashboard`
    : "ws://localhost:8766/ws/dashboard");
const MAX_LOGS_PER_INSTANCE = 300;

function groupByPc(instances: InstanceInfo[]): Record<string, InstanceInfo[]> {
  return instances.reduce<Record<string, InstanceInfo[]>>((acc, inst) => {
    if (!acc[inst.pc]) acc[inst.pc] = [];
    acc[inst.pc].push(inst);
    return acc;
  }, {});
}

export function MonitorDashboard() {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [alerts, setAlerts] = useState<BotAlert[]>([]);
  const [stats, setStats] = useState({ online: 0, total: 0, alertsToday: 0 });
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"logs" | "alerts">("logs");
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive stats from instances when WebSocket doesn't push explicit stats
  useEffect(() => {
    const online = instances.filter((i) => i.online).length;
    setStats((prev) => ({ ...prev, online, total: instances.length }));
  }, [instances]);

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        toast.success("Monitor conectado");
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Reconnect after 5 seconds
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data) as WsMessage;
        } catch {
          return;
        }

        switch (msg.type) {
          case "instances": {
            // msg.data can be: array, { instances: [] }, or other shapes
            const raw = msg.data;
            const arr = Array.isArray(raw)
              ? raw
              : Array.isArray((raw as Record<string, unknown>)?.instances)
              ? (raw as { instances: unknown[] }).instances
              : Object.values(raw ?? {}).flat();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: InstanceInfo[] = arr.map((r: any) => ({
              id: r.id,
              configName: r.configName,
              characterName: r.characterName ?? null,
              currentArea: r.currentArea ?? null,
              pc: r.pcName ?? r.pc ?? "",
              online: r.isOnline ?? r.online ?? false,
              uptime: r.connectedAt ? Date.now() - new Date(r.connectedAt).getTime() : null,
              errors: r.errorCount ?? r.errors ?? 0,
              warns: r.warnCount ?? r.warns ?? 0,
              hasRecentAlert: false,
              logs: [],
            }));
            setInstances(mapped);
            setLogs((prev) => {
              const next = { ...prev };
              for (const inst of mapped) {
                if (!next[inst.id]) next[inst.id] = [];
              }
              return next;
            });
            break;
          }

          case "logs": {
            // Server sends logs as msg.logs or msg.data.logs
            const newLogs: LogEntry[] = msg.logs
              ?? (msg as unknown as { data?: { logs?: LogEntry[] } }).data?.logs
              ?? [];
            if (newLogs.length > 0) {
              setLogs((prev) => {
                const existing = prev[msg.instanceId] ?? [];
                const merged = [...existing, ...newLogs].slice(-MAX_LOGS_PER_INSTANCE);
                return { ...prev, [msg.instanceId]: merged };
              });
            }
            break;
          }

          case "alert": {
            // Server may send alert as msg.alert or msg.data
            const alert = msg.alert ?? (msg as unknown as { data?: BotAlert }).data;
            if (alert && alert.message) {
              setAlerts((prev) => [alert, ...prev].slice(0, 100));
              setStats((prev) => ({
                ...prev,
                alertsToday: prev.alertsToday + 1,
              }));
              toast.warning(`Alerta: ${alert.message}`, {
                description: alert.instanceName ?? alert.instanceId,
              });
            }
            break;
          }

          case "status": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const upd = msg.data as any;
            setInstances((prev) =>
              prev.map((inst) => {
                if (inst.id !== msg.instanceId) return inst;
                return {
                  ...inst,
                  configName: upd.configName ?? inst.configName,
                  characterName: upd.characterName ?? inst.characterName,
                  currentArea: upd.currentArea ?? inst.currentArea,
                  pc: upd.pcName ?? upd.pc ?? inst.pc,
                  online: upd.isOnline ?? upd.online ?? inst.online,
                  errors: upd.errorCount ?? upd.errors ?? inst.errors,
                  warns: upd.warnCount ?? upd.warns ?? inst.warns,
                };
              })
            );
            break;
          }

          case "stats": {
            // Server may send different field names — normalize
            const s = msg.data as Record<string, number>;
            setStats({
              online: s.online ?? s.onlineInstances ?? 0,
              total: s.total ?? s.totalInstances ?? 0,
              alertsToday: s.alertsToday ?? s.unacknowledgedAlerts ?? 0,
            });
            break;
          }
        }
      };
    } catch {
      // WebSocket construction can throw in non-browser environments
    }
  }, []);

  // Initial REST fetch for instances and alerts
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [instRes, alertRes] = await Promise.all([
          fetch("/api/monitor/instances"),
          fetch("/api/monitor/alerts?limit=20&acknowledged=false"),
        ]);

        if (instRes.ok) {
          const json = await instRes.json();
          // API returns { data: [{ pcName, instances[] }] } — flatten to array
          const groups = json.data ?? json;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawList: any[] = Array.isArray(groups)
            ? groups.flatMap((g: { instances?: unknown[] }) => g.instances ?? [g])
            : [];
          const flat: InstanceInfo[] = rawList.map((r) => ({
            id: r.id,
            configName: r.configName,
            characterName: r.characterName ?? null,
            currentArea: r.currentArea ?? null,
            pc: r.pcName ?? r.pc ?? "",
            online: r.isOnline ?? r.online ?? false,
            uptime: r.connectedAt ? Date.now() - new Date(r.connectedAt).getTime() : null,
            errors: r.errorCount ?? r.errors ?? 0,
            warns: r.warnCount ?? r.warns ?? 0,
            hasRecentAlert: false,
            logs: [],
          }));
          setInstances(flat);
          setLogs(
            flat.reduce<Record<string, LogEntry[]>>((acc, inst) => {
              acc[inst.id] = [];
              return acc;
            }, {})
          );
        }

        if (alertRes.ok) {
          const json = await alertRes.json();
          const alertData = json.data ?? json;
          setAlerts(Array.isArray(alertData) ? alertData : []);
        }
      } catch {
        // Silently ignore — WS will provide live data
      }
    }

    void fetchInitialData();
    connectWs();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;

  const selectedLogs = selectedInstanceId ? (logs[selectedInstanceId] ?? []) : [];

  const pcGroups = groupByPc(instances);

  async function handleAcknowledge(alertId: string) {
    try {
      const res = await fetch(`/api/monitor/alerts/${alertId}/acknowledge`, {
        method: "POST",
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
        );
      }
    } catch {
      toast.error("Erro ao confirmar alerta");
    }
  }

  async function handleAcknowledgeAll() {
    try {
      const res = await fetch("/api/monitor/alerts/acknowledge-all", {
        method: "POST",
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
      }
    } catch {
      toast.error("Erro ao confirmar alertas");
    }
  }

  const unacknowledgedCount = alerts.filter((a) => a && !a.acknowledged).length;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Monitor</h1>
        <Badge
          variant="outline"
          className={
            wsConnected
              ? "border-green-500/50 bg-green-500/10 text-green-500"
              : "border-red-500/50 bg-red-500/10 text-red-500"
          }
        >
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-red-500"}`}
          />
          {wsConnected ? "Conectado" : "Desconectado"}
        </Badge>
      </div>

      {/* Stats bar */}
      <MonitorStats
        online={stats.online}
        total={stats.total}
        alertsToday={stats.alertsToday}
      />

      {/* Main content: left panel + right panel */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0 flex-col md:flex-row">
        {/* Left panel: PC groups */}
        <div className="w-full md:w-72 shrink-0">
          <ScrollArea className="h-64 md:h-full rounded-lg border border-border bg-card p-3">
            {instances.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aguardando instancias...
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(pcGroups).map(([pc, pcInstances]) => (
                  <PcGroup
                    key={pc}
                    pcName={pc}
                    instances={pcInstances}
                    selectedInstanceId={selectedInstanceId}
                    onSelectInstance={(id) => {
                      setSelectedInstanceId(id);
                      setRightPanel("logs");
                    }}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel: Logs / Alerts tabs */}
        <div className="flex-1 min-w-0 min-h-0">
          <Tabs
            value={rightPanel}
            onValueChange={(v) => setRightPanel(v as "logs" | "alerts")}
            className="flex h-full flex-col"
          >
            <TabsList className="shrink-0 w-full justify-start">
              <TabsTrigger value="logs" className="gap-2">
                Logs
                {selectedInstance && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {selectedInstance.configName}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                Alertas
                {unacknowledgedCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0"
                  >
                    {unacknowledgedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="flex-1 min-h-0 mt-2">
              <LogViewer
                instanceName={selectedInstance?.configName ?? null}
                logs={selectedLogs}
              />
            </TabsContent>

            <TabsContent value="alerts" className="flex-1 min-h-0 mt-2">
              <AlertPanel
                alerts={alerts}
                onAcknowledge={handleAcknowledge}
                onAcknowledgeAll={handleAcknowledgeAll}
                onSelectInstance={(instanceId) => {
                  setSelectedInstanceId(instanceId);
                  setRightPanel("logs");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Session 21 Track B — four operational routes (/logs, /llm-logs,
// /analytics, /monitor) collapsed into this single admin dashboard.
// Tabs are lazy-loaded so the heavy recharts/WebSocket code only hits
// the bundle when the operator actually visits each pane.

const LogsTab = dynamic(() => import("@/components/admin/observability/logs-tab"), {
  loading: () => <TabLoading />,
});
const LlmLogsTab = dynamic(() => import("@/components/admin/observability/llm-logs-tab"), {
  loading: () => <TabLoading />,
});
const AnalyticsTab = dynamic(() => import("@/components/admin/observability/analytics-tab"), {
  loading: () => <TabLoading />,
});
const MonitorTab = dynamic(() => import("@/components/admin/observability/monitor-tab"), {
  loading: () => <TabLoading />,
});

type TabId = "logs" | "llm" | "analytics" | "monitor";

function TabLoading() {
  return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
}

export default function ObservabilityPage() {
  const [tab, setTab] = useState<TabId>("logs");

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Observability</h1>
        <p className="text-sm text-muted-foreground">
          Logs, LLM custos, analytics e monitor em tempo real
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="llm">LLM</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="llm"><LlmLogsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="monitor"><MonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}

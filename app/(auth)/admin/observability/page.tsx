import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";

// Session 21 Track B — four operational routes (/logs, /llm-logs,
// /analytics, /monitor) collapsed into this single admin dashboard.
// Tabs are lazy-loaded so the heavy recharts/WebSocket code only hits
// the bundle when the operator actually visits each pane.
//
// Session 04 S04.a — converted to RSC. Radix Tabs manages active-tab
// state internally via defaultValue; no useState needed here.

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

function TabLoading() {
  return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
}

export default function ObservabilityPage() {
  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <PageHeader
        title="Observability"
        description="Logs, LLM custos, analytics e monitor em tempo real"
        className="mb-6"
      />

      <Tabs defaultValue="logs">
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

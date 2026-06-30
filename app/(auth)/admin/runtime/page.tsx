import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";

// Session 23 — runtime control center: funde /admin/operations + /admin/
// observability numa página só, e adiciona o tab "Saúde" (frescor por fonte de
// coleta). Tabs lazy-loaded — recharts/WebSocket/SWR só entram no bundle quando
// o operador abre cada pane (Radix desmonta tabs inativos por padrão).

const HealthTab = dynamic(() => import("@/components/admin/runtime/health-tab"), {
  loading: () => <TabLoading />,
});
const OperationsTab = dynamic(() => import("@/components/admin/runtime/operations-tab"), {
  loading: () => <TabLoading />,
});
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

export default function RuntimePage() {
  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <PageHeader
        title="Runtime"
        description="Saúde das fontes, operações, logs, custos LLM, analytics e monitor"
        accent="var(--color-admin)"
        className="mb-6"
      />

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Saúde</TabsTrigger>
          <TabsTrigger value="operations">Operações</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="llm">LLM</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="health"><HealthTab /></TabsContent>
        <TabsContent value="operations"><OperationsTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="llm"><LlmLogsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="monitor"><MonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}

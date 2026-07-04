import { PageHeader } from "@/components/ui/page-header";
import { ExecutorsPanel } from "@/components/modules/cx/executors-panel";
import { JobsPanel } from "@/components/modules/cx/jobs-panel";
import { ParamsPanel } from "@/components/modules/cx/params-panel";

// Fundação do gerenciamento do bot de currency exchange (fase 1):
// executores online, fila de comandos e parâmetros. Telas ricas vêm depois.
export default function CxManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="CX Bot" />
      <ExecutorsPanel />
      <JobsPanel />
      <ParamsPanel />
    </div>
  );
}

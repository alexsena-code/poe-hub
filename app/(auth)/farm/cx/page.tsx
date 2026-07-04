import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { ExecutorsPanel } from "@/components/modules/cx/executors-panel";
import { JobsPanel } from "@/components/modules/cx/jobs-panel";
import { ParamsPanel } from "@/components/modules/cx/params-panel";

// Fundação do gerenciamento do bot de currency exchange (fase 1):
// executores online, fila de comandos e parâmetros. Telas ricas vêm depois.
export default function CxManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CX Bot"
        actions={
          <Link href="/farm/cx/stats">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Stats
            </Button>
          </Link>
        }
      />
      <ExecutorsPanel />
      <JobsPanel />
      <ParamsPanel />
    </div>
  );
}

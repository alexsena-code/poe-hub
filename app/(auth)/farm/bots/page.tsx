import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BotsTable } from "@/components/modules/bots/bots-table";
import { PageHeader } from "@/components/ui/page-header";

export default function BotsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Bots"
        actions={
          <Link href="/farm/bots/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Bot
            </Button>
          </Link>
        }
      />
      <BotsTable />
    </div>
  );
}

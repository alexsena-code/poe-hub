import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";
import { FillsTable } from "@/components/modules/fills/fills-table";
import { PageHeader } from "@/components/ui/page-header";

export default function FillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange"
        actions={
          <div className="flex gap-2">
            <Link href="/farm/fills/reports">
              <Button variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
            <Link href="/farm/fills/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Order
              </Button>
            </Link>
          </div>
        }
      />
      <FillsTable />
    </div>
  );
}

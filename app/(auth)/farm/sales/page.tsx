import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SalesTable } from "@/components/modules/sales/sales-table";
import { PageHeader } from "@/components/ui/page-header";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        actions={
          <Link href="/farm/sales/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </Link>
        }
      />
      <SalesTable />
    </div>
  );
}

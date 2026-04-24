import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SalesTable } from "@/components/modules/sales/sales-table";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vendas</h1>
        <Link href="/farm/sales/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>
      <SalesTable />
    </div>
  );
}

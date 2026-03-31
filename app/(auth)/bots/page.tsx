import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BotsTable } from "@/components/modules/bots/bots-table";

export default function BotsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Bots</h1>
        <Link href="/bots/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Bot
          </Button>
        </Link>
      </div>
      <BotsTable />
    </div>
  );
}

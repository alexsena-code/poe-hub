import Link from "next/link";
import { DiscordSourceManager } from "@/components/modules/prices/discord-source-manager";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PriceSourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/prices">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Discord Sources</h1>
          <p className="text-muted-foreground">
            Gerencie os canais do Discord monitorados para coleta de precos.
          </p>
        </div>
      </div>
      <DiscordSourceManager />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignalsTable } from "@/components/modules/signals/signals-table";
import { ArbTable } from "@/components/modules/signals/arb-table";
import { getSignals, getArb } from "@/lib/cx-signals";

export default async function SignalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [signals, arb] = await Promise.all([getSignals(), getArb()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sinais (Câmbio)"
        actions={<Badge variant="secondary">dados de exemplo (mock)</Badge>}
      />
      <p className="text-sm text-muted-foreground">
        Triagem do mercado com todos os indicadores (Tier 1 + fill-prob). É onde você decide QUAL order fazer —
        depois registra o resultado na aba Exchange.
      </p>

      <Tabs defaultValue="candidatos">
        <TabsList>
          <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
          <TabsTrigger value="arb">Arb (screening)</TabsTrigger>
        </TabsList>
        <TabsContent value="candidatos" className="mt-4">
          <SignalsTable signals={signals} />
        </TabsContent>
        <TabsContent value="arb" className="mt-4">
          <ArbTable rows={arb} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

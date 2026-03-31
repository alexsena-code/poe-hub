import { SimulationList } from "@/components/modules/simulations/simulation-list";
import { SimulationCreateDialog } from "@/components/modules/simulations/simulation-create-dialog";

export default function SimulationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulacoes de Faturamento</h1>
          <p className="text-muted-foreground">
            Projecoes de receita e lucro por liga/temporada.
          </p>
        </div>
        <SimulationCreateDialog />
      </div>
      <SimulationList />
    </div>
  );
}

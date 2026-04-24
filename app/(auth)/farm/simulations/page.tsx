import { SimulationList } from "@/components/modules/simulations/simulation-list";
import { SimulationCreateDialog } from "@/components/modules/simulations/simulation-create-dialog";
import { SimulationProjectionDialog } from "@/components/modules/simulations/simulation-projection-dialog";

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
        <div className="flex gap-2">
          <SimulationProjectionDialog />
          <SimulationCreateDialog />
        </div>
      </div>
      <SimulationList />
    </div>
  );
}

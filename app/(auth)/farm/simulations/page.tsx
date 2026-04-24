import { SimulationList } from "@/components/modules/simulations/simulation-list";
import { SimulationCreateDialog } from "@/components/modules/simulations/simulation-create-dialog";
import { SimulationProjectionDialog } from "@/components/modules/simulations/simulation-projection-dialog";
import { PageHeader } from "@/components/ui/page-header";

export default function SimulationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulacoes de Faturamento"
        description="Projecoes de receita e lucro por liga/temporada."
        actions={
          <>
            <SimulationProjectionDialog />
            <SimulationCreateDialog />
          </>
        }
      />
      <SimulationList />
    </div>
  );
}

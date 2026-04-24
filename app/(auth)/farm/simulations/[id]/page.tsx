import { SimulationEditor } from "@/components/modules/simulations/simulation-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SimulationDetailPage({ params }: Props) {
  const { id } = await params;

  return <SimulationEditor simulationId={id} />;
}

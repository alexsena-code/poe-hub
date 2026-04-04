import { SimulationComparison } from "@/components/modules/simulations/simulation-comparison";

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) || [];

  return (
    <div className="space-y-6">
      <SimulationComparison ids={ids} />
    </div>
  );
}

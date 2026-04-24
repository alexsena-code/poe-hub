// Server Component — no data to prefetch (no listing endpoint on engine).
// All interactivity is in BenchmarkClient.
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { BenchmarkClient } from "@/components/modules/admin/benchmark/benchmark-client";

export const metadata = {
  title: "Benchmark | PoE Hub",
};

export default function BenchmarkPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Benchmark"
        description="Dispara runs isolados de QA / Ideation / Content Generation com telemetry completa"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/benchmark/history">Ver Historico</Link>
          </Button>
        }
      />
      <BenchmarkClient />
    </div>
  );
}

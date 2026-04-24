// RSC shell — fetches annual plans server-side; create/delete + useRouter in client island.
// S05.a migration: was 237L 'use client'; now RSC + AnnualClient island.
import { fetchEngine } from "@/lib/fetch-engine";
import { AnnualClient, type AnnualPlan } from "@/components/modules/farm/simulations/annual-client";

interface PlansResponse {
  data: AnnualPlan[];
}

export default async function AnnualPlansIndexPage() {
  let initialPlans: AnnualPlan[] = [];
  try {
    const res = await fetchEngine<PlansResponse>("/api/annual-plans");
    initialPlans = res.data ?? [];
  } catch {
    // DB or auth issue — client island renders empty table, operator can refresh
  }

  return <AnnualClient initialPlans={initialPlans} />;
}

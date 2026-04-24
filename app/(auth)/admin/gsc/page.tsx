import { PageHeader } from "@/components/ui/page-header";
import { fetchEngine } from "@/lib/fetch-engine";
import { GscClient } from "@/components/modules/admin/gsc/gsc-client";
import type { GscStatus } from "@/components/modules/admin/gsc/gsc-client";

// RSC shell — fetches initial GSC status server-side so the page loads
// with data already present (avoids a loading flash on first visit).
// If the engine is unreachable, initialStatus is null and the client
// component renders a reload prompt instead.
export default async function GscAdminPage() {
  let initialStatus: GscStatus | null = null;
  try {
    initialStatus = await fetchEngine<GscStatus>("/api/engine/seo/gsc/status");
  } catch {
    // noop — client shows reload
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Google Search Console"
        description="Autenticacao, sync de keywords e health do refresh token"
      />
      <GscClient initialStatus={initialStatus} />
    </div>
  );
}

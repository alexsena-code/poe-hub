// RSC shell — no data fetching needed here; the client island owns the fetch
// because the competitor list is fully interactive (add / edit / remove).
// Compare: competitor-gaps/page.tsx (read-only) is a pure RSC; this page is
// CRUD, so the pattern is closer to manage-channels-tab lifted into its own route.

import { PageHeader } from '@/components/ui/page-header';
import { CompetitorsClient } from '@/components/modules/seo/competitors/competitors-client';

export const metadata = {
  title: 'Concorrentes — PoE Hub',
};

export default function CompetitorsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Concorrentes"
        description="Sites concorrentes monitorados pelo pipeline de gap analysis. Dados persistidos no engine DB (não mais no YAML)."
        accent="var(--color-seo, #10b981)"
      />

      <CompetitorsClient />
    </div>
  );
}

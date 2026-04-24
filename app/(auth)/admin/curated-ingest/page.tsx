'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { NewIngestTab } from '@/components/modules/admin/curated-ingest/new-ingest-tab';
import { DraftsListTab } from '@/components/modules/admin/curated-ingest/drafts-list-tab';
import {
  NON_TERMINAL_STATUSES,
  TERMINAL_STATUSES,
} from '@/components/modules/admin/curated-ingest/types';

/**
 * Curated-ingest admin flow (Session 21 Fase 3).
 *
 * Operator pastes raw text, picks one of the 5 curated Qdrant
 * collections, triggers LLM analysis, answers clarification questions,
 * and approves to ingest.
 *
 * Backend: /api/knowledge/curated-ingest/* via the engine proxy.
 */
export default function CuratedIngestPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Curated Ingest"
        description="Fluxo assistido para popular as 5 colecoes curadas do Qdrant (crafting, leveling, atlas, mechanics, trading) com texto revisado pelo operador."
      />

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">New Ingest</TabsTrigger>
          <TabsTrigger value="progress">Drafts in Progress</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <NewIngestTab />
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <DraftsListTab
            statuses={NON_TERMINAL_STATUSES}
            emptyLabel="No drafts in progress. Start a new ingest from the first tab."
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <DraftsListTab
            statuses={TERMINAL_STATUSES}
            readOnly
            emptyLabel="No approved or rejected drafts yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

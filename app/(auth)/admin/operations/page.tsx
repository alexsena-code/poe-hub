'use client';

// ---------------------------------------------------------------------------
// Operations control center — single page for triggering crawls + pipelines
// + maintenance tasks, with live status for the 3 endpoints that expose
// `statusEndpoint` (Reddit / Ninja / KeyBERT) and a Recent Runs table for
// everything that flows through `pipeline_runs`.
// ---------------------------------------------------------------------------

import { PageHeader } from '@/components/ui/page-header';
import { useOperations } from '@/components/modules/admin/operations/use-operations';
import { ActionCard } from '@/components/modules/admin/operations/action-card';
import { RecentRuns } from '@/components/modules/admin/operations/recent-runs';
import type { ActionCategory } from '@/components/modules/admin/operations/types';

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  crawl: 'Crawls',
  pipeline: 'Pipelines',
  maintenance: 'Maintenance',
};

export default function OperationsPage() {
  const { actions, getState, trigger, runs, runsLoading } = useOperations();

  const grouped = (Object.keys(CATEGORY_LABELS) as ActionCategory[]).map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: actions.filter((a) => a.category === cat),
  }));

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        <PageHeader
          title="Operations"
          description="Trigger crawls, pipelines, and maintenance jobs in one place."
          accent="var(--color-admin)"
          className="mb-4"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8">
        {grouped.map((group) => (
          <section key={group.category}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {group.label}
            </h2>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  state={getState(action.id)}
                  onRun={() => void trigger(action)}
                />
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Recent Pipeline Runs
          </h2>
          <RecentRuns runs={runs} loading={runsLoading} />
        </section>
      </div>
    </div>
  );
}

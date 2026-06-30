'use client';

// ---------------------------------------------------------------------------
// Operações — disparar crawls/pipelines/maintenance + Recent Runs. Extraído da
// antiga /admin/operations pra virar um tab da /admin/runtime unificada.
// ---------------------------------------------------------------------------

import { useOperations } from '@/components/modules/admin/operations/use-operations';
import { ActionCard } from '@/components/modules/admin/operations/action-card';
import { RecentRuns } from '@/components/modules/admin/operations/recent-runs';
import type { ActionCategory } from '@/components/modules/admin/operations/types';

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  crawl: 'Crawls',
  pipeline: 'Pipelines',
  maintenance: 'Maintenance',
};

export default function OperationsTab() {
  const { actions, getState, trigger, runs, runsLoading } = useOperations();

  const grouped = (Object.keys(CATEGORY_LABELS) as ActionCategory[]).map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: actions.filter((a) => a.category === cat),
  }));

  return (
    <div className="space-y-8">
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
  );
}

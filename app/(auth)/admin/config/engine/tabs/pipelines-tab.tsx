'use client';

// Fires SEO/content pipelines and streams their logs/progress.
// Dispatches to POST /api/engine/<endpoint> per pipeline config below;
// poll-mode pipelines then GET /api/engine/<statusEndpoint> for updates.
// Also renders /api/engine/seo/pipeline/costs?days=30 summary card.

import { PIPELINES } from '@/components/modules/admin/engine-config/pipelines/types';
import { PipelineCostsCard } from '@/components/modules/admin/engine-config/pipelines/pipeline-costs-card';
import { PipelineCard } from '@/components/modules/admin/engine-config/pipelines/pipeline-card';
import { usePipelinesRunner } from '@/components/modules/admin/engine-config/pipelines/use-pipelines-runner';

export default function PipelinesTab() {
  const { getState, getConfig, updateConfig, runPipeline, logEndRefs } = usePipelinesRunner();

  return (
    <div>
      <PipelineCostsCard />

      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Pipeline Runner</h2>
        <p className="text-xs text-muted-foreground">Dispare pipelines e acompanhe logs e performance em tempo real</p>
      </div>

      <div className="space-y-4">
        {PIPELINES.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            state={getState(pipeline.id)}
            cfg={getConfig(pipeline.id, pipeline)}
            logEndRef={(el) => { logEndRefs.current[pipeline.id] = el; }}
            onRun={() => runPipeline(pipeline)}
            onConfigChange={(key, value) => updateConfig(pipeline.id, key, value)}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

// Fetches and renders the /api/engine/seo/pipeline/costs?days=30 summary.
// Shown at the top of the Pipelines tab as an at-a-glance cost overview.

import { useEffect, useState } from 'react';
import { API, PipelineCosts } from './types';

export function PipelineCostsCard() {
  const [costs, setCosts] = useState<PipelineCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/seo/pipeline/costs?days=30`)
      .then(r => r.json())
      .then((data: PipelineCosts) => { setCosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground mb-4">Loading costs...</div>;
  if (!costs) return null;

  const avgCost = costs.total.calls > 0 ? costs.total.costUsd / costs.total.calls : 0;

  return (
    <div className="mb-6">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pipeline Costs (30d)</div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Cost</div>
          <div className="text-lg font-bold text-foreground">${costs.total.costUsd.toFixed(4)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Calls</div>
          <div className="text-lg font-bold text-foreground">{costs.total.calls}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Cost/Call</div>
          <div className="text-lg font-bold text-foreground">${avgCost.toFixed(5)}</div>
        </div>
      </div>
      {costs.byNode.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Node</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {costs.byNode.map(node => (
                <tr key={node.nodeName} className="border-b border-border/50">
                  <td className="px-3 py-1.5 text-foreground font-mono">{node.nodeName}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{node.calls}</td>
                  <td className="px-3 py-1.5 text-right text-foreground">${node.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

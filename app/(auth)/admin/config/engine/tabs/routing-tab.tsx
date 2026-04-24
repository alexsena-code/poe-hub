'use client';

// Edits query routing via PUT /api/engine/config/query-routing

import { useState } from 'react';

interface QueryRoute {
  description: string;
  layers: string[];
  chunk_limit: number;
  collections: string[];
  example: string;
}

const ALL_COLLECTIONS = [
  'poe_wiki', 'poe_builds', 'poe_patch_notes', 'poe_ggg_news',
  'poe_transcripts', 'poe_reddit', 'poe_meta', 'poe_youtube_trends',
];

const ALL_LAYERS = ['exact_data', 'chunks', 'summary', 'build_meta'];

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {saving ? 'Salvando...' : 'Salvar'}
    </button>
  );
}

export default function RoutingTab({
  routing, onChange, onSave, saving,
}: {
  routing: Record<string, QueryRoute>;
  onChange: (r: Record<string, QueryRoute>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateRoute = (key: string, patch: Partial<QueryRoute>) => {
    onChange({ ...routing, [key]: { ...routing[key], ...patch } });
  };

  const toggleCollection = (routeKey: string, col: string) => {
    const route = routing[routeKey];
    const cols = route.collections || [];
    const next = cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col];
    updateRoute(routeKey, { collections: next });
  };

  const toggleLayer = (routeKey: string, layer: string) => {
    const route = routing[routeKey];
    const layers = route.layers || [];
    const next = layers.includes(layer) ? layers.filter((l) => l !== layer) : [...layers, layer];
    updateRoute(routeKey, { layers: next });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Query Routing</h2>
          <p className="text-xs text-muted-foreground">Define quais layers e collections cada tipo de query usa</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-2">
        {Object.entries(routing).map(([key, route]) => (
          <div key={key} className="bg-surface border border-border rounded-lg">
            <button
              onClick={() => setExpanded(expanded === key ? null : key)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{route.description}</span>
              </div>
              <span className="text-muted-foreground text-xs">{expanded === key ? 'v' : '>'}</span>
            </button>

            {expanded === key && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Chunk limit</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={route.chunk_limit}
                    onChange={(e) => updateRoute(key, { chunk_limit: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Layers</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_LAYERS.map((layer) => (
                      <button
                        key={layer}
                        onClick={() => toggleLayer(key, layer)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          (route.layers || []).includes(layer)
                            ? 'bg-foreground/10 border-foreground/30 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {layer}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Collections</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COLLECTIONS.map((col) => (
                      <button
                        key={col}
                        onClick={() => toggleCollection(key, col)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          (route.collections || []).includes(col)
                            ? 'bg-foreground/10 border-foreground/30 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {col.replace('poe_', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Exemplo</label>
                  <input
                    value={route.example || ''}
                    onChange={(e) => updateRoute(key, { example: e.target.value })}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

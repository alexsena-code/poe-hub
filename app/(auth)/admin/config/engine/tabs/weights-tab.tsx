'use client';

// Edits collection weights via PUT /api/engine/config/collection-weights

const COLLECTION_LABELS: Record<string, string> = {
  poe_wiki: 'Wiki (verified data)',
  poe_builds: 'Builds (poe.ninja)',
  poe_patch_notes: 'Patch Notes (GGG)',
  poe_ggg_news: 'GGG News',
  poe_transcripts: 'YouTube Transcripts',
  poe_reddit: 'Reddit Posts',
  poe_meta: 'Summaries (auto)',
  poe_youtube_trends: 'YouTube Trends',
};

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

export default function WeightsTab({
  weights, onChange, onSave, saving,
}: {
  weights: Record<string, number>;
  onChange: (w: Record<string, number>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (key: string, val: number) => {
    onChange({ ...weights, [key]: Math.round(val * 100) / 100 });
  };

  const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collection Weights</h2>
          <p className="text-xs text-muted-foreground">Multiplicador aplicado ao score de similaridade do Qdrant. Wiki = baseline 1.0</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-3">
        {sorted.map(([key, value]) => (
          <div key={key} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{COLLECTION_LABELS[key] || ''}</span>
              </div>
              <span className="text-sm font-mono text-foreground">{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={value}
              onChange={(e) => update(key, parseFloat(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0.0 (ignorar)</span>
              <span>0.5</span>
              <span>1.0 (full trust)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

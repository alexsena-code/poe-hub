'use client';

// Edits token budget per layer via PUT /api/engine/config/token-budget

const BUDGET_LABELS: Record<string, string> = {
  exact_data_max: 'PostgreSQL (dados exatos)',
  chunks_max: 'Qdrant chunks (apos reranking)',
  summary_max: 'poe_meta summary',
  total_context_max: 'Total context (excl. system prompt)',
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

export default function BudgetTab({
  budget, onChange, onSave, saving,
}: {
  budget: Record<string, number>;
  onChange: (b: Record<string, number>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Token Budget</h2>
          <p className="text-xs text-muted-foreground">Limite de tokens por layer no context assembly</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-3">
        {Object.entries(budget).map(([key, value]) => (
          <div key={key} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{BUDGET_LABELS[key] || ''}</span>
              </div>
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                value={value}
                onChange={(e) => onChange({ ...budget, [key]: parseInt(e.target.value) || 0 })}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-foreground text-right font-mono"
              />
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-foreground/30 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (value / 1500) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { ContentBrief } from './types';
import { IDEAS_API } from './constants';
import { Textarea } from '@/components/ui/textarea';

interface BriefInputsPanelProps {
  brief: ContentBrief;
  onUpdate: (updated: ContentBrief) => void;
}

export function BriefInputsPanel({ brief, onUpdate }: BriefInputsPanelProps) {
  const isBuildGuide = brief.templateType === 'build_guide';
  const isCurrencyGuide = brief.templateType === 'currency_guide';

  const [pobUrl, setPobUrl] = useState(brief.pobUrl || '');
  const [farmInputs, setFarmInputs] = useState({
    scarabs: brief.templateInputs?.scarabs || '',
    otherItems: brief.templateInputs?.otherItems || '',
    cost: brief.templateInputs?.cost || '',
    expectedLoot: brief.templateInputs?.expectedLoot || '',
    divPerHour: brief.templateInputs?.divPerHour || '',
    atlasTreeUrl: brief.templateInputs?.atlasTreeUrl || '',
  });

  const [saving, setSaving] = useState(false);

  // Sync state if brief changes
  useEffect(() => {
    setPobUrl(brief.pobUrl || '');
    setFarmInputs({
      scarabs: brief.templateInputs?.scarabs || '',
      otherItems: brief.templateInputs?.otherItems || '',
      cost: brief.templateInputs?.cost || '',
      expectedLoot: brief.templateInputs?.expectedLoot || '',
      divPerHour: brief.templateInputs?.divPerHour || '',
      atlasTreeUrl: brief.templateInputs?.atlasTreeUrl || '',
    });
  }, [brief]);

  if (!isBuildGuide && !isCurrencyGuide) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {};
      if (isBuildGuide) payload.pobUrl = pobUrl;
      if (isCurrencyGuide) payload.templateInputs = farmInputs;

      const res = await fetch(`${IDEAS_API}/ideation/briefs/${brief.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
      } else {
        alert('Failed to save inputs');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {isBuildGuide ? 'Build Guide Inputs' : 'Farm Strategy Inputs'}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isBuildGuide && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Path of Building URL</label>
            <input
              type="text"
              value={pobUrl}
              onChange={(e) => setPobUrl(e.target.value)}
              placeholder="https://pobb.in/..."
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          </div>
        )}

        {isCurrencyGuide && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Scarabs (Max 5)</label>
              <input
                type="text"
                value={farmInputs.scarabs}
                onChange={(e) => setFarmInputs({ ...farmInputs, scarabs: e.target.value })}
                placeholder="Ex: Divination Scarab of Curation, Reliquary Scarab..."
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Outros Itens (Chisels, Maps, etc)</label>
              <input
                type="text"
                value={farmInputs.otherItems}
                onChange={(e) => setFarmInputs({ ...farmInputs, otherItems: e.target.value })}
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Custo Total (Chaos/Divine)</label>
                <input
                  type="text"
                  value={farmInputs.cost}
                  onChange={(e) => setFarmInputs({ ...farmInputs, cost: e.target.value })}
                  placeholder="Ex: 100c por mapa"
                  className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Divines por Hora</label>
                <input
                  type="number"
                  step="0.1"
                  value={farmInputs.divPerHour}
                  onChange={(e) => setFarmInputs({ ...farmInputs, divPerHour: e.target.value })}
                  placeholder="Ex: 12.5"
                  className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Expected Loot (Pequeno parágrafo)</label>
              <Textarea
                value={farmInputs.expectedLoot}
                onChange={(e) => setFarmInputs({ ...farmInputs, expectedLoot: e.target.value })}
                placeholder="Explique rapidamente o que dropa desse farm (Ex: Foco em cards e raw currency...)"
                rows={2}
                className="text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Atlas Tree URL</label>
              <input
                type="text"
                value={farmInputs.atlasTreeUrl}
                onChange={(e) => setFarmInputs({ ...farmInputs, atlasTreeUrl: e.target.value })}
                placeholder="https://poeplanner.com/..."
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Inputs'}
          </button>
        </div>
      </div>
    </div>
  );
}

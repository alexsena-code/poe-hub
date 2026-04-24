'use client';

// Generate controls panel: editorial briefing textarea, template picker,
// model select, and the Generate/Clear action buttons.
// Rendered in the header row when the filterStatus is not "generated".

import { Textarea } from '@/components/ui/textarea';
import { GENERATABLE_TEMPLATES, TEMPLATE_LABELS, MODEL_OPTIONS } from './constants';

interface GenerateControlsProps {
  generating: boolean;
  msg: string | null;
  briefs: { length: number };
  editorialBriefing: string;
  setEditorialBriefing: (v: string) => void;
  showBriefing: boolean;
  setShowBriefing: (v: boolean) => void;
  selectedTemplates: string[];
  toggleTemplate: (t: string) => void;
  setSelectedTemplates: (v: string[]) => void;
  showTemplates: boolean;
  setShowTemplates: (v: boolean) => void;
  selectedModel: number;
  setSelectedModel: (v: number) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export function GenerateControls({
  generating,
  msg,
  briefs,
  editorialBriefing,
  setEditorialBriefing,
  showBriefing,
  setShowBriefing,
  selectedTemplates,
  toggleTemplate,
  setSelectedTemplates,
  showTemplates,
  setShowTemplates,
  selectedModel,
  setSelectedModel,
  onGenerate,
  onClear,
}: GenerateControlsProps) {
  return (
    <>
      {/* Action buttons row */}
      <div className="flex items-center gap-3 ml-auto">
        {msg && <span className="text-xs text-emerald-400">{msg}</span>}
        <button
          onClick={() => setShowBriefing(!showBriefing)}
          className={`px-3 py-2 rounded-md text-xs transition-colors ${
            editorialBriefing
              ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
              : 'bg-zinc-800 text-zinc-400 hover:text-foreground'
          }`}
        >
          {editorialBriefing ? 'Briefing ✓' : '+ Briefing'}
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={`px-3 py-2 rounded-md text-xs transition-colors ${
            selectedTemplates.length > 0
              ? 'bg-sky-900/40 text-sky-300 border border-sky-700'
              : 'bg-zinc-800 text-zinc-400 hover:text-foreground'
          }`}
        >
          {selectedTemplates.length > 0 ? `Templates (${selectedTemplates.length})` : '+ Templates'}
        </button>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(Number(e.target.value))}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground"
        >
          {MODEL_OPTIONS.map((opt, i) => (
            <option key={i} value={i}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-md text-sm font-medium transition-colors"
        >
          {generating ? (msg?.startsWith('Generating...') ? msg : 'Generating...') : 'Generate Ideas'}
        </button>
        {briefs.length > 0 && (
          <button
            onClick={onClear}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md text-xs transition-colors"
          >
            Clear Pending
          </button>
        )}
      </div>

      {/* Editorial briefing panel */}
      {showBriefing && (
        <div className="bg-surface border border-border rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Editorial Briefing</label>
            <span className="text-[10px] text-muted-foreground">Diretrizes para a AI priorizar na geracao de ideias</span>
          </div>
          <Textarea
            value={editorialBriefing}
            onChange={(e) => setEditorialBriefing(e.target.value)}
            placeholder="Ex: Foco em conteudo de league start pra Mirage league. Priorizar guias de breach farming e builds populares no poe.ninja. Ignorar conteudo de crafting avancado por enquanto."
            rows={3}
            className="text-sm"
          />
        </div>
      )}

      {/* Template filter panel */}
      {showTemplates && (
        <div className="bg-surface border border-border rounded-lg p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Templates permitidos</label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {selectedTemplates.length === 0
                  ? 'Vazio = todos os templates disponíveis'
                  : `${selectedTemplates.length} selecionado(s)`}
              </span>
              {selectedTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTemplates([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {GENERATABLE_TEMPLATES.map((t) => {
              const active = selectedTemplates.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTemplate(t)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    active
                      ? 'bg-sky-900/40 text-sky-300 border-sky-700'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {TEMPLATE_LABELS[t] ?? t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

'use client';

// Generate controls panel: editorial briefing textarea, template picker,
// model select, and the Generate/Clear action buttons.
// Rendered in the header row when the filterStatus is not "generated".

import { useState } from 'react';
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
  onGenerateFromUrl: (url: string) => Promise<void>;
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
  onGenerateFromUrl,
}: GenerateControlsProps) {
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);

  async function handleUrlGenerate() {
    if (!urlInput.trim()) return;
    setGeneratingUrl(true);
    try {
      await onGenerateFromUrl(urlInput.trim());
      setShowUrlDialog(false);
      setUrlInput('');
    } finally {
      setGeneratingUrl(false);
    }
  }

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
        <div className="relative">
          <button
            onClick={() => setShowUrlDialog(!showUrlDialog)}
            className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/50 rounded-md text-xs font-medium transition-colors"
          >
            Gerar de URL
          </button>
          
          {showUrlDialog && (
            <div className="absolute right-0 top-full mt-2 w-80 p-3 bg-surface border border-border rounded-lg shadow-xl z-50">
              <label className="text-xs text-foreground mb-2 block">Cole a URL do concorrente</label>
              <input 
                type="text" 
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://maxroll.gg/..."
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground mb-2"
                onKeyDown={e => { if(e.key === 'Enter') handleUrlGenerate() }}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowUrlDialog(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUrlGenerate}
                  disabled={generatingUrl || !urlInput.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  {generatingUrl ? 'Gerando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
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

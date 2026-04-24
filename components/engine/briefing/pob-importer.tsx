'use client';

import { Input } from '@/components/ui/input';
import PobSummaryCard from '@/components/engine/PobSummaryCard';
import type { PobSummary } from '@/lib/engine-types';

interface PobImporterProps {
  pobUrl: string;
  onPobUrlChange: (url: string) => void;
  pobSummary: PobSummary | null;
  pobAnalyzing: boolean;
  pobError: string | null;
  onAnalyze: () => void;
  onDismiss: () => void;
}

// PoB import block — decoded server-side, will be injected in briefing.notes
// as "## BUILD SNAPSHOT" (and "## BUILD VARIANTS" if the file has multiple loadouts).
export function PobImporter({
  pobUrl,
  onPobUrlChange,
  pobSummary,
  pobAnalyzing,
  pobError,
  onAnalyze,
  onDismiss,
}: PobImporterProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-muted-foreground mb-1">
        PoB URL{' '}
        <span className="text-xs text-muted-foreground/70">
          (opcional — pobb.in / pastebin / código cru base64)
        </span>
      </label>
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://pobb.in/..."
          value={pobUrl}
          onChange={(e) => {
            onPobUrlChange(e.target.value);
          }}
          className="flex-1 font-mono text-sm"
        />
        <button
          type="button"
          onClick={onAnalyze}
          disabled={pobAnalyzing || !pobUrl.trim()}
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {pobAnalyzing ? 'Analisando…' : 'Analisar PoB'}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/80">
        Todos os items, passives, auras e loadouts alternativos do PoB entram no contexto do writer.
        Clique em <strong>Analisar PoB</strong> pra ver o que foi decodificado antes de gerar.
      </p>
      {pobError && (
        <div className="rounded-lg border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {pobError}
        </div>
      )}
      {pobSummary && <PobSummaryCard summary={pobSummary} onDismiss={onDismiss} />}
    </div>
  );
}

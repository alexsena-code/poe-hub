'use client';
/**
 * Assets (Currencies) right-rail widget.
 *
 * Migrated from side-panel-assets.tsx — same functionality, wrapped in WidgetShell.
 *
 * Polish applied: yellow hardcoded colours replaced with neutral design tokens
 * (bg-accent/40, border-accent/30, text-foreground) to match the project palette.
 *
 * Drag-to-insert and click-to-insert behaviour is preserved unchanged.
 * See side-panel-assets.tsx S08.f doc for the full drag MIME type contract.
 */

import React, { useState, useDeferredValue } from 'react';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { WidgetShell } from './widget-shell';
import { useEditorContext } from '../editor-context';
import { useCurrencyCatalog, filterCurrencies } from '../hooks/use-currency-catalog';
import { resolveCurrencyIcon } from '../hooks/resolve-currency-icon';

// ─── Currency chip ─────────────────────────────────────────────────────────────

interface CurrencyChipProps {
  name: string;
  onInsert: (name: string) => void;
}

function CurrencyChip({ name, onInsert }: CurrencyChipProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/poe-hub-currency', JSON.stringify({ name }));
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onInsert(name)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onInsert(name);
      }}
      title={`Inserir ${name}`}
      className={[
        'flex items-center gap-1.5 rounded-md border border-accent/30',
        'bg-accent/40 px-2 py-1 text-xs text-foreground cursor-grab active:cursor-grabbing',
        'hover:bg-accent/60 hover:border-accent/50 transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      ].join(' ')}
    >
      {/* ◈ placeholder glyph — replaced by real icon when available */}
      <span className="text-[10px] text-muted-foreground opacity-80 leading-none shrink-0">◈</span>
      <span className="truncate leading-none">{name}</span>
    </div>
  );
}

// ─── State helpers ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8 gap-2 text-xs text-zinc-500">
      <Spinner size="sm" />
      Carregando currencies…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-xs text-destructive text-center leading-relaxed">
      Falha ao carregar catálogo.
      <br />
      <span className="text-zinc-500">{message}</span>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-4 py-6 text-xs text-zinc-500 text-center">
      {filtered ? 'Nenhuma currency encontrada para esse filtro.' : 'Nenhuma currency disponível.'}
    </div>
  );
}

// ─── Currency list body ────────────────────────────────────────────────────────

interface CurrencyListBodyProps {
  onInsert: (name: string) => void;
}

function CurrencyListBody({ onInsert }: CurrencyListBodyProps) {
  const { currencies, isLoading, error } = useCurrencyCatalog();
  const [query, setQuery] = useState('');
  // Deferred value keeps the filter snappy — avoids blocking on every keystroke
  const deferredQuery = useDeferredValue(query);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;

  const visible = filterCurrencies(currencies, deferredQuery);

  return (
    <>
      <div className="px-4 pb-2">
        <Input
          placeholder="Filtrar currencies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="px-4 pb-1">
        <span className="text-[10px] text-zinc-500">
          {visible.length} de {currencies.length} disponíveis
        </span>
      </div>
      <ScrollArea className="h-[280px]">
        <div className="flex flex-col gap-1 px-4 pb-4">
          {visible.length === 0 ? (
            <EmptyState filtered={query.trim().length > 0} />
          ) : (
            visible.map((name) => (
              <CurrencyChip key={name} name={name} onInsert={onInsert} />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function AssetsWidget() {
  const { editor } = useEditorContext();

  async function insertCurrency(currencyName: string) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    // Resolve icon at insert time so chip matches the preview pane.
    // resolveCurrencyIcon is fail-soft — null means engine off, chip falls back to ◈.
    const iconUrl = await resolveCurrencyIcon(currencyName);
    editor.chain().focus().insertPoeCurrency({ currencyName, iconUrl: iconUrl ?? undefined }).run();
  }

  return (
    <WidgetShell id="assets" icon={Package} title="Assets — Currencies" contentClassName="overflow-hidden">
      <CurrencyListBody onInsert={insertCurrency} />
    </WidgetShell>
  );
}

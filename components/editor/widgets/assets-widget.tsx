'use client';
/**
 * Assets (Currencies) right-rail widget.
 *
 * Migrated from side-panel-assets.tsx — same functionality, wrapped in WidgetShell.
 * S13 refresh: switched from `useCurrencyCatalog` (names-only) to
 * `useItemsCatalog({kind:'currency'})` so chips can render the real icon,
 * matching the preview pane and the Items/Gems/Passives widget. Drag-to-insert
 * and click-to-insert behaviour preserved unchanged.
 *
 * See side-panel-assets.tsx S08.f doc for the full drag MIME type contract.
 */

import React, { useState, useDeferredValue } from 'react';
import { Coins } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { WidgetShell } from './widget-shell';
import { WidgetFilterInput } from './widget-filter-input';
import { useEditorContext } from '../editor-context';
import {
  useItemsCatalog,
  type ItemCatalogEntry,
} from '../hooks/use-items-catalog';

// ─── Currency chip ─────────────────────────────────────────────────────────────

interface CurrencyChipProps {
  entry: ItemCatalogEntry;
  onInsert: (entry: ItemCatalogEntry) => void;
}

function CurrencyChip({ entry, onInsert }: CurrencyChipProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/poe-hub-currency',
      JSON.stringify({ name: entry.name, iconUrl: entry.iconUrl ?? undefined }),
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onInsert(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onInsert(entry);
      }}
      title={`Inserir ${entry.name}`}
      className={[
        'flex items-center gap-2 rounded-md border border-zinc-800',
        'bg-zinc-900/40 px-2 py-1.5 text-xs text-zinc-100 cursor-grab active:cursor-grabbing',
        'hover:bg-zinc-800/60 hover:border-zinc-700 transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      ].join(' ')}
    >
      {entry.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.iconUrl}
          alt=""
          width={20}
          height={20}
          className="shrink-0 rounded-sm object-contain"
          loading="lazy"
        />
      ) : (
        <span
          className="shrink-0 w-5 h-5 grid place-items-center text-[10px] text-zinc-500"
          aria-hidden
        >
          ◈
        </span>
      )}
      <span className="truncate leading-none">{entry.name}</span>
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
  onInsert: (entry: ItemCatalogEntry) => void;
}

function CurrencyListBody({ onInsert }: CurrencyListBodyProps) {
  const [query, setQuery] = useState('');
  // Deferred value keeps the filter snappy — avoids blocking on every keystroke
  const deferredQuery = useDeferredValue(query);
  const { items, total, isLoading, error } = useItemsCatalog({
    kind: 'currency',
    q: deferredQuery,
    limit: 500,
  });

  if (error) return <ErrorState message={error.message} />;

  return (
    <>
      <div className="px-4 pb-2 flex items-center gap-2">
        <WidgetFilterInput
          value={query}
          onChange={setQuery}
          placeholder="Filtrar currencies…"
          className="flex-1"
        />
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {items.length}
          {total > items.length ? `/${total}` : ''}
        </span>
      </div>
      <ScrollArea className="h-[320px]">
        <div className="flex flex-col gap-1 px-4 pb-4">
          {isLoading && items.length === 0 ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState filtered={query.trim().length > 0} />
          ) : (
            items.map((entry) => (
              <CurrencyChip key={entry.name} entry={entry} onInsert={onInsert} />
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

  function insertCurrency(entry: ItemCatalogEntry) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    // iconUrl now comes straight from the catalog row — no extra round-trip.
    editor
      .chain()
      .focus()
      .insertPoeCurrency({
        currencyName: entry.name,
        iconUrl: entry.iconUrl ?? undefined,
      })
      .run();
  }

  return (
    <WidgetShell id="assets" icon={Coins} title="Assets — Currencies" contentClassName="overflow-hidden">
      <CurrencyListBody onInsert={insertCurrency} />
    </WidgetShell>
  );
}

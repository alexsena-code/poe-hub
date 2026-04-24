'use client';
/**
 * Assets side panel for the blog editor — Currencies tab.
 *
 * Provides a drag-source list of PoE currency names that can be inserted
 * into the Tiptap editor body as poe-currency-node chips.
 *
 * ## Drag integration
 *
 * Each currency chip is `draggable="true"` and sets:
 *   dataTransfer.setData('application/poe-hub-currency', JSON.stringify({ name }))
 *
 * The editor body (editor-body.tsx, S08.e) must handle the `drop` event.
 * The `Dropcursor` extension (already configured in use-tiptap-editor.ts, S08.b)
 * renders the drop indicator. The actual insertion on drop can be implemented by:
 *   1. Reading the dataTransfer in editor-body's onDrop handler.
 *   2. Calling editor.commands.insertPoeCurrency({ currencyName }).
 *
 * S08.g (image-upload extension) will add a separate drop handler for images.
 * Coexistence is safe because MIME types differ:
 *   - Currency drop: 'application/poe-hub-currency'
 *   - Image drop:    standard 'Files' dataTransfer (file.type.startsWith('image/'))
 *
 * ## Click-to-insert (primary UX for MVP)
 *
 * Clicking a currency chip calls:
 *   editor.chain().focus().insertPoeCurrency({ currencyName }).run()
 *
 * This is the primary insertion path. Drag is a bonus — it works out-of-box
 * with Tiptap's native drop handling when the dataTransfer type is registered.
 *
 * ## Session 09 note
 *
 * When engine endpoints `/api/items/gems`, `/api/items/uniques`, `/api/items/search`
 * are available, this panel gains Items/Gems/Passives tabs. The `Tabs` component
 * is already imported below (disabled = "coming soon" placeholders).
 */

import React, { useState, useDeferredValue } from 'react';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEditorContext } from './editor-context';
import { useCurrencyCatalog, filterCurrencies } from './hooks/use-currency-catalog';
import { resolveCurrencyIcon } from './hooks/resolve-currency-icon';

// ---------------------------------------------------------------------------
// Currency drag-source chip
// ---------------------------------------------------------------------------

interface CurrencyChipProps {
  name: string;
  onInsert: (name: string) => void;
}

function CurrencyChip({ name, onInsert }: CurrencyChipProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/poe-hub-currency',
      JSON.stringify({ name }),
    );
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
        'flex items-center gap-1.5 rounded-md border border-yellow-500/25',
        'bg-yellow-950/30 px-2 py-1 text-xs text-yellow-200 cursor-grab active:cursor-grabbing',
        'hover:bg-yellow-950/60 hover:border-yellow-500/50 transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow-400',
      ].join(' ')}
    >
      {/* ◈ placeholder glyph — replaced by real icon when available */}
      <span className="text-[10px] text-yellow-500 opacity-80 leading-none shrink-0">◈</span>
      <span className="truncate leading-none">{name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------

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
    <div className="px-3 py-6 text-xs text-destructive text-center leading-relaxed">
      Falha ao carregar catálogo.
      <br />
      <span className="text-zinc-500">{message}</span>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-3 py-6 text-xs text-zinc-500 text-center">
      {filtered ? 'Nenhuma currency encontrada para esse filtro.' : 'Nenhuma currency disponível.'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Currencies list body
// ---------------------------------------------------------------------------

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
      {/* Search */}
      <div className="px-3 pb-2">
        <Input
          placeholder="Filtrar currencies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      {/* Count */}
      <div className="px-3 pb-1">
        <span className="text-[10px] text-zinc-500">
          {visible.length} de {currencies.length} disponíveis
        </span>
      </div>
      {/* List */}
      <ScrollArea className="h-[280px]">
        <div className="flex flex-col gap-1 px-3 pb-3">
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

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function SidePanelAssets() {
  const { editor } = useEditorContext();
  const [open, setOpen] = useState(true);

  async function insertCurrency(currencyName: string) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    // Resolve icon at insert time so the chip matches the preview pane.
    // resolveCurrencyIcon is fail-soft — null means engine off, chip falls back to ◈.
    const iconUrl = await resolveCurrencyIcon(currencyName);
    editor.chain().focus().insertPoeCurrency({ currencyName, iconUrl: iconUrl ?? undefined }).run();
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
      {/* Header */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-2 px-3 py-2.5 w-full text-left hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-sm font-medium text-zinc-200 truncate">Assets — Currencies</span>
          </div>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>

      <Separator className="bg-zinc-800" />

      <CollapsibleContent className="flex flex-col min-h-0 pt-2">
        <CurrencyListBody onInsert={insertCurrency} />
      </CollapsibleContent>
    </Collapsible>
  );
}

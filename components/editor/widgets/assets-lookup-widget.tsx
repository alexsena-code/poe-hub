'use client';
/**
 * Assets Lookup right-rail widget — browses the engine's item + passive
 * catalog and inserts the selection into the editor as a `poeItem` /
 * `poePassive` atomic node.
 *
 * Three tabs:
 *   - Items: uniques and any non-currency item.
 *   - Gems: `kind=gem` (active + support).
 *   - Passives: `/api/engine/tools/passives`.
 *
 * Click a row → inserts the relevant inline node via Tiptap commands.
 * Falls back to plain text insert when the chip extension isn't loaded
 * (keeps the widget non-breaking during editor init).
 *
 * Carryover 1 — session 11 → session 12.
 */

import React, { useState, useDeferredValue } from 'react';
import { Boxes, Sparkles, Gem, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { WidgetShell } from './widget-shell';
import { WidgetFilterInput } from './widget-filter-input';
import { useEditorContext } from '../editor-context';
import {
  useItemsCatalog,
  type ItemCatalogEntry,
  type ItemCatalogKind,
} from '../hooks/use-items-catalog';
import {
  usePassivesCatalog,
  filterPassives,
  type PassiveEntry,
} from '../hooks/use-passives-catalog';

// ─── Generic state helpers (shared across tabs) ───────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-8 gap-2 text-xs text-zinc-500">
      <Spinner size="sm" />
      {label}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-xs text-destructive text-center leading-relaxed">
      Falha ao carregar.
      <br />
      <span className="text-zinc-500">{message}</span>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="px-4 py-6 text-xs text-zinc-500 text-center">
      {hasQuery ? 'Nenhum resultado para a busca.' : 'Nada encontrado.'}
    </div>
  );
}

// ─── Item row (items + gems reuse this) ───────────────────────────────────────

interface ItemRowProps {
  entry: ItemCatalogEntry;
  onInsert: (entry: ItemCatalogEntry) => void;
  accentClass: string;
}

function ItemRow({ entry, onInsert, accentClass }: ItemRowProps) {
  return (
    <button
      type="button"
      onClick={() => onInsert(entry)}
      className={[
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2',
        'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      ].join(' ')}
    >
      {entry.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.iconUrl}
          alt=""
          width={20}
          height={20}
          className="shrink-0 rounded-sm object-contain mt-0.5"
        />
      ) : (
        <span className="shrink-0 w-5 h-5 mt-0.5 rounded-sm bg-zinc-800/60" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-medium ${accentClass} truncate`}>{entry.name}</span>
          {entry.isSupportGem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              Support
            </Badge>
          )}
        </div>
        {(entry.baseItem || entry.rarity) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {entry.rarity ? `${entry.rarity} · ` : ''}
            {entry.baseItem ?? entry.classId}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Passive row ──────────────────────────────────────────────────────────────

interface PassiveRowProps {
  entry: PassiveEntry;
  onInsert: (entry: PassiveEntry) => void;
}

function PassiveRow({ entry, onInsert }: PassiveRowProps) {
  return (
    <button
      type="button"
      onClick={() => onInsert(entry)}
      className={[
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] leading-none opacity-70">◆</span>
        <span className="font-medium text-violet-200">{entry.name}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          {entry.kind}
        </Badge>
      </div>
      {entry.stats.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {entry.stats.join(' · ')}
        </p>
      )}
    </button>
  );
}

// ─── Items / Gems tab body ────────────────────────────────────────────────────

interface ItemListBodyProps {
  kind: ItemCatalogKind;
  accentClass: string;
  emptyLabel: string;
  onInsert: (entry: ItemCatalogEntry) => void;
}

function ItemListBody({ kind, accentClass, emptyLabel, onInsert }: ItemListBodyProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const { items, total, isLoading, error } = useItemsCatalog({
    kind,
    q: deferred,
    limit: 100,
  });

  if (error) return <ErrorState message={error.message} />;

  return (
    <>
      <div className="px-4 pb-2 flex items-center gap-2">
        <WidgetFilterInput
          value={query}
          onChange={setQuery}
          placeholder={emptyLabel}
          className="flex-1"
        />
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {items.length}
          {total > items.length ? `/${total}` : ''}
        </span>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {isLoading && items.length === 0 ? (
            <LoadingState label="Carregando…" />
          ) : items.length === 0 ? (
            <EmptyState hasQuery={query.trim().length > 0} />
          ) : (
            items.map((entry) => (
              <ItemRow
                key={entry.name}
                entry={entry}
                onInsert={onInsert}
                accentClass={accentClass}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Passives tab body ────────────────────────────────────────────────────────

interface PassiveListBodyProps {
  onInsert: (entry: PassiveEntry) => void;
}

function PassiveListBody({ onInsert }: PassiveListBodyProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const { passives, isLoading, error } = usePassivesCatalog({ limit: 500 });

  if (isLoading) return <LoadingState label="Carregando passives…" />;
  if (error) return <ErrorState message={error.message} />;

  const visible = filterPassives(passives, deferred);

  return (
    <>
      <div className="px-4 pb-2 flex items-center gap-2">
        <WidgetFilterInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar passive…"
          className="flex-1"
        />
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {visible.length}
          {passives.length > visible.length ? `/${passives.length}` : ''}
        </span>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {visible.length === 0 ? (
            <EmptyState hasQuery={query.trim().length > 0} />
          ) : (
            visible.map((entry) => (
              <PassiveRow key={entry.id} entry={entry} onInsert={onInsert} />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function AssetsLookupWidget() {
  const { editor } = useEditorContext();

  function insertItem(entry: ItemCatalogEntry) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'poeItem',
        attrs: {
          itemName: entry.name,
          modifier: entry.rarity?.toLowerCase() ?? null,
          iconUrl: entry.iconUrl ?? null,
        },
      })
      .run();
    toast.success(`"${entry.name}" inserido`);
  }

  function insertPassive(entry: PassiveEntry) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({ type: 'poePassive', attrs: { passiveName: entry.name } })
      .run();
    toast.success(`"${entry.name}" inserido`);
  }

  return (
    <WidgetShell
      id="assets-lookup"
      icon={Boxes}
      title="Items / Gems / Passives"
      contentClassName="overflow-hidden"
    >
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="w-full mx-2 mb-2 grid grid-cols-3 h-8">
          <TabsTrigger value="items" className="text-xs gap-1">
            <Sparkles className="h-3 w-3" /> Items
          </TabsTrigger>
          <TabsTrigger value="gems" className="text-xs gap-1">
            <Gem className="h-3 w-3" /> Gems
          </TabsTrigger>
          <TabsTrigger value="passives" className="text-xs gap-1">
            <Star className="h-3 w-3" /> Passives
          </TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-0">
          <ItemListBody
            kind="unique"
            accentClass="text-amber-200"
            emptyLabel="Buscar unique…"
            onInsert={insertItem}
          />
        </TabsContent>
        <TabsContent value="gems" className="mt-0">
          <ItemListBody
            kind="gem"
            accentClass="text-emerald-200"
            emptyLabel="Buscar gem…"
            onInsert={insertItem}
          />
        </TabsContent>
        <TabsContent value="passives" className="mt-0">
          <PassiveListBody onInsert={insertPassive} />
        </TabsContent>
      </Tabs>
    </WidgetShell>
  );
}

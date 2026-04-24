'use client';
/**
 * Slang Lookup right-rail widget.
 *
 * Debounced search over approved PoE slang terms (from use-slang-catalog).
 * Clicking a term inserts it as a mention node in the editor body via
 * editor.commands.insertContent — falls back to plain text when the mention
 * extension isn't loaded.
 *
 * Endpoint: /api/engine/slang?status=approved&limit=1000 via engine proxy.
 */

import React, { useState, useDeferredValue } from 'react';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { WidgetShell } from './widget-shell';
import { useEditorContext } from '../editor-context';
import { useSlangCatalog, filterSlangTerms } from '../hooks/use-slang-catalog';
import type { SlangTerm } from '../hooks/use-slang-catalog';

// ─── Term row ─────────────────────────────────────────────────────────────────

interface TermRowProps {
  term: SlangTerm;
  onInsert: (term: SlangTerm) => void;
}

function TermRow({ term, onInsert }: TermRowProps) {
  return (
    <button
      type="button"
      onClick={() => onInsert(term)}
      className={[
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-medium text-foreground">{term.term}</span>
        {term.category && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            {term.category}
          </Badge>
        )}
      </div>
      {term.definition && (
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{term.definition}</p>
      )}
    </button>
  );
}

// ─── State helpers ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8 gap-2 text-xs text-zinc-500">
      <Spinner size="sm" />
      Carregando slang…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-xs text-destructive text-center leading-relaxed">
      Falha ao carregar slang.
      <br />
      <span className="text-zinc-500">{message}</span>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="px-4 py-6 text-xs text-zinc-500 text-center">
      {hasQuery
        ? 'Nenhum slang aprovado encontrado.'
        : 'Nenhum slang aprovado disponível.'}
    </div>
  );
}

// ─── List body ────────────────────────────────────────────────────────────────

interface SlangListBodyProps {
  onInsert: (term: SlangTerm) => void;
}

function SlangListBody({ onInsert }: SlangListBodyProps) {
  const { terms, isLoading, error } = useSlangCatalog();
  const [query, setQuery] = useState('');
  // Deferred value avoids blocking on every keystroke
  const deferredQuery = useDeferredValue(query);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;

  const visible = filterSlangTerms(terms, deferredQuery);

  return (
    <>
      <div className="px-4 pb-2">
        <Input
          placeholder="Buscar slang aprovado…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="px-4 pb-1">
        <span className="text-[10px] text-zinc-500">
          {visible.length} de {terms.length} aprovados
        </span>
      </div>
      <ScrollArea className="h-[260px]">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {visible.length === 0 ? (
            <EmptyState hasQuery={query.trim().length > 0} />
          ) : (
            visible.map((t) => (
              <TermRow key={t.id} term={t} onInsert={onInsert} />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function SlangLookupWidget() {
  const { editor } = useEditorContext();

  function insertTerm(term: SlangTerm) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    // Insert as inline text — the mention extension (S08.g) may wrap it later.
    // Using plain text keeps the widget non-breaking even when mention isn't active.
    editor.chain().focus().insertContent(term.term).run();
    toast.success(`"${term.term}" inserido`);
  }

  return (
    <WidgetShell id="slang-lookup" icon={BookOpen} title="Slang Lookup" contentClassName="overflow-hidden">
      <SlangListBody onInsert={insertTerm} />
    </WidgetShell>
  );
}

'use client';
/**
 * Q&A side panel for the blog editor.
 *
 * Renders a collapsible chat pane where the operator can ask the engine
 * knowledge questions while writing a post. Responses come from
 * `POST /api/engine/knowledge/answer` via the hub's engine proxy.
 *
 * Features:
 * - Collapsible header with MessageSquare icon
 * - PT-BR / EN language toggle (top of pane)
 * - Scrollable message history (user + assistant alternating)
 * - Sticky bottom input + send button with loading indicator
 * - Each assistant message: cost badge + "Inserir como callout" button
 * - Inline error badge on failed user messages with retry button
 * - History persisted to localStorage per draftId via use-qa-chat hook
 *
 * Integration note:
 * - Consumes useEditorContext() from editor-context.tsx (S08.e).
 * - If S08.g slash command wants to open this pane via /ask, expose
 *   openQaPane via a ref or state lifted to editor-shell.
 */

import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useEditorContext } from './editor-context';
import { useQaChat, type QaLanguage } from './hooks/use-qa-chat';

// ---------------------------------------------------------------------------
// Language toggle
// ---------------------------------------------------------------------------

interface LanguageToggleProps {
  language: QaLanguage;
  onChange: (lang: QaLanguage) => void;
}

function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onChange('pt-br')}
        className={[
          'px-2 py-0.5 rounded transition-colors',
          language === 'pt-br'
            ? 'bg-zinc-700 text-zinc-100 font-medium'
            : 'text-zinc-500 hover:text-zinc-300',
        ].join(' ')}
      >
        PT-BR
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={[
          'px-2 py-0.5 rounded transition-colors',
          language === 'en'
            ? 'bg-zinc-700 text-zinc-100 font-medium'
            : 'text-zinc-500 hover:text-zinc-300',
        ].join(' ')}
      >
        EN
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User message bubble
// ---------------------------------------------------------------------------

interface UserBubbleProps {
  content: string;
  hasError: boolean;
  onRetry: () => void;
}

function UserBubble({ content, hasError, onRetry }: UserBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-100">
        {content}
      </div>
      {hasError && (
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive" className="text-[10px] px-1.5">
            Erro
          </Badge>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant message bubble
// ---------------------------------------------------------------------------

interface AssistantBubbleProps {
  content: string;
  cost?: number;
  onInsertCallout: () => void;
}

function AssistantBubble({ content, cost, onInsertCallout }: AssistantBubbleProps) {
  const costLabel =
    cost !== undefined ? `$${cost.toFixed(4)}` : null;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[92%] rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      <div className="flex items-center gap-2">
        {costLabel && (
          <span className="text-[10px] text-zinc-500">{costLabel}</span>
        )}
        <button
          type="button"
          onClick={onInsertCallout}
          className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-2"
        >
          Inserir como callout
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function SidePanelQa() {
  const { editor, draftId } = useEditorContext();
  const [open, setOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, send, retry, language, setLanguage, loading, error } =
    useQaChat({ draftId });

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Toast on hook-level errors (network failures etc.)
  useEffect(() => {
    if (error) {
      toast.error('Falha ao consultar engine', { description: error });
    }
  }, [error]);

  function handleSend() {
    const q = inputValue.trim();
    if (!q || loading) return;
    setInputValue('');
    send(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertCallout(answerText: string) {
    if (!editor) {
      toast.error('Editor não está pronto');
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: answerText }],
          },
        ],
      })
      .run();
    toast.success('Resposta inserida como callout');
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
            <MessageSquare className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-sm font-medium text-zinc-200 truncate">Q&A Engine</span>
          </div>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>

      <Separator className="bg-zinc-800" />

      <CollapsibleContent className="flex flex-col min-h-0">
        {/* Language toggle */}
        <div className="flex items-center justify-end px-3 pt-2 pb-1">
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>

        {/* Message history */}
        <ScrollArea className="flex-1 h-[280px]">
          <div className="flex flex-col gap-3 px-3 py-2">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-6 leading-relaxed">
                Faça perguntas sobre Path of Exile ao engine de conhecimento.
              </p>
            )}
            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserBubble
                  key={idx}
                  content={msg.content}
                  hasError={msg.error === true}
                  onRetry={() => retry(idx)}
                />
              ) : (
                <AssistantBubble
                  key={idx}
                  content={msg.content}
                  cost={msg.cost}
                  onInsertCallout={() => insertCallout(msg.content)}
                />
              ),
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Spinner size="xs" />
                Consultando engine…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator className="bg-zinc-800" />

        {/* Sticky input area */}
        <div className="flex flex-col gap-2 p-3">
          <Textarea
            placeholder="Pergunta ao engine… (Enter envia, Shift+Enter quebra linha)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="text-sm resize-none min-h-0"
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!inputValue.trim() || loading}
            className="self-end gap-1.5"
          >
            {loading ? <Spinner size="xs" /> : <Send className="h-3.5 w-3.5" />}
            Enviar
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

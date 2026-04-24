'use client';
/**
 * Q&A Engine right-rail widget.
 *
 * Migrated from side-panel-qa.tsx — same functionality, wrapped in WidgetShell.
 *
 * Language toggle removed intentionally: S10.c will wire meta.language into
 * useQaChat so the hook language always matches the post language. Until then
 * the hook defaults to 'pt-br' internally. The toggle UI is omitted to avoid
 * confusion when the sync is not yet active.
 */

import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { WidgetShell } from './widget-shell';
import { useEditorContext } from '../editor-context';
import { useQaChat } from '../hooks/use-qa-chat';

// ─── Message bubbles ──────────────────────────────────────────────────────────

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

interface AssistantBubbleProps {
  content: string;
  cost?: number;
  onInsertCallout: () => void;
}

function AssistantBubble({ content, cost, onInsertCallout }: AssistantBubbleProps) {
  const costLabel = cost !== undefined ? `$${cost.toFixed(4)}` : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[92%] rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      <div className="flex items-center gap-2">
        {costLabel && <span className="text-[10px] text-zinc-500">{costLabel}</span>}
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

// ─── Chat body ────────────────────────────────────────────────────────────────

function QaChatBody() {
  const { editor, draftId } = useEditorContext();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, send, retry, loading, error } = useQaChat({ draftId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (error) toast.error('Falha ao consultar engine', { description: error });
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
        content: [{ type: 'paragraph', content: [{ type: 'text', text: answerText }] }],
      })
      .run();
    toast.success('Resposta inserida como callout');
  }

  return (
    <>
      {/* Message history */}
      <ScrollArea className="h-[280px]">
        <div className="flex flex-col gap-3 px-4 py-2">
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

      {/* Input area */}
      <div className="flex flex-col gap-2 p-4">
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
    </>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function QaChatWidget() {
  return (
    <WidgetShell id="qa" icon={MessageSquare} title="Q&A Engine" contentClassName="overflow-hidden">
      <QaChatBody />
    </WidgetShell>
  );
}

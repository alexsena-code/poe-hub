'use client';

import { RefObject } from 'react';
import type { Message } from './types';
import { EXAMPLE_QUESTIONS } from './helpers';
import { MessageBubble } from './message-bubble';

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  showContext: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSend: (question: string) => void;
  onToggleContext: (id: string) => void;
}

export function ChatMessages({
  messages,
  loading,
  showContext,
  messagesEndRef,
  onSend,
  onToggleContext,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {messages.length === 0 && <EmptyState onSend={onSend} />}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            showContext={showContext}
            onToggleContext={onToggleContext}
          />
        ))}

        {loading && <LoadingBubble />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function EmptyState({ onSend }: { onSend: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-2xl font-bold text-foreground mb-2">Pergunte sobre Path of Exile</h2>
      <p className="text-muted-foreground text-sm mb-8">
        Respostas geradas com dados reais da PoE Wiki + PoEDB
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="text-left px-4 py-3 rounded-lg border border-border bg-surface text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            {/* Staggered bounce — inline style only for animation-delay (not expressible in Tailwind) */}
            <span
              className="w-2 h-2 bg-accent rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-accent rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-accent rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          Buscando dados e gerando resposta...
        </div>
      </div>
    </div>
  );
}

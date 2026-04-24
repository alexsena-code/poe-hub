'use client';

import { RefObject } from 'react';
import { Input } from '@/components/ui/input';

interface ChatInputBarProps {
  input: string;
  loading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInputBar({ input, loading, inputRef, onChange, onSend }: ChatInputBarProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-4">
      <div className="max-w-3xl mx-auto flex gap-3">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre PoE... (Enter para enviar)"
          disabled={loading}
          className="flex-1"
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 rounded-xl bg-foreground text-background font-medium hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

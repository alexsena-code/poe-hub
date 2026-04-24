'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from './types';

interface MessageBubbleProps {
  msg: Message;
  showContext: string | null;
  onToggleContext: (id: string) => void;
}

export function MessageBubble({ msg, showContext, onToggleContext }: MessageBubbleProps) {
  const isAssistant = msg.role === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? 'bg-surface border border-border rounded-bl-md'
            : 'bg-foreground/10 border border-foreground/20 text-foreground rounded-br-md'
        }`}
      >
        {isAssistant ? (
          <div className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
        )}

        {isAssistant && msg.layers && (
          <MessageContextPanel
            msg={msg}
            isExpanded={showContext === msg.id}
            onToggle={() => onToggleContext(msg.id)}
          />
        )}
      </div>
    </div>
  );
}

interface MessageContextPanelProps {
  msg: Message;
  isExpanded: boolean;
  onToggle: () => void;
}

function MessageContextPanel({ msg, isExpanded, onToggle }: MessageContextPanelProps) {
  return (
    <div className="mt-3 pt-2 border-t border-border/50">
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {msg.cost && (
          <span className="font-mono text-emerald-400">${msg.cost.totalUsd.toFixed(5)}</span>
        )}
        {msg.tokenEstimate && <span>{msg.tokenEstimate} tokens ctx</span>}
        {msg.cost && (
          <span>
            {msg.cost.inputTokens}in/{msg.cost.outputTokens}out
          </span>
        )}
        {msg.latencyMs && <span>{(msg.latencyMs / 1000).toFixed(1)}s</span>}
        {msg.layers?.chunks && <span>{msg.layers.chunks.length} chunks</span>}
        {msg.layers?.exactData && <span>PG data</span>}
        {msg.layers?.summary && <span>summary</span>}
        {msg.detectedPageType && (
          <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">
            {msg.detectedPageType}
          </span>
        )}
        {msg.language && (
          <span
            className="px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground font-medium uppercase"
            title={
              msg.languageSource === 'auto'
                ? `Auto-detected as ${msg.language.toUpperCase()}`
                : `Forced ${msg.language.toUpperCase()}`
            }
          >
            {msg.languageSource === 'auto' ? `auto - ${msg.language}` : msg.language}
          </span>
        )}
        <button onClick={onToggle} className="text-accent hover:text-accent-hover">
          {isExpanded ? 'hide context' : 'show context'}
        </button>
      </div>

      {isExpanded && <ContextDetails msg={msg} />}
    </div>
  );
}

function ContextDetails({ msg }: { msg: Message }) {
  return (
    <div className="mt-2 text-xs space-y-2">
      {msg.layers?.exactData && (
        <details>
          <summary className="cursor-pointer text-accent">PostgreSQL data</summary>
          <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-40">
            {msg.layers.exactData.slice(0, 500)}
            {msg.layers.exactData.length > 500 && '...'}
          </pre>
        </details>
      )}
      {msg.layers?.chunks?.map((c, i) => (
        <details key={i}>
          <summary className="cursor-pointer text-accent">
            [{c.score.toFixed(2)}] {c.metadata?.page_title as string} —{' '}
            {c.metadata?.section as string}
          </summary>
          <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-32">
            {c.content.slice(0, 300)}
          </pre>
        </details>
      ))}
      {msg.layers?.summary && (
        <details>
          <summary className="cursor-pointer text-accent">Summary (poe_meta)</summary>
          <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-32">
            {msg.layers.summary}
          </pre>
        </details>
      )}
    </div>
  );
}

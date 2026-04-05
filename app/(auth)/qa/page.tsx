'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_URL = '/api/engine';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  layers?: {
    exactData?: string;
    chunks?: Array<{ score: number; content: string; metadata: any }>;
    summary?: string;
  };
  tokenEstimate?: number;
  latencyMs?: number;
  detectedPageType?: string;
  cost?: { inputTokens: number; outputTokens: number; totalUsd: number; model: string };
}

const EXAMPLE_QUESTIONS = [
  'Como liberar os slots do Map Device?',
  'How does Delirium work?',
  'What is Headhunter?',
  'Como funciona o Harvest crafting?',
  'Is Righteous Fire good for league start?',
  'What are Maven invitations?',
  'Como funciona Energy Shield?',
  'Expedition rewards guide',
];

export default function QAChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const start = Date.now();

    try {
      // First get context assembly (for showing layers)
      const contextRes = await fetch(`${API_URL}/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, queryType: 'qa' }),
      });
      const contextData = await contextRes.json();

      // Then get LLM answer
      const answerRes = await fetch(`${API_URL}/knowledge/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, queryType: 'qa' }),
      });
      const answerData = await answerRes.json();

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answerData.answer || 'Sem resposta.',
        layers: contextData.layers,
        tokenEstimate: contextData.tokenEstimate,
        latencyMs: Date.now() - start,
        detectedPageType: contextData.detectedPageType,
        cost: answerData.cost,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Erro ao conectar com a API. O NestJS esta rodando?',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="flex items-center justify-between h-12 px-6 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Q&A Chat</span>
        <span className="text-xs text-muted-foreground">RAG: 65K chunks + 213K PG rows</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Pergunte sobre Path of Exile
              </h2>
              <p className="text-muted-foreground text-sm mb-8">
                Respostas geradas com dados reais da PoE Wiki + PoEDB
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-surface text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-foreground/10 border border-foreground/20 text-foreground rounded-br-md'
                    : 'bg-surface border border-border rounded-bl-md'
                }`}
              >
                {/* Message content */}
                {msg.role === 'assistant' ? (
                  <div className="markdown-body text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </div>
                )}

                {/* Context info (assistant only) */}
                {msg.role === 'assistant' && msg.layers && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {msg.cost && (
                        <span className="font-mono text-emerald-400">${msg.cost.totalUsd.toFixed(5)}</span>
                      )}
                      {msg.tokenEstimate && (
                        <span>{msg.tokenEstimate} tokens ctx</span>
                      )}
                      {msg.cost && (
                        <span>{msg.cost.inputTokens}in/{msg.cost.outputTokens}out</span>
                      )}
                      {msg.latencyMs && (
                        <span>{(msg.latencyMs / 1000).toFixed(1)}s</span>
                      )}
                      {msg.layers.chunks && (
                        <span>{msg.layers.chunks.length} chunks</span>
                      )}
                      {msg.layers.exactData && <span>PG data</span>}
                      {msg.layers.summary && <span>summary</span>}
                      {msg.detectedPageType && (
                        <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">
                          {msg.detectedPageType}
                        </span>
                      )}
                      <button
                        onClick={() =>
                          setShowContext(
                            showContext === msg.id ? null : msg.id,
                          )
                        }
                        className="text-accent hover:text-accent-hover"
                      >
                        {showContext === msg.id ? 'hide context' : 'show context'}
                      </button>
                    </div>

                    {/* Expandable context details */}
                    {showContext === msg.id && (
                      <div className="mt-2 text-xs space-y-2">
                        {msg.layers.exactData && (
                          <details>
                            <summary className="cursor-pointer text-accent">
                              PostgreSQL data
                            </summary>
                            <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-40">
                              {msg.layers.exactData.slice(0, 500)}
                              {msg.layers.exactData.length > 500 && '...'}
                            </pre>
                          </details>
                        )}
                        {msg.layers.chunks?.map((c, i) => (
                          <details key={i}>
                            <summary className="cursor-pointer text-accent">
                              [{c.score.toFixed(2)}] {c.metadata?.page_title} — {c.metadata?.section}
                            </summary>
                            <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-32">
                              {c.content.slice(0, 300)}
                            </pre>
                          </details>
                        ))}
                        {msg.layers.summary && (
                          <details>
                            <summary className="cursor-pointer text-accent">
                              Summary (poe_meta)
                            </summary>
                            <pre className="mt-1 p-2 bg-background rounded text-muted-foreground overflow-x-auto max-h-32">
                              {msg.layers.summary}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Buscando dados e gerando resposta...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-surface px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre PoE... (Enter para enviar)"
            disabled={loading}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-6 py-3 rounded-xl bg-foreground text-background font-medium hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

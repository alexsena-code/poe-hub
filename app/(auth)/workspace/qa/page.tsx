'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_URL = '/api/engine';

type LanguagePref = 'pt' | 'en' | 'auto';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  layers?: {
    exactData?: string;
    chunks?: Array<{ score: number; content: string; metadata: Record<string, unknown> }>;
    summary?: string;
  };
  tokenEstimate?: number;
  latencyMs?: number;
  detectedPageType?: string;
  cost?: { inputTokens: number; outputTokens: number; totalUsd: number; model: string };
  language?: 'pt' | 'en';
  languageSource?: 'user' | 'auto';
}

const LANGUAGE_STORAGE_KEY = 'qa-chat-language';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: { content: string; role: string; createdAt: string } | null;
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

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) {
      groups[0].items.push(conv);
    } else if (d >= yesterday) {
      groups[1].items.push(conv);
    } else if (d >= thisWeek) {
      groups[2].items.push(conv);
    } else {
      groups[3].items.push(conv);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function QAChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showContext, setShowContext] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguagePref>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load language preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'pt' || saved === 'en' || saved === 'auto') {
        setLanguage(saved);
      }
    } catch {
      // ignore (SSR or disabled storage)
    }
  }, []);

  function changeLanguage(next: LanguagePref) {
    setLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  // Fetch conversations on mount
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=100');
      if (!res.ok) return;
      const json = await res.json();
      setConversations(json.data ?? []);
      return json.data ?? [];
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations().then((convs: Conversation[] | undefined) => {
      if (!convs || convs.length === 0) {
        // Auto-create first conversation
        createConversation();
      } else {
        // Select the most recent
        selectConversation(convs[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createConversation() {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const conv = await res.json();
      const newConv: Conversation = {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: 0,
        lastMessage: null,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
    } catch {
      // ignore
    }
  }

  async function selectConversation(id: string) {
    setActiveConvId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = (data.messages ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
        layers: m.layers as Message['layers'] | undefined,
        tokenEstimate: m.tokenEstimate as number | undefined,
        latencyMs: m.latencyMs as number | undefined,
        detectedPageType: m.detectedPageType as string | undefined,
        cost: m.cost as Message['cost'] | undefined,
        language: m.language as Message['language'] | undefined,
        languageSource: m.languageSource as Message['languageSource'] | undefined,
      }));
      setMessages(msgs);
    } catch {
      // ignore
    }
  }

  async function deleteConversation(id: string) {
    try {
      await fetch(`/api/chat/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          createConversation();
        }
      }
    } catch {
      // ignore
    }
  }

  async function persistMessage(conversationId: string, msg: Message) {
    try {
      await fetch(`/api/chat/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: msg.role,
          content: msg.content,
          layers: msg.layers,
          tokenEstimate: msg.tokenEstimate,
          latencyMs: msg.latencyMs,
          detectedPageType: msg.detectedPageType,
          cost: msg.cost,
        }),
      });
    } catch {
      // ignore — message is already shown optimistically
    }
  }

  function updateConversationInList(convId: string, firstUserContent?: string) {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          updatedAt: new Date().toISOString(),
          messageCount: c.messageCount + 1,
          title: c.title || (firstUserContent ? firstUserContent.slice(0, 60) : c.title),
        };
      });
      // Re-sort: most recently updated first
      return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading || !activeConvId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Persist user message
    persistMessage(activeConvId, userMsg);

    // Check if this is the first user message (for title auto-gen)
    const isFirstUserMsg = messages.filter((m) => m.role === 'user').length === 0;
    updateConversationInList(activeConvId, isFirstUserMsg ? q : undefined);

    const start = Date.now();

    // Build conversation history for context
    const conversationHistory = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // First get context assembly (for showing layers)
      const contextRes = await fetch(`${API_URL}/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, queryType: 'qa', conversationHistory }),
      });
      const contextData = await contextRes.json();

      // Then get LLM answer
      const answerRes = await fetch(`${API_URL}/knowledge/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, queryType: 'qa', conversationHistory, language }),
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
        language: answerData.language,
        languageSource: answerData.languageSource,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Persist assistant message
      persistMessage(activeConvId, assistantMsg);
      updateConversationInList(activeConvId);
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Erro ao conectar com a API. O NestJS esta rodando?',
      };
      setMessages((prev) => [...prev, errorMsg]);
      persistMessage(activeConvId, errorMsg);
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

  const groups = groupConversationsByDate(conversations);

  return (
    <div className="flex h-screen fixed inset-0 md:left-64 z-10 bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } shrink-0 border-r border-border bg-surface transition-all duration-200 overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
          <span className="text-sm font-medium text-foreground">Chats</span>
          <button
            onClick={createConversation}
            className="text-xs px-2.5 py-1 rounded-md bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingConvs && (
            <div className="px-4 py-8 text-xs text-muted-foreground text-center">
              Loading...
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  className={`group flex items-center gap-1 px-4 py-2 cursor-pointer text-sm transition-colors ${
                    activeConvId === conv.id
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <button
                    onClick={() => selectConversation(conv.id)}
                    className="flex-1 text-left truncate min-w-0"
                  >
                    {conv.title || 'New chat'}
                  </button>
                  {hoveredConvId === conv.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors p-0.5"
                      title="Delete conversation"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-3.5 h-3.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

          {!loadingConvs && conversations.length === 0 && (
            <div className="px-4 py-8 text-xs text-muted-foreground text-center">
              No conversations yet
            </div>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Page header */}
        <header className="flex items-center justify-between h-12 px-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="text-sm font-medium text-foreground">Q&A Chat</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Language toggle */}
            <div
              role="group"
              aria-label="Response language"
              className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
            >
              {(['pt', 'en', 'auto'] as LanguagePref[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => changeLanguage(opt)}
                  aria-pressed={language === opt}
                  title={
                    opt === 'pt'
                      ? 'Sempre responder em portugues'
                      : opt === 'en'
                        ? 'Always answer in English'
                        : 'Auto-detect language from question'
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    language === opt
                      ? 'bg-foreground/15 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt === 'pt' ? 'PT' : opt === 'en' ? 'EN' : 'Auto'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">RAG: 65K chunks + 213K PG rows</span>
          </div>
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
                                [{c.score.toFixed(2)}] {c.metadata?.page_title as string} — {c.metadata?.section as string}
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
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre PoE... (Enter para enviar)"
              disabled={loading}
              className="flex-1"
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
    </div>
  );
}

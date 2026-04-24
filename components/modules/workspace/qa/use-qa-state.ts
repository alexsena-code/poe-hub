'use client';

import { useState, useRef, useCallback } from 'react';
import type { Message, Conversation, LanguagePref } from './types';
import { LANGUAGE_STORAGE_KEY, mapApiMessageToMessage } from './helpers';

const API_URL = '/api/engine';

/** All state + async actions for the QA chat page. */
export function useQaState() {
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

  function changeLanguage(next: LanguagePref) {
    setLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore (SSR or disabled storage)
    }
  }

  function loadLanguagePreference() {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'pt' || saved === 'en' || saved === 'auto') {
        setLanguage(saved);
      }
    } catch {
      // ignore (SSR or disabled storage)
    }
  }

  const fetchConversations = useCallback(async (): Promise<Conversation[] | undefined> => {
    try {
      const res = await fetch('/api/chat?limit=100');
      if (!res.ok) return undefined;
      const json = await res.json();
      const convs: Conversation[] = json.data ?? [];
      setConversations(convs);
      return convs;
    } catch {
      return undefined;
    } finally {
      setLoadingConvs(false);
    }
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
      const msgs: Message[] = (data.messages ?? []).map(
        (m: Record<string, unknown>) => mapApiMessageToMessage(m),
      );
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

  function bumpConversation(convId: string, firstUserContent?: string) {
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
      return updated.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    });
  }

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading || !activeConvId) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    persistMessage(activeConvId, userMsg);

    // Title auto-gen on first user message
    const isFirstUserMsg = messages.filter((m) => m.role === 'user').length === 0;
    bumpConversation(activeConvId, isFirstUserMsg ? q : undefined);

    const start = Date.now();
    const conversationHistory = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Fetch context layers (for showing RAG details per message)
      const contextRes = await fetch(`${API_URL}/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, queryType: 'qa', conversationHistory }),
      });
      const contextData = await contextRes.json();

      // Fetch LLM answer separately (allows independent streaming in future)
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
      persistMessage(activeConvId, assistantMsg);
      bumpConversation(activeConvId);
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

  return {
    conversations,
    activeConvId,
    messages,
    input,
    setInput,
    loading,
    loadingConvs,
    showContext,
    setShowContext,
    sidebarOpen,
    setSidebarOpen,
    hoveredConvId,
    setHoveredConvId,
    language,
    changeLanguage,
    loadLanguagePreference,
    messagesEndRef,
    inputRef,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    handleSend,
  };
}

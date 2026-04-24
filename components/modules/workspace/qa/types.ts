// QA chat types — shared across all qa sub-components

export type LanguagePref = 'pt' | 'en' | 'auto';

export interface MessageLayers {
  exactData?: string;
  chunks?: Array<{ score: number; content: string; metadata: Record<string, unknown> }>;
  summary?: string;
}

export interface MessageCost {
  inputTokens: number;
  outputTokens: number;
  totalUsd: number;
  model: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  layers?: MessageLayers;
  tokenEstimate?: number;
  latencyMs?: number;
  detectedPageType?: string;
  cost?: MessageCost;
  language?: 'pt' | 'en';
  languageSource?: 'user' | 'auto';
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: { content: string; role: string; createdAt: string } | null;
}

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

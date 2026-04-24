import type { Conversation, ConversationGroup } from './types';

export const LANGUAGE_STORAGE_KEY = 'qa-chat-language';

export const EXAMPLE_QUESTIONS = [
  'Como liberar os slots do Map Device?',
  'How does Delirium work?',
  'What is Headhunter?',
  'Como funciona o Harvest crafting?',
  'Is Righteous Fire good for league start?',
  'What are Maven invitations?',
  'Como funciona Energy Shield?',
  'Expedition rewards guide',
];

/** Groups conversations into Today / Yesterday / This Week / Older buckets. */
export function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: ConversationGroup[] = [
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

/** Maps a raw API message record to a typed Message. */
export function mapApiMessageToMessage(m: Record<string, unknown>) {
  return {
    id: m.id as string,
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
    layers: m.layers as import('./types').MessageLayers | undefined,
    tokenEstimate: m.tokenEstimate as number | undefined,
    latencyMs: m.latencyMs as number | undefined,
    detectedPageType: m.detectedPageType as string | undefined,
    cost: m.cost as import('./types').MessageCost | undefined,
    language: m.language as 'pt' | 'en' | undefined,
    languageSource: m.languageSource as 'user' | 'auto' | undefined,
  };
}

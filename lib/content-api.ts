import type { Briefing, GeneratedSection } from './engine-types';

const isServer = typeof window === 'undefined';
const CONTENT_API_URL = isServer
  ? (process.env.NEXT_PUBLIC_CONTENT_API_URL || "http://localhost:3000/api")
  : "/api/engine";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (isServer) {
    const apiKey = process.env.CONTENT_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
  }
  // Client-side: proxy at /api/engine adds x-api-key automatically
  return headers;
}

// ---------------------------------------------------------------------------
// Types (poe-hub originals)
// ---------------------------------------------------------------------------

export interface PostSummary {
  slug: string;
  title: { "pt-br": string; en: string };
  template: string;
  status: string;
  generatedAt: string;
}

export interface PostSection {
  id: string;
  heading: string;
  content: { "pt-br": string; en: string };
  order: number;
}

interface RawSection {
  sectionId: string;
  title: string;
  content: { "pt-br": string; en: string };
  tokensUsed: number;
}

export interface PostMeta {
  title: { "pt-br": string; en: string };
  description: { "pt-br": string; en: string };
  ogTitle?: { "pt-br": string; en: string };
  ogDescription?: { "pt-br": string; en: string };
}

export interface PostDetail {
  slug: string;
  title: { "pt-br": string; en: string };
  template: string;
  status: string;
  generatedAt: string;
  sections: PostSection[];
  meta: PostMeta;
}

// ---------------------------------------------------------------------------
// poe-hub original functions
// ---------------------------------------------------------------------------

export async function fetchPosts(): Promise<PostSummary[]> {
  const res = await fetch(`${CONTENT_API_URL}/content/posts`, {
    headers: authHeaders(),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }

  return res.json();
}

export async function fetchPost(slug: string): Promise<PostDetail> {
  const res = await fetch(`${CONTENT_API_URL}/content/posts/${slug}`, {
    headers: authHeaders(),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch post ${slug}: ${res.status}`);
  }

  const raw = await res.json();

  // Map raw section format (sectionId/title) to PostSection (id/heading/order)
  const sections: PostSection[] = (raw.sections || []).map(
    (s: RawSection, i: number) => ({
      id: s.sectionId,
      heading: s.title,
      content: s.content,
      order: i,
    })
  );

  return { ...raw, sections };
}

// ---------------------------------------------------------------------------
// Engine functions (from path-of-trade-content)
// ---------------------------------------------------------------------------

export async function fetchTemplates() {
  const res = await fetch(`${CONTENT_API_URL}/content/templates`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao buscar templates');
  return res.json();
}

export async function generateOutline(briefing: Briefing) {
  const res = await fetch(`${CONTENT_API_URL}/content/outline`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(briefing),
  });
  if (!res.ok) throw new Error('Falha ao gerar outline');
  return res.json();
}

export async function writeSection(params: {
  briefing: Briefing;
  sectionId: string;
  humanInput?: string;
  previousDraft?: string;
  previousComments?: Array<{ sectionTitle: string; comment: string }>;
  lockedContent?: string[];
  fromScratch?: boolean;
}) {
  const res = await fetch(`${CONTENT_API_URL}/content/write-section`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Falha ao gerar seção');
  return res.json();
}

export async function optimizeSeo(params: {
  sections: GeneratedSection[];
  briefing: Briefing;
}) {
  const res = await fetch(`${CONTENT_API_URL}/content/optimize-seo`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Falha ao otimizar SEO');
  return res.json();
}

export async function rewriteSelection(params: {
  briefing: Briefing;
  sectionId: string;
  fullDraft: string;
  selectedText: string;
  instruction?: string;
}) {
  const res = await fetch(`${CONTENT_API_URL}/content/rewrite-selection`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Falha ao regerar trecho');
  return res.json();
}

export async function savePost(data: any) {
  const res = await fetch(`${CONTENT_API_URL}/content/posts`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Falha ao salvar post');
  return res.json();
}

export async function updatePost(slug: string, data: any) {
  const res = await fetch(`${CONTENT_API_URL}/content/posts/${slug}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Falha ao atualizar post');
  return res.json();
}

export async function listPosts() {
  const res = await fetch(`${CONTENT_API_URL}/content/posts`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao listar posts');
  return res.json();
}

export async function loadPost(slug: string) {
  const res = await fetch(`${CONTENT_API_URL}/content/posts/${slug}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao carregar post');
  return res.json();
}

export async function askQuestion(question: string) {
  const res = await fetch(`${CONTENT_API_URL}/knowledge/answer`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Falha ao responder pergunta');
  return res.json();
}

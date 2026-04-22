import type { Briefing, CritiqueIssue, GeneratedSection, ProposedOutline } from './engine-types';

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

/**
 * Pede ao engine para propor um outline (seções editáveis) baseado no
 * briefing + template. Resposta vem pronta para popular o OutlineEditor.
 * Quando ENABLE_OUTLINE_PROPOSER=false no engine, retorna fallback do
 * template skeleton — ainda editável, só não tem LLM propondo seções novas.
 */
export async function proposeOutline(briefing: Briefing): Promise<ProposedOutline> {
  const res = await fetch(`${CONTENT_API_URL}/content/outline/propose`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(briefing),
  });
  if (!res.ok) throw new Error('Falha ao propor outline');
  return res.json();
}

// ---------------------------------------------------------------------------
// Feature flags (runtime toggles backed by output/feature-flags.json)
// ---------------------------------------------------------------------------

export interface FeatureFlagEntry {
  key: string;
  envVar: string;
  default: boolean;
  label: string;
  description: string;
  value: boolean;
  source: 'file' | 'env' | 'default';
}

export async function fetchFeatureFlags(): Promise<{ flags: FeatureFlagEntry[] }> {
  const res = await fetch(`${CONTENT_API_URL}/content/feature-flags`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Falha ao carregar feature flags');
  return res.json();
}

export async function updateFeatureFlags(
  updates: Record<string, boolean>,
): Promise<{ flags: FeatureFlagEntry[] }> {
  const res = await fetch(`${CONTENT_API_URL}/content/feature-flags`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Falha ao atualizar feature flags');
  return res.json();
}

export async function resetFeatureFlag(key: string): Promise<{ flags: FeatureFlagEntry[] }> {
  const res = await fetch(`${CONTENT_API_URL}/content/feature-flags/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Falha ao resetar feature flag');
  return res.json();
}

// ---------------------------------------------------------------------------
// Outline proposer metrics
// ---------------------------------------------------------------------------

export interface OutlineMetricsSummary {
  total: number;
  fallbacks: number;
  fallbackRate: number;
  totalTokens: number;
  totalCostUsd: number;
  averageLatencyMs: number | null;
  recentFallbackReasons: Array<{ timestamp: string; reason: string; templateName?: string }>;
  last: {
    timestamp: string;
    fallback: boolean;
    llmModel: string;
    tokensUsed: number;
    sectionCount: number;
    templateName?: string;
  } | null;
}

export async function fetchOutlineMetrics(): Promise<OutlineMetricsSummary> {
  const res = await fetch(`${CONTENT_API_URL}/content/outline/metrics`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Falha ao carregar métricas de outline');
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
  previousSections?: Array<{ sectionId: string; title: string; content: { 'pt-br': string; en: string }; tokensUsed: number }>;
  /** Post slug — sent so the engine can reuse a cached PlanOutput from output/posts/{slug}.json */
  slug?: string;
  /** Editor-wide note applied to every section (separate from humanInput which is per-section). */
  globalComment?: string;
}) {
  const res = await fetch(`${CONTENT_API_URL}/content/write-section`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Falha ao gerar seção');
  return res.json();
}

export async function planPreview(briefing: Briefing): Promise<{
  plan: {
    stepBackQuery: string;
    sections: Array<{
      sectionId: string;
      specificQueries: string[];
      entityMustInclude: string[];
      priority?: string;
    }>;
    generatedAt: string;
  } | null;
  error?: string;
}> {
  const res = await fetch(`${CONTENT_API_URL}/content/plan/preview`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(briefing),
  });
  if (!res.ok) throw new Error('Falha ao gerar preview do plano');
  return res.json();
}

export async function fixSection(params: {
  briefing: Briefing;
  sectionId: string;
  currentDraft: { 'pt-br': string; en: string };
  issues: CritiqueIssue[];
  lang: 'pt-br' | 'en';
}): Promise<{
  content: { 'pt-br': string; en: string };
  tokensUsed: number;
  critiqueIssues: CritiqueIssue[];
}> {
  const res = await fetch(`${CONTENT_API_URL}/content/section/fix`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Falha ao corrigir seção');
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
  /** Send both languages so the backend can keep them in sync after the rewrite. */
  fullDraft: string | { 'pt-br': string; en: string };
  selectedText: string;
  /** Which language the user highlighted. Backend rewrites in this one and translates to the other. */
  selectedLang?: 'pt-br' | 'en';
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

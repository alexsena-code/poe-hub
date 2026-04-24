// Shared API prefix for all ideation endpoints
export const IDEAS_API = '/api/engine';

export const URGENCY_COLORS: Record<string, string> = {
  hot: 'bg-red-900/40 text-red-300',
  timely: 'bg-amber-900/40 text-amber-300',
  evergreen: 'bg-emerald-900/40 text-emerald-300',
};

export const EFFORT_COLORS: Record<string, string> = {
  S: 'text-emerald-400',
  M: 'text-amber-400',
  L: 'text-red-400',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-700/50 text-zinc-300',
  accepted: 'bg-emerald-900/40 text-emerald-300',
  rejected: 'bg-red-900/40 text-red-300',
  generated: 'bg-blue-900/40 text-blue-300',
};

export const TEMPLATE_LABELS: Record<string, string> = {
  mechanic_guide: 'Mechanic Guide',
  currency_guide: 'Currency Guide',
  quick_explainer: 'Quick Explainer',
  faq: 'FAQ',
  beginner_guide: 'Beginner Guide',
  // legacy keys — kept only so old briefs still render with a readable label
  build_guide: 'Build Guide',
  tier_list: 'Tier List',
  comparison: 'Comparison',
  atlas_guide: 'Atlas Guide',
  league_start: 'League Start',
  qa_page: 'Q&A',
  patch_analysis: 'Patch Analysis',
};

// Templates the backend actually supports — keep in sync with VALID_TEMPLATES
// in packages/api/src/modules/ideation/ideation.service.ts.
export const GENERATABLE_TEMPLATES = [
  'quick_explainer', 'mechanic_guide', 'currency_guide', 'faq', 'beginner_guide',
];

// Canonical data source keys — shown on every brief even when the LLM left
// them out, so the user can toggle them on before generating.
export const CANONICAL_DATA_SOURCES = ['qdrant', 'ninja', 'patch', 'reddit', 'youtube', 'keywords'];

// Model selection (OpenRouter format) — default uses YAML config
export const MODEL_OPTIONS = [
  { label: 'Default (config YAML)', model: '' },
  { label: 'GPT-4.1 Mini', model: 'openai/gpt-4.1-mini' },
  { label: 'GPT-4.1', model: 'openai/gpt-4.1' },
  { label: 'GPT-5 Mini', model: 'openai/gpt-5-mini' },
  { label: 'Gemini 2.5 Flash Lite', model: 'google/gemini-2.5-flash-lite' },
  { label: 'Gemini 2.5 Flash', model: 'google/gemini-2.5-flash' },
  { label: 'Gemini 3 Flash', model: 'google/gemini-3-flash-preview' },
  { label: 'DeepSeek V3.2', model: 'deepseek/deepseek-v3.2' },
  { label: 'Claude Sonnet 4', model: 'anthropic/claude-sonnet-4' },
  { label: 'Grok 4.1 Fast', model: 'x-ai/grok-4.1-fast' },
];

// Shared SEO helpers — constants + formatters used by all three /seo/* routes.
// Centralised here so research/opportunities/analysis share the same labels/colors.

export const CLUSTERS = [
  'all',
  'build_guide',
  'crafting',
  'currency_guide',
  'tier_list',
  'atlas_guide',
  'league_start',
  'mechanic_guide',
  'general',
] as const;

export const SOURCES = ['all', 'gsc', 'suggest', 'youtube', 'competitor'] as const;
export const GAMES = ['all', 'poe1', 'poe2', 'both'] as const;
export const INTENTS = ['all', 'informational', 'commercial', 'transactional', 'navigational'] as const;

export const API_URL = '/api/engine';

export function clusterLabel(c: string | null | undefined): string {
  if (!c) return '-';
  return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function intentColor(intent: string | null): string {
  switch (intent) {
    case 'informational':
      return 'text-sky-400';
    case 'commercial':
      return 'text-amber-400';
    case 'transactional':
      return 'text-red-400';
    case 'navigational':
      return 'text-purple-400';
    default:
      return 'text-muted-foreground';
  }
}

export function sourceColor(source: string): string {
  switch (source) {
    case 'gsc':
      return 'bg-blue-900/40 text-blue-300';
    case 'suggest':
      return 'bg-emerald-900/40 text-emerald-300';
    case 'youtube':
      return 'bg-red-900/40 text-red-300';
    case 'competitor':
      return 'bg-amber-900/40 text-amber-300';
    default:
      return 'bg-surface text-muted-foreground';
  }
}

export function actionBadge(action: string): { label: string; color: string } {
  switch (action) {
    case 'optimize_ctr':
      return { label: 'Fix CTR', color: 'bg-amber-900/40 text-amber-300' };
    case 'push_to_top5':
      return { label: 'Push Top 5', color: 'bg-emerald-900/40 text-emerald-300' };
    case 'create_content':
      return { label: 'Create Content', color: 'bg-sky-900/40 text-sky-300' };
    default:
      return { label: action, color: 'bg-surface text-muted-foreground' };
  }
}

export function viceColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-400 font-bold';
  if (score >= 60) return 'text-emerald-300';
  if (score >= 40) return 'text-amber-300';
  return 'text-red-300';
}

/** Format date as dd/mm/yyyy pt-BR per operator convention */
export function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Format datetime as dd/mm/yyyy HH:MM pt-BR */
export function formatDatetimeBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

// Shared SEO helpers — constants + formatters used by all three /seo/* routes.
// Centralised here so research/opportunities/analysis share the same labels/colors.

// S05.b — badge color functions migrated to StatusBadgeVariant returns.
// intentColor + viceColor are text-only (no badge border), kept as class strings
// but updated from hardcoded hues to semantic CSS tokens.

import type { StatusBadgeVariant } from '@/components/ui/status-badge';

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

/** Intent text color — text-only, no badge background. Uses semantic tokens. */
export function intentColor(intent: string | null): string {
  switch (intent) {
    case 'informational':
      return 'text-info';
    case 'commercial':
      return 'text-warning';
    case 'transactional':
      return 'text-destructive';
    case 'navigational':
      // navigational has no direct semantic match — keep purple for distinction
      return 'text-purple-400';
    default:
      return 'text-muted-foreground';
  }
}

/** Source badge variant — maps data origin to StatusBadgeVariant. */
export function sourceVariant(source: string): StatusBadgeVariant {
  switch (source) {
    case 'gsc':       return 'info';
    case 'suggest':   return 'success';
    case 'youtube':   return 'danger';
    case 'competitor':return 'warning';
    default:          return 'neutral';
  }
}

/**
 * Action badge — maps recommended SEO action to label + StatusBadgeVariant.
 * @example actionBadge('optimize_ctr') → { label: 'Fix CTR', variant: 'warning' }
 */
export function actionBadge(action: string): { label: string; variant: StatusBadgeVariant } {
  switch (action) {
    case 'optimize_ctr':
      return { label: 'Fix CTR', variant: 'warning' };
    case 'push_to_top5':
      return { label: 'Push Top 5', variant: 'success' };
    case 'create_content':
      return { label: 'Create Content', variant: 'info' };
    default:
      return { label: action, variant: 'neutral' };
  }
}

/**
 * VICE score text color — text-only display, no badge background.
 * >=80 → success bold, >=60 → success, >=40 → warning, else → danger.
 */
export function viceColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-success font-bold';
  if (score >= 60) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

/** Format date as dd/mm/yyyy pt-BR per operator convention */
export function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Format datetime as dd/mm/yyyy HH:MM pt-BR */
export function formatDatetimeBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

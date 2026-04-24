'use client';
/**
 * Visual validation checklist for the publish form.
 *
 * Reads editorMetaSchema.safeParse(meta) and renders a categorized list
 * of checks: blockers (red), warnings (amber), and passing (green).
 *
 * Design: three severity tiers:
 *   - blocker: field is missing/invalid per zod schema → post cannot publish
 *   - warning: field is technically valid but suboptimal (SEO desc < 50 chars)
 *   - ok: check passes
 *
 * Kept pure (no side effects, no fetching) so it can be tested trivially.
 *
 * Session 10.b.
 */

import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { editorMetaSchema } from '../editor-meta-schema';
import type { EditorMetaForm } from '../editor-meta-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'ok' | 'warning' | 'blocker';

interface CheckItem {
  label: string;
  severity: Severity;
}

// ─── Severity icons and styles ────────────────────────────────────────────────

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
  blocker: <XCircle className="h-4 w-4 text-destructive shrink-0" />,
};

const SEVERITY_TEXT: Record<Severity, string> = {
  ok: 'text-zinc-300',
  warning: 'text-amber-400',
  blocker: 'text-destructive',
};

// ─── Check builders ───────────────────────────────────────────────────────────

/**
 * Computes the checklist from current meta values.
 * Runs zod parse to detect blockers, then adds warning-level checks on top.
 */
function buildChecks(meta: Partial<EditorMetaForm>): CheckItem[] {
  const result = editorMetaSchema.safeParse(meta);

  // Collect zod error paths for field-level blocker detection.
  const errorPaths = new Set<string>();
  if (!result.success) {
    for (const issue of result.error.issues) {
      errorPaths.add(issue.path.join('.'));
    }
  }

  const blocker = (field: string): Severity =>
    errorPaths.has(field) ? 'blocker' : 'ok';

  const metaLen = (meta.metadata ?? '').length;
  const seoSeverity: Severity =
    errorPaths.has('metadata') ? 'blocker' :
    metaLen < 50 ? 'warning' :
    'ok';

  return [
    { label: 'Título (mín. 3 chars)', severity: blocker('title') },
    { label: 'Slug (lowercase, sem espaços)', severity: blocker('slug') },
    { label: 'Game Version', severity: blocker('gameVersion') },
    { label: 'Categoria', severity: blocker('categoryId') },
    { label: 'Autor', severity: blocker('authorId') },
    { label: 'Ao menos 1 tag', severity: blocker('tags') },
    { label: `Descrição SEO (${metaLen}/160 chars)`, severity: seoSeverity },
    { label: 'Data de publicação', severity: blocker('publishedAt') },
    { label: 'Idioma', severity: blocker('language') },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface PublishValidationChecklistProps {
  meta: Partial<EditorMetaForm>;
}

/**
 * Sticky checklist showing which required fields are satisfied.
 * Parent passes live meta values — checklist is purely derived.
 */
export function PublishValidationChecklist({ meta }: PublishValidationChecklistProps) {
  const checks = buildChecks(meta);
  const blockerCount = checks.filter((c) => c.severity === 'blocker').length;
  const warningCount = checks.filter((c) => c.severity === 'warning').length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Checklist</h3>
        {blockerCount === 0 && warningCount === 0 ? (
          <span className="text-xs text-emerald-400 font-medium">Pronto para publicar</span>
        ) : blockerCount > 0 ? (
          <span className="text-xs text-destructive font-medium">
            {blockerCount} pendente{blockerCount > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-xs text-amber-400 font-medium">
            {warningCount} aviso{warningCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2">
            {SEVERITY_ICON[check.severity]}
            <span className={`text-xs ${SEVERITY_TEXT[check.severity]}`}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

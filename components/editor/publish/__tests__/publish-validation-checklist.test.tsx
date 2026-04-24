// @vitest-environment jsdom
/**
 * Tests for PublishValidationChecklist — pure visual component driven by
 * editorMetaSchema.safeParse(meta). No network, no side effects.
 *
 * Session 10.b.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublishValidationChecklist } from '../publish-validation-checklist';
import type { EditorMetaForm } from '../../editor-meta-schema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_META: EditorMetaForm = {
  title: 'Guia de Divine Orb no PoE 2',
  metadata: 'Aprenda a farmear Divine Orbs no Path of Exile 2 com essa estratégia completa.',
  slug: 'guia-divine-orb-poe2',
  gameVersion: 'path-of-exile-2',
  categoryId: 'cat-123',
  authorId: 'author-456',
  tags: ['farming', 'economy'],
  publishedAt: '2026-04-24T12:00',
  language: 'pt-br',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublishValidationChecklist', () => {
  it('shows all checks passing when meta is fully valid', () => {
    render(<PublishValidationChecklist meta={VALID_META} />);

    expect(screen.getByText('Pronto para publicar')).toBeTruthy();
    // No XCircle icons — all green
    expect(screen.queryByText(/pendente/)).toBeNull();
  });

  it('shows blockers when required fields are missing', () => {
    const emptyMeta = {
      title: '',
      slug: '',
      gameVersion: 'path-of-exile-1' as const,
      categoryId: '',
      authorId: '',
      tags: [] as string[],
      metadata: '',
      publishedAt: '',
      language: 'pt-br' as const,
    };

    render(<PublishValidationChecklist meta={emptyMeta} />);

    // Should show blocker count badge
    expect(screen.getByText(/pendente/)).toBeTruthy();
  });

  it('shows warning when SEO description is short (< 50 chars) but valid (>= 20)', () => {
    const metaWithShortSeo: EditorMetaForm = {
      ...VALID_META,
      // 30 chars — passes zod min(20) but triggers warning at < 50
      metadata: 'Curta descrição de trinta chars.',
    };

    render(<PublishValidationChecklist meta={metaWithShortSeo} />);

    // Summary shows "aviso"
    expect(screen.getByText(/aviso/)).toBeTruthy();
  });
});

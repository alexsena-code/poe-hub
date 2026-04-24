/**
 * Unit tests for editorMetaSchema — covers valid input, required-field
 * violations, slug format rules, tag format rules, and metadata length limits.
 *
 * Session 08.e.
 */

import { describe, it, expect } from 'vitest';
import { editorMetaSchema, editorMetaDefaults } from '../editor-meta-schema';

// ─── Valid baseline ────────────────────────────────────────────────────────────

const validMeta = {
  ...editorMetaDefaults,
  title: 'Guia de Divine Orbs no PoE 2',
  metadata: 'Aprenda a farmar Divine Orbs de forma eficiente no Path of Exile 2.',
  slug: 'guia-divine-orbs-poe2',
  gameVersion: 'path-of-exile-2' as const,
  categoryId: 'cat-abc123',
  authorId: 'author-xyz456',
  tags: ['divine-orb', 'farming', 'poe2'],
  publishedAt: '2026-04-23T10:00:00.000Z',
  language: 'pt-br' as const,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getError(data: Record<string, unknown>, field: string): string | undefined {
  const result = editorMetaSchema.safeParse(data);
  if (result.success) return undefined;
  const issue = result.error.issues.find(
    (i) => i.path[0] === field || i.path.join('.') === field,
  );
  return issue?.message;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('editorMetaSchema', () => {
  it('accepts a fully valid payload', () => {
    const result = editorMetaSchema.safeParse(validMeta);
    expect(result.success).toBe(true);
  });

  it('rejects title that is too short', () => {
    const err = getError({ ...validMeta, title: 'Ab' }, 'title');
    expect(err).toMatch(/Título muito curto/i);
  });

  it('rejects title that is too long', () => {
    const err = getError({ ...validMeta, title: 'A'.repeat(201) }, 'title');
    expect(err).toMatch(/Título muito longo/i);
  });

  it('rejects empty title', () => {
    const err = getError({ ...validMeta, title: '' }, 'title');
    expect(err).toBeDefined();
  });

  it('rejects metadata shorter than 20 chars', () => {
    const err = getError({ ...validMeta, metadata: 'Curta demais.' }, 'metadata');
    expect(err).toMatch(/muito curta/i);
  });

  it('rejects metadata longer than 160 chars', () => {
    const err = getError({ ...validMeta, metadata: 'A'.repeat(161) }, 'metadata');
    expect(err).toMatch(/muito longa/i);
  });

  it('rejects slug with uppercase letters', () => {
    const err = getError({ ...validMeta, slug: 'My-Post' }, 'slug');
    expect(err).toMatch(/lowercase/i);
  });

  it('rejects slug with spaces', () => {
    const err = getError({ ...validMeta, slug: 'my post' }, 'slug');
    expect(err).toMatch(/lowercase/i);
  });

  it('rejects slug with special chars', () => {
    const err = getError({ ...validMeta, slug: 'my_post!' }, 'slug');
    expect(err).toMatch(/lowercase/i);
  });

  it('accepts slug with digits and hyphens', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, slug: 'poe2-guide-123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid gameVersion', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, gameVersion: 'poe3' });
    expect(result.success).toBe(false);
  });

  it('rejects empty categoryId', () => {
    const err = getError({ ...validMeta, categoryId: '' }, 'categoryId');
    expect(err).toBeDefined();
  });

  it('rejects empty authorId', () => {
    const err = getError({ ...validMeta, authorId: '' }, 'authorId');
    expect(err).toBeDefined();
  });

  it('rejects tags array with invalid tag (uppercase)', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, tags: ['ValidTag'] });
    expect(result.success).toBe(false);
  });

  it('rejects tags with spaces', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, tags: ['my tag'] });
    expect(result.success).toBe(false);
  });

  it('rejects empty tags array', () => {
    const err = getError({ ...validMeta, tags: [] }, 'tags');
    expect(err).toMatch(/Pelo menos uma tag/i);
  });

  it('rejects more than 8 tags', () => {
    const tags = Array.from({ length: 9 }, (_, i) => `tag-${i}`);
    const err = getError({ ...validMeta, tags }, 'tags');
    expect(err).toMatch(/Máximo 8 tags/i);
  });

  it('accepts mainImageAssetId as optional', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, mainImageAssetId: undefined });
    expect(result.success).toBe(true);
  });

  it('rejects invalid language', () => {
    const result = editorMetaSchema.safeParse({ ...validMeta, language: 'es' });
    expect(result.success).toBe(false);
  });

  it('accepts both valid languages', () => {
    expect(editorMetaSchema.safeParse({ ...validMeta, language: 'pt-br' }).success).toBe(true);
    expect(editorMetaSchema.safeParse({ ...validMeta, language: 'en' }).success).toBe(true);
  });
});

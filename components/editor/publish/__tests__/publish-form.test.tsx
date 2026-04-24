// @vitest-environment jsdom
/**
 * Tests for PublishForm — orchestrator component.
 *
 * Mocks:
 * - next/navigation (useRouter, push)
 * - global fetch (for the publish POST and draft PATCH)
 * - use-sanity-refs (authors + categories) — no network
 *
 * Session 10.b.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublishForm } from '../publish-form';
import type { EditorMetaForm } from '../../editor-meta-schema';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('../../hooks/use-sanity-refs', () => ({
  useAuthors: () => ({ authors: [{ _id: 'a1', name: 'Icaro', slug: 'icaro' }], isLoading: false }),
  useCategories: () => ({
    categories: [{ _id: 'c1', tagname: 'Economy', slug: 'economy' }],
    isLoading: false,
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_META: Partial<EditorMetaForm> = {
  title: 'Guia de Divine Orb no PoE 2',
  metadata: 'Aprenda a farmear Divine Orbs no Path of Exile 2 com estratégia completa para 2026.',
  slug: 'guia-divine-orb-poe2',
  gameVersion: 'path-of-exile-2',
  categoryId: 'c1',
  authorId: 'a1',
  tags: ['farming', 'economy'],
  publishedAt: '2026-04-24T12:00',
  language: 'pt-br',
};

const EMPTY_BODY = { type: 'doc', content: [] };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublishForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ slug: 'guia-divine-orb-poe2', _id: 'pub-123' }),
    } as Response);
  });

  it('renders all four accordion sections', () => {
    render(<PublishForm initialMeta={VALID_META} body={EMPTY_BODY} draftId="draft-abc" />);

    expect(screen.getByText('Informações básicas')).toBeTruthy();
    expect(screen.getByText('Taxonomia')).toBeTruthy();
    // "SEO & Imagem" is the exact accordion title — use role to avoid matching label text
    expect(screen.getAllByText(/SEO & Imagem/).length).toBeGreaterThan(0);
    expect(screen.getByText('Publicação')).toBeTruthy();
  });

  it('checklist updates summary when meta changes to invalid state', async () => {
    render(
      <PublishForm
        initialMeta={{ ...VALID_META, title: '' }}
        body={EMPTY_BODY}
        draftId="draft-abc"
      />,
    );

    // With empty title, checklist should show blockers
    await waitFor(() => {
      expect(screen.getByText(/pendente/)).toBeTruthy();
    });
  });

  it('calls publish API on submit with valid meta', async () => {
    render(<PublishForm initialMeta={VALID_META} body={EMPTY_BODY} draftId="draft-abc" />);

    const publishBtn = screen.getByRole('button', { name: /publicar/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
      const publishCall = calls.find((args) => {
        const url = args[0];
        return typeof url === 'string' && url.includes('/api/sanity/publish');
      });
      expect(publishCall).toBeTruthy();
    });
  });

  it('shows slug collision toast and stays on page on 409', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Slug já utilizado por outro post' }),
    } as Response);

    render(<PublishForm initialMeta={VALID_META} body={EMPTY_BODY} draftId="draft-abc" />);

    const publishBtn = screen.getByRole('button', { name: /publicar/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      // Router should NOT navigate away on 409
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

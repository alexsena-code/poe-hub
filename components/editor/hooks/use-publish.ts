'use client';
/**
 * Publish hook — validates, calls POST /api/sanity/publish, cleans up draft,
 * and navigates to the edit route on success.
 *
 * Separated from editor-shell to keep the shell below 300L.
 * Consumes the editor context for draftId; takes payload as argument so
 * the caller assembles it from react-hook-form values + editor body.
 *
 * Session 08.e.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { PortableTextContent } from '@/lib/sanity/types';
import type { EditorMetaForm } from '../editor-meta-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublishPayload {
  meta: EditorMetaForm;
  body: PortableTextContent[];
  draftId: string;
}

export interface PublishResult {
  slug: string;
  _id: string;
}

export interface UsePublishReturn {
  publish: (payload: PublishPayload) => Promise<PublishResult | null>;
  publishing: boolean;
  publishError: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a `publish` function and loading/error state.
 *
 * @example
 * const { publish, publishing } = usePublish();
 * await publish({ meta, body: tiptapToPortable(json), draftId });
 */
export function usePublish(): UsePublishReturn {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = useCallback(
    async ({ meta, body, draftId }: PublishPayload): Promise<PublishResult | null> => {
      setPublishing(true);
      setPublishError(null);

      try {
        const res = await fetch('/api/sanity/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meta, body, draftId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: res.statusText }));
          const msg = `Falha ao publicar: ${data.error ?? res.statusText}`;
          setPublishError(msg);
          toast.error('Erro ao publicar', {
            description: Array.isArray(data?.details) && data.details.length
              ? `${data.error}: ${data.details.map((d: { message?: string; path?: unknown[] }) => `${Array.isArray(d.path) ? d.path.join('.') : ''} — ${d.message}`).join('; ')}`
              : msg,
          });
          return null;
        }

        const result = (await res.json()) as PublishResult;

        // Draft cleanup is handled atomically server-side by the publish
        // transaction (lib/sanity/publish.ts) since the session 10 fix.

        toast.success('Post publicado!', {
          description: `/${result.slug} está no ar.`,
          action: {
            label: 'Ver post',
            onClick: () => window.open(`https://poetrade.dev/blog/${result.slug}`, '_blank'),
          },
        });

        // Navigate to edit route with the published ID so autosave updates correctly.
        router.push(`/workspace/blog/${result._id}/edit`);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setPublishError(msg);
        toast.error('Erro ao publicar', { description: msg });
        return null;
      } finally {
        setPublishing(false);
      }
    },
    [router],
  );

  return { publish, publishing, publishError };
}

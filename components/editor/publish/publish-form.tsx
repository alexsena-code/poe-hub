'use client';
/**
 * Publish form orchestrator — 2-column layout wrapping the four meta sections
 * and the validation checklist + action footer.
 *
 * Architecture:
 * - FormProvider from react-hook-form shares form state with all section
 *   sub-components. Each section uses useFormContext() to register fields.
 * - Live meta is patched to the draft via PUT /api/sanity/draft/[id] on blur
 *   (debounced 1 s via a ref-timer) — keeps draft fresh without blocking UI.
 * - Validation driven by editorMetaSchema.safeParse (useMemo) — passed as
 *   `isValid` to PublishActions (disables publish button) and raw meta to
 *   PublishValidationChecklist (drives the visual checklist).
 * - On submit: POST /api/sanity/publish. 409 → toast + stay. 200 → navigate.
 *
 * Session 10.b.
 */

import React, { useState, useMemo, useRef, useTransition, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { PortableTextContent } from '@/lib/sanity/types';
import { editorMetaSchema, editorMetaDefaults } from '../editor-meta-schema';
import type { EditorMetaForm } from '../editor-meta-schema';
import { tiptapToPortable } from '../serializer/tiptap-to-portable';
import type { TiptapDoc } from '../serializer/tiptap-to-portable';
import type { JSONContent } from '@tiptap/core';
import { PublishSectionBasic } from './publish-section-basic';
import { PublishSectionTaxonomy } from './publish-section-taxonomy';
import { PublishSectionSeo } from './publish-section-seo';
import { PublishSectionPublication } from './publish-section-publication';
import { PublishValidationChecklist } from './publish-validation-checklist';
import { PublishActions } from './publish-actions';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishFormProps {
  initialMeta: Partial<EditorMetaForm>;
  /** Body as Tiptap JSON — converted to Portable Text on publish. */
  body: JSONContent;
  draftId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 1_000;

// ─── Draft patch helper ───────────────────────────────────────────────────────

async function patchDraft(
  draftId: string,
  meta: EditorMetaForm,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/sanity/draft/${draftId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: { ...meta, language: meta.language } }),
    signal,
  });
  if (!res.ok) {
    console.warn(`[publish-form] draft PATCH failed: ${res.status} for ${draftId}`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Full publish form with section accordions (left) and sticky checklist (right).
 *
 * @example
 * <PublishForm initialMeta={meta} body={bodyJson} draftId={draftId} />
 */
export function PublishForm({ initialMeta, body, draftId }: PublishFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const methods = useForm<EditorMetaForm>({
    resolver: zodResolver(editorMetaSchema),
    defaultValues: { ...editorMetaDefaults, ...initialMeta },
    mode: 'onChange',
  });

  const watchedValues = methods.watch();

  // isValid is derived from zod parse so checklist and button stay in sync.
  const isValid = useMemo(
    () => editorMetaSchema.safeParse(watchedValues).success,
    // JSON.stringify gives stable dependency for the object value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(watchedValues)],
  );

  // Debounced draft patch on blur — keeps draft fresh for navigation back to editor.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scheduleDraftPatch = useCallback((values: EditorMetaForm) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort('new-patch');
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      patchDraft(draftId, values, ctrl.signal).catch(() => {
        // Non-critical — autosave in editor covers this path.
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [draftId]);

  // Register onChange to trigger draft patch.
  React.useEffect(() => {
    const subscription = methods.watch((values) => {
      const parsed = editorMetaSchema.safeParse(values);
      if (parsed.success) scheduleDraftPatch(parsed.data);
    });
    return () => subscription.unsubscribe();
  }, [methods, scheduleDraftPatch]);

  // ── Publish handler ─────────────────────────────────────────────────────────

  const handlePublish = methods.handleSubmit((meta) => {
    startTransition(async () => {
      const portableBody = tiptapToPortable(body as TiptapDoc) as PortableTextContent[];
      try {
        const res = await fetch('/api/sanity/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meta, body: portableBody, draftId }),
        });

        if (res.status === 409) {
          const data = await res.json().catch(() => ({ error: 'Slug já em uso' })) as { error?: string };
          toast.error('Slug em conflito', {
            description: `${data.error ?? 'Esse slug já está em uso.'} Altere o slug e tente novamente.`,
          });
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
          toast.error('Falha ao publicar', { description: data.error ?? res.statusText });
          return;
        }

        const result = await res.json() as { slug: string; _id: string };
        toast.success('Post publicado!', {
          description: `/${result.slug} está no ar.`,
          action: {
            label: 'Ver post',
            onClick: () => window.open(`https://poetrade.dev/blog/${result.slug}`, '_blank'),
          },
        });
        router.push('/workspace/blog');
      } catch (err: unknown) {
        toast.error('Erro ao publicar', {
          description: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    });
  });

  // ── Layout ──────────────────────────────────────────────────────────────────

  const editHref = `/workspace/blog/${draftId}/edit`;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handlePublish} className="flex flex-col gap-6 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left: meta sections */}
          <div className="space-y-2">
            <Accordion
              type="multiple"
              defaultValue={['basic', 'taxonomy', 'seo', 'publication']}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800"
            >
              <AccordionItem value="basic" className="border-0">
                <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-zinc-300 hover:no-underline hover:text-white">
                  Informações básicas
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <PublishSectionBasic />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="taxonomy" className="border-0">
                <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-zinc-300 hover:no-underline hover:text-white">
                  Taxonomia
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <PublishSectionTaxonomy />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="seo" className="border-0">
                <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-zinc-300 hover:no-underline hover:text-white">
                  SEO &amp; Imagem
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <PublishSectionSeo />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="publication" className="border-0">
                <AccordionTrigger className="px-5 py-3 text-sm font-semibold text-zinc-300 hover:no-underline hover:text-white">
                  Publicação
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <PublishSectionPublication />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right: sticky checklist */}
          <div className="sticky top-6 space-y-4">
            <PublishValidationChecklist meta={watchedValues} />
          </div>
        </div>

        {/* Footer actions */}
        <PublishActions
          editHref={editHref}
          isValid={isValid}
          isPending={isPending}
          onPublish={handlePublish}
        />
      </form>
    </FormProvider>
  );
}

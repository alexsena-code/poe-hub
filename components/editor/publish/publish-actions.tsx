'use client';
/**
 * Publish form footer actions.
 *
 * Left: "← Voltar ao editor" link.
 * Right: "Publicar" button — disabled when form is invalid, shows
 *        loading state via `isPending`.
 *
 * Error handling:
 *   - 409 slug collision → toast with route message + stays on page.
 *   - 200 success → navigation to /workspace/blog (handled by caller).
 *
 * The component receives all necessary state as props — no internal fetch,
 * keeps the pattern testable without network stubs.
 *
 * Session 10.b.
 */

import React from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishActionsProps {
  editHref: string;
  isValid: boolean;
  isPending: boolean;
  onPublish: () => void;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Sticky footer with back link and publish button.
 *
 * @example
 * <PublishActions
 *   editHref={`/workspace/blog/${draftId}/edit`}
 *   isValid={isValid}
 *   isPending={isPending}
 *   onPublish={handlePublish}
 * />
 */
export function PublishActions({
  editHref,
  isValid,
  isPending,
  onPublish,
}: PublishActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-800">
      <Button variant="ghost" size="sm" asChild className="gap-1.5 text-zinc-400 hover:text-zinc-200">
        <Link href={editHref}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao editor
        </Link>
      </Button>

      <Button
        size="sm"
        onClick={onPublish}
        disabled={!isValid || isPending}
        className="min-w-28"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            Publicando…
          </>
        ) : (
          'Publicar'
        )}
      </Button>
    </div>
  );
}

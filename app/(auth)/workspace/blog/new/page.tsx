'use client';
/**
 * New blog post page — client wrapper.
 *
 * Generates a fresh draftId via nanoid on mount and passes it to EditorShell.
 * RSC is not possible here because EditorShell is a client component and
 * we need a stable random ID that survives navigation (must be client-generated
 * to avoid server/client hydration mismatch with nanoid).
 *
 * Session 10 S10.a — side panels removed; right rail is mounted inside EditorShell.
 */

import { useMemo } from "react";
import { nanoid } from "nanoid";
import { EditorShell } from "@/components/editor/editor-shell";

export default function NewBlogPostPage() {
  // Stable across re-renders for the lifetime of this page mount.
  // nanoid(21) gives 21-char URL-safe string — collision-free for drafts scope.
  const draftId = useMemo(() => nanoid(21), []);

  return (
    <EditorShell
      draftId={draftId}
      defaultLanguage="pt-br"
    />
  );
}

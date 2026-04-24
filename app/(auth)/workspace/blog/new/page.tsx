'use client';
/**
 * New blog post page — client wrapper.
 *
 * Generates a fresh draftId via nanoid on mount and passes it to EditorShell.
 * RSC is not possible here because EditorShell is a client component and
 * we need a stable random ID that survives navigation (must be client-generated
 * to avoid server/client hydration mismatch with nanoid).
 *
 * Session 08 S08.h.
 */

import { useMemo } from "react";
import { nanoid } from "nanoid";
import { EditorShell } from "@/components/editor/editor-shell";
import { SidePanelQa } from "@/components/editor/side-panel-qa";
import { SidePanelAssets } from "@/components/editor/side-panel-assets";

export default function NewBlogPostPage() {
  // Stable across re-renders for the lifetime of this page mount.
  // nanoid(21) gives 21-char URL-safe string — collision-free for drafts scope.
  const draftId = useMemo(() => nanoid(21), []);

  const sidePanels = (
    <>
      <SidePanelQa />
      <SidePanelAssets />
    </>
  );

  return (
    <EditorShell
      draftId={draftId}
      defaultLanguage="pt-br"
      slotSidePanels={sidePanels}
    />
  );
}

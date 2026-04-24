'use client';
/**
 * Editor body — hosts the Tiptap contenteditable area, bubble menu (B/I/Link/Code
 * on text selection), and floating menu (block-type hints on empty line).
 *
 * Props:
 *   editor — the Tiptap Editor instance from useTiptapEditor().
 *            null only before hydration; renders a centered spinner in that case.
 *
 * BubbleMenu: imported from @tiptap/extension-bubble-menu.
 * FloatingMenu: imported from @tiptap/extension-floating-menu.
 * EditorContent: imported from @tiptap/react.
 *
 * The drag-over visual (ring when a PoE asset is dragged over) is handled
 * by tracking onDragEnter/onDragLeave/onDrop on the wrapper div.
 * Slot for S08.g: image-upload extension adds paste/drop handlers on the
 * Tiptap extension layer, not here — this file stays unchanged.
 *
 * Session 08.e.
 */

import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import { Bold, Italic, Link2, Code2, Heading1, List } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorBodyProps {
  editor: Editor | null;
}

// ─── Bubble menu content ──────────────────────────────────────────────────────

function BubbleActions({ editor }: { editor: Editor }) {
  const setLink = () => {
    const url = window.prompt('URL do link:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 p-0.5 shadow-lg">
      <BubbleBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Negrito"
      >
        <Bold className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Itálico"
      >
        <Italic className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn
        active={editor.isActive('link')}
        onClick={setLink}
        label="Link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Código inline"
      >
        <Code2 className="h-3.5 w-3.5" />
      </BubbleBtn>
    </div>
  );
}

// ─── Floating menu content ────────────────────────────────────────────────────

function FloatingActions({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 shadow-lg">
      <span className="text-xs text-zinc-600 mr-1">
        / ou selecione:
      </span>
      <Separator orientation="vertical" className="h-4 bg-zinc-700" />
      <BubbleBtn
        active={false}
        onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn
        active={false}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Lista bullet"
      >
        <List className="h-3.5 w-3.5" />
      </BubbleBtn>
    </div>
  );
}

// ─── Shared bubble/floating button ───────────────────────────────────────────

function BubbleBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-6 w-6"
      onClick={onClick}
      type="button"
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Renders the Tiptap editor area with bubble/floating menus.
 * Shows a centered spinner while the editor instance is being hydrated.
 * Shows a ring border when a draggable PoE asset hovers over the drop zone.
 */
export function EditorBody({ editor }: EditorBodyProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <Spinner size="lg" ariaLabel="Carregando editor" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex-1 rounded-md transition-all duration-150',
        isDragOver && 'ring-2 ring-primary/60',
      )}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => setIsDragOver(false)}
    >
      {/* Bubble menu — appears on text selection */}
      <BubbleMenu editor={editor}>
        <BubbleActions editor={editor} />
      </BubbleMenu>

      {/* Floating menu — appears on an empty line */}
      <FloatingMenu editor={editor}>
        <FloatingActions editor={editor} />
      </FloatingMenu>

      {/* The actual Tiptap contenteditable — prose classes applied to EditorContent
          via editorProps.attributes in use-tiptap-editor.ts */}
      <EditorContent editor={editor} />
    </div>
  );
}

'use client';
/**
 * Top bar for the blog editor.
 *
 * Layout (S10.b — Row 1 removed, meta moved to /publish route):
 *   Left   — formatting quick-actions (H1/H2/H3 group, B, I, Link, Quote,
 *             Bullet, Ordered, Code block) — hidden in preview mode
 *   Right  — autosave status, Draft↔Preview toggle, "Prosseguir →" button
 *
 * All formatting buttons call editor commands via useEditorContext().
 * "Prosseguir →" navigates to /workspace/blog/[draftId]/publish.
 *
 * Removed in S10.b: title input, slug preview, language pill, publish button.
 * Those fields now live in publish-form.tsx under the /publish route.
 *
 * Session 08.e → updated S10.b.
 */

import React from 'react';
import {
  Bold, Italic, Link2, Quote, List, ListOrdered,
  Code2, Heading1, Heading2, Heading3,
  Eye, EyeOff, CheckCircle2, Loader2, AlertCircle,
  ArrowRight, Undo2, Redo2, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Minus, Table, ImageIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorContext } from './editor-context';
import type { EditorPhase } from './types';
import type { AutosaveStatus } from './hooks/use-autosave';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  phase: EditorPhase;
  onPhaseToggle: () => void;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
}

// ─── Autosave status display ──────────────────────────────────────────────────

function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (status === 'error') {
    return (
      // text-destructive maps to --destructive in the design system
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Erro ao salvar
      </span>
    );
  }
  if (status === 'saved' && lastSavedAt) {
    const secsAgo = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
    return (
      // text-success maps to --color-success in globals.css
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-success" />
        Salvo há {secsAgo}s
      </span>
    );
  }
  return null;
}

// ─── Formatting button ────────────────────────────────────────────────────────

interface FmtButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FmtButton({ label, active, onClick, children }: FmtButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
          type="button"
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Table insert dropdown ────────────────────────────────────────────────────

/**
 * Dropdown for inserting tables. Offers 2x2, 3x3, and a prompt-based custom
 * size. Separated from FmtButton because it needs its own DropdownMenu state
 * and cannot be wrapped in a single <Button>.
 */
function TableInsertMenu({ editor }: { editor: import('@tiptap/core').Editor | null }) {
  function insertTable(rows: number, cols: number) {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  }

  function handleCustomTable() {
    const rowsStr = window.prompt('Número de linhas:', '3');
    const colsStr = window.prompt('Número de colunas:', '3');
    const rows = parseInt(rowsStr ?? '', 10);
    const cols = parseInt(colsStr ?? '', 10);
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1) return;
    insertTable(rows, cols);
  }

  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" type="button" aria-label="Inserir tabela">
              <Table className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Inserir tabela</TooltipContent>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">Inserir tabela</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => insertTable(2, 2)}>
            2 × 2 (simples)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertTable(3, 3)}>
            3 × 3 (padrão)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCustomTable}>
            Personalizado…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Top editor toolbar — formatting quick actions, phase toggle, proceed button.
 *
 * S10.b: title/slug/language/publish removed — meta lives in /publish route.
 * "Prosseguir →" navigates to /workspace/blog/[draftId]/publish.
 */
export function EditorToolbar({
  phase,
  onPhaseToggle,
  autosaveStatus,
  lastSavedAt,
}: EditorToolbarProps) {
  const { editor, draftId } = useEditorContext();
  const router = useRouter();

  const cmd = (fn: () => boolean) => { fn(); };
  const isPreview = phase === 'preview';

  const handleProceed = () => {
    router.push(`/workspace/blog/${draftId}/publish`);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2 min-h-[44px]">
        {/* Left: formatting buttons (hidden in preview) */}
        <div className="flex flex-1 items-center gap-0.5 flex-wrap min-w-0">
          {!isPreview && (
            <>
              <FmtButton
                label="Heading 1"
                active={editor?.isActive('heading', { level: 1 })}
                onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 1 }).run() ?? false)}
              >
                <Heading1 className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Heading 2"
                active={editor?.isActive('heading', { level: 2 })}
                onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 2 }).run() ?? false)}
              >
                <Heading2 className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Heading 3"
                active={editor?.isActive('heading', { level: 3 })}
                onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 3 }).run() ?? false)}
              >
                <Heading3 className="h-3.5 w-3.5" />
              </FmtButton>

              <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

              <FmtButton
                label="Negrito (Ctrl+B)"
                active={editor?.isActive('bold')}
                onClick={() => cmd(() => editor?.chain().focus().toggleBold().run() ?? false)}
              >
                <Bold className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Itálico (Ctrl+I)"
                active={editor?.isActive('italic')}
                onClick={() => cmd(() => editor?.chain().focus().toggleItalic().run() ?? false)}
              >
                <Italic className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Link"
                active={editor?.isActive('link')}
                onClick={() => {
                  const url = window.prompt('URL do link:');
                  if (url) editor?.chain().focus().setLink({ href: url }).run();
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </FmtButton>

              <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

              <FmtButton
                label="Citação"
                active={editor?.isActive('blockquote')}
                onClick={() => cmd(() => editor?.chain().focus().toggleBlockquote().run() ?? false)}
              >
                <Quote className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Lista bullet"
                active={editor?.isActive('bulletList')}
                onClick={() => cmd(() => editor?.chain().focus().toggleBulletList().run() ?? false)}
              >
                <List className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Lista numerada"
                active={editor?.isActive('orderedList')}
                onClick={() => cmd(() => editor?.chain().focus().toggleOrderedList().run() ?? false)}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Bloco de código"
                active={editor?.isActive('codeBlock')}
                onClick={() => cmd(() => editor?.chain().focus().toggleCodeBlock().run() ?? false)}
              >
                <Code2 className="h-3.5 w-3.5" />
              </FmtButton>

              <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

              {/* Undo / Redo */}
              <FmtButton
                label="Desfazer (Ctrl+Z)"
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Refazer (Ctrl+Shift+Z)"
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </FmtButton>

              <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

              {/* Alignment */}
              <FmtButton
                label="Alinhar à esquerda"
                active={editor?.isActive({ textAlign: 'left' })}
                onClick={() => cmd(() => editor?.chain().focus().setTextAlign('left').run() ?? false)}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Centralizar"
                active={editor?.isActive({ textAlign: 'center' })}
                onClick={() => cmd(() => editor?.chain().focus().setTextAlign('center').run() ?? false)}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Alinhar à direita"
                active={editor?.isActive({ textAlign: 'right' })}
                onClick={() => cmd(() => editor?.chain().focus().setTextAlign('right').run() ?? false)}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </FmtButton>
              <FmtButton
                label="Justificar"
                active={editor?.isActive({ textAlign: 'justify' })}
                onClick={() => cmd(() => editor?.chain().focus().setTextAlign('justify').run() ?? false)}
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </FmtButton>

              <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

              {/* Horizontal rule */}
              <FmtButton
                label="Linha horizontal"
                onClick={() => cmd(() => editor?.chain().focus().setHorizontalRule().run() ?? false)}
              >
                <Minus className="h-3.5 w-3.5" />
              </FmtButton>

              {/* Table insert dropdown */}
              <TableInsertMenu editor={editor ?? null} />

              {/* Image upload — dispatches the same custom event the slash
                  '/image' command uses, so editor-shell's listener handles it. */}
              <FmtButton
                label="Inserir imagem"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('editor:open-image-picker'));
                }}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </FmtButton>
            </>
          )}
        </div>

        {/* Right: autosave + phase toggle + proceed */}
        <div className="flex items-center gap-2 shrink-0">
          <AutosaveIndicator status={autosaveStatus} lastSavedAt={lastSavedAt} />

          <Separator orientation="vertical" className="h-5 bg-zinc-700" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPhaseToggle}
                type="button"
                className="h-7 gap-1.5 text-xs"
              >
                {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {isPreview ? 'Editar' : 'Preview'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPreview ? 'Voltar ao editor' : 'Visualizar post'}
            </TooltipContent>
          </Tooltip>

          {/* Prosseguir — takes operator to the /publish meta form */}
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleProceed}
            type="button"
          >
            Prosseguir
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

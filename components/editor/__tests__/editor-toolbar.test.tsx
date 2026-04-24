// @vitest-environment jsdom
/**
 * Tests for EditorToolbar — S10.d additions: Undo/Redo, Alignment, HR, Table.
 *
 * Strategy: mock useEditorContext to return a controlled fake editor object,
 * then assert the new buttons call the right editor chain methods.
 *
 * Session 10 S10.d.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// ResizeObserver polyfill for jsdom
// ---------------------------------------------------------------------------

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Fake editor builder
// ---------------------------------------------------------------------------

/** Builds a minimal fake Tiptap editor with jest-tracked chain methods. */
function buildFakeEditor() {
  const undo = vi.fn().mockReturnValue({ run: vi.fn() });
  const redo = vi.fn().mockReturnValue({ run: vi.fn() });
  const setTextAlign = vi.fn().mockReturnValue({ run: vi.fn() });
  const setHorizontalRule = vi.fn().mockReturnValue({ run: vi.fn() });
  const insertTable = vi.fn().mockReturnValue({ run: vi.fn() });

  // Chainable fluent builder pattern matching Tiptap's .chain().focus().*
  const chain = vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      undo,
      redo,
      setTextAlign,
      setHorizontalRule,
      insertTable,
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      setLink: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCodeBlock: vi.fn().mockReturnValue({ run: vi.fn() }),
      setHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  });

  const isActive = vi.fn().mockReturnValue(false);

  return { chain, isActive, _undo: undo, _redo: redo, _setTextAlign: setTextAlign, _setHorizontalRule: setHorizontalRule, _insertTable: insertTable };
}

// ---------------------------------------------------------------------------
// Mock editor context
// ---------------------------------------------------------------------------

const fakeEditor = buildFakeEditor();

vi.mock('../editor-context', () => ({
  useEditorContext: () => ({
    editor: fakeEditor,
    draftId: 'draft-test-id',
  }),
}));

// Mock next/navigation so useRouter doesn't blow up in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { EditorToolbar } from '../editor-toolbar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderToolbar() {
  return render(
    <EditorToolbar
      phase="draft"
      onPhaseToggle={vi.fn()}
      autosaveStatus="idle"
      lastSavedAt={null}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorToolbar — S10.d additions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Undo and Redo buttons', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: /desfazer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refazer/i })).toBeInTheDocument();
  });

  it('Undo button calls editor.chain().focus().undo()', async () => {
    renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /desfazer/i }));
    expect(fakeEditor.chain).toHaveBeenCalled();
    expect(fakeEditor._undo).toHaveBeenCalled();
  });

  it('Redo button calls editor.chain().focus().redo()', async () => {
    renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refazer/i }));
    expect(fakeEditor._redo).toHaveBeenCalled();
  });

  it('renders all 4 alignment buttons', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: /alinhar à esquerda/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /centralizar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alinhar à direita/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /justificar/i })).toBeInTheDocument();
  });

  it('Align center button calls setTextAlign("center")', async () => {
    renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /centralizar/i }));
    expect(fakeEditor._setTextAlign).toHaveBeenCalledWith('center');
  });

  it('Horizontal Rule button calls setHorizontalRule()', async () => {
    renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /linha horizontal/i }));
    expect(fakeEditor._setHorizontalRule).toHaveBeenCalled();
  });

  it('Table dropdown trigger renders', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: /inserir tabela/i })).toBeInTheDocument();
  });
});

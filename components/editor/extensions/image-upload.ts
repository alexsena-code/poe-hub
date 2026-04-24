'use client';
/**
 * Image upload extension for the PoE blog editor.
 *
 * Intercepts three upload paths:
 * 1. Paste with image in clipboard (Ctrl+V).
 * 2. OS drag-and-drop of an image file onto the editor.
 * 3. Slash command '/image' dispatches 'editor:open-image-picker' → file picker
 *    → calls uploadImageFile() exported from here.
 *
 * All paths call POST /api/sanity/upload (multipart, 8MB cap).
 * On success: inserts a Tiptap image node with src=CDN URL + data-sanity-ref attr.
 * On error: sonner toast with the failure reason.
 *
 * Extends the base @tiptap/extension-image — meaning the base Image extension
 * MUST NOT be registered alongside this one. Swap it in buildEditorExtensions().
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp|avif|svg\+xml)$/;
const IMAGE_UPLOAD_KEY = new PluginKey('imageUpload');

// ---------------------------------------------------------------------------
// Upload helper — exported for slash command '/image' picker path
// ---------------------------------------------------------------------------

export interface SanityUploadResult {
  assetId: string;
  url: string;
}

/**
 * Uploads a single image file to Sanity Assets via the hub route handler.
 *
 * @throws Error with message when the server returns a non-2xx status.
 *
 * @example
 * const { url } = await uploadImageFile(file);
 * editor.chain().focus().setImage({ src: url }).run();
 */
export async function uploadImageFile(file: File): Promise<SanityUploadResult> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Imagem muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máximo 8MB)`);
  }
  if (!ALLOWED_MIME.test(file.type)) {
    throw new Error(`Tipo de arquivo não suportado: ${file.type}`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/sanity/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Upload falhou: ${res.status}`);
  }

  const data = (await res.json()) as SanityUploadResult;
  return data;
}

// ---------------------------------------------------------------------------
// Insert image node helper
// ---------------------------------------------------------------------------

function insertImageNode(
  view: EditorView,
  src: string,
  filename: string,
  assetId: string,
): void {
  const { schema, tr } = view.state;
  const imageNode = schema.nodes.image;
  if (!imageNode) return;

  const node = imageNode.create({
    src,
    alt: filename,
    'data-sanity-ref': assetId,
  });

  const transaction = tr.replaceSelectionWith(node);
  view.dispatch(transaction);
}

// ---------------------------------------------------------------------------
// File processing (shared by paste and drop handlers)
// ---------------------------------------------------------------------------

async function processImageFile(file: File, view: EditorView): Promise<void> {
  const toastId = toast.loading(`Enviando ${file.name}…`);
  try {
    const { assetId, url } = await uploadImageFile(file);
    insertImageNode(view, url, file.name, assetId);
    toast.success('Imagem enviada', { id: toastId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    toast.error(`Erro: ${message}`, { id: toastId });
  }
}

function extractImageFromDataTransfer(dt: DataTransfer): File | null {
  for (const file of Array.from(dt.files)) {
    if (ALLOWED_MIME.test(file.type)) return file;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ProseMirror plugins
// ---------------------------------------------------------------------------

function buildPastePlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('imageUploadPaste'),
    props: {
      handleDOMEvents: {
        paste(view, event) {
          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          const file = extractImageFromDataTransfer(clipboardData);
          if (!file) return false;

          event.preventDefault();
          void processImageFile(file, view);
          return true;
        },
      },
    },
  });
}

function buildDropPlugin(): Plugin {
  return new Plugin({
    key: IMAGE_UPLOAD_KEY,
    props: {
      handleDOMEvents: {
        dragover(view, event) {
          if (!event.dataTransfer?.types.includes('Files')) return false;
          event.preventDefault();
          return false;
        },

        drop(view, event) {
          const dt = event.dataTransfer;
          if (!dt) return false;

          const file = extractImageFromDataTransfer(dt);
          if (!file) return false;

          event.preventDefault();

          // Position the cursor at the drop point before inserting
          const { schema } = view.state;
          const coordPos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (coordPos) {
            const resolvedPos = view.state.doc.resolve(coordPos.pos);
            const tr = view.state.tr.setSelection(
              schema.nodes.doc
                ? view.state.selection
                : view.state.selection,
            );
            // Move selection to drop point using a simple transaction
            const dropTr = view.state.tr.setSelection(
              // @ts-expect-error — TextSelection static create
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              view.state.selection.constructor.create(view.state.doc, resolvedPos.pos),
            );
            view.dispatch(dropTr);
            void tr; // avoid unused warning
          }

          void processImageFile(file, view);
          return true;
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * Tiptap Extension that adds paste/drop image upload behaviour.
 * MUST be registered AFTER the base Image extension in the extension list.
 *
 * Does NOT replace the Image extension — it augments it with upload plugins.
 */
export const ImageUploadExtension = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    return [buildPastePlugin(), buildDropPlugin()];
  },
});

/**
 * Returns the image upload extension array for merging into buildEditorExtensions().
 *
 * @example
 * extensions: [...buildEditorExtensions(), ...buildImageUploadExtension()],
 */
export function buildImageUploadExtension(): Extension[] {
  return [ImageUploadExtension];
}

// ---------------------------------------------------------------------------
// Native file picker helper (for slash command '/image')
// ---------------------------------------------------------------------------

/**
 * Opens a native file picker restricted to image MIME types and calls
 * uploadImageFile on the selected file.
 *
 * Dispatches 'editor:image-inserted' so editor-body can update state.
 *
 * @example
 * window.addEventListener('editor:open-image-picker', openImagePicker(editor));
 */
export function openImageFilePicker(
  view: EditorView,
): () => void {
  return () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await processImageFile(file, view);
    };
    input.click();
  };
}

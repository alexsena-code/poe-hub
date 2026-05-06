'use client';
/**
 * Image upload extension for the PoE blog editor.
 *
 * Intercepts three upload paths:
 * 1. Paste with image in clipboard (Ctrl+V).
 * 2. OS drag-and-drop of an image file onto the editor.
 * 3. Slash command '/image' / toolbar button → file picker → uploadImageFile().
 *
 * Pipeline (paste/drop/picker):
 *   validate → decode dimensions → clamp longest side to 1920px →
 *   re-encode as WebP @ 0.85 (skipping GIF/WebP) → POST /api/sanity/upload →
 *   insert Tiptap image node with src, data-sanity-ref, width, height.
 *
 * On any failure: sonner toast with the failure reason; the original file is
 * sent to the upload route as a last-resort fallback so an upload never fails
 * just because the canvas pipeline glitched.
 *
 * Extends the base @tiptap/extension-image — meaning the base Image extension
 * MUST stay registered and have width/height/data-sanity-ref attrs declared
 * (see use-tiptap-editor.ts).
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
// Mirror the backend whitelist in app/api/sanity/upload/route.ts. SVG is
// excluded on purpose — embedded <script> tags are an XSS vector. AVIF was
// dropped to keep frontend and backend in sync.
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/;
const IMAGE_UPLOAD_KEY = new PluginKey('imageUpload');

/** Longest-side clamp for the WebP re-encode. 1920px covers 1080p and 4K-ish. */
const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.85;
/** GIF preserves animation, WebP is already optimal — skip the re-encode. */
const SKIP_CONVERSION_MIME = new Set(['image/gif', 'image/webp']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SanityUploadResult {
  assetId: string;
  url: string;
}

/**
 * Validates and uploads a single image file as-is — NO conversion.
 *
 * Kept as the simple/test-friendly entry point. The paste/drop/picker paths
 * use the richer processImageFile() which adds WebP conversion + dimension
 * capture on top of this.
 *
 * @throws Error with message when validation or the server call fails.
 *
 * @example
 * const { url } = await uploadImageFile(file);
 * editor.chain().focus().setImage({ src: url }).run();
 */
export async function uploadImageFile(file: File): Promise<SanityUploadResult> {
  validateOriginalFile(file);
  return uploadBlob(file, file.name);
}

// ---------------------------------------------------------------------------
// Validation + raw upload
// ---------------------------------------------------------------------------

function validateOriginalFile(file: File): void {
  if (file.size > MAX_BYTES) {
    throw new Error(`Imagem muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máximo 8MB)`);
  }
  if (!ALLOWED_MIME.test(file.type)) {
    throw new Error(`Tipo de arquivo não suportado: ${file.type}`);
  }
}

async function uploadBlob(blob: Blob, filename: string): Promise<SanityUploadResult> {
  const formData = new FormData();
  formData.append('file', blob, filename);

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

  return (await res.json()) as SanityUploadResult;
}

// ---------------------------------------------------------------------------
// Dimension capture + WebP conversion
// ---------------------------------------------------------------------------

interface DecodedImage {
  width: number;
  height: number;
  bitmap: HTMLImageElement;
  objectUrl: string;
}

/**
 * Decode an image File via an off-DOM HTMLImageElement so we can read its
 * intrinsic dimensions and reuse the bitmap for canvas re-encoding.
 *
 * The caller is responsible for calling URL.revokeObjectURL(objectUrl) once
 * the bitmap is no longer needed.
 */
function decodeImage(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`não foi possível ler dimensões de ${file.name}`));
        return;
      }
      resolve({ width, height, bitmap: img, objectUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`falha ao decodificar ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/** Encodes the given bitmap to a WebP Blob. Resolves null on canvas failure. */
function encodeAsWebp(
  bitmap: HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY);
  });
}

interface PreparedImage {
  blob: Blob;
  filename: string;
  contentType: string;
  /** Natural width AFTER any clamp/re-encode. 0 when decoding failed. */
  width: number;
  height: number;
  /** True when the WebP re-encode actually ran. */
  converted: boolean;
}

/**
 * Run the full client-side pipeline on a validated image file:
 * decode → clamp longest side to MAX_DIMENSION → encode WebP @ 0.85.
 *
 * Returns a PreparedImage ready for uploadBlob(). Falls back to the original
 * file on any decode/encode failure so the upload itself never blocks.
 */
async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
  } catch {
    return { blob: file, filename: file.name, contentType: file.type, width: 0, height: 0, converted: false };
  }

  // GIF (animated) / WebP (optimal) — keep as-is, just expose dims.
  if (SKIP_CONVERSION_MIME.has(file.type)) {
    URL.revokeObjectURL(decoded.objectUrl);
    return {
      blob: file,
      filename: file.name,
      contentType: file.type,
      width: decoded.width,
      height: decoded.height,
      converted: false,
    };
  }

  const { targetW, targetH } = clampDimensions(decoded.width, decoded.height);
  const webp = await encodeAsWebp(decoded.bitmap, targetW, targetH).catch(() => null);
  URL.revokeObjectURL(decoded.objectUrl);

  if (!webp || webp.size === 0) {
    return {
      blob: file,
      filename: file.name,
      contentType: file.type,
      width: decoded.width,
      height: decoded.height,
      converted: false,
    };
  }

  const stem = file.name.replace(/\.[a-zA-Z0-9]+$/, '');
  return {
    blob: webp,
    filename: `${stem}.webp`,
    contentType: 'image/webp',
    width: targetW,
    height: targetH,
    converted: true,
  };
}

/**
 * Scale (width, height) so the longest side is at most MAX_DIMENSION while
 * preserving the aspect ratio. Returns the input unchanged when no clamp is
 * needed. Exported for unit testing.
 */
export function clampDimensions(
  width: number,
  height: number,
): { targetW: number; targetH: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) return { targetW: width, targetH: height };
  const scale = MAX_DIMENSION / longest;
  return {
    targetW: Math.max(1, Math.round(width * scale)),
    targetH: Math.max(1, Math.round(height * scale)),
  };
}

// ---------------------------------------------------------------------------
// Insert image node helper
// ---------------------------------------------------------------------------

interface InsertImageOptions {
  src: string;
  filename: string;
  assetId: string;
  width?: number;
  height?: number;
}

function insertImageNode(view: EditorView, opts: InsertImageOptions): void {
  const { schema, tr } = view.state;
  const imageNode = schema.nodes.image;
  if (!imageNode) return;

  const attrs: Record<string, unknown> = {
    src: opts.src,
    alt: opts.filename,
    'data-sanity-ref': opts.assetId,
  };
  if (opts.width && opts.width > 0) attrs.width = opts.width;
  if (opts.height && opts.height > 0) attrs.height = opts.height;

  const node = imageNode.create(attrs);
  view.dispatch(tr.replaceSelectionWith(node));
}

// ---------------------------------------------------------------------------
// File processing (shared by paste/drop/picker)
// ---------------------------------------------------------------------------

async function processImageFile(file: File, view: EditorView): Promise<void> {
  const toastId = toast.loading(`Enviando ${file.name}…`);
  try {
    validateOriginalFile(file);
    const prepared = await prepareImageForUpload(file);
    const { assetId, url } = await uploadBlob(prepared.blob, prepared.filename);
    insertImageNode(view, {
      src: url,
      filename: prepared.filename,
      assetId,
      width: prepared.width || undefined,
      height: prepared.height || undefined,
    });
    const note = prepared.converted ? ' (convertida para WebP)' : '';
    toast.success(`Imagem enviada${note}`, { id: toastId });
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

          // Move the caret to the drop point so the image lands where the
          // operator released it, not at the previous selection. posAtCoords
          // returns null when the drop is outside an editable region — in
          // that case, fall back to inserting at the current selection.
          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (coords) {
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, coords.pos),
            );
            view.dispatch(tr);
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
// Native file picker helper (for slash command '/image' + toolbar button)
// ---------------------------------------------------------------------------

/**
 * Opens a native file picker restricted to image MIME types and runs the
 * full processImageFile() pipeline (validation + WebP convert + upload +
 * Tiptap node insert) on the selected file.
 *
 * @example
 * window.addEventListener('editor:open-image-picker', openImageFilePicker(view));
 */
export function openImageFilePicker(view: EditorView): () => void {
  return () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await processImageFile(file, view);
    };
    input.click();
  };
}

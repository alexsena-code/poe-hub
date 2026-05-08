// @vitest-environment jsdom
/**
 * Tests for the image upload extension and helpers.
 *
 * Validates:
 * 1. uploadImageFile calls fetch with multipart FormData on valid input.
 * 2. Files exceeding 8MB are rejected before any fetch call.
 * 3. Non-image MIME types are rejected before any fetch call.
 * 4. Server 413/500 errors produce descriptive Error messages.
 * 5. ImageUploadExtension registers without errors.
 * 6. buildImageUploadExtension() returns the extension array.
 *
 * fetch is mocked via vi.stubGlobal — no real HTTP calls made.
 * Toast is mocked to avoid sonner DOM dependencies in jsdom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sonner before any module that imports it
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => 'mock-toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeFile(name: string, type: string, sizeBytes: number): File {
  // Construct a File with the given size (content is repeated zeros)
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

function mockFetchSuccess(assetId = 'img-123', url = 'https://cdn.sanity.io/img.jpg') {
  const mockFetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ assetId, url }),
  } as unknown as Response);
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

function mockFetchError(status: number, errorMessage: string) {
  const mockFetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    statusText: `Error ${status}`,
    json: async () => ({ error: errorMessage }),
  } as unknown as Response);
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadImageFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with POST to /api/sanity/upload for a valid JPEG', async () => {
    const { uploadImageFile } = await import('../image-upload');
    const mockFetch = mockFetchSuccess();
    const file = makeFakeFile('photo.jpg', 'image/jpeg', 100 * 1024); // 100KB

    const result = await uploadImageFile(file);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sanity/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(result.assetId).toBe('img-123');
    expect(result.url).toBe('https://cdn.sanity.io/img.jpg');
  });

  it('rejects files larger than 8MB without calling fetch', async () => {
    const { uploadImageFile } = await import('../image-upload');
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const bigFile = makeFakeFile('huge.png', 'image/png', 9 * 1024 * 1024); // 9MB

    await expect(uploadImageFile(bigFile)).rejects.toThrow(/muito grande/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects non-image MIME types without calling fetch', async () => {
    const { uploadImageFile } = await import('../image-upload');
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const pdfFile = makeFakeFile('document.pdf', 'application/pdf', 1024);

    await expect(uploadImageFile(pdfFile)).rejects.toThrow(/não suportado/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws descriptive error on server 413 response', async () => {
    const { uploadImageFile } = await import('../image-upload');
    mockFetchError(413, 'Payload Too Large');

    const file = makeFakeFile('medium.jpg', 'image/jpeg', 5 * 1024 * 1024);

    await expect(uploadImageFile(file)).rejects.toThrow('Payload Too Large');
  });

  it('throws descriptive error on server 500 with error field', async () => {
    const { uploadImageFile } = await import('../image-upload');
    mockFetchError(500, 'Sanity write token invalid');

    const file = makeFakeFile('photo.webp', 'image/webp', 1024);

    await expect(uploadImageFile(file)).rejects.toThrow('Sanity write token invalid');
  });

  it('accepts the four MIME types in the backend whitelist', async () => {
    const { uploadImageFile } = await import('../image-upload');

    for (const mime of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      const mockFetch = mockFetchSuccess(`asset-${mime}`, `https://cdn.sanity.io/${mime}.img`);
      const file = makeFakeFile(`img.${mime.split('/')[1]}`, mime, 512 * 1024);
      const result = await uploadImageFile(file);
      expect(result.assetId).toBe(`asset-${mime}`);
      expect(mockFetch).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
    }
  });

  // SVG carries XSS risk (embedded <script>) and AVIF is not in the backend
  // whitelist (app/api/sanity/upload/route.ts). Reject both client-side so the
  // operator gets immediate feedback instead of a 400 from the server.
  it('rejects avif and svg without calling fetch', async () => {
    const { uploadImageFile } = await import('../image-upload');
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    for (const mime of ['image/avif', 'image/svg+xml']) {
      const file = makeFakeFile(`bad.${mime.split('/')[1]}`, mime, 100 * 1024);
      await expect(uploadImageFile(file)).rejects.toThrow(/não suportado/);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects exactly 8MB + 1 byte file', async () => {
    const { uploadImageFile } = await import('../image-upload');
    vi.stubGlobal('fetch', vi.fn());

    const overLimit = makeFakeFile('borderline.png', 'image/png', 8 * 1024 * 1024 + 1);
    await expect(uploadImageFile(overLimit)).rejects.toThrow(/muito grande/);
  });

  it('accepts exactly 8MB file (boundary inclusive check)', async () => {
    const { uploadImageFile } = await import('../image-upload');
    mockFetchSuccess();

    const atLimit = makeFakeFile('exact.png', 'image/png', 8 * 1024 * 1024);
    // Should NOT throw — at the limit is allowed
    await expect(uploadImageFile(atLimit)).resolves.toBeDefined();
  });
});

describe('buildImageUploadExtension', () => {
  it('returns an array with the imageUpload extension', async () => {
    const { buildImageUploadExtension } = await import('../image-upload');
    const exts = buildImageUploadExtension();
    expect(Array.isArray(exts)).toBe(true);
    expect(exts.length).toBe(1);
    expect(exts[0].name).toBe('imageUpload');
  });
});

describe('insertImageNode (consecutive paste regression)', () => {
  // Reproduces the bug where Ctrl+V pasting multiple images one-by-one only
  // kept the last image — replaceSelectionWith leaves a NodeSelection on the
  // inserted block, and the next paste overwrites it. The fix moves the cursor
  // to a TextSelection past the node so consecutive inserts accumulate.
  it('inserts three images consecutively without overwriting prior ones', async () => {
    const { Editor } = await import('@tiptap/core');
    const { StarterKit } = await import('@tiptap/starter-kit');
    const { Image } = await import('@tiptap/extension-image');
    const { insertImageNode } = await import('../image-upload');

    const editor = new Editor({
      extensions: [StarterKit, Image],
      element: document.createElement('div'),
    });

    const refs = ['asset-aaa', 'asset-bbb', 'asset-ccc'];
    for (const id of refs) {
      insertImageNode(editor.view, {
        src: `https://cdn.sanity.io/${id}.jpg`,
        filename: `${id}.jpg`,
        assetId: id,
      });
    }

    const imageNodes: { src: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') imageNodes.push({ src: node.attrs.src as string });
    });

    expect(imageNodes).toHaveLength(3);
    expect(imageNodes.map((n) => n.src)).toEqual(refs.map((id) => `https://cdn.sanity.io/${id}.jpg`));

    editor.destroy();
  });

  it('appends a paragraph when image is inserted at end of doc so cursor has somewhere to land', async () => {
    const { Editor } = await import('@tiptap/core');
    const { StarterKit } = await import('@tiptap/starter-kit');
    const { Image } = await import('@tiptap/extension-image');
    const { insertImageNode } = await import('../image-upload');

    const editor = new Editor({
      extensions: [StarterKit, Image],
      element: document.createElement('div'),
      content: '',
    });

    insertImageNode(editor.view, {
      src: 'https://cdn.sanity.io/x.jpg',
      filename: 'x.jpg',
      assetId: 'x',
    });

    // After insert, the last child of the doc should be the synthetic paragraph
    // — not the image — so the caret can sit there for the next paste.
    const lastChild = editor.state.doc.lastChild;
    expect(lastChild?.type.name).toBe('paragraph');

    editor.destroy();
  });
});

describe('clampDimensions', () => {
  it('passes through when both dimensions are below the cap', async () => {
    const { clampDimensions } = await import('../image-upload');
    expect(clampDimensions(800, 600)).toEqual({ targetW: 800, targetH: 600 });
  });

  it('passes through at exactly the cap boundary', async () => {
    const { clampDimensions } = await import('../image-upload');
    expect(clampDimensions(1920, 1080)).toEqual({ targetW: 1920, targetH: 1080 });
  });

  it('downscales a 4K landscape to fit the longest-side cap', async () => {
    const { clampDimensions } = await import('../image-upload');
    // 3840×2160 → longest 3840 → scale 0.5 → 1920×1080
    expect(clampDimensions(3840, 2160)).toEqual({ targetW: 1920, targetH: 1080 });
  });

  it('downscales tall portrait images by clamping the longest side', async () => {
    const { clampDimensions } = await import('../image-upload');
    // 1000×3000 → longest 3000 → scale 0.64 → 640×1920
    expect(clampDimensions(1000, 3000)).toEqual({ targetW: 640, targetH: 1920 });
  });

  it('rounds dimensions to integers and never returns zero', async () => {
    const { clampDimensions } = await import('../image-upload');
    // 1921×1 → scale 1920/1921 ≈ 0.9995 → 1920×1 (Math.max(1, round(0.9995)))
    const out = clampDimensions(1921, 1);
    expect(out.targetW).toBe(1920);
    expect(out.targetH).toBe(1);
    expect(Number.isInteger(out.targetW)).toBe(true);
    expect(Number.isInteger(out.targetH)).toBe(true);
  });
});

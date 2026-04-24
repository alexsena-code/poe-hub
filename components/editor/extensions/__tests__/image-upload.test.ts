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

  it('accepts webp and avif MIME types', async () => {
    const { uploadImageFile } = await import('../image-upload');

    for (const mime of ['image/webp', 'image/avif']) {
      const mockFetch = mockFetchSuccess(`asset-${mime}`, `https://cdn.sanity.io/${mime}.img`);
      const file = makeFakeFile(`img.${mime.split('/')[1]}`, mime, 512 * 1024);
      const result = await uploadImageFile(file);
      expect(result.assetId).toBe(`asset-${mime}`);
      expect(mockFetch).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
    }
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

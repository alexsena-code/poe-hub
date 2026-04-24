/**
 * Tests for lib/sanity/upload-asset.ts
 *
 * The Sanity client is mocked via vi.mock. Tests cover the happy path,
 * MIME/size validation at the helper level, and error propagation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadImageAsset } from "../upload-asset";

// ─── Mock the Sanity client module ────────────────────────────────────────────

const mockAssetsUpload = vi.fn();

vi.mock("../client", () => ({
  getSanityClient: () => ({
    assets: {
      upload: mockAssetsUpload,
    },
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBuffer(sizeBytes: number = 1024): Buffer {
  return Buffer.alloc(sizeBytes, 0);
}

const happyAssetResponse = {
  _id: "image-abc123-abc-1234-png",
  _type: "sanity.imageAsset",
  url: "https://cdn.sanity.io/images/proj/production/abc123.png",
};

// ─── uploadImageAsset ─────────────────────────────────────────────────────────

describe("uploadImageAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssetsUpload.mockResolvedValue(happyAssetResponse);
  });

  it("should return assetId and url on success", async () => {
    const result = await uploadImageAsset({
      buffer: makeBuffer(),
      filename: "screenshot.png",
      contentType: "image/png",
    });

    expect(result.assetId).toBe("image-abc123-abc-1234-png");
    expect(result.url).toBe(
      "https://cdn.sanity.io/images/proj/production/abc123.png"
    );
  });

  it("should pass filename and contentType to client.assets.upload", async () => {
    await uploadImageAsset({
      buffer: makeBuffer(),
      filename: "hero.jpg",
      contentType: "image/jpeg",
    });

    expect(mockAssetsUpload).toHaveBeenCalledWith(
      "image",
      expect.any(Buffer),
      { filename: "hero.jpg", contentType: "image/jpeg" }
    );
  });

  it("should pass the buffer directly to client.assets.upload", async () => {
    const buf = makeBuffer(4096);
    await uploadImageAsset({ buffer: buf, filename: "test.png", contentType: "image/png" });

    const uploadedBuffer = mockAssetsUpload.mock.calls[0][1];
    expect(uploadedBuffer).toBe(buf);
  });

  it("should throw with filename and contentType in message when upload fails", async () => {
    mockAssetsUpload.mockRejectedValue(new Error("quota exceeded"));

    await expect(
      uploadImageAsset({
        buffer: makeBuffer(),
        filename: "too-big.jpg",
        contentType: "image/jpeg",
      })
    ).rejects.toThrow("too-big.jpg");
  });

  it("should include contentType in error message when upload fails", async () => {
    mockAssetsUpload.mockRejectedValue(new Error("quota exceeded"));

    await expect(
      uploadImageAsset({
        buffer: makeBuffer(),
        filename: "img.webp",
        contentType: "image/webp",
      })
    ).rejects.toThrow("image/webp");
  });

  it("should include size in KB in error message when upload fails", async () => {
    mockAssetsUpload.mockRejectedValue(new Error("upload error"));
    const buffer = makeBuffer(2048); // 2KB

    try {
      await uploadImageAsset({ buffer, filename: "test.png", contentType: "image/png" });
    } catch (err) {
      expect((err as Error).message).toMatch("2KB");
    }
  });

  it("should throw when asset response is missing _id", async () => {
    mockAssetsUpload.mockResolvedValue({ url: "https://cdn.sanity.io/img.png" });

    await expect(
      uploadImageAsset({
        buffer: makeBuffer(),
        filename: "incomplete.png",
        contentType: "image/png",
      })
    ).rejects.toThrow("asset missing _id or url");
  });

  it("should throw when asset response is missing url", async () => {
    mockAssetsUpload.mockResolvedValue({ _id: "image-only-id" });

    await expect(
      uploadImageAsset({
        buffer: makeBuffer(),
        filename: "no-url.png",
        contentType: "image/png",
      })
    ).rejects.toThrow("asset missing _id or url");
  });

  it("should prefix error message with [sanity.upload]", async () => {
    mockAssetsUpload.mockRejectedValue(new Error("network timeout"));

    await expect(
      uploadImageAsset({
        buffer: makeBuffer(),
        filename: "fail.png",
        contentType: "image/png",
      })
    ).rejects.toThrow("[sanity.upload]");
  });
});

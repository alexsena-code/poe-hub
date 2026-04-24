import { getSanityClient } from "./client";

export interface UploadImageOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface UploadImageResult {
  assetId: string;
  url: string;
}

/**
 * Uploads an image buffer to Sanity Assets and returns the resulting
 * asset document ID and CDN URL.
 *
 * The Sanity client's `assets.upload()` returns a `SanityAssetDocument`.
 * We extract `_id` (the asset ref used in image fields) and `url`.
 *
 * Throws with filename, contentType, and size in the message if the
 * upload fails — makes it easy to debug without logging the buffer.
 *
 * Usage:
 *   const { assetId, url } = await uploadImageAsset({ buffer, filename, contentType });
 *   // Use assetId as: { _type: 'reference', _ref: assetId } in mainImage.asset
 */
export async function uploadImageAsset({
  buffer,
  filename,
  contentType,
}: UploadImageOptions): Promise<UploadImageResult> {
  const client = getSanityClient();
  const sizeKb = Math.round(buffer.length / 1024);

  let asset;
  try {
    asset = await client.assets.upload("image", buffer, {
      filename,
      contentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[sanity.upload] failed to upload image: filename=${filename} contentType=${contentType} size=${sizeKb}KB — ${message}`
    );
  }

  if (!asset._id || !asset.url) {
    throw new Error(
      `[sanity.upload] asset missing _id or url after upload: filename=${filename} contentType=${contentType} size=${sizeKb}KB`
    );
  }

  return {
    assetId: asset._id,
    url: asset.url,
  };
}

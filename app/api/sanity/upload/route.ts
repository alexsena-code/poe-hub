import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadImageAsset } from "@/lib/sanity/upload-asset";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/**
 * POST /api/sanity/upload
 *
 * Accepts a multipart/form-data body with a single `file` field.
 * Validates auth, MIME type, and file size before uploading to Sanity Assets.
 *
 * Returns: { assetId: string, url: string }
 * Errors: 401 | 400 (bad MIME or missing file) | 413 (too large) | 500
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reject early if Content-Length is already over limit (browsers always send it).
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large — max ${MAX_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid `file` field in form data" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported MIME type: ${file.type} (allowed: image/png, image/jpeg, image/webp, image/gif)`,
      },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large — max ${MAX_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await uploadImageAsset({
      buffer,
      filename: file.name,
      contentType: file.type,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.upload] POST /api/sanity/upload failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

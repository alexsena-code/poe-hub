/**
 * Legacy redirect — /workspace/editor/[postId] → /workspace/blog/[postId]/edit
 * Editor antigo removido em session 08 (S08.h).
 */
import { redirect } from "next/navigation";

export default async function LegacyEditorPage(
  props: { params: Promise<{ postId: string }> }
) {
  const { postId } = await props.params;
  redirect(`/workspace/blog/${postId}/edit`);
}

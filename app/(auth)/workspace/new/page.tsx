/**
 * Legacy redirect — /workspace/new → /workspace/blog/new
 * Editor antigo removido em session 08 (S08.h).
 */
import { redirect } from "next/navigation";

export default function LegacyNewPostPage() {
  redirect("/workspace/blog/new");
}

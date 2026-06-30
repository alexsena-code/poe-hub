import { redirect } from "next/navigation";

// Session 23 — /admin/observability foi fundida na /admin/runtime (tabs Logs/
// LLM/Analytics/Monitor). Redirect mantém bookmarks/links antigos funcionando.
export default function ObservabilityRedirect() {
  redirect("/admin/runtime");
}

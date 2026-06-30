import { redirect } from "next/navigation";

// Session 23 — /admin/operations foi fundida na /admin/runtime (tab "Operações").
// Redirect mantém bookmarks/links antigos funcionando.
export default function OperationsRedirect() {
  redirect("/admin/runtime");
}

import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { DomainListsEditor } from "@/components/admin/domain-lists/domain-lists-editor";
import type { ListType, DomainListsAll } from "@/components/admin/domain-lists/types";

const LIST_TYPES: ListType[] = ["off-topic", "social", "marketplace-rmt", "generic-news"];

async function fetchAllLists(): Promise<DomainListsAll> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const url = `${proto}://${host}/api/engine/seo/domain-lists`;

  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`domain-lists fetch failed: ${res.status} (${url})`);
  }
  const raw = (await res.json()) as Record<string, unknown>;

  const safe: DomainListsAll = {
    "off-topic": [],
    "social": [],
    "marketplace-rmt": [],
    "generic-news": [],
  };
  for (const lt of LIST_TYPES) {
    const value = raw?.[lt];
    if (Array.isArray(value)) safe[lt] = value.filter((v): v is string => typeof v === "string");
  }
  return safe;
}

export default async function DomainListsPage() {
  let initialLists: DomainListsAll;
  try {
    initialLists = await fetchAllLists();
  } catch (e) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          title="Listas de domínios"
          description="Off-topic / social / marketplace-rmt / generic-news"
          className="mb-6"
        />
        <div className="bg-surface border border-border rounded-lg p-4 text-sm text-destructive">
          Falha ao carregar listas: {(e as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title="Listas de domínios"
        description="Edita as 4 listas usadas pelos auto-actions do SearxNG (off-topic, social, marketplace-rmt, generic-news). Mudanças refletem imediatamente no engine sem PM2 restart."
        className="mb-2"
      />
      <DomainListsEditor initialLists={initialLists} />
    </div>
  );
}

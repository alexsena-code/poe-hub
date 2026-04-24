import { notFound } from "next/navigation";
import { fetchEngine } from "@/lib/fetch-engine";
import { GuideContent } from "./guide-content";
import type { PostDetail } from "@/lib/content-api";

// Session 04 S04.a — converted from client useEffect+useParams to RSC async.
// Slug comes from route params (Promise<{ slug: string }> in Next.js 15+).

interface RawSection {
  sectionId?: string;
  id?: string;
  title?: string;
  heading?: string;
  content: { "pt-br": string; en: string };
}

interface RawPost extends Omit<PostDetail, "sections"> {
  sections: RawSection[];
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: PostDetail;

  try {
    const raw = await fetchEngine<RawPost>(
      `/api/engine/content/posts/${encodeURIComponent(slug)}`
    );

    const sections = (raw.sections ?? []).map((s, i) => ({
      id: s.sectionId ?? s.id ?? String(i),
      heading: s.title ?? s.heading ?? "",
      content: s.content,
      order: i,
    }));

    post = { ...raw, sections };
  } catch (err) {
    const status = err instanceof Error ? err.message : "";
    // 404 from engine → Next not-found boundary
    if (status.includes("404")) notFound();

    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Post não encontrado.</p>
        <p className="text-xs text-muted-foreground mt-2">
          Erro: {err instanceof Error ? err.message : "desconhecido"}
        </p>
      </div>
    );
  }

  return <GuideContent post={post} />;
}

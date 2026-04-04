const CONTENT_API_URL =
  process.env.NEXT_PUBLIC_CONTENT_API_URL || "http://localhost:3000/api";

export interface PostSummary {
  slug: string;
  title: { "pt-br": string; en: string };
  template: string;
  status: string;
  generatedAt: string;
}

export interface PostSection {
  id: string;
  heading: string;
  content: { "pt-br": string; en: string };
  order: number;
}

interface RawSection {
  sectionId: string;
  title: string;
  content: { "pt-br": string; en: string };
  tokensUsed: number;
}

export interface PostMeta {
  title: { "pt-br": string; en: string };
  description: { "pt-br": string; en: string };
  ogTitle?: { "pt-br": string; en: string };
  ogDescription?: { "pt-br": string; en: string };
}

export interface PostDetail {
  slug: string;
  title: { "pt-br": string; en: string };
  template: string;
  status: string;
  generatedAt: string;
  sections: PostSection[];
  meta: PostMeta;
}

export async function fetchPosts(): Promise<PostSummary[]> {
  const res = await fetch(`${CONTENT_API_URL}/content/posts`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }

  return res.json();
}

export async function fetchPost(slug: string): Promise<PostDetail> {
  const res = await fetch(`${CONTENT_API_URL}/content/posts/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch post ${slug}: ${res.status}`);
  }

  const raw = await res.json();

  // Map raw section format (sectionId/title) to PostSection (id/heading/order)
  const sections: PostSection[] = (raw.sections || []).map(
    (s: RawSection, i: number) => ({
      id: s.sectionId,
      heading: s.title,
      content: s.content,
      order: i,
    })
  );

  return { ...raw, sections };
}

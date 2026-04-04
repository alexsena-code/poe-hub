import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchPost, fetchPosts } from "@/lib/content-api";
import { GuideContent } from "./guide-content";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await fetchPost(slug);
    const title = post.meta?.title?.en || post.title.en;
    const description =
      post.meta?.description?.en || `Read our guide: ${post.title.en}`;

    return {
      title: `${title} | Path of Trade`,
      description,
      openGraph: {
        title: post.meta?.ogTitle?.en || title,
        description: post.meta?.ogDescription?.en || description,
        type: "article",
      },
    };
  } catch {
    return {
      title: "Guide Not Found | Path of Trade",
    };
  }
}

export async function generateStaticParams() {
  try {
    const posts = await fetchPosts();
    return posts
      .filter((p) => p.status === "published")
      .map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;

  let post;
  try {
    post = await fetchPost(slug);
  } catch {
    notFound();
  }

  if (!post) {
    notFound();
  }

  return <GuideContent post={post} />;
}

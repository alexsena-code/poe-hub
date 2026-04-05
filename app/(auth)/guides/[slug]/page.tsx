'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GuideContent } from './guide-content';

const API = '/api/engine';

interface PostSection {
  id: string;
  heading: string;
  content: { 'pt-br': string; en: string };
  order: number;
}

interface PostMeta {
  title: { 'pt-br': string; en: string };
  description: { 'pt-br': string; en: string };
  ogTitle?: { 'pt-br': string; en: string };
  ogDescription?: { 'pt-br': string; en: string };
}

interface PostDetail {
  slug: string;
  title: { 'pt-br': string; en: string };
  template: string;
  status: string;
  generatedAt: string;
  sections: PostSection[];
  meta: PostMeta;
}

export default function GuidePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API}/content/posts/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const raw = await res.json();
        const sections = (raw.sections || []).map((s: any, i: number) => ({
          id: s.sectionId || s.id,
          heading: s.title || s.heading,
          content: s.content,
          order: i,
        }));
        setPost({ ...raw, sections });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Carregando...</div>;
  }

  if (error || !post) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Post nao encontrado.</p>
        <p className="text-xs text-muted-foreground mt-2">Erro: {error}</p>
      </div>
    );
  }

  return <GuideContent post={post} />;
}

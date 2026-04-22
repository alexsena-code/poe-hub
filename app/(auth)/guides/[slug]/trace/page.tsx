import TraceViewer from '@/components/engine/TraceViewer';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = {
  title: 'Trace — Content Engine',
};

export default async function GuideTracePage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/guides" className="hover:text-foreground underline">
          Guides
        </Link>
        <span>/</span>
        <Link href={`/guides/${slug}`} className="hover:text-foreground underline">
          {slug}
        </Link>
        <span>/</span>
        <span className="text-foreground">trace</span>
      </div>

      <TraceViewer slug={slug} />
    </div>
  );
}

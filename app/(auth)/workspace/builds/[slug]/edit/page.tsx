import { notFound } from "next/navigation";
import { getSanityClient } from "@/lib/sanity/client";
import { FETCH_BUILD_OVERVIEW_BY_SLUG_QUERY } from "@/lib/sanity/queries";
import type { BuildOverviewSanity } from "@/lib/sanity/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditBuildOverviewForm } from "./edit-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditBuildOverviewPage({ params }: PageProps) {
  const { slug } = await params;

  const client = getSanityClient();
  const doc: BuildOverviewSanity | null = await client.fetch(
    FETCH_BUILD_OVERVIEW_BY_SLUG_QUERY,
    { slug },
  );

  if (!doc) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspace/builds">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <PageHeader
            title={`Editando: ${slug}`}
            description="Adicione, remova e reordene as seções de conteúdo."
          />
        </div>
      </div>
      <EditBuildOverviewForm slug={slug} initialSections={doc.sections} />
    </div>
  );
}

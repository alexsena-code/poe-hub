import Link from "next/link";
import { getSanityClient } from "@/lib/sanity/client";
import {
  LIST_BUILD_OVERVIEWS_QUERY,
  type BuildOverviewListItem,
} from "@/lib/sanity/queries";
import { formatDateBr } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Sword } from "lucide-react";
import { CreateBuildOverviewDialog } from "./create-dialog";
import { DeleteBuildOverviewButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function BuildOverviewListPage() {
  const client = getSanityClient();
  const docs: BuildOverviewListItem[] = await client.fetch(
    LIST_BUILD_OVERVIEWS_QUERY,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build Overviews"
        description="Gerencie as seções de conteúdo das páginas de build."
        actions={<CreateBuildOverviewDialog />}
      />

      {docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Sword className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhum build overview encontrado.
            </p>
            <CreateBuildOverviewDialog />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Seções</th>
                  <th className="px-4 py-3">Atualizado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => (
                  <tr
                    key={doc._id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{doc.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {doc.sectionCount}{" "}
                        {doc.sectionCount === 1 ? "seção" : "seções"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDateBr(doc._updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/workspace/builds/${doc.slug}/edit`}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteBuildOverviewButton slug={doc.slug} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

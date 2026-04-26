"use client";

// Session 36 Phase O: Previous/Next pager para o /seo/posts-recommended.
// Lê a URL atual via `useSearchParams`, sobrescreve `offset` e empurra via
// `router.replace({ scroll: false })` pra SSR re-rodar sem perder posição.
// Filtros (game, suggestedAction, targetPosition, limit) são preservados —
// só `offset` muda. Filtros que mudam o set total devem zerar o offset
// dentro do filters bar (essa responsabilidade fica lá, não aqui).

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecommendationsPagerProps {
  total: number;
  limit: number;
  offset: number;
}

export function RecommendationsPager({
  total,
  limit,
  offset,
}: RecommendationsPagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  function goToOffset(nextOffset: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextOffset <= 0) next.delete("offset");
    else next.set("offset", String(nextOffset));
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <div className="text-xs text-muted-foreground">
        Página {currentPage} de {totalPages} · mostrando{" "}
        {Math.min(offset + 1, total)}–{Math.min(offset + limit, total)} de{" "}
        {total}
        {isPending && <span className="ml-2">atualizando…</span>}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev || isPending}
          onClick={() => goToOffset(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="h-3 w-3 mr-1" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext || isPending}
          onClick={() => goToOffset(offset + limit)}
        >
          Próxima
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

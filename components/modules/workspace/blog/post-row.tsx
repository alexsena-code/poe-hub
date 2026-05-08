"use client";
/**
 * Blog post list row — client component so drafts can carry a delete action.
 *
 * Extracted from `/workspace/blog/page.tsx` (RSC list) so the row can own
 * transient UI state (confirmation dialog, pending flag) without turning
 * the whole page into a client tree.
 */

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlogListRow {
  _id: string;
  title?: string;
  slug?: { current?: string };
  language?: string;
  _updatedAt?: string;
  publishedAt?: string;
}

interface PostRowProps {
  post: BlogListRow;
  isDraft: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateBR(isoString: string | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function bareId(id: string): string {
  return id.startsWith("drafts.") ? id.slice(7) : id;
}

function langBadgeVariant(lang: string | undefined): "default" | "secondary" | "outline" {
  if (lang === "pt-br") return "default";
  if (lang === "en") return "secondary";
  return "outline";
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export function PostRow({ post, isDraft }: PostRowProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  const id = bareId(post._id);
  const editHref = `/workspace/blog/${id}/edit`;
  const slug = post.slug?.current ?? "—";
  const lang = post.language ?? "?";
  const date = isDraft ? post._updatedAt : post.publishedAt;

  const deleteLabel = isDraft ? "rascunho" : "post publicado";

  function handleConfirmDelete() {
    startDeleting(async () => {
      try {
        const res = await fetch(`/api/sanity/draft/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string;
          };
          toast.error(`Falha ao deletar ${deleteLabel}`, {
            description: data.error ?? res.statusText,
          });
          return;
        }
        toast.success(`${isDraft ? "Rascunho" : "Post"} deletado`);
        setConfirmOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(`Erro ao deletar ${deleteLabel}`, {
          description: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center rounded-md transition-colors",
        "hover:bg-zinc-800/60",
      )}
    >
      <Link
        href={editHref}
        className="flex flex-1 items-start justify-between gap-4 px-3 py-2.5 text-sm min-w-0"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {post.title ?? "(sem título)"}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">/{slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={langBadgeVariant(lang)} className="text-[10px] uppercase">
            {lang}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateBR(date)}
          </span>
        </div>
      </Link>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          disabled={isDeleting}
          aria-label={`Deletar ${deleteLabel}`}
          className={cn(
            "mr-2 rounded-md p-1.5 text-muted-foreground transition-opacity",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-destructive/10 hover:text-destructive",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deletar {isDraft ? "rascunho" : "post publicado"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{post.title ?? "(sem título)"}&rdquo; será removido do Sanity
              {isDraft
                ? "."
                : " — incluindo a versão publicada e qualquer rascunho associado."}{" "}
              Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

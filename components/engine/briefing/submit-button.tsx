'use client';

import { Spinner } from "@/components/ui/spinner";

interface SubmitButtonProps {
  loading: boolean;
}

export function SubmitButton({ loading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-lg bg-accent px-8 text-sm font-semibold text-background shadow-lg shadow-accent/20 ring-1 ring-accent/40 transition-all hover:bg-accent-hover hover:shadow-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Spinner size="md" />
          <span>Gerando outline…</span>
        </>
      ) : (
        <>
          <span>Gerar outline</span>
          <span aria-hidden>→</span>
        </>
      )}
    </button>
  );
}

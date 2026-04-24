'use client';

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
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
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

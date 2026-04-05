import { type ReactNode } from 'react';

/* ── Page title ────────────────────────────────────── */
export function PageTitle({ children, description }: { children: ReactNode; description?: string }) {
  return (
    <div className="mb-8 pb-6 border-b border-border">
      <h1 className="text-2xl font-bold text-foreground tracking-tight">{children}</h1>
      {description && <p className="mt-2 text-sm text-muted-foregroundleading-relaxed max-w-2xl">{description}</p>}
    </div>
  );
}

/* ── Section heading ───────────────────────────────── */
export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="text-lg font-semibold text-foreground mt-10 mb-3 scroll-mt-20">{children}</h2>;
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return <h3 id={id} className="text-sm font-semibold text-foreground mt-6 mb-2 scroll-mt-20">{children}</h3>;
}

/* ── Paragraph ─────────────────────────────────────── */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foregroundleading-relaxed mb-4">{children}</p>;
}

/* ── Inline code ───────────────────────────────────── */
export function Code({ children }: { children: ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-surface text-[13px] font-mono text-foreground border border-border">{children}</code>;
}

/* ── Code block ────────────────────────────────────── */
export function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      {title && (
        <div className="px-4 py-2 bg-surface border-b border-border text-[11px] font-mono text-muted-foregrounduppercase tracking-wider">
          {title}
        </div>
      )}
      <pre className="p-4 bg-[#0d0d0d] text-[13px] font-mono text-muted-foregroundleading-relaxed overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

/* ── Callout ───────────────────────────────────────── */
const CALLOUT_STYLES = {
  info: { border: 'border-blue-500/30', bg: 'bg-blue-500/5', icon: 'i', iconBg: 'bg-blue-500/20 text-blue-400' },
  warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: '!', iconBg: 'bg-amber-500/20 text-amber-400' },
  tip: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', icon: '*', iconBg: 'bg-emerald-500/20 text-emerald-400' },
  danger: { border: 'border-red-500/30', bg: 'bg-red-500/5', icon: 'x', iconBg: 'bg-red-500/20 text-red-400' },
};

export function Callout({ type = 'info', title, children }: { type?: keyof typeof CALLOUT_STYLES; title?: string; children: ReactNode }) {
  const s = CALLOUT_STYLES[type];
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-4 mb-4 flex gap-3`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${s.iconBg}`}>
        {s.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <div className="text-sm font-semibold text-foreground mb-1">{title}</div>}
        <div className="text-sm text-muted-foregroundleading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ── Table ─────────────────────────────────────────── */
export function Table({ headers, rows }: { headers: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-surface/50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────── */
export function Steps({ children }: { children: ReactNode }) {
  return <div className="relative pl-8 mb-6 docs-steps">{children}</div>;
}

export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="relative pb-6 last:pb-0">
      {/* vertical line */}
      <div className="absolute -left-8 top-0 bottom-0 w-px bg-border" />
      {/* number circle */}
      <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-[11px] font-bold text-muted-foreground">
        {number}
      </div>
      <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
      <div className="text-sm text-muted-foregroundleading-relaxed">{children}</div>
    </div>
  );
}

/* ── Cards grid ────────────────────────────────────── */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">{children}</div>;
}

export function Card({ title, description, href }: { title: string; description: string; href?: string }) {
  const inner = (
    <div className="rounded-lg border border-border bg-surface p-4 hover:border-muted transition-colors h-full">
      <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
      <div className="text-xs text-muted-foregroundleading-relaxed">{description}</div>
    </div>
  );
  if (href) {
    return <a href={href} className="block no-underline">{inner}</a>;
  }
  return inner;
}

/* ── Badge ─────────────────────────────────────────── */
export function Badge({ children, color = 'default' }: { children: ReactNode; color?: 'green' | 'blue' | 'amber' | 'red' | 'default' }) {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/15 text-red-400 border-red-500/20',
    default: 'bg-foreground/5 text-muted-foregroundborder-border',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
}

/* ── Endpoint row (for API docs) ───────────────────── */
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  PATCH: 'bg-purple-500/20 text-purple-400',
  DELETE: 'bg-red-500/20 text-red-400',
};

export function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${METHOD_COLORS[method] || METHOD_COLORS.GET}`}>
        {method}
      </span>
      <div className="flex-1 min-w-0">
        <code className="text-[13px] font-mono text-foreground">{path}</code>
        <div className="text-xs text-muted-foregroundmt-0.5">{description}</div>
      </div>
    </div>
  );
}

export function EndpointGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-surface border-b border-border text-xs font-semibold text-foreground">{title}</div>
      <div className="px-4 divide-y divide-border">{children}</div>
    </div>
  );
}

/* ── Diagram (ASCII art box) ───────────────────────── */
export function Diagram({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-6">
      {title && (
        <div className="px-4 py-2 bg-surface border-b border-border text-[11px] font-semibold text-muted-foregrounduppercase tracking-wider">
          {title}
        </div>
      )}
      <pre className="p-5 bg-[#080808] text-[12px] font-mono text-emerald-400/80 leading-relaxed overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

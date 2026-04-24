'use client';

interface TemplateSectionTogglesProps {
  sections: Array<{ id: string; title: string }>;
  keptSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
  excludedCount: number;
}

// Section selector — opt out of template sections for this post.
// All sections start enabled; unchecking flows through to
// Briefing.excludedSections and the research node filters them
// out before write.
export function TemplateSectionToggles({
  sections,
  keptSections,
  toggleSection,
  excludedCount,
}: TemplateSectionTogglesProps) {
  if (sections.length === 0) return null;

  const activeCount = sections.length - excludedCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-muted-foreground">
          Seções do template
        </label>
        <span className="text-[10px] text-muted-foreground/70">
          {excludedCount === 0
            ? `${sections.length} seções — todas ativas`
            : `${activeCount}/${sections.length} ativas`}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-surface p-3 space-y-1.5">
        {sections.map((s) => {
          const kept = !!keptSections[s.id];
          return (
            <label
              key={s.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                kept ? 'hover:bg-background/50' : 'opacity-50 hover:opacity-75'
              }`}
            >
              <input
                type="checkbox"
                checked={kept}
                onChange={() => toggleSection(s.id)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-[11px] font-mono text-muted-foreground/70 w-32 truncate">
                {s.id}
              </span>
              <span
                className={`text-sm ${kept ? 'text-foreground' : 'text-muted-foreground line-through'}`}
              >
                {s.title}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

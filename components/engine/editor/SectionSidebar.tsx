'use client';

import { usePostStore } from '@/lib/engine-store';

const STATUS_CONFIG: Record<string, { dot: string; label: string; textColor: string }> = {
  pending: { dot: 'bg-zinc-500', label: 'Pendente', textColor: 'text-muted-foreground' },
  generating: { dot: 'bg-amber-400 animate-pulse', label: 'Gerando...', textColor: 'text-amber-400' },
  draft: { dot: 'bg-yellow-500', label: 'Rascunho', textColor: 'text-yellow-400' },
  reviewing: { dot: 'bg-orange-500', label: 'Em revisao', textColor: 'text-orange-400' },
  approved: { dot: 'bg-green-500', label: 'Aprovado', textColor: 'text-green-400' },
};

export default function SectionSidebar() {
  const { sections, activeSectionId, setActiveSection } = usePostStore();
  const approvedCount = sections.filter((s) => s.status === 'approved').length;

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-border bg-surface min-h-0">
      <div className="px-5 pt-5 pb-3 shrink-0">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Secoes
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const isActive = section.sectionId === activeSectionId;
            const config = STATUS_CONFIG[section.status] || STATUS_CONFIG.pending;

            return (
              <li key={section.sectionId}>
                <button
                  onClick={() => setActiveSection(section.sectionId)}
                  className={`group w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 ${
                    isActive
                      ? 'bg-background border-l-2 border-l-foreground/60 border border-border'
                      : 'border-l-2 border-l-transparent hover:bg-background/50 hover:border-l-foreground/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`}
                    />
                    <span className={`text-sm font-medium truncate ${
                      isActive ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
                    }`}>
                      {section.title}
                    </span>
                    {/* Needs-human badge: shows whenever the template marks
                        this section as requiring human input AND the author
                        hasn't submitted any opinion for it yet. Applies
                        regardless of draft status — a placeholder draft
                        doesn't count as input. */}
                    {section.requiresHumanInput &&
                      (section.humanMessages?.length ?? 0) === 0 && (
                        <span
                          title={section.humanInputGuidance || 'Esta seção precisa da sua opinião'}
                          className="ml-auto shrink-0 inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200"
                        >
                          <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                          Precisa você
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-[18px]">
                    <span className={`text-[11px] ${config.textColor}`}>{config.label}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar footer: progress summary */}
      <div className="px-5 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: sections.length > 0 ? `${(approvedCount / sections.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {approvedCount}/{sections.length}
          </span>
        </div>
      </div>
    </aside>
  );
}

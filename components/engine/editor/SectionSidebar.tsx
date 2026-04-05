'use client';

import { usePostStore } from '@/lib/engine-store';

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  pending: { dot: 'bg-gray-500', label: 'Pendente' },
  generating: { dot: 'bg-blue-500 animate-pulse-accent', label: 'Gerando...' },
  draft: { dot: 'bg-yellow-500', label: 'Rascunho' },
  reviewing: { dot: 'bg-orange-500', label: 'Em revisao' },
  approved: { dot: 'bg-green-500', label: 'Aprovado' },
};

export default function SectionSidebar() {
  const { sections, activeSectionId, setActiveSection } = usePostStore();

  return (
    <aside className="border-r border-border bg-surface overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
          Secoes
        </h2>
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const isActive = section.sectionId === activeSectionId;
            const style = STATUS_STYLES[section.status] || STATUS_STYLES.pending;

            return (
              <li key={section.sectionId}>
                <button
                  onClick={() => setActiveSection(section.sectionId)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-background border border-border'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                    />
                    <span className="text-sm font-medium truncate">
                      {section.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-4">
                    <span className="text-xs text-muted-foreground">{style.label}</span>
                    {section.requiresHumanInput && section.status === 'pending' && (
                      <span className="text-xs text-accent font-medium">
                        Opiniao recomendada
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

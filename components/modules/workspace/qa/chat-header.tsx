'use client';

import type { LanguagePref } from './types';

interface ChatHeaderProps {
  sidebarOpen: boolean;
  language: LanguagePref;
  onToggleSidebar: () => void;
  onChangeLanguage: (lang: LanguagePref) => void;
}

export function ChatHeader({
  sidebarOpen,
  language,
  onToggleSidebar,
  onChangeLanguage,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between h-12 px-6 border-b border-border shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <span className="text-sm font-medium text-foreground">Q&A Chat</span>
      </div>

      <div className="flex items-center gap-4">
        <LanguageToggle language={language} onChange={onChangeLanguage} />
        <span className="text-xs text-muted-foreground">RAG: 65K chunks + 213K PG rows</span>
      </div>
    </header>
  );
}

interface LanguageToggleProps {
  language: LanguagePref;
  onChange: (lang: LanguagePref) => void;
}

function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  const options: { value: LanguagePref; label: string; title: string }[] = [
    { value: 'pt', label: 'PT', title: 'Sempre responder em portugues' },
    { value: 'en', label: 'EN', title: 'Always answer in English' },
    { value: 'auto', label: 'Auto', title: 'Auto-detect language from question' },
  ];

  return (
    <div
      role="group"
      aria-label="Response language"
      className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={language === opt.value}
          title={opt.title}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            language === opt.value
              ? 'bg-foreground/15 text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

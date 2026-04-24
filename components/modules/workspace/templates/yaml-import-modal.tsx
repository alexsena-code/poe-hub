'use client';

/** Modal for pasting and importing a raw YAML template. */

import { Textarea } from '@/components/ui/textarea';

const YAML_PLACEHOLDER = `template:\n  name: My Guide\n  slug_pattern: my-guide-{topic}\n  target_length_words: 1500-2000\n\nsections:\n  - id: intro\n    title: Introduction\n    instruction: Write an introduction...\n    query_type: qa\n    rag_queries:\n      - "{topic} overview"\n\nseo:\n  primary_keyword: "{topic}"\n  schema_type: Article`;

interface YamlImportModalProps {
  yamlText: string;
  onYamlChange: (value: string) => void;
  onImport: () => void;
  onClose: () => void;
}

export function YamlImportModal({
  yamlText,
  onYamlChange,
  onImport,
  onClose,
}: YamlImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Import YAML Template</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <p className="text-xs text-muted-foreground mb-3">
            Paste a template YAML (same format as config/templates/*.yaml). It will be
            parsed and loaded into the editor.
          </p>
          <Textarea
            value={yamlText}
            onChange={(e) => onYamlChange(e.target.value)}
            placeholder={YAML_PLACEHOLDER}
            className="h-72 font-mono resize-none"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={!yamlText.trim()}
            className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            Parse &amp; Load
          </button>
        </div>
      </div>
    </div>
  );
}

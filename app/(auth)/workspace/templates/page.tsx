'use client';

import { useTemplatesState } from '@/components/modules/workspace/templates/use-templates-state';
import { TemplateSidebar } from '@/components/modules/workspace/templates/template-sidebar';
import { TemplateFields } from '@/components/modules/workspace/templates/template-fields';
import { TemplateActions } from '@/components/modules/workspace/templates/template-actions';
import { YamlImportModal } from '@/components/modules/workspace/templates/yaml-import-modal';

export default function TemplateManager() {
  const state = useTemplatesState();

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage content generation templates
            </p>
          </div>

          {/* Inline stat */}
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total
            </div>
            <div className="text-lg font-bold text-foreground">
              {state.templates.length}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => state.setShowYamlImport(true)}
              className="px-4 py-2 rounded-md text-sm border border-border text-foreground hover:bg-foreground/5 transition-colors"
            >
              Import YAML
            </button>
            <button
              onClick={state.handleNew}
              className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              + New Template
            </button>
          </div>
        </div>
      </div>

      {/* Content area — sidebar + editor */}
      <div className="flex flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
        <TemplateSidebar
          templates={state.templates}
          selected={state.selected}
          loading={state.loading}
          onSelect={state.selectTemplate}
        />

        {/* Main editor area */}
        <div className="flex-1 overflow-auto scrollbar-none">
          {!state.current ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Select a template or create a new one.
              </p>
            </div>
          ) : (
            <>
              <TemplateFields
                current={state.current}
                expandedSections={state.expandedSections}
                onTemplateChange={state.setCurrent}
                onSectionChange={state.updateSection}
                onSectionDelete={state.deleteSection}
                onSectionAdd={state.addSection}
                onSectionToggle={state.toggleSection}
              />
              <div className="max-w-3xl mx-auto px-6">
                <TemplateActions
                  saving={state.saving}
                  selected={state.selected}
                  confirmDelete={state.confirmDelete}
                  onSave={state.handleSave}
                  onDeleteRequest={() => state.setConfirmDelete(true)}
                  onDeleteConfirm={state.handleDelete}
                  onDeleteCancel={() => state.setConfirmDelete(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* YAML Import Modal */}
      {state.showYamlImport && (
        <YamlImportModal
          yamlText={state.yamlText}
          onYamlChange={state.setYamlText}
          onImport={state.handleImportYaml}
          onClose={() => state.setShowYamlImport(false)}
        />
      )}
    </div>
  );
}

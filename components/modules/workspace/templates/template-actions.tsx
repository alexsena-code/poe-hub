'use client';

/** Save / Delete action bar rendered below the template editor. */

interface TemplateActionsProps {
  saving: boolean;
  selected: string | null;
  confirmDelete: boolean;
  onSave: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

export function TemplateActions({
  saving,
  selected,
  confirmDelete,
  onSave,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: TemplateActionsProps) {
  return (
    <div className="flex items-center gap-3 pb-8">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-5 py-2.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Template'}
      </button>

      {selected && (
        <>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">
                Delete &quot;{selected}&quot;?
              </span>
              <button
                onClick={onDeleteConfirm}
                className="px-3 py-1.5 rounded-md text-xs bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={onDeleteCancel}
                className="px-3 py-1.5 rounded-md text-xs bg-surface-hover hover:bg-border text-muted-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onDeleteRequest}
              className="px-4 py-2.5 rounded-lg text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
            >
              Delete Template
            </button>
          )}
        </>
      )}
    </div>
  );
}

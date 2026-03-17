import {
  type DisplayPropertyKey,
  type WorkspaceViewDisplay,
  DISPLAY_PROPERTY_KEYS,
  DISPLAY_PROPERTY_LABELS,
} from "../../types/workspaceViewDisplay";

export interface WorkspaceViewsDisplayPanelProps {
  display: WorkspaceViewDisplay;
  onDisplayChange: (
    updater: (prev: WorkspaceViewDisplay) => WorkspaceViewDisplay,
  ) => void;
}

export function WorkspaceViewsDisplayPanel({
  display,
  onDisplayChange,
}: WorkspaceViewsDisplayPanelProps) {
  const toggleProperty = (key: DisplayPropertyKey) => {
    onDisplayChange((prev) => ({
      ...prev,
      properties: prev.properties.includes(key)
        ? prev.properties.filter((k) => k !== key)
        : [...prev.properties, key],
    }));
  };

  return (
    <div className="flex flex-col">
      <div className="border-b border-(--border-subtle) bg-(--bg-surface-1) p-3">
        <p className="text-xs font-medium text-(--txt-secondary)">
          Display Properties
        </p>
      </div>
      <div className="flex flex-1 flex-wrap gap-2 p-3">
        {DISPLAY_PROPERTY_KEYS.map((key) => {
          const selected = display.properties.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleProperty(key)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? "border-transparent bg-(--brand-default) text-white"
                  : "border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-secondary) hover:bg-(--bg-layer-2)"
              }`}
            >
              {DISPLAY_PROPERTY_LABELS[key]}
            </button>
          );
        })}
      </div>
      <div className="border-t border-(--border-subtle) p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-(--txt-primary)">
          <input
            type="checkbox"
            checked={display.showSubWorkItems}
            onChange={(e) =>
              onDisplayChange((prev) => ({
                ...prev,
                showSubWorkItems: e.target.checked,
              }))
            }
            className="rounded border-(--border-subtle)"
          />
          <span>Show sub-work items</span>
        </label>
      </div>
    </div>
  );
}

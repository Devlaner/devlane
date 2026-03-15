import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Dropdown } from "../work-item";
import {
  type DisplayPropertyKey,
  DISPLAY_PROPERTY_KEYS,
  DISPLAY_PROPERTY_LABELS,
  parseWorkspaceViewDisplayFromSearchParams,
  workspaceViewDisplayToSearchParams,
} from "../../types/workspaceViewDisplay";

const IconLayoutGrid = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

export interface WorkspaceViewsDisplayDropdownProps {
  openId: string | null;
  onOpen: (id: string | null) => void;
}

export function WorkspaceViewsDisplayDropdown({
  openId,
  onOpen,
}: WorkspaceViewsDisplayDropdownProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const display = parseWorkspaceViewDisplayFromSearchParams(searchParams);

  const updateDisplay = useCallback(
    (
      updater: (
        prev: ReturnType<typeof parseWorkspaceViewDisplayFromSearchParams>,
      ) => ReturnType<typeof parseWorkspaceViewDisplayFromSearchParams>,
    ) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const nextDisplay = updater(
          parseWorkspaceViewDisplayFromSearchParams(prev),
        );
        const params = workspaceViewDisplayToSearchParams(nextDisplay);
        ["display", "show_sub", "layout"].forEach((k) => {
          if (params[k]) next.set(k, params[k]);
          else next.delete(k);
        });
        return next;
      });
    },
    [setSearchParams],
  );

  const toggleProperty = (key: DisplayPropertyKey) => {
    updateDisplay((prev) => ({
      ...prev,
      properties: prev.properties.includes(key)
        ? prev.properties.filter((k) => k !== key)
        : [...prev.properties, key],
    }));
  };

  return (
    <Dropdown
      id="workspace-views-display"
      openId={openId}
      onOpen={onOpen}
      label="Display"
      icon={<IconLayoutGrid />}
      displayValue="Display"
      panelClassName="flex min-w-[280px] max-w-[320px] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
      align="right"
    >
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-3">
        <p className="text-xs font-medium text-[var(--txt-secondary)]">
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
                  ? "border-transparent bg-[var(--brand-default)] text-white"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-1)] text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2)]"
              }`}
            >
              {DISPLAY_PROPERTY_LABELS[key]}
            </button>
          );
        })}
      </div>
      <div className="border-t border-[var(--border-subtle)] p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--txt-primary)]">
          <input
            type="checkbox"
            checked={display.showSubWorkItems}
            onChange={(e) =>
              updateDisplay((prev) => ({
                ...prev,
                showSubWorkItems: e.target.checked,
              }))
            }
            className="rounded border-[var(--border-subtle)]"
          />
          <span>Show sub-work items</span>
        </label>
      </div>
    </Dropdown>
  );
}

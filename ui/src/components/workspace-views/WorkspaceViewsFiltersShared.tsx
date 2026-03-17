import type { ReactNode } from "react";
import { FILTER_ICONS } from "./WorkspaceViewsFiltersData";

export interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  open: controlledOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border-b border-(--border-subtle) last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
      >
        {title}
        <span className="text-(--txt-icon-tertiary)">
          {controlledOpen ? (
            <FILTER_ICONS.chevronUp />
          ) : (
            <FILTER_ICONS.chevronDown />
          )}
        </span>
      </button>
      {controlledOpen && <div className="pb-1">{children}</div>}
    </div>
  );
}

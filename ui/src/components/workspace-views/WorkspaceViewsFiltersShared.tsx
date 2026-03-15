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
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
      >
        {title}
        <span className="text-[var(--txt-icon-tertiary)]">
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

import { useParams } from "react-router-dom";
import { Dropdown } from "../work-item";
import { useWorkspaceViewsState } from "../../contexts/WorkspaceViewsStateContext";
import { FILTER_ICONS } from "./WorkspaceViewsFiltersShared";
import { WorkspaceViewsFiltersPanel } from "./WorkspaceViewsFiltersPanel";

export interface WorkspaceViewsFiltersDropdownProps {
  openId: string | null;
  onOpen: (id: string | null) => void;
}

export function WorkspaceViewsFiltersDropdown({
  openId,
  onOpen,
}: WorkspaceViewsFiltersDropdownProps) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { filters, setFilters } = useWorkspaceViewsState();

  if (!workspaceSlug) return null;

  return (
    <Dropdown
      id="workspace-views-filters"
      openId={openId}
      onOpen={onOpen}
      label="Filters"
      icon={<FILTER_ICONS.filter />}
      displayValue="Filters"
      panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
      align="right"
    >
      <WorkspaceViewsFiltersPanel
        filters={filters}
        onFiltersChange={setFilters}
        workspaceSlug={workspaceSlug}
        onCloseParent={() => onOpen(null)}
        compact
      />
    </Dropdown>
  );
}

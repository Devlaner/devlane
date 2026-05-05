import { useParams } from 'react-router-dom';
import { Dropdown } from '../work-item';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import { FILTER_ICONS } from './WorkspaceViewsFiltersData';
import { WorkspaceViewsFiltersPanel } from './WorkspaceViewsFiltersPanel';

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
      panelClassName="flex w-[min(280px,calc(100vw-2rem))] max-h-[min(52vh,22rem)] flex-col overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
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

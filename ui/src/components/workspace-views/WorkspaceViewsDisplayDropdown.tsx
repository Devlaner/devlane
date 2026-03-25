import { Dropdown } from '../work-item';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import { WorkspaceViewsDisplayPanel } from './WorkspaceViewsDisplayPanel';

const IconSliders = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
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
  const { display, setDisplay } = useWorkspaceViewsState();

  return (
    <Dropdown
      id="workspace-views-display"
      openId={openId}
      onOpen={onOpen}
      label="Display"
      icon={<IconSliders />}
      displayValue="Display"
      panelClassName="flex min-w-[280px] max-w-[320px] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
      align="right"
    >
      <WorkspaceViewsDisplayPanel display={display} onDisplayChange={setDisplay} />
    </Dropdown>
  );
}

import { Dropdown } from "../work-item";
import { useWorkspaceViewsState } from "../../contexts/WorkspaceViewsStateContext";
import { WorkspaceViewsDisplayPanel } from "./WorkspaceViewsDisplayPanel";

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
  const { display, setDisplay } = useWorkspaceViewsState();

  return (
    <Dropdown
      id="workspace-views-display"
      openId={openId}
      onOpen={onOpen}
      label="Display"
      icon={<IconLayoutGrid />}
      displayValue="Display"
      panelClassName="flex min-w-[280px] max-w-[320px] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
      align="right"
    >
      <WorkspaceViewsDisplayPanel
        display={display}
        onDisplayChange={setDisplay}
      />
    </Dropdown>
  );
}

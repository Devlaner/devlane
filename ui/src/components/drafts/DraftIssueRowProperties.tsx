import { useRef } from 'react';
import { Dropdown } from '../work-item/Dropdown';
import { Avatar } from '../ui';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';
import type { StateGroup } from '../../types/workspaceViewFilters';
import {
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
} from '../workspace-views/WorkspaceViewsFiltersData';
import { findWorkspaceMemberByUserId, getImageUrl } from '../../lib/utils';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];

/** Plane-style start date: calendar + clock accent (simplified). */
function IconStartDateProperty() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      <rect
        x="2.25"
        y="2.75"
        width="11.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path d="M2.25 6.25h11.5" stroke="currentColor" strokeWidth="1.15" />
      <circle cx="11.25" cy="10.75" r="2.15" stroke="currentColor" strokeWidth="1" />
      <path
        d="M11.25 9.4v1.35l.75.55"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDueDateProperty() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      <rect
        x="2.25"
        y="2.75"
        width="11.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path d="M2.25 6.25h11.5" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M7.15 9.35 8.4 10.6l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const IconChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="shrink-0 text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconCircleSlash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

const IconTag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);

const IconUser = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

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

const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconMoreHorizontal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
);

function stateGroupIcon(group: string | undefined) {
  const g = (group ?? 'backlog').toLowerCase() as StateGroup;
  return STATE_GROUP_ICONS[g] ?? STATE_GROUP_ICONS.backlog;
}

const propBtnSquare =
  'relative flex size-7 shrink-0 items-center justify-center rounded border border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) disabled:pointer-events-none disabled:opacity-40';

export interface DraftIssueRowPropertiesProps {
  issue: IssueApiResponse;
  project: ProjectApiResponse | undefined;
  states: StateApiResponse[];
  labels: LabelApiResponse[];
  modules: ModuleApiResponse[];
  members: WorkspaceMemberApiResponse[];
  busy: boolean;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  onPatch: (issue: IssueApiResponse, payload: Record<string, unknown>) => Promise<void>;
  onModuleChange: (issue: IssueApiResponse, moduleId: string | null) => Promise<void>;
  onToggleRowMenu: () => void;
  rowMenuOpen: boolean;
  onPublish: () => void;
  onDelete: () => void;
}

export function DraftIssueRowProperties({
  issue,
  project,
  states,
  labels,
  modules,
  members,
  busy,
  openDropdownId,
  setOpenDropdownId,
  onPatch,
  onModuleChange,
  onToggleRowMenu,
  rowMenuOpen,
  onPublish,
  onDelete,
}: DraftIssueRowPropertiesProps) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);

  const pri = (issue.priority ?? 'none') as Priority;
  const currentState = states.find((s) => s.id === issue.state_id);
  const stateName = currentState?.name ?? 'Backlog';
  const primaryAssigneeId =
    issue.assignee_ids && issue.assignee_ids.length > 0 ? issue.assignee_ids[0] : null;
  const assigneeMember = findWorkspaceMemberByUserId(members, primaryAssigneeId);
  const assigneeName =
    assigneeMember?.member_display_name?.trim() ||
    assigneeMember?.member_email?.split('@')[0] ||
    (primaryAssigneeId ? primaryAssigneeId.slice(0, 8) : '');
  const assigneeAvatar = assigneeMember?.member_avatar?.trim();
  const labelNames = (issue.label_ids ?? [])
    .map((id) => labels.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const currentModuleId = issue.module_ids?.[0] ?? null;

  const toggleLabel = (labelId: string) => {
    const cur = issue.label_ids ?? [];
    const next = cur.includes(labelId) ? cur.filter((x) => x !== labelId) : [...cur, labelId];
    void onPatch(issue, { label_ids: next });
  };

  const panelClass =
    'max-h-64 min-w-[180px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)';

  const showModules = Boolean(project?.module_view);

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* State —  StateDropdown border-with-text + dashed */}
      <Dropdown
        id={`${issue.id}:state`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="State"
        icon={<span />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName="inline-flex h-7 max-w-[10rem] min-w-0 items-center gap-1 rounded border border-dashed border-(--border-subtle) bg-(--bg-surface-1) px-2 text-[12px] font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
        triggerContent={
          <>
            <span className="flex size-3.5 shrink-0 items-center justify-center text-(--txt-icon-tertiary) [&_svg]:size-3.5">
              {stateGroupIcon(currentState?.group)}
            </span>
            <span className="truncate">{stateName}</span>
            <IconChevronDown />
          </>
        }
        panelClassName={panelClass}
      >
        {states.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-(--txt-tertiary)">No states</div>
        ) : (
          <>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onPatch(issue, { state_id: null });
                setOpenDropdownId(null);
              }}
            >
              Backlog
            </button>
            {states.map((s) => (
              <button
                key={s.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={() => {
                  void onPatch(issue, { state_id: s.id });
                  setOpenDropdownId(null);
                }}
              >
                {s.name}
              </button>
            ))}
          </>
        )}
      </Dropdown>

      {/* Blocked — visual parity (no API yet) */}
      <button
        type="button"
        className={propBtnSquare}
        title="Blocked"
        disabled={busy}
        aria-label="Blocked"
      >
        <IconCircleSlash />
      </button>

      {/* Labels */}
      <Dropdown
        id={`${issue.id}:labels`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Labels"
        icon={<IconTag />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName={propBtnSquare}
        triggerContent={
          <span className={labelNames.length ? '' : 'opacity-50'}>
            <IconTag />
          </span>
        }
        panelClassName={panelClass}
      >
        {labels.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-(--txt-tertiary)">No labels</div>
        ) : (
          labels.map((l) => {
            const on = (issue.label_ids ?? []).includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-(--bg-layer-1-hover)"
                onClick={() => toggleLabel(l.id)}
              >
                <span className="w-4 text-(--txt-accent-primary)">{on ? '✓' : ''}</span>
                {l.name}
              </button>
            );
          })
        )}
      </Dropdown>

      {/* Start date — icon-only + hidden date input (Plane DateDropdown border-without-text) */}
      <div
        className={`${propBtnSquare}${busy ? ' pointer-events-none opacity-40' : ''}`}
        title={issue.start_date ? `Start ${issue.start_date}` : 'Start date'}
      >
        <IconStartDateProperty />
        <input
          ref={startInputRef}
          type="date"
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={issue.start_date?.slice(0, 10) ?? ''}
          aria-label="Start date"
          onChange={(e) => {
            const v = e.target.value;
            void onPatch(issue, { start_date: v || null });
          }}
        />
      </div>

      {/* Due date */}
      <div
        className={`${propBtnSquare}${busy ? ' pointer-events-none opacity-40' : ''}`}
        title={issue.target_date ? `Due ${issue.target_date}` : 'Due date'}
      >
        <IconDueDateProperty />
        <input
          ref={dueInputRef}
          type="date"
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={issue.target_date?.slice(0, 10) ?? ''}
          aria-label="Due date"
          onChange={(e) => {
            const v = e.target.value;
            void onPatch(issue, { target_date: v || null });
          }}
        />
      </div>

      {/* Assignee — icon / avatar + chevron in bordered control */}
      <Dropdown
        id={`${issue.id}:assignee`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Assignee"
        icon={<IconUser />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName="inline-flex h-7 items-center gap-0.5 rounded border border-(--border-subtle) bg-(--bg-surface-1) pl-1 pr-1 hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
        triggerContent={
          <>
            <span className="flex size-6 items-center justify-center">
              {primaryAssigneeId ? (
                <Avatar
                  name={assigneeName || '?'}
                  src={getImageUrl(assigneeAvatar || null) ?? undefined}
                  size="sm"
                  className="h-5 w-5 text-[9px]"
                />
              ) : (
                <span className="text-(--txt-icon-tertiary)">
                  <IconUser />
                </span>
              )}
            </span>
            <IconChevronDown />
          </>
        }
        panelClassName={panelClass}
      >
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
          onClick={() => {
            void onPatch(issue, { assignee_ids: [] });
            setOpenDropdownId(null);
          }}
        >
          Unassigned
        </button>
        {members.map((m) => {
          const uid = m.member_id ?? m.id;
          const nm =
            m.member_display_name?.trim() || m.member_email?.split('@')[0] || uid.slice(0, 8);
          return (
            <button
              key={m.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onPatch(issue, { assignee_ids: [uid] });
                setOpenDropdownId(null);
              }}
            >
              {nm}
            </button>
          );
        })}
      </Dropdown>

      {/* Modules — Plane ModuleDropdown icon */}
      {showModules ? (
        <Dropdown
          id={`${issue.id}:module`}
          openId={openDropdownId}
          onOpen={setOpenDropdownId}
          label="Modules"
          icon={<IconLayoutGrid />}
          displayValue=""
          align="right"
          disabled={busy}
          triggerClassName={propBtnSquare}
          triggerContent={
            <span className={currentModuleId ? '' : 'opacity-50'}>
              <IconLayoutGrid />
            </span>
          }
          panelClassName={panelClass}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => {
              void onModuleChange(issue, null);
              setOpenDropdownId(null);
            }}
          >
            No module
          </button>
          {modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onModuleChange(issue, mod.id);
                setOpenDropdownId(null);
              }}
            >
              {mod.name}
            </button>
          ))}
        </Dropdown>
      ) : null}

      {/* Priority — Plane PriorityDropdown border-without-text */}
      <Dropdown
        id={`${issue.id}:priority`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Priority"
        icon={<span />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName={propBtnSquare}
        triggerContent={
          <span className="flex size-[18px] items-center justify-center [&_svg]:size-[14px]">
            {PRIORITY_ICONS[pri] ?? PRIORITY_ICONS.none}
          </span>
        }
        panelClassName={panelClass}
      >
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-(--bg-layer-1-hover)"
            onClick={() => {
              void onPatch(issue, { priority: p });
              setOpenDropdownId(null);
            }}
          >
            <span className="flex w-5 justify-center text-(--txt-icon-tertiary)">
              {PRIORITY_ICONS[p]}
            </span>
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </Dropdown>

      {/* Visibility — no border (Plane-style) */}
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
        title="Visibility"
        aria-label="Visibility"
      >
        <IconEye />
      </button>

      {/* More — no border; menu aligned like Plane quick actions */}
      <div className="relative shrink-0" data-draft-actions>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40"
          aria-expanded={rowMenuOpen}
          aria-label="More options"
          disabled={busy}
          onClick={() => onToggleRowMenu()}
        >
          <IconMoreHorizontal />
        </button>
        {rowMenuOpen ? (
          <div
            className="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onPublish()}
            >
              Publish
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onDelete()}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

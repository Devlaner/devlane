import { Dropdown } from './Dropdown';
import { StatePill, PriorityIcon, WorkItemAvatarGroup, LabelChips } from './IssueRowCells';
import { membersFromAssigneeIds } from '../../lib/issueRowHelpers';
import { getImageUrl } from '../../lib/utils';
import { Avatar } from '../ui';
import type {
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';

/**
 * Inline-editable property cells for the work-item layouts. Each wraps the
 * read-only display cell from IssueRowCells in a Dropdown so a property can be
 * changed in place. Open/close state is owned by the parent layout via a single
 * `openId`/`onOpen` pair so only one picker is open at a time.
 */

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const CELL_TRIGGER =
  'inline-flex min-w-0 max-w-full items-center gap-1 rounded-(--radius-md) px-1 py-0.5 text-left hover:bg-(--bg-layer-1-hover)';
const OPTION_BTN =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)';
const PANEL =
  'max-h-72 min-w-[220px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)';

const Check = ({ on }: { on: boolean }) => (
  <span className="inline-flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) text-[10px] text-(--txt-accent-primary)">
    {on ? '✓' : ''}
  </span>
);

interface OpenProps {
  openId: string | null;
  onOpen: (id: string | null) => void;
  align?: 'left' | 'right';
}

export function EditableStateCell({
  issueId,
  state,
  states,
  onChange,
  openId,
  onOpen,
  align,
}: OpenProps & {
  issueId: string;
  state?: StateApiResponse | null;
  states: StateApiResponse[];
  onChange: (stateId: string) => void;
}) {
  return (
    <Dropdown
      id={`${issueId}:state`}
      openId={openId}
      onOpen={onOpen}
      label="State"
      icon={null}
      displayValue=""
      align={align}
      panelClassName={PANEL}
      triggerClassName={CELL_TRIGGER}
      triggerAriaLabel="Change state"
      triggerContent={<StatePill state={state} />}
    >
      {states.map((s) => (
        <button
          key={s.id}
          type="button"
          className={OPTION_BTN}
          onClick={() => {
            onOpen(null);
            if (s.id !== state?.id) onChange(s.id);
          }}
        >
          <StatePill state={s} />
          <span className="truncate text-(--txt-primary)">{s.name}</span>
          {state?.id === s.id && <span className="ml-auto text-xs text-(--txt-tertiary)">✓</span>}
        </button>
      ))}
    </Dropdown>
  );
}

export function EditablePriorityCell({
  issueId,
  priority,
  onChange,
  openId,
  onOpen,
  align,
}: OpenProps & {
  issueId: string;
  priority?: Priority | string | null;
  onChange: (priority: Priority) => void;
}) {
  const current = (priority ?? 'none') as Priority;
  return (
    <Dropdown
      id={`${issueId}:priority`}
      openId={openId}
      onOpen={onOpen}
      label="Priority"
      icon={null}
      displayValue=""
      align={align}
      panelClassName={PANEL}
      triggerClassName={CELL_TRIGGER}
      triggerAriaLabel="Change priority"
      triggerContent={<PriorityIcon priority={current} />}
    >
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          className={OPTION_BTN}
          onClick={() => {
            onOpen(null);
            if (p !== current) onChange(p);
          }}
        >
          <PriorityIcon priority={p} />
          <span className="capitalize text-(--txt-primary)">
            {p === 'none' ? 'No priority' : p}
          </span>
          {current === p && <span className="ml-auto text-xs text-(--txt-tertiary)">✓</span>}
        </button>
      ))}
    </Dropdown>
  );
}

export function EditableAssigneeCell({
  issueId,
  assigneeIds,
  members,
  onChange,
  openId,
  onOpen,
  align,
}: OpenProps & {
  issueId: string;
  assigneeIds: string[];
  members: WorkspaceMemberApiResponse[];
  onChange: (assigneeIds: string[]) => void;
}) {
  const selected = membersFromAssigneeIds(members, assigneeIds);
  return (
    <Dropdown
      id={`${issueId}:assignees`}
      openId={openId}
      onOpen={onOpen}
      label="Assignees"
      icon={null}
      displayValue=""
      align={align}
      panelClassName={PANEL}
      triggerClassName={CELL_TRIGGER}
      triggerAriaLabel="Change assignees"
      triggerContent={<WorkItemAvatarGroup members={selected} />}
    >
      {members.map((m) => {
        const checked = assigneeIds.includes(m.member_id);
        const name = m.member_display_name || (m.member_email ?? 'Unknown');
        return (
          <button
            key={m.id}
            type="button"
            className={OPTION_BTN}
            onClick={() =>
              onChange(
                checked
                  ? assigneeIds.filter((x) => x !== m.member_id)
                  : [...assigneeIds, m.member_id],
              )
            }
          >
            <Check on={checked} />
            <Avatar name={name} src={getImageUrl(m.member_avatar) ?? undefined} size="sm" />
            <span className="truncate text-(--txt-primary)">{name}</span>
          </button>
        );
      })}
      {members.length === 0 && (
        <p className="px-3 py-2 text-sm text-(--txt-tertiary)">No members</p>
      )}
    </Dropdown>
  );
}

export function EditableLabelCell({
  issueId,
  labelIds,
  labels,
  onChange,
  openId,
  onOpen,
  align,
}: OpenProps & {
  issueId: string;
  labelIds: string[];
  labels: LabelApiResponse[];
  onChange: (labelIds: string[]) => void;
}) {
  const selected = labels.filter((l) => labelIds.includes(l.id));
  return (
    <Dropdown
      id={`${issueId}:labels`}
      openId={openId}
      onOpen={onOpen}
      label="Labels"
      icon={null}
      displayValue=""
      align={align}
      panelClassName={PANEL}
      triggerClassName={CELL_TRIGGER}
      triggerAriaLabel="Change labels"
      triggerContent={
        selected.length > 0 ? (
          <LabelChips labels={selected} max={2} />
        ) : (
          <span className="text-[11px] text-(--txt-tertiary)">Labels</span>
        )
      }
    >
      {labels.map((l) => {
        const checked = labelIds.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            className={OPTION_BTN}
            onClick={() =>
              onChange(checked ? labelIds.filter((x) => x !== l.id) : [...labelIds, l.id])
            }
          >
            <Check on={checked} />
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: l.color || 'var(--neutral-500)' }}
              aria-hidden
            />
            <span className="truncate text-(--txt-primary)">{l.name}</span>
          </button>
        );
      })}
      {labels.length === 0 && <p className="px-3 py-2 text-sm text-(--txt-tertiary)">No labels</p>}
    </Dropdown>
  );
}

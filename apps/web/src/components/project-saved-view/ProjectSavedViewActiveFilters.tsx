import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import type {
  WorkspaceMemberApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
} from '../../api/types';

interface Props {
  members: WorkspaceMemberApiResponse[];
  labels: LabelApiResponse[];
  projects: ProjectApiResponse[];
  /**
   * The project ID this view belongs to. If the active project filter is
   * exactly this project, the pill is suppressed (it's redundant noise).
   */
  scopeProjectId?: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

const STATE_GROUP_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  unstarted: 'Unstarted',
  started: 'Started',
  completed: 'Completed',
  canceled: 'Canceled',
};

const DATE_PRESET_LABEL: Record<string, string> = {
  '1_week': 'Last 1 week',
  '2_weeks': 'Last 2 weeks',
  '1_month': 'Last 1 month',
  '2_months': 'Last 2 months',
  custom: 'Custom range',
};

const GROUPING_LABEL: Record<string, string> = {
  active: 'Active',
  backlog: 'Backlog',
};

function memberName(members: WorkspaceMemberApiResponse[], id: string): string {
  const m = members.find((x) => x.member_id === id);
  return m?.member_display_name?.trim() || m?.member_email?.split('@')[0] || id.slice(0, 6);
}

function labelName(labels: LabelApiResponse[], id: string): string {
  return labels.find((l) => l.id === id)?.name ?? id.slice(0, 6);
}

function projectName(projects: ProjectApiResponse[], id: string): string {
  return projects.find((p) => p.id === id)?.name ?? id.slice(0, 6);
}

function IconClose() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface PillSpec {
  key: string;
  label: string;
  values: string[];
  onClear: () => void;
}

/**
 * Active filter pills shown above the issue list on the saved-view detail page.
 *
 * Each pill represents one filter dimension (e.g. Priority, Assignees) and is
 * clearable as a whole. Inline value-level removal is doable but not worth the
 * complexity at the dimension count we currently expose (~9 dimensions, mostly
 * with 1–3 values picked at a time).
 */
export function ProjectSavedViewActiveFilters({
  members,
  labels,
  projects,
  scopeProjectId,
}: Props) {
  const { t } = useTranslation();
  const { filters, setFilters } = useWorkspaceViewsState();

  const pills = useMemo<PillSpec[]>(() => {
    const out: PillSpec[] = [];
    const priorityLabel = (p: string) => t(`views.filter.priority.${p}`, PRIORITY_LABEL[p] ?? p);
    const stateGroupLabel = (s: string) =>
      t(`views.filter.stateGroup.${s}`, STATE_GROUP_LABEL[s] ?? s);
    const datePresetLabel = (d: string) =>
      t(`views.filter.datePreset.${d}`, DATE_PRESET_LABEL[d] ?? d);
    const groupingLabel = (g: string) => t(`views.filter.grouping.${g}`, GROUPING_LABEL[g] ?? g);

    if (filters.priority.length) {
      out.push({
        key: 'priority',
        label: t('views.filter.priorityLabel', 'Priority'),
        values: filters.priority.map((p) => priorityLabel(p)),
        onClear: () => setFilters((p) => ({ ...p, priority: [] })),
      });
    }
    if (filters.stateGroup.length) {
      out.push({
        key: 'stateGroup',
        label: t('views.filter.statusLabel', 'Status'),
        values: filters.stateGroup.map((s) => stateGroupLabel(s)),
        onClear: () => setFilters((p) => ({ ...p, stateGroup: [] })),
      });
    }
    if (filters.assigneeIds.length) {
      out.push({
        key: 'assignees',
        label: t('views.filter.assigneesLabel', 'Assignees'),
        values: filters.assigneeIds.map((id) => memberName(members, id)),
        onClear: () => setFilters((p) => ({ ...p, assigneeIds: [] })),
      });
    }
    if (filters.createdByIds.length) {
      out.push({
        key: 'createdBy',
        label: t('views.filter.createdByLabel', 'Created by'),
        values: filters.createdByIds.map((id) => memberName(members, id)),
        onClear: () => setFilters((p) => ({ ...p, createdByIds: [] })),
      });
    }
    if (filters.labelIds.length) {
      out.push({
        key: 'labels',
        label: t('views.filter.labelsLabel', 'Labels'),
        values: filters.labelIds.map((id) => labelName(labels, id)),
        onClear: () => setFilters((p) => ({ ...p, labelIds: [] })),
      });
    }
    if (
      filters.projectIds.length &&
      // Hide when the only active project is the one we're already viewing.
      !(
        filters.projectIds.length === 1 &&
        scopeProjectId &&
        filters.projectIds[0] === scopeProjectId
      )
    ) {
      out.push({
        key: 'projects',
        label: t('views.filter.projectLabel', 'Project'),
        values: filters.projectIds.map((id) => projectName(projects, id)),
        onClear: () => setFilters((p) => ({ ...p, projectIds: [] })),
      });
    }
    if (filters.grouping !== 'all') {
      out.push({
        key: 'grouping',
        label: t('views.filter.typeLabel', 'Type'),
        values: [groupingLabel(filters.grouping)],
        onClear: () => setFilters((p) => ({ ...p, grouping: 'all' })),
      });
    }
    if (filters.startDate.length) {
      const v = filters.startDate.includes('custom')
        ? t('views.filter.customRange', 'Custom · {{after}} → {{before}}', {
            after: filters.startAfter ?? '…',
            before: filters.startBefore ?? '…',
          })
        : filters.startDate.map((d) => datePresetLabel(d)).join(', ');
      out.push({
        key: 'startDate',
        label: t('views.filter.startDateLabel', 'Start date'),
        values: [v],
        onClear: () =>
          setFilters((p) => ({ ...p, startDate: [], startAfter: null, startBefore: null })),
      });
    }
    if (filters.dueDate.length) {
      const v = filters.dueDate.includes('custom')
        ? t('views.filter.customRange', 'Custom · {{after}} → {{before}}', {
            after: filters.dueAfter ?? '…',
            before: filters.dueBefore ?? '…',
          })
        : filters.dueDate.map((d) => datePresetLabel(d)).join(', ');
      out.push({
        key: 'dueDate',
        label: t('views.filter.dueDateLabel', 'Due date'),
        values: [v],
        onClear: () => setFilters((p) => ({ ...p, dueDate: [], dueAfter: null, dueBefore: null })),
      });
    }
    return out;
  }, [filters, members, labels, projects, scopeProjectId, setFilters, t]);

  if (pills.length === 0) return null;

  const clearAll = () => {
    setFilters((p) => ({
      ...p,
      priority: [],
      stateGroup: [],
      assigneeIds: [],
      createdByIds: [],
      labelIds: [],
      projectIds: [],
      grouping: 'all',
      startDate: [],
      startAfter: null,
      startBefore: null,
      dueDate: [],
      dueAfter: null,
      dueBefore: null,
    }));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-(--border-subtle) px-(--padding-page) py-2.5">
      {pills.map((p) => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1 text-xs text-(--txt-primary)"
        >
          <span className="text-(--txt-tertiary)">{p.label}:</span>
          <span className="max-w-[260px] truncate">{p.values.join(', ')}</span>
          <button
            type="button"
            aria-label={t('views.filter.clearFilter', 'Clear {{label}} filter', { label: p.label })}
            onClick={p.onClear}
            className="-mr-0.5 inline-flex size-4 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
          >
            <IconClose />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="ml-1 text-xs text-(--txt-secondary) hover:text-(--txt-primary) hover:underline"
      >
        {t('views.filter.clearAll', 'Clear all')}
      </button>
    </div>
  );
}

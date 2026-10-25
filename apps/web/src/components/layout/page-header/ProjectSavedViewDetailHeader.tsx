import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../ui';
import { useWorkspaceViewsState } from '../../../contexts/WorkspaceViewsStateContext';
import { WorkspaceViewsFiltersDropdown } from '../../workspace-views';
import { ProjectSavedViewDisplayDropdown } from '../../project-saved-view/ProjectSavedViewDisplayDropdown';
import { ProjectSavedViewMoreMenu } from '../../project-saved-view/ProjectSavedViewMoreMenu';
import { projectService } from '../../../services/projectService';
import { viewService } from '../../../services/viewService';
import { ProjectIconDisplay } from '../../ProjectIconModal';
import type { ProjectApiResponse } from '../../../api/types';
import { PROJECT_VIEWS_REFRESH_EVENT } from '../../../lib/projectViewsEvents';
import {
  parseWorkspaceViewFiltersFromSearchParams,
  workspaceViewFiltersToSearchParams,
  type WorkspaceViewFilters,
} from '../../../types/workspaceViewFilters';
import {
  IconChevronDown,
  IconSearch,
  IconCheck,
  IconProjectViews,
  IconList,
  IconColumns,
  IconCalendar,
  IconSpreadsheet,
  IconGantt,
  IconPlus,
} from './icons';

export function ProjectSavedViewDetailHeader({
  workspaceSlug,
  projectId,
  project,
  projectName,
  viewId,
  issueCount: _issueCount,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  projectName: string;
  viewId: string;
  issueCount: number;
}) {
  void _issueCount;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { filters: workspaceViewFilters, setFilters: setWorkspaceViewFilters } =
    useWorkspaceViewsState();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;
  const [viewTitle, setViewTitle] = useState<string>('…');
  // Snapshot of the view's persisted filters in WorkspaceViewFilters shape.
  // Used for dirty detection ("Save filters" button) and reset.
  const [savedFilters, setSavedFilters] = useState<WorkspaceViewFilters | null>(null);
  const [savingFilters, setSavingFilters] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState<string | null>(null);
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);

  // Pulls the view from the API and seeds title + savedFilters snapshot.
  // The view's `filters` JSON is a flat `Record<string, string>` matching the
  // search-params shape used by parseWorkspaceViewFiltersFromSearchParams.
  const refreshView = useRef<(cancelledRef?: { current: boolean }) => Promise<void>>(
    async () => {},
  );
  refreshView.current = async (cancelledRef) => {
    try {
      const v = await viewService.get(workspaceSlug, viewId);
      if (cancelledRef?.current) return;
      setViewTitle(v?.name?.trim() ? v.name : t('common.view', 'View'));
      const raw = v?.filters;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const params = new URLSearchParams();
        for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
          if (val == null) continue;
          const s = String(val).trim();
          if (s) params.set(k, s);
        }
        setSavedFilters(parseWorkspaceViewFiltersFromSearchParams(params));
      } else {
        setSavedFilters(parseWorkspaceViewFiltersFromSearchParams(new URLSearchParams()));
      }
    } catch {
      if (!cancelledRef?.current) setViewTitle(t('common.view', 'View'));
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    void refreshView.current(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [workspaceSlug, viewId]);

  // Reload the snapshot when the view is edited from elsewhere (rename/etc.
  // dispatch this event) so the comparison against saved filters stays fresh.
  useEffect(() => {
    const handler = () => {
      void refreshView.current();
    };
    window.addEventListener(PROJECT_VIEWS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(PROJECT_VIEWS_REFRESH_EVENT, handler);
  }, []);

  // Dirty detection: serialize both filter sets to the same canonical
  // search-params record and string-compare. Cheap and good enough.
  const filtersDirty = (() => {
    if (!savedFilters) return false;
    const a = JSON.stringify(workspaceViewFiltersToSearchParams(workspaceViewFilters));
    const b = JSON.stringify(workspaceViewFiltersToSearchParams(savedFilters));
    return a !== b;
  })();

  const handleSaveFilters = async () => {
    if (!filtersDirty || savingFilters) return;
    setSavingFilters(true);
    try {
      const payload = workspaceViewFiltersToSearchParams(workspaceViewFilters);
      await viewService.update(workspaceSlug, viewId, {
        filters: payload as Record<string, unknown>,
      });
      setSavedFilters(workspaceViewFilters);
      window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
    } catch {
      // Surface no toast — the dirty banner remains so the user can retry.
    } finally {
      setSavingFilters(false);
    }
  };

  const handleResetFilters = () => {
    if (!savedFilters) return;
    setWorkspaceViewFilters(savedFilters);
  };

  useEffect(() => {
    let cancelled = false;
    projectService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setProjects(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    if (projectDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectDropdownOpen]);

  const handleSelectProject = (targetProjectId: string) => {
    setProjectDropdownOpen(false);
    if (targetProjectId === projectId) return;
    const targetBase = `/${workspaceSlug}/projects/${targetProjectId}`;
    navigate(`${targetBase}/views`);
  };

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  const startDateEffective =
    workspaceViewFilters.startDate.length &&
    !(
      workspaceViewFilters.startDate.includes('custom') &&
      (!workspaceViewFilters.startAfter || !workspaceViewFilters.startBefore)
    );
  const dueDateEffective =
    workspaceViewFilters.dueDate.length &&
    !(
      workspaceViewFilters.dueDate.includes('custom') &&
      (!workspaceViewFilters.dueAfter || !workspaceViewFilters.dueBefore)
    );
  const activeFilters =
    workspaceViewFilters.priority.length > 0 ||
    workspaceViewFilters.stateGroup.length > 0 ||
    workspaceViewFilters.assigneeIds.length > 0 ||
    workspaceViewFilters.createdByIds.length > 0 ||
    workspaceViewFilters.labelIds.length > 0 ||
    workspaceViewFilters.projectIds.length > 0 ||
    workspaceViewFilters.grouping !== 'all' ||
    Boolean(startDateEffective) ||
    Boolean(dueDateEffective);

  return (
    <>
      <div
        className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm"
        ref={projectDropdownRef}
      >
        <Link
          to={issuesUrl}
          className="flex max-w-[40vw] items-center gap-1.5 truncate rounded-md px-3 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <ProjectIconDisplay
              emoji={project.emoji}
              icon_prop={project.icon_prop}
              size={16}
              className="leading-none"
            />
          </span>
          {projectName}
        </Link>
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((o) => !o)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
          aria-label={t('common.selectProject', 'Select project')}
        >
          <IconChevronDown />
        </button>
        {projectDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
            <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder={t('common.search', 'Search')}
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-0.5">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProject(p.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === projectId && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <Link
          to={`${baseUrl}/views`}
          className="flex max-w-[28vw] shrink-0 items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-secondary)">
            <IconProjectViews />
          </span>
          {t('common.views', 'Views')}
        </Link>
        <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <div className="flex min-w-0 max-w-[36vw] items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-primary)">
          <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-secondary)">
            <IconProjectViews />
          </span>
          <span className="truncate">{viewTitle}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
          <button
            type="button"
            title={t('common.layout.listView', 'List view')}
            aria-pressed
            className="flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-primary) shadow-sm"
          >
            <IconList />
          </button>
          <Link
            to={`${baseUrl}/board`}
            title={t('common.layout.board', 'Board')}
            aria-label={t('common.layout.board', 'Board')}
            className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)"
          >
            <IconColumns />
          </Link>
          <button
            type="button"
            title={t('common.layout.calendarComingSoon', 'Calendar (coming soon)')}
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconCalendar />
          </button>
          <button
            type="button"
            title={t('common.layout.spreadsheetComingSoon', 'Spreadsheet (coming soon)')}
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconSpreadsheet />
          </button>
          <button
            type="button"
            title={t('common.layout.timelineComingSoon', 'Timeline (coming soon)')}
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconGantt />
          </button>
        </div>
        <div className="mx-1 w-px self-stretch bg-(--border-subtle)" />
        <div className="relative shrink-0">
          <WorkspaceViewsFiltersDropdown
            openId={filtersDropdownOpen}
            onOpen={setFiltersDropdownOpen}
          />
          {activeFilters && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
              aria-hidden
            />
          )}
        </div>
        <ProjectSavedViewDisplayDropdown />
        {filtersDirty && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleResetFilters}
              disabled={savingFilters}
              className="gap-1.5 text-[13px] font-medium"
            >
              {t('common.reset', 'Reset')}
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveFilters()}
              disabled={savingFilters}
              className="gap-1.5 text-[13px] font-medium"
            >
              {savingFilters
                ? t('common.saving', 'Saving…')
                : t('header.savedView.saveFilters', 'Save filters')}
            </Button>
          </>
        )}
        <Link to={`${baseUrl}/views/${viewId}?create=1`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> {t('common.addWorkItem', 'Add work item')}
          </Button>
        </Link>
        <ProjectSavedViewMoreMenu
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          viewId={viewId}
        />
      </div>
    </>
  );
}

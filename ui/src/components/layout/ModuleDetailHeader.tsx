import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { Dropdown } from '../work-item';
import { DateRangeModal } from '../workspace-views/DateRangeModal';
import { ProjectIconDisplay } from '../ProjectIconModal';
import {
  ModuleWorkItemsDisplayPanel,
  ModuleWorkItemsFiltersPanel,
} from '../module-work-items/ModuleWorkItemsToolbarPanels';
import { workspaceService } from '../../services/workspaceService';
import { stateService } from '../../services/stateService';
import type { ProjectApiResponse, StateApiResponse, WorkspaceMemberApiResponse } from '../../api/types';
import {
  DEFAULT_MODULE_WORK_ITEMS_DISPLAY,
  DEFAULT_MODULE_WORK_ITEMS_FILTERS,
  MODULE_WORK_ITEMS_DISPLAY_EVENT,
  MODULE_WORK_ITEMS_FILTER_EVENT,
  MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT,
  isModuleFiltersActive,
  moduleWorkItemsPrefsKey,
  parseModuleWorkItemsPrefs,
  serializeModuleWorkItemsPrefs,
  type ModuleWorkItemsDisplayState,
  type ModuleWorkItemsFiltersState,
} from '../../lib/moduleWorkItemsPrefs';

const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconKanban = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);

const IconCalendar = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconSpreadsheet = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

const IconGantt = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 6v12" />
    <path d="M3 12h6" />
    <path d="M3 18h4" />
    <path d="M13 8h8" />
    <path d="M13 12h5" />
    <path d="M13 16h6" />
  </svg>
);

const IconFilter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconSliders = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const IconMoreVertical = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

export interface ModuleDetailHeaderProps {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  projectName: string;
  moduleId: string;
  moduleName: string;
  moduleRouteParam: string;
  issueCountBadge: number;
}

export function ModuleDetailHeader({
  workspaceSlug,
  projectId,
  project,
  projectName,
  moduleId,
  moduleName,
  moduleRouteParam,
  issueCountBadge,
}: ModuleDetailHeaderProps) {
  const navigate = useNavigate();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const modulePath = `${baseUrl}/modules/${encodeURIComponent(moduleRouteParam)}`;

  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState<string | null>(null);

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [filters, setFilters] = useState<ModuleWorkItemsFiltersState>(DEFAULT_MODULE_WORK_ITEMS_FILTERS);
  const [display, setDisplay] = useState<ModuleWorkItemsDisplayState>(DEFAULT_MODULE_WORK_ITEMS_DISPLAY);
  const [dateModal, setDateModal] = useState<'due' | 'start' | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModuleDropdownOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      stateService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([st, mem]) => {
        if (!cancelled) {
          setStates(st ?? []);
          setMembers(mem ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStates([]);
          setMembers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    const key = moduleWorkItemsPrefsKey(workspaceSlug, projectId, moduleId);
    const raw = localStorage.getItem(key);
    const parsed = parseModuleWorkItemsPrefs(raw);
    if (parsed) {
      setFilters({ ...DEFAULT_MODULE_WORK_ITEMS_FILTERS, ...parsed.filters });
      setDisplay({ ...DEFAULT_MODULE_WORK_ITEMS_DISPLAY, ...parsed.display });
    } else {
      setFilters(DEFAULT_MODULE_WORK_ITEMS_FILTERS);
      setDisplay(DEFAULT_MODULE_WORK_ITEMS_DISPLAY);
    }
  }, [workspaceSlug, projectId, moduleId]);

  useEffect(() => {
    const key = moduleWorkItemsPrefsKey(workspaceSlug, projectId, moduleId);
    localStorage.setItem(
      key,
      serializeModuleWorkItemsPrefs({
        filters,
        display,
      }),
    );
  }, [workspaceSlug, projectId, moduleId, filters, display]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MODULE_WORK_ITEMS_FILTER_EVENT, { detail: filters }));
  }, [filters]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MODULE_WORK_ITEMS_DISPLAY_EVENT, { detail: display }));
  }, [display]);

  const filtersActive = isModuleFiltersActive(filters);

  const openAddExisting = () => {
    setMoreOpen(false);
    window.dispatchEvent(new Event(MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT));
  };

  const copyLink = async () => {
    setMoreOpen(false);
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* ignore */
    }
  };

  const openNewTab = () => {
    setMoreOpen(false);
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm text-(--txt-primary)">
        <Link
          to={baseUrl}
          className="flex shrink-0 items-center gap-1.5 truncate font-medium text-(--txt-secondary) hover:text-(--txt-primary) hover:underline"
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
        <span className="shrink-0 text-(--txt-icon-tertiary)">/</span>
        <Link
          to={`${baseUrl}/modules`}
          className="shrink-0 truncate font-medium text-(--txt-secondary) hover:text-(--txt-primary) hover:underline"
        >
          Modules
        </Link>
        <span className="shrink-0 text-(--txt-icon-tertiary)">/</span>
        <div ref={dropdownRef} className="relative flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setModuleDropdownOpen((o) => !o)}
            className="flex min-w-0 max-w-[12rem] items-center gap-1 truncate rounded-md px-2.5 py-1.5 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-transparent-hover) md:max-w-[16rem]"
          >
            <span className="min-w-0 truncate">{moduleName}</span>
            <span className="shrink-0 text-(--txt-icon-tertiary)">
              <IconChevronDown />
            </span>
          </button>
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200"
            title="Work items in this module"
          >
            {issueCountBadge}
          </span>
          {moduleDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-40 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
              <Link
                to={`${baseUrl}/modules`}
                className="block px-3 py-2 text-left text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                onClick={() => setModuleDropdownOpen(false)}
              >
                All modules
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-2) p-0.5">
          <button
            type="button"
            title="List"
            aria-pressed
            className="flex size-7 items-center justify-center rounded-md bg-white text-(--txt-primary) shadow-sm"
          >
            <IconList />
          </button>
          <button
            type="button"
            title="Board"
            className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)"
            onClick={() => navigate(`${baseUrl}/board`)}
          >
            <IconKanban />
          </button>
          <button
            type="button"
            title="Calendar (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconCalendar />
          </button>
          <button
            type="button"
            title="Spreadsheet (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconSpreadsheet />
          </button>
          <button
            type="button"
            title="Timeline (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconGantt />
          </button>
        </div>

        <div className="relative">
          <Dropdown
            id="module-filters"
            openId={toolbarOpen}
            onOpen={setToolbarOpen}
            label="Filters"
            icon={<IconFilter />}
            displayValue=""
            align="right"
            compact
            panelClassName="max-h-[min(85vh,32rem)] overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
            triggerClassName="inline-flex border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
            triggerContent={
              <span className="relative inline-flex">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)">
                  <IconFilter />
                  Filters
                  <IconChevronDown />
                </span>
                {filtersActive ? (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)" aria-hidden />
                ) : null}
              </span>
            }
          >
            <ModuleWorkItemsFiltersPanel
              filters={filters}
              setFilters={setFilters}
              states={states}
              members={members}
              onRequestDueCustom={() => setDateModal('due')}
              onRequestStartCustom={() => setDateModal('start')}
            />
          </Dropdown>
        </div>

        <Dropdown
          id="module-display"
          openId={toolbarOpen}
          onOpen={setToolbarOpen}
          label="Display"
          icon={<IconSliders />}
          displayValue=""
          align="right"
          compact
          panelClassName="max-h-[min(85vh,32rem)] overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
          triggerClassName="inline-flex border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
          triggerContent={
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)">
              <IconSliders />
              Display
              <IconChevronDown />
            </span>
          }
        >
          <ModuleWorkItemsDisplayPanel display={display} setDisplay={setDisplay} />
        </Dropdown>

        <Link
          to={`/${workspaceSlug}/analytics/work-items`}
          className="inline-flex h-8 items-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
        >
          Analytics
        </Link>

        <Link to={`${modulePath}?create=1`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus />
            Add work item
          </Button>
        </Link>

        <div ref={moreRef} className="relative">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)"
            aria-label="More options"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <IconMoreVertical />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-52 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                onClick={openAddExisting}
              >
                Add an existing work item
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                onClick={copyLink}
              >
                Copy link
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                onClick={openNewTab}
              >
                Open in new tab
              </button>
            </div>
          )}
        </div>
      </div>

      <DateRangeModal
        open={dateModal === 'due'}
        onClose={() => setDateModal(null)}
        title="Due date range"
        after={filters.dueAfter}
        before={filters.dueBefore}
        onApply={(after, before) => {
          setFilters((p) => ({
            ...p,
            duePreset: 'custom',
            dueAfter: after,
            dueBefore: before,
          }));
          setDateModal(null);
        }}
      />
      <DateRangeModal
        open={dateModal === 'start'}
        onClose={() => setDateModal(null)}
        title="Start date range"
        after={filters.startAfter}
        before={filters.startBefore}
        onApply={(after, before) => {
          setFilters((p) => ({
            ...p,
            startAfter: after,
            startBefore: before,
          }));
          setDateModal(null);
        }}
      />
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Tooltip } from '../../ui';
import { Dropdown } from '../../work-item';
import { useModulesFilter } from '../../../contexts/ModulesFilterContext';
import { useWorkspaceViewsState } from '../../../contexts/WorkspaceViewsStateContext';
import { ModuleFiltersPanel } from '../../workspace-views';
import { DateRangeModal } from '../../workspace-views/DateRangeModal';
import { CreateModuleModal } from '../../CreateModuleModal';
import { CreateCycleModal } from '../../CreateCycleModal';
import { ProjectIssuesFiltersPanel } from '../../project-issues/ProjectIssuesFiltersPanel';
import { ProjectIssuesDisplayPanel } from '../../project-issues/ProjectIssuesDisplayPanel';
import { useAuth } from '../../../contexts/AuthContext';
import { workspaceService } from '../../../services/workspaceService';
import { projectService } from '../../../services/projectService';
import { cycleService } from '../../../services/cycleService';
import { labelService } from '../../../services/labelService';
import { ProjectIconDisplay } from '../../ProjectIconModal';
import type {
  ProjectApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
  LabelApiResponse,
} from '../../../api/types';
import {
  PROJECT_CYCLES_FILTER_EVENT,
  PROJECT_CYCLES_REFRESH_EVENT,
} from '../../../lib/projectCyclesEvents';
import { PROJECT_PAGES_CREATE_EVENT } from '../../../lib/projectPagesEvents';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  PROJECT_ISSUES_DISPLAY_EVENT,
  PROJECT_ISSUES_FILTER_EVENT,
  type ProjectIssuesFiltersState,
} from '../../../lib/projectIssuesEvents';
import {
  cloneDefaultProjectIssuesDisplay,
  parseProjectIssuesDisplay,
  projectIssuesDisplayStorageKey,
  serializeProjectIssuesDisplay,
  toDisplayPayload,
  type ProjectIssuesDisplayState,
} from '../../../lib/projectIssuesDisplay';
import { PROJECT_VIEWS_FILTER_EVENT } from '../../../lib/projectViewsEvents';
import type { ProjectSection } from '../PageHeader';
import {
  IconSearch,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconCalendar,
  IconSpreadsheet,
  IconGantt,
  IconArrowUpDown,
  IconFilter,
  IconPlus,
  IconSliders,
  IconCheck,
  IconList,
  IconLayoutGrid,
  IconStack,
  IconColumns,
  IconBarChart,
} from './icons';
import { ProjectSectionDropdown } from './ProjectSectionDropdown';

export function ProjectSectionHeader({
  workspaceSlug,
  projectId,
  project,
  projectName,
  section,
  issueCount,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  projectName: string;
  section: ProjectSection;
  issueCount: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const modulesFilter = useModulesFilter();
  const { display: viewsDisplay, setDisplay } = useWorkspaceViewsState();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [modulesSearchExpanded, setModulesSearchExpanded] = useState(false);
  const [modulesFiltersOpen, setModulesFiltersOpen] = useState<string | null>(null);
  const [modulesSortOpen, setModulesSortOpen] = useState<string | null>(null);
  const [viewsSortOpen, setViewsSortOpen] = useState<string | null>(null);
  const [viewsFiltersOpen, setViewsFiltersOpen] = useState<string | null>(null);
  const [viewsSearchOpen, setViewsSearchOpen] = useState(false);
  const [viewsSearchQuery, setViewsSearchQuery] = useState('');
  const [viewsFavOnly, setViewsFavOnly] = useState(false);
  const [viewsCreatedDate, setViewsCreatedDate] = useState<
    '1_week' | '2_weeks' | '1_month' | 'custom' | null
  >(null);
  const [viewsCreatedAfter, setViewsCreatedAfter] = useState<string | null>(null);
  const [viewsCreatedBefore, setViewsCreatedBefore] = useState<string | null>(null);
  const [viewsCreatedBy, setViewsCreatedBy] = useState<string[]>([]);
  const [viewsMembers, setViewsMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [modulesDateRangeModal, setModulesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [createCycleOpen, setCreateCycleOpen] = useState(false);
  const [cyclesFiltersDropdownOpen, setCyclesFiltersDropdownOpen] = useState<string | null>(null);
  const [cyclesStatusSectionOpen, setCyclesStatusSectionOpen] = useState(true);
  const [cyclesStartSectionOpen, setCyclesStartSectionOpen] = useState(true);
  const [cyclesDueSectionOpen, setCyclesDueSectionOpen] = useState(true);
  const [cyclesFiltersSearch, setCyclesFiltersSearch] = useState('');
  const [cyclesSearchExpanded, setCyclesSearchExpanded] = useState(false);
  const [cyclesSearch, setCyclesSearch] = useState('');
  const [cyclesDateRangeModal, setCyclesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [cyclesSelectedStatusKeys, setCyclesSelectedStatusKeys] = useState<string[]>([]);
  const [cyclesSelectedStartDatePresets, setCyclesSelectedStartDatePresets] = useState<string[]>(
    [],
  );
  const [cyclesSelectedDueDatePresets, setCyclesSelectedDueDatePresets] = useState<string[]>([]);
  const [cyclesStartAfter, setCyclesStartAfter] = useState<string | null>(null);
  const [cyclesStartBefore, setCyclesStartBefore] = useState<string | null>(null);
  const [cyclesDueAfter, setCyclesDueAfter] = useState<string | null>(null);
  const [cyclesDueBefore, setCyclesDueBefore] = useState<string | null>(null);
  const [issuesFiltersOpen, setIssuesFiltersOpen] = useState<string | null>(null);
  const [issuesFiltersSearch, setIssuesFiltersSearch] = useState('');
  const [issuesMembers, setIssuesMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [issuesCycles, setIssuesCycles] = useState<CycleApiResponse[]>([]);
  const [issuesLabels, setIssuesLabels] = useState<LabelApiResponse[]>([]);
  const [issuesFilters, setIssuesFilters] = useState<ProjectIssuesFiltersState>(() => ({
    ...DEFAULT_PROJECT_ISSUES_FILTERS,
  }));
  const [issuesDateRangeModal, setIssuesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [issuesDisplayOpen, setIssuesDisplayOpen] = useState<string | null>(null);
  const [issuesDisplay, setIssuesDisplay] = useState<ProjectIssuesDisplayState>(() =>
    cloneDefaultProjectIssuesDisplay(),
  );
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);
  const modulesSearchInputRef = useRef<HTMLInputElement | null>(null);
  const cyclesSearchInputRef = useRef<HTMLInputElement | null>(null);

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
    if (projectDropdownOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [projectDropdownOpen]);

  useEffect(() => {
    if (modulesSearchExpanded) {
      modulesSearchInputRef.current?.focus();
    }
  }, [modulesSearchExpanded]);

  useEffect(() => {
    if (cyclesSearchExpanded) {
      cyclesSearchInputRef.current?.focus();
    }
  }, [cyclesSearchExpanded]);

  useEffect(() => {
    if (section !== 'views') return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((mem) => {
        if (!cancelled) setViewsMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setViewsMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug]);

  useEffect(() => {
    if (section !== 'issues') return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((mem) => {
        if (!cancelled) setIssuesMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setIssuesMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    let cancelled = false;
    Promise.all([
      cycleService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
    ])
      .then(([cyc, lab]) => {
        if (!cancelled) {
          setIssuesCycles(Array.isArray(cyc) ? cyc : []);
          setIssuesLabels(Array.isArray(lab) ? lab : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIssuesCycles([]);
          setIssuesLabels([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug, projectId]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    window.dispatchEvent(
      new CustomEvent(PROJECT_ISSUES_FILTER_EVENT, {
        detail: { workspaceSlug, projectId, filters: issuesFilters },
      }),
    );
  }, [section, workspaceSlug, projectId, issuesFilters]);

  useEffect(() => {
    if (section !== 'issues') return;
    if (!workspaceSlug || !projectId) return;
    const key = projectIssuesDisplayStorageKey(workspaceSlug, projectId);
    try {
      const raw = localStorage.getItem(key);
      const parsed = parseProjectIssuesDisplay(raw);
      queueMicrotask(() => setIssuesDisplay(parsed ?? cloneDefaultProjectIssuesDisplay()));
    } catch {
      queueMicrotask(() => setIssuesDisplay(cloneDefaultProjectIssuesDisplay()));
    }
  }, [section, workspaceSlug, projectId]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    try {
      localStorage.setItem(
        projectIssuesDisplayStorageKey(workspaceSlug, projectId),
        serializeProjectIssuesDisplay(issuesDisplay),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [section, workspaceSlug, projectId, issuesDisplay]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    window.dispatchEvent(
      new CustomEvent(PROJECT_ISSUES_DISPLAY_EVENT, {
        detail: {
          workspaceSlug,
          projectId,
          display: toDisplayPayload(issuesDisplay),
        },
      }),
    );
  }, [section, workspaceSlug, projectId, issuesDisplay]);

  const dispatchViewsFilters = (
    next: Partial<{
      query: string;
      favoritesOnly: boolean;
      createdDatePreset: '1_week' | '2_weeks' | '1_month' | 'custom' | null;
      createdAfter: string | null;
      createdBefore: string | null;
      createdByIds: string[];
    }>,
  ) => {
    window.dispatchEvent(
      new CustomEvent(PROJECT_VIEWS_FILTER_EVENT, {
        detail: {
          query: viewsSearchQuery,
          favoritesOnly: viewsFavOnly,
          createdDatePreset: viewsCreatedDate,
          createdAfter: viewsCreatedAfter,
          createdBefore: viewsCreatedBefore,
          createdByIds: viewsCreatedBy,
          ...next,
        },
      }),
    );
  };

  useEffect(() => {
    if (section !== 'cycles') return;
    if (!workspaceSlug || !projectId) return;

    window.dispatchEvent(
      new CustomEvent(PROJECT_CYCLES_FILTER_EVENT, {
        detail: {
          workspaceSlug,
          projectId,
          filters: {
            searchQuery: cyclesSearch,
            statusKeys: cyclesSelectedStatusKeys,
            startDatePresets: cyclesSelectedStartDatePresets,
            dueDatePresets: cyclesSelectedDueDatePresets,
            startAfter: cyclesStartAfter,
            startBefore: cyclesStartBefore,
            dueAfter: cyclesDueAfter,
            dueBefore: cyclesDueBefore,
          },
        },
      }),
    );
  }, [
    section,
    workspaceSlug,
    projectId,
    cyclesSearch,
    cyclesSelectedStatusKeys,
    cyclesSelectedStartDatePresets,
    cyclesSelectedDueDatePresets,
    cyclesStartAfter,
    cyclesStartBefore,
    cyclesDueAfter,
    cyclesDueBefore,
  ]);

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  const handleSelectProject = (targetProjectId: string) => {
    const targetBase = `/${workspaceSlug}/projects/${targetProjectId}`;
    const targetPath =
      section === 'issues'
        ? `${targetBase}/issues`
        : section === 'cycles'
          ? `${targetBase}/cycles`
          : section === 'modules'
            ? `${targetBase}/modules`
            : section === 'views'
              ? `${targetBase}/views`
              : `${targetBase}/pages`;
    setProjectDropdownOpen(false);
    navigate(targetPath);
  };

  const currentLayout = modulesFilter.layout;

  const rightActions = () => {
    if (section === 'issues') {
      return (
        <>
          {(() => {
            const layouts: { key: string; label: string; icon: React.ReactNode }[] = [
              { key: 'list', label: t('common.layout.list', 'List'), icon: <IconList /> },
              { key: 'board', label: t('common.layout.board', 'Board'), icon: <IconColumns /> },
              {
                key: 'calendar',
                label: t('common.layout.calendar', 'Calendar'),
                icon: <IconCalendar />,
              },
              {
                key: 'spreadsheet',
                label: t('common.layout.spreadsheet', 'Spreadsheet'),
                icon: <IconSpreadsheet />,
              },
              { key: 'gantt', label: t('common.layout.timeline', 'Timeline'), icon: <IconGantt /> },
            ];
            const activeLayout = (() => {
              const v = searchParams.get('layout') ?? '';
              return layouts.some((l) => l.key === v) ? v : 'list';
            })();
            const setLayout = (k: string) => {
              const next = new URLSearchParams(searchParams);
              if (k === 'list') next.delete('layout');
              else next.set('layout', k);
              setSearchParams(next, { replace: true });
            };
            return (
              <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
                {layouts.map((l) => {
                  const active = activeLayout === l.key;
                  return (
                    <button
                      key={l.key}
                      type="button"
                      title={l.label}
                      aria-label={l.label}
                      aria-pressed={active}
                      onClick={() => setLayout(l.key)}
                      className={
                        active
                          ? 'flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-primary) shadow-sm'
                          : 'flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)'
                      }
                    >
                      {l.icon}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div className="mx-1 w-px self-stretch bg-(--border-subtle)" />
          <div className="relative shrink-0">
            <Dropdown
              id="project-issues-filters"
              openId={issuesFiltersOpen}
              onOpen={setIssuesFiltersOpen}
              label={t('header.filters', 'Filters')}
              icon={<IconFilter />}
              displayValue={t('header.filters', 'Filters')}
              panelClassName="flex w-[min(400px,calc(100vw-24px))] max-h-[min(calc(100dvh-96px),36rem)] flex-col overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              align="right"
              triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">{t('header.filters', 'Filters')}</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    {issuesFiltersOpen === 'project-issues-filters' ? (
                      <IconChevronUp />
                    ) : (
                      <IconChevronDown />
                    )}
                  </span>
                </>
              }
            >
              <ProjectIssuesFiltersPanel
                search={issuesFiltersSearch}
                onSearchChange={setIssuesFiltersSearch}
                filters={issuesFilters}
                setFilters={setIssuesFilters}
                members={issuesMembers}
                cycles={issuesCycles}
                labels={issuesLabels}
                currentUserId={authUser?.id}
                currentUserName={authUser?.name ?? t('common.you', 'You')}
                currentUserAvatarUrl={authUser?.avatarUrl}
                onOpenCustomStart={() => {
                  setIssuesFiltersOpen(null);
                  setIssuesDateRangeModal('start');
                }}
                onOpenCustomDue={() => {
                  setIssuesFiltersOpen(null);
                  setIssuesDateRangeModal('due');
                }}
              />
            </Dropdown>
            {[
              issuesFilters.priorities.length,
              issuesFilters.stateGroups.length,
              issuesFilters.assigneeIds.length,
              issuesFilters.cycleIds.length,
              issuesFilters.mentionedUserIds.length,
              issuesFilters.createdByIds.length,
              issuesFilters.labelIds.length,
              issuesFilters.workItemGrouping === 'all' ? 0 : 1,
              issuesFilters.startDate.length,
              issuesFilters.dueDate.length,
            ].some((n) => n > 0) && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <Dropdown
            id="project-issues-display"
            openId={issuesDisplayOpen}
            onOpen={setIssuesDisplayOpen}
            label={t('header.display', 'Display')}
            icon={<IconSliders />}
            displayValue={t('header.display', 'Display')}
            panelClassName="w-[min(400px,calc(100vw-24px))] max-h-[min(calc(100dvh-96px),50rem)] overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
            align="right"
            triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconSliders />
                </span>
                <span className="truncate">{t('header.display', 'Display')}</span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  {issuesDisplayOpen === 'project-issues-display' ? (
                    <IconChevronUp />
                  ) : (
                    <IconChevronDown />
                  )}
                </span>
              </>
            }
          >
            <ProjectIssuesDisplayPanel display={issuesDisplay} setDisplay={setIssuesDisplay} />
          </Dropdown>
          <Link
            to={`/${workspaceSlug}/analytics/work-items`}
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-2-hover)"
          >
            <IconBarChart /> {t('common.analytics', 'Analytics')}
          </Link>
          <Link to={`${issuesUrl}?create=1`}>
            <Button size="sm" className="gap-1.5 text-[13px] font-medium">
              <IconPlus /> {t('common.addWorkItem', 'Add work item')}
            </Button>
          </Link>
        </>
      );
    }
    if (section === 'cycles') {
      const showCyclesSearchInput = cyclesSearchExpanded || cyclesSearch.length > 0;
      return (
        <>
          {showCyclesSearchInput ? (
            <div className="flex h-8 min-w-35 max-w-50 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2">
              <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                <IconSearch />
              </span>
              <input
                ref={cyclesSearchInputRef}
                type="text"
                value={cyclesSearch}
                onChange={(e) => setCyclesSearch(e.target.value)}
                onBlur={() => {
                  if (cyclesSearch.length === 0) setCyclesSearchExpanded(false);
                }}
                placeholder={t('common.search', 'Search')}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                aria-label={t('header.cycles.searchCycles', 'Search cycles')}
              />
              {cyclesSearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCyclesSearch('')}
                  className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                  aria-label={t('common.clearSearch', 'Clear search')}
                >
                  <IconX />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCyclesSearchExpanded(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
              aria-label={t('header.cycles.searchCycles', 'Search cycles')}
            >
              <IconSearch />
            </button>
          )}
          <Dropdown
            id="cycles-filters"
            openId={cyclesFiltersDropdownOpen}
            onOpen={setCyclesFiltersDropdownOpen}
            label={t('header.filters', 'Filters')}
            icon={<IconFilter />}
            displayValue={t('header.filters', 'Filters')}
            triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            triggerContent={
              <span className="flex items-center gap-1.5">
                <IconFilter /> {t('header.filters', 'Filters')} <IconChevronDown />
              </span>
            }
            panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
            align="right"
          >
            <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
              <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder={t('common.search', 'Search')}
                  value={cyclesFiltersSearch}
                  onChange={(e) => setCyclesFiltersSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesStatusSectionOpen((o) => !o)}
                >
                  <span>{t('header.cycles.statusTitle', 'Status of the cycle')}</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesStatusSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesStatusSectionOpen && (
                  <div className="pb-1">
                    {[
                      {
                        key: 'in_progress',
                        label: t('header.cycles.status.inProgress', 'In progress'),
                      },
                      {
                        key: 'yet_to_start',
                        label: t('header.cycles.status.yetToStart', 'Yet to start'),
                      },
                      { key: 'completed', label: t('header.cycles.status.completed', 'Completed') },
                      { key: 'draft', label: t('header.cycles.status.draft', 'Draft') },
                    ]
                      .filter(
                        (s) =>
                          !cyclesFiltersSearch.trim() ||
                          s.label.toLowerCase().includes(cyclesFiltersSearch.trim().toLowerCase()),
                      )
                      .map((s) => (
                        <label
                          key={s.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={cyclesSelectedStatusKeys.includes(s.key)}
                            onChange={() => {
                              setCyclesSelectedStatusKeys((prev) =>
                                prev.includes(s.key)
                                  ? prev.filter((k) => k !== s.key)
                                  : [...prev, s.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{s.label}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesStartSectionOpen((o) => !o)}
                >
                  <span>{t('common.startDate', 'Start date')}</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesStartSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesStartSectionOpen && (
                  <div className="pb-1">
                    {[
                      {
                        key: '1_week',
                        label: t('common.datePreset.oneWeekFromNow', '1 week from now'),
                      },
                      {
                        key: '2_weeks',
                        label: t('common.datePreset.twoWeeksFromNow', '2 weeks from now'),
                      },
                      {
                        key: '1_month',
                        label: t('common.datePreset.oneMonthFromNow', '1 month from now'),
                      },
                      {
                        key: '2_months',
                        label: t('common.datePreset.twoMonthsFromNow', '2 months from now'),
                      },
                      { key: 'custom', label: t('common.custom', 'Custom') },
                    ].map((p) => {
                      const checked = cyclesSelectedStartDatePresets.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (p.key === 'custom') {
                                if (checked) {
                                  setCyclesSelectedStartDatePresets((prev) =>
                                    prev.filter((k) => k !== 'custom'),
                                  );
                                  setCyclesStartAfter(null);
                                  setCyclesStartBefore(null);
                                } else {
                                  setCyclesSelectedStartDatePresets((prev) => [...prev, 'custom']);
                                  setCyclesFiltersDropdownOpen(null);
                                  setCyclesDateRangeModal('start');
                                }
                                return;
                              }

                              setCyclesSelectedStartDatePresets((prev) =>
                                prev.includes(p.key)
                                  ? prev.filter((k) => k !== p.key)
                                  : [...prev, p.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesDueSectionOpen((o) => !o)}
                >
                  <span>{t('common.dueDate', 'Due date')}</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesDueSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesDueSectionOpen && (
                  <div className="pb-1">
                    {[
                      {
                        key: '1_week',
                        label: t('common.datePreset.oneWeekFromNow', '1 week from now'),
                      },
                      {
                        key: '2_weeks',
                        label: t('common.datePreset.twoWeeksFromNow', '2 weeks from now'),
                      },
                      {
                        key: '1_month',
                        label: t('common.datePreset.oneMonthFromNow', '1 month from now'),
                      },
                      {
                        key: '2_months',
                        label: t('common.datePreset.twoMonthsFromNow', '2 months from now'),
                      },
                      { key: 'custom', label: t('common.custom', 'Custom') },
                    ].map((p) => {
                      const checked = cyclesSelectedDueDatePresets.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (p.key === 'custom') {
                                if (checked) {
                                  setCyclesSelectedDueDatePresets((prev) =>
                                    prev.filter((k) => k !== 'custom'),
                                  );
                                  setCyclesDueAfter(null);
                                  setCyclesDueBefore(null);
                                } else {
                                  setCyclesSelectedDueDatePresets((prev) => [...prev, 'custom']);
                                  setCyclesFiltersDropdownOpen(null);
                                  setCyclesDateRangeModal('due');
                                }
                                return;
                              }

                              setCyclesSelectedDueDatePresets((prev) =>
                                prev.includes(p.key)
                                  ? prev.filter((k) => k !== p.key)
                                  : [...prev, p.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Dropdown>
          <Button
            size="sm"
            className="gap-1.5 text-[13px] font-medium"
            onClick={() => setCreateCycleOpen(true)}
          >
            <IconPlus /> {t('header.cycles.addCycle', 'Add cycle')}
          </Button>
        </>
      );
    }
    if (section === 'modules') {
      const listActive = currentLayout === 'list';
      const galleryActive = currentLayout === 'gallery';
      const timelineActive = currentLayout === 'timeline';
      const modulesSearch = modulesFilter.search ?? '';
      const showSearchInput = modulesSearchExpanded || modulesSearch.length > 0;
      return (
        <>
          {showSearchInput ? (
            <div className="flex h-8 min-w-35 max-w-50 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2">
              <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                <IconSearch />
              </span>
              <input
                ref={modulesSearchInputRef}
                type="text"
                value={modulesSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  modulesFilter.setSearch(v);
                }}
                onBlur={() => {
                  if (modulesSearch.length === 0) setModulesSearchExpanded(false);
                }}
                placeholder={t('common.search', 'Search')}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                aria-label={t('header.modules.searchModules', 'Search modules')}
              />
              {modulesSearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    modulesFilter.setSearch('');
                  }}
                  className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                  aria-label={t('common.clearSearch', 'Clear search')}
                >
                  <IconX />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModulesSearchExpanded(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
              aria-label={t('header.modules.searchModules', 'Search modules')}
            >
              <IconSearch />
            </button>
          )}
          <Dropdown
            id="modules-sort"
            openId={modulesSortOpen}
            onOpen={setModulesSortOpen}
            label={t('common.sortBy', 'Sort by')}
            icon={<IconArrowUpDown />}
            displayValue={(() => {
              const sort = modulesFilter.sort || 'progress';
              const labels: Record<string, string> = {
                name: t('common.name', 'Name'),
                progress: t('common.progress', 'Progress'),
                work_items: t('header.modules.numberOfWorkItems', 'Number of work items'),
                due_date: t('common.dueDate', 'Due date'),
                created_date: t('common.createdDate', 'Created date'),
                manual: t('common.manual', 'Manual'),
              };
              return labels[sort] ?? t('common.progress', 'Progress');
            })()}
            panelClassName="min-w-[200px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            align="left"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconArrowUpDown />
                </span>
                <span className="truncate">
                  {(() => {
                    const sort = modulesFilter.sort || 'progress';
                    const labels: Record<string, string> = {
                      name: t('common.name', 'Name'),
                      progress: t('common.progress', 'Progress'),
                      work_items: t('header.modules.numberOfWorkItems', 'Number of work items'),
                      due_date: t('common.dueDate', 'Due date'),
                      created_date: t('common.createdDate', 'Created date'),
                      manual: t('common.manual', 'Manual'),
                    };
                    return labels[sort] ?? t('common.progress', 'Progress');
                  })()}
                </span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </>
            }
            triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            {[
              { value: 'name', label: t('common.name', 'Name') },
              { value: 'progress', label: t('common.progress', 'Progress') },
              {
                value: 'work_items',
                label: t('header.modules.numberOfWorkItems', 'Number of work items'),
              },
              { value: 'due_date', label: t('common.dueDate', 'Due date') },
              { value: 'created_date', label: t('common.createdDate', 'Created date') },
              { value: 'manual', label: t('common.manual', 'Manual') },
            ].map((opt) => {
              const current = modulesFilter.sort || 'progress';
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    modulesFilter.setSort(opt.value);
                    if (!modulesFilter.order) modulesFilter.setOrder('asc');
                    setModulesSortOpen(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  {opt.label}
                  {current === opt.value && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-1 border-t border-(--border-subtle)" />
            {['asc', 'desc'].map((orderValue) => {
              const currentOrder = modulesFilter.order || 'asc';
              const label =
                orderValue === 'asc'
                  ? t('common.ascending', 'Ascending')
                  : t('common.descending', 'Descending');
              return (
                <button
                  key={orderValue}
                  type="button"
                  onClick={() => {
                    modulesFilter.setOrder(orderValue as 'asc' | 'desc');
                    setModulesSortOpen(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  {label}
                  {currentOrder === orderValue && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              );
            })}
          </Dropdown>
          <div className="relative shrink-0">
            <Dropdown
              id="modules-filters"
              openId={modulesFiltersOpen}
              onOpen={setModulesFiltersOpen}
              label={t('header.filters', 'Filters')}
              icon={<IconFilter />}
              displayValue={t('header.filters', 'Filters')}
              panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
              align="right"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">{t('header.filters', 'Filters')}</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconChevronDown />
                  </span>
                </>
              }
              triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <ModuleFiltersPanel
                workspaceSlug={workspaceSlug}
                onOpenDateModal={(which) => {
                  setModulesFiltersOpen(null);
                  setModulesDateRangeModal(which);
                }}
              />
            </Dropdown>
            {[
              modulesFilter.search.trim(),
              modulesFilter.favorites ? '1' : '',
              modulesFilter.status.join(','),
              modulesFilter.lead.join(','),
              modulesFilter.members.join(','),
              modulesFilter.startDateList.join(','),
              modulesFilter.dueDateList.join(','),
            ].some(Boolean) && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
            <Tooltip content={t('header.modules.listLayout', 'List layout')}>
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('list')}
                className={`flex size-7 items-center justify-center rounded-l-md text-(--txt-icon-secondary) transition-colors ${
                  listActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={listActive}
              >
                <IconList />
              </button>
            </Tooltip>
            <Tooltip content={t('header.modules.galleryLayout', 'Gallery layout')}>
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('gallery')}
                className={`flex size-7 items-center justify-center text-(--txt-icon-secondary) transition-colors ${
                  galleryActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={galleryActive}
              >
                <IconLayoutGrid />
              </button>
            </Tooltip>
            <Tooltip content={t('header.modules.timelineLayout', 'Timeline layout')}>
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('timeline')}
                className={`flex size-7 items-center justify-center rounded-r-md text-(--txt-icon-secondary) transition-colors ${
                  timelineActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={timelineActive}
              >
                <IconStack />
              </button>
            </Tooltip>
          </div>
          <Button
            size="sm"
            className="ml-1 gap-1.5 h-8 text-[13px] font-medium"
            type="button"
            onClick={() => setCreateModuleOpen(true)}
          >
            <IconPlus /> {t('header.modules.addModule', 'Add Module')}
          </Button>
        </>
      );
    }
    if (section === 'pages') {
      return (
        <Button
          size="sm"
          className="gap-1.5 text-[13px] font-medium"
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(PROJECT_PAGES_CREATE_EVENT))}
        >
          <IconPlus /> {t('header.pages.addPage', 'Add page')}
        </Button>
      );
    }
    if (section === 'views') {
      const activeFilters =
        viewsFavOnly ||
        !!viewsCreatedDate ||
        !!viewsCreatedAfter ||
        !!viewsCreatedBefore ||
        viewsCreatedBy.length > 0;
      const sortLabel =
        viewsDisplay.sortBy === 'name'
          ? t('common.name', 'Name')
          : viewsDisplay.sortBy === 'created_at'
            ? t('common.createdAt', 'Created at')
            : t('common.updatedAt', 'Updated at');
      return (
        <>
          <div className="flex items-center">
            {!viewsSearchOpen && (
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                aria-label={t('header.views.searchViews', 'Search views')}
                onClick={() => setViewsSearchOpen(true)}
              >
                <IconSearch />
              </button>
            )}
            <div
              className={`ml-2 overflow-hidden transition-[width] duration-200 ease-out ${
                viewsSearchOpen ? 'w-64' : 'w-0'
              }`}
            >
              <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  value={viewsSearchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setViewsSearchQuery(v);
                    dispatchViewsFilters({ query: v });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (viewsSearchQuery.trim()) {
                        setViewsSearchQuery('');
                        dispatchViewsFilters({ query: '' });
                      } else {
                        setViewsSearchOpen(false);
                      }
                    }
                  }}
                  placeholder={t('common.search', 'Search')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                  aria-label={t('common.search', 'Search')}
                />
                {viewsSearchOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewsSearchQuery('');
                      dispatchViewsFilters({ query: '' });
                      setViewsSearchOpen(false);
                    }}
                    className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                    aria-label={t('common.clearSearch', 'Clear search')}
                  >
                    <IconX />
                  </button>
                )}
              </div>
            </div>
          </div>
          <Dropdown
            id="project-views-sort"
            openId={viewsSortOpen}
            onOpen={setViewsSortOpen}
            label={t('common.sortBy', 'Sort by')}
            icon={<IconArrowUpDown />}
            displayValue={sortLabel}
            align="right"
            panelClassName="min-w-[180px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconArrowUpDown />
                </span>
                <span className="truncate">{sortLabel}</span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </>
            }
            triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            {[
              { value: 'updated_at', label: t('common.updatedAt', 'Updated at') },
              { value: 'created_at', label: t('common.createdAt', 'Created at') },
              { value: 'name', label: t('common.name', 'Name') },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setDisplay((prev) => ({
                    ...prev,
                    sortBy: opt.value as typeof prev.sortBy,
                  }));
                  setViewsSortOpen(null);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                {opt.label}
                {viewsDisplay.sortBy === opt.value && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-(--border-subtle)" />
            {(['desc', 'asc'] as const).map((orderValue) => (
              <button
                key={orderValue}
                type="button"
                onClick={() => {
                  setDisplay((prev) => ({ ...prev, sortOrder: orderValue }));
                  setViewsSortOpen(null);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                {orderValue === 'desc'
                  ? t('common.descending', 'Descending')
                  : t('common.ascending', 'Ascending')}
                {viewsDisplay.sortOrder === orderValue && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
          </Dropdown>
          <div className="relative shrink-0">
            <Dropdown
              id="project-views-filters"
              openId={viewsFiltersOpen}
              onOpen={setViewsFiltersOpen}
              label={t('header.filters', 'Filters')}
              icon={<IconFilter />}
              displayValue={t('header.filters', 'Filters')}
              align="right"
              panelClassName="flex w-[300px] max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">{t('header.filters', 'Filters')}</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconChevronDown />
                  </span>
                </>
              }
              triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
                <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    value={viewsSearchQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setViewsSearchQuery(v);
                      dispatchViewsFilters({ query: v });
                    }}
                    placeholder={t('common.search', 'Search')}
                    className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-2">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)">
                  <input
                    type="checkbox"
                    checked={viewsFavOnly}
                    onChange={() => {
                      setViewsFavOnly((prev) => {
                        const next = !prev;
                        dispatchViewsFilters({ favoritesOnly: next });
                        return next;
                      });
                    }}
                    className="rounded border-(--border-subtle)"
                  />
                  <span>{t('common.favorites', 'Favorites')}</span>
                </label>

                <div className="mt-2">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-(--txt-tertiary)">
                    <span>{t('common.createdDate', 'Created date')}</span>
                  </div>
                  {[
                    { id: '1_week', label: t('common.datePreset.oneWeekAgo', '1 week ago') },
                    { id: '2_weeks', label: t('common.datePreset.twoWeeksAgo', '2 weeks ago') },
                    { id: '1_month', label: t('common.datePreset.oneMonthAgo', '1 month ago') },
                    { id: 'custom', label: t('common.customRange', 'Custom range') },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                    >
                      <input
                        type="radio"
                        name="views-created-date"
                        checked={viewsCreatedDate === opt.id}
                        onChange={() => {
                          const nextPreset = opt.id as '1_week' | '2_weeks' | '1_month' | 'custom';
                          setViewsCreatedDate(nextPreset);
                          if (nextPreset !== 'custom') {
                            setViewsCreatedAfter(null);
                            setViewsCreatedBefore(null);
                          }
                          dispatchViewsFilters({
                            createdDatePreset: nextPreset,
                            createdAfter: nextPreset === 'custom' ? viewsCreatedAfter : null,
                            createdBefore: nextPreset === 'custom' ? viewsCreatedBefore : null,
                          });
                        }}
                        className="border-(--border-subtle)"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm text-(--txt-tertiary) hover:bg-(--bg-layer-2-hover)"
                    onClick={() => {
                      setViewsCreatedDate(null);
                      setViewsCreatedAfter(null);
                      setViewsCreatedBefore(null);
                      dispatchViewsFilters({
                        createdDatePreset: null,
                        createdAfter: null,
                        createdBefore: null,
                      });
                    }}
                  >
                    {t('header.views.clearCreatedDate', 'Clear created date')}
                  </button>
                  {viewsCreatedDate === 'custom' && (
                    <div className="px-3 pb-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-(--txt-tertiary)">
                            {t('common.after', 'After')}
                          </label>
                          <input
                            type="date"
                            value={viewsCreatedAfter ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value || null;
                              setViewsCreatedAfter(nextValue);
                              dispatchViewsFilters({
                                createdDatePreset: 'custom',
                                createdAfter: nextValue,
                                createdBefore: viewsCreatedBefore,
                              });
                            }}
                            className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-(--txt-tertiary)">
                            {t('common.before', 'Before')}
                          </label>
                          <input
                            type="date"
                            value={viewsCreatedBefore ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value || null;
                              setViewsCreatedBefore(nextValue);
                              dispatchViewsFilters({
                                createdDatePreset: 'custom',
                                createdAfter: viewsCreatedAfter,
                                createdBefore: nextValue,
                              });
                            }}
                            className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-(--txt-tertiary)">
                    <span>{t('common.createdBy', 'Created by')}</span>
                  </div>
                  {viewsMembers.map((m) => {
                    const checked = viewsCreatedBy.includes(m.member_id);
                    const label = m.member_display_name ?? m.member_email ?? m.member_id;
                    return (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setViewsCreatedBy((prev) => {
                              const next = checked
                                ? prev.filter((id) => id !== m.member_id)
                                : [...prev, m.member_id];
                              dispatchViewsFilters({ createdByIds: next });
                              return next;
                            });
                          }}
                          className="rounded border-(--border-subtle)"
                        />
                        {m.member_avatar ? (
                          <img
                            src={m.member_avatar}
                            alt=""
                            className="size-5 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--bg-layer-2) text-[10px] text-(--txt-secondary)">
                            {label.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Dropdown>
            {activeFilters && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-[13px] font-medium"
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('project-views-create-open'));
            }}
          >
            <IconPlus /> {t('common.addView', 'Add view')}
          </Button>
        </>
      );
    }
    return null;
  };

  return (
    <>
      <div className="relative flex items-center gap-1 text-sm" ref={projectDropdownRef}>
        <Link
          to={issuesUrl}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
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
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
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
        <span className="shrink-0 text-(--txt-placeholder)" aria-hidden>
          /
        </span>
        <ProjectSectionDropdown
          baseUrl={baseUrl}
          currentSection={section}
          issueCount={issueCount}
        />
      </div>
      <div className="flex items-center gap-1">{rightActions()}</div>
      {section === 'modules' && (
        <>
          <CreateModuleModal
            open={createModuleOpen}
            onClose={() => setCreateModuleOpen(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            projectName={projectName}
            onCreated={() => {
              setCreateModuleOpen(false);
              window.dispatchEvent(new CustomEvent('modules-refresh'));
            }}
          />
          <DateRangeModal
            open={modulesDateRangeModal !== null}
            onClose={() => setModulesDateRangeModal(null)}
            title={
              modulesDateRangeModal === 'start'
                ? t('common.startDateRange', 'Start date range')
                : t('common.dueDateRange', 'Due date range')
            }
            after={
              modulesDateRangeModal === 'start'
                ? (modulesFilter.startAfter ?? null)
                : (modulesFilter.dueAfter ?? null)
            }
            before={
              modulesDateRangeModal === 'start'
                ? (modulesFilter.startBefore ?? null)
                : (modulesFilter.dueBefore ?? null)
            }
            onApply={(after, before) => {
              if (modulesDateRangeModal === 'start') {
                modulesFilter.setStartDateList(['custom']);
                modulesFilter.setStartAfter(after);
                modulesFilter.setStartBefore(before);
              } else {
                modulesFilter.setDueDateList(['custom']);
                modulesFilter.setDueAfter(after);
                modulesFilter.setDueBefore(before);
              }
              setModulesDateRangeModal(null);
            }}
          />
        </>
      )}
      {section === 'issues' && (
        <DateRangeModal
          open={issuesDateRangeModal !== null}
          onClose={() => setIssuesDateRangeModal(null)}
          title={
            issuesDateRangeModal === 'start'
              ? t('common.startDateRange', 'Start date range')
              : t('common.dueDateRange', 'Due date range')
          }
          after={
            issuesDateRangeModal === 'start' ? issuesFilters.startAfter : issuesFilters.dueAfter
          }
          before={
            issuesDateRangeModal === 'start' ? issuesFilters.startBefore : issuesFilters.dueBefore
          }
          onApply={(after, before) => {
            if (issuesDateRangeModal === 'start') {
              setIssuesFilters((prev) => ({
                ...prev,
                startDate: prev.startDate.includes('custom')
                  ? prev.startDate
                  : [...prev.startDate, 'custom'],
                startAfter: after,
                startBefore: before,
              }));
            } else {
              setIssuesFilters((prev) => ({
                ...prev,
                dueDate: prev.dueDate.includes('custom')
                  ? prev.dueDate
                  : [...prev.dueDate, 'custom'],
                dueAfter: after,
                dueBefore: before,
              }));
            }
            setIssuesDateRangeModal(null);
          }}
        />
      )}
      {section === 'cycles' && (
        <>
          <DateRangeModal
            open={cyclesDateRangeModal !== null}
            onClose={() => setCyclesDateRangeModal(null)}
            title={
              cyclesDateRangeModal === 'start'
                ? t('common.startDateRange', 'Start date range')
                : t('common.dueDateRange', 'Due date range')
            }
            after={cyclesDateRangeModal === 'start' ? cyclesStartAfter : cyclesDueAfter}
            before={cyclesDateRangeModal === 'start' ? cyclesStartBefore : cyclesDueBefore}
            onApply={(after, before) => {
              if (cyclesDateRangeModal === 'start') {
                setCyclesStartAfter(after);
                setCyclesStartBefore(before);
              } else {
                setCyclesDueAfter(after);
                setCyclesDueBefore(before);
              }
              setCyclesDateRangeModal(null);
            }}
          />
          <CreateCycleModal
            open={createCycleOpen}
            onClose={() => setCreateCycleOpen(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            onCreated={(_created, targetProjectId) => {
              setCreateCycleOpen(false);
              if (targetProjectId !== projectId) {
                navigate(`/${workspaceSlug}/projects/${targetProjectId}/cycles`);
              }
              window.dispatchEvent(
                new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
                  detail: { workspaceSlug, projectId: targetProjectId },
                }),
              );
            }}
          />
        </>
      )}
    </>
  );
}

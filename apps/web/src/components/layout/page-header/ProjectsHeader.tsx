import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, Button } from '../../ui';
import { Dropdown } from '../../work-item';
import { CollapsibleSection } from '../../workspace-views/WorkspaceViewsFiltersShared';
import { DateRangeModal } from '../../workspace-views/DateRangeModal';
import { useAuth } from '../../../contexts/AuthContext';
import { workspaceService } from '../../../services/workspaceService';
import type { WorkspaceMemberApiResponse } from '../../../api/types';
import { parseProjectsListSearchParams } from '../../../lib/projectsListSearchParams';
import {
  IconBriefcase,
  IconSearch,
  IconX,
  IconArrowUpDown,
  IconChevronUp,
  IconChevronDown,
  IconCheck,
  IconFilter,
  IconLock,
  IconGlobe,
  IconPlus,
} from './icons';

export function ProjectsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const {
    sortField,
    sortDir,
    accessFilters: selectedAccess,
    leadFilters: selectedLeadIds,
    memberFilters: selectedMemberIds,
    myProjectsOnly,
    createdDateFilter,
    createdAfter,
    createdBefore,
    favoritesOnly,
  } = parseProjectsListSearchParams(searchParams);
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState<string | null>(null);
  const [projectsDateRangeModalOpen, setProjectsDateRangeModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(!!searchQuery);
  const [projectsFiltersSearch, setProjectsFiltersSearch] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [projectsFilterSectionOpen, setProjectsFilterSectionOpen] = useState({
    createdDate: true,
    access: true,
    lead: true,
    members: true,
  });

  const baseUrl = `/${workspaceSlug}`;
  const sortFieldLabelMap: Record<typeof sortField, string> = {
    manual: t('common.manual', 'Manual'),
    name: t('common.name', 'Name'),
    created_date: t('common.createdDate', 'Created date'),
    member_count: t('header.projects.memberCount', 'Number of members'),
  };
  const activeFilterCount =
    (favoritesOnly ? 1 : 0) +
    (myProjectsOnly ? 1 : 0) +
    (createdDateFilter ? 1 : 0) +
    selectedAccess.length +
    selectedLeadIds.length +
    selectedMemberIds.length;

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((members) => {
        if (!cancelled) setWorkspaceMembers(members ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorkspaceMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const updateParam = (
    key:
      | 'q'
      | 'sort'
      | 'sortField'
      | 'sortDir'
      | 'filter'
      | 'access'
      | 'lead'
      | 'members'
      | 'myProjects'
      | 'createdDate'
      | 'createdAfter'
      | 'createdBefore',
    value?: string,
  ) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const updateParams = (
    updates: Partial<
      Record<
        | 'q'
        | 'sort'
        | 'sortField'
        | 'sortDir'
        | 'filter'
        | 'access'
        | 'lead'
        | 'members'
        | 'myProjects'
        | 'createdDate'
        | 'createdAfter'
        | 'createdBefore',
        string | undefined
      >
    >,
  ) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };
  const setCsvParam = (key: 'access' | 'lead' | 'members', values: string[]) => {
    updateParam(key, values.length ? values.join(',') : undefined);
  };
  const toggleCsvParam = (key: 'access' | 'lead' | 'members', value: string) => {
    const current =
      key === 'access' ? selectedAccess : key === 'lead' ? selectedLeadIds : selectedMemberIds;
    setCsvParam(
      key,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };

  const memberOptions = [
    ...(authUser
      ? [
          {
            id: authUser.id,
            label: t('common.you', 'You'),
            avatarUrl: authUser.avatarUrl,
            sortLabel: 'You',
          },
        ]
      : []),
    ...workspaceMembers
      .filter((member) => member.member_id !== authUser?.id)
      .map((member) => ({
        id: member.member_id,
        label:
          member.member_display_name?.trim() ||
          member.member_email?.trim() ||
          member.member_id.slice(0, 8),
        avatarUrl: member.member_avatar ?? null,
        sortLabel:
          member.member_display_name?.trim() || member.member_email?.trim() || member.member_id,
      })),
  ].sort((a, b) => a.sortLabel.localeCompare(b.sortLabel));
  const normalizedFilterSearch = projectsFiltersSearch.trim().toLowerCase();
  const includeBySearch = (label: string) =>
    !normalizedFilterSearch || label.toLowerCase().includes(normalizedFilterSearch);
  const visibleLeadOptions = memberOptions.filter((opt) => includeBySearch(opt.label));
  const visibleMemberOptions = memberOptions.filter((opt) => includeBySearch(opt.label));
  const leadOptionsToRender = showAllLeads ? visibleLeadOptions : visibleLeadOptions.slice(0, 5);
  const memberOptionsToRender = showAllMembers
    ? visibleMemberOptions
    : visibleMemberOptions.slice(0, 5);

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconBriefcase />
        </span>
        {t('header.projects.title', 'Projects')}
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <div
          className={`overflow-hidden transition-[width] duration-200 ease-out ${searchOpen ? 'w-56' : 'w-0'}`}
        >
          <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
            <span className="shrink-0 text-(--txt-icon-tertiary)">
              <IconSearch />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder={t('header.projects.searchPlaceholder', 'Search projects')}
              className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              aria-label={t('header.projects.searchPlaceholder', 'Search projects')}
            />
            <button
              type="button"
              onClick={() => {
                updateParam('q');
                setSearchOpen(false);
              }}
              className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
              aria-label={t('common.clearSearch', 'Clear search')}
            >
              <IconX />
            </button>
          </div>
        </div>
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)"
            aria-label={t('header.projects.searchPlaceholder', 'Search projects')}
          >
            <IconSearch />
          </button>
        )}
        <Dropdown
          id="projects-sort"
          openId={projectsDropdownOpen}
          onOpen={setProjectsDropdownOpen}
          label={t('header.projects.sortProjects', 'Sort projects')}
          icon={<IconArrowUpDown />}
          displayValue={sortFieldLabelMap[sortField]}
          panelClassName="min-w-52 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
          triggerContent={
            <>
              <span className="text-(--txt-icon-tertiary)">
                <IconArrowUpDown />
              </span>
              <span className="truncate">{sortFieldLabelMap[sortField]}</span>
              {projectsDropdownOpen === 'projects-sort' ? <IconChevronUp /> : <IconChevronDown />}
            </>
          }
          triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
        >
          {[
            { value: 'manual', label: t('common.manual', 'Manual') },
            { value: 'name', label: t('common.name', 'Name') },
            { value: 'created_date', label: t('common.createdDate', 'Created date') },
            { value: 'member_count', label: t('header.projects.memberCount', 'Number of members') },
          ].map((opt) => {
            const active = sortField === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  active
                    ? 'text-(--txt-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                }`}
                onClick={() => {
                  updateParams({
                    sortField: opt.value,
                    sort: undefined,
                    ...(opt.value === 'manual' ? { sortDir: undefined } : {}),
                  });
                }}
              >
                <span>{opt.label}</span>
                {active ? <IconCheck /> : null}
              </button>
            );
          })}
          <div className="mx-2 my-1 h-px bg-(--border-subtle)" />
          {[
            { value: 'asc', label: t('common.ascending', 'Ascending') },
            { value: 'desc', label: t('common.descending', 'Descending') },
          ].map((opt) => {
            const active = sortDir === opt.value;
            const disabled = sortField === 'manual';
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  active
                    ? 'text-(--txt-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                } ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  updateParams({ sortDir: opt.value, sort: undefined });
                }}
              >
                <span>{opt.label}</span>
                {active ? <IconCheck /> : null}
              </button>
            );
          })}
        </Dropdown>
        <Dropdown
          id="projects-filters"
          openId={projectsDropdownOpen}
          onOpen={setProjectsDropdownOpen}
          label={t('header.projects.filterProjects', 'Filter projects')}
          icon={<IconFilter />}
          displayValue={
            activeFilterCount > 0
              ? t('header.filtersWithCount', 'Filters ({{count}})', { count: activeFilterCount })
              : t('header.filters', 'Filters')
          }
          panelClassName="w-80 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
          triggerContent={
            <>
              <span className="text-(--txt-icon-tertiary)">
                <IconFilter />
              </span>
              <span className="truncate">
                {activeFilterCount > 0
                  ? t('header.filtersWithCount', 'Filters ({{count}})', {
                      count: activeFilterCount,
                    })
                  : t('header.filters', 'Filters')}
              </span>
              {projectsDropdownOpen === 'projects-filters' ? (
                <IconChevronUp />
              ) : (
                <IconChevronDown />
              )}
            </>
          }
          triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
        >
          <div className="px-3 py-1">
            <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                value={projectsFiltersSearch}
                onChange={(e) => setProjectsFiltersSearch(e.target.value)}
                placeholder={t('common.search', 'Search')}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                aria-label={t('header.projects.searchFilters', 'Search project filters')}
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={() => updateParam('filter', favoritesOnly ? '' : 'favorites')}
                className="rounded border-(--border-subtle)"
              />
              <span>{t('common.favorites', 'Favorites')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
              <input
                type="checkbox"
                checked={myProjectsOnly}
                onChange={() => updateParam('myProjects', myProjectsOnly ? '' : '1')}
                className="rounded border-(--border-subtle)"
              />
              <span>{t('header.projects.myProjects', 'My projects')}</span>
            </label>
            <CollapsibleSection
              title={t('header.projects.access', 'Access')}
              open={projectsFilterSectionOpen.access}
              onToggle={() =>
                setProjectsFilterSectionOpen((prev) => ({ ...prev, access: !prev.access }))
              }
            >
              {[
                {
                  value: 'private' as const,
                  label: t('common.private', 'Private'),
                  icon: <IconLock />,
                },
                {
                  value: 'public' as const,
                  label: t('common.public', 'Public'),
                  icon: <IconGlobe />,
                },
              ]
                .filter((opt) => includeBySearch(opt.label))
                .map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccess.includes(opt.value)}
                      onChange={() => toggleCsvParam('access', opt.value)}
                      className="rounded border-(--border-subtle)"
                    />
                    <span className="text-(--txt-icon-tertiary)">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </label>
                ))}
            </CollapsibleSection>
            <CollapsibleSection
              title={t('header.projects.lead', 'Lead')}
              open={projectsFilterSectionOpen.lead}
              onToggle={() =>
                setProjectsFilterSectionOpen((prev) => ({ ...prev, lead: !prev.lead }))
              }
            >
              {leadOptionsToRender.map((opt) => (
                <label
                  key={`lead-${opt.id}`}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                >
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(opt.id)}
                    onChange={() => toggleCsvParam('lead', opt.id)}
                    className="rounded border-(--border-subtle)"
                  />
                  <Avatar
                    name={opt.label}
                    src={opt.avatarUrl}
                    size="sm"
                    className="h-5 w-5 text-[10px]"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
              {visibleLeadOptions.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllLeads((prev) => !prev)}
                  className="px-3 py-1 text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
                >
                  {showAllLeads
                    ? t('common.viewLess', 'View less')
                    : t('common.viewAll', 'View all')}
                </button>
              )}
            </CollapsibleSection>
            <CollapsibleSection
              title={t('header.projects.members', 'Members')}
              open={projectsFilterSectionOpen.members}
              onToggle={() =>
                setProjectsFilterSectionOpen((prev) => ({ ...prev, members: !prev.members }))
              }
            >
              {memberOptionsToRender.map((opt) => (
                <label
                  key={`member-${opt.id}`}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(opt.id)}
                    onChange={() => toggleCsvParam('members', opt.id)}
                    className="rounded border-(--border-subtle)"
                  />
                  <Avatar
                    name={opt.label}
                    src={opt.avatarUrl}
                    size="sm"
                    className="h-5 w-5 text-[10px]"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
              {visibleMemberOptions.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers((prev) => !prev)}
                  className="px-3 py-1 text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
                >
                  {showAllMembers
                    ? t('common.viewLess', 'View less')
                    : t('common.viewAll', 'View all')}
                </button>
              )}
            </CollapsibleSection>
            <CollapsibleSection
              title={t('common.createdDate', 'Created date')}
              open={projectsFilterSectionOpen.createdDate}
              onToggle={() =>
                setProjectsFilterSectionOpen((prev) => ({
                  ...prev,
                  createdDate: !prev.createdDate,
                }))
              }
            >
              {[
                { value: 'today', label: t('common.today', 'Today') },
                { value: 'last7', label: t('common.last7Days', 'Last 7 days') },
                { value: 'last30', label: t('common.last30Days', 'Last 30 days') },
                { value: 'custom', label: t('common.custom', 'Custom') },
              ]
                .filter((opt) => includeBySearch(opt.label))
                .map((opt) => {
                  const active = createdDateFilter === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          if (active) {
                            updateParams({
                              createdDate: undefined,
                              createdAfter: undefined,
                              createdBefore: undefined,
                            });
                            return;
                          }
                          if (opt.value === 'custom') {
                            setProjectsDateRangeModalOpen(true);
                            return;
                          }
                          updateParams({
                            createdDate: opt.value,
                            createdAfter: undefined,
                            createdBefore: undefined,
                          });
                        }}
                        className="rounded border-(--border-subtle)"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
            </CollapsibleSection>
          </div>
        </Dropdown>
        <Link to={`${baseUrl}/projects?createProject=1`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus />
            {t('header.projects.addProject', 'Add Project')}
          </Button>
        </Link>
      </div>
      <DateRangeModal
        open={projectsDateRangeModalOpen}
        onClose={() => setProjectsDateRangeModalOpen(false)}
        title={t('common.createdDateRange', 'Created date range')}
        after={createdAfter}
        before={createdBefore}
        onApply={(after, before) => {
          updateParams({
            createdDate: 'custom',
            createdAfter: after,
            createdBefore: before,
          });
          setProjectsDateRangeModalOpen(false);
        }}
      />
    </>
  );
}

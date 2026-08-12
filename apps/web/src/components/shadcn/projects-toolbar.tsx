import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Check, Filter, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import { workspaceService } from '../../services/workspaceService';
import {
  parseProjectsListSearchParams,
  type ProjectsCreatedDateFilter,
  type ProjectsSortField,
} from '../../lib/projectsListSearchParams';
import type { WorkspaceMemberApiResponse } from '../../api/types';

/** How many leads/members to list before the dropdown gets unwieldy. */
const MAX_PEOPLE_LISTED = 8;

/**
 * Search, filter and sort controls for the projects list, written against the
 * same URL parameters as the shipped ProjectsHeader.
 *
 * It lives in the v2 shell's header rather than the page, mirroring how the
 * shipped app puts its toolbar in AppShell's header.
 */
export function ProjectsToolbar({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = parseProjectsListSearchParams(searchParams);

  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [searchOpen, setSearchOpen] = useState(!!state.searchQuery);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (!cancelled) setMembers(list ?? []);
      })
      .catch(() => {
        /* People filters just stay empty if the member list cannot be read. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  /** Writes one parameter, dropping it entirely when the value is empty. */
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  /** Adds or removes one entry of a comma-separated parameter. */
  const toggleCsvParam = (key: string, value: string) => {
    const current = (searchParams.get(key) ?? '').split(',').filter(Boolean);
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    setParam(key, next.join(','));
  };

  const activeFilterCount =
    (state.favoritesOnly ? 1 : 0) +
    (state.myProjectsOnly ? 1 : 0) +
    (state.createdDateFilter ? 1 : 0) +
    state.accessFilters.length +
    state.leadFilters.length +
    state.memberFilters.length;

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'favorites',
      'mine',
      'createdDate',
      'createdAfter',
      'createdBefore',
      'access',
      'lead',
      'member',
    ].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const sortFieldLabels: Record<ProjectsSortField, string> = {
    manual: t('common.manual', 'Manual'),
    name: t('common.name', 'Name'),
    created_date: t('common.createdDate', 'Created date'),
    member_count: t('header.projects.memberCount', 'Number of members'),
  };

  const createdDateOptions: Array<{ value: ProjectsCreatedDateFilter; label: string }> = [
    { value: '', label: t('common.anyTime', 'Any time') },
    { value: 'today', label: t('common.today', 'Today') },
    { value: 'last7', label: t('common.last7Days', 'Last 7 days') },
    { value: 'last30', label: t('common.last30Days', 'Last 30 days') },
  ];

  const peopleLabel = (member: WorkspaceMemberApiResponse) =>
    member.member_display_name || member.member_email || t('common.member', 'Member');

  return (
    <div className="ml-auto flex items-center gap-1 pr-4">
      {searchOpen ? (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={state.searchQuery}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder={t('header.projects.searchPlaceholder', 'Search projects')}
            aria-label={t('header.projects.searchPlaceholder', 'Search projects')}
            className="h-8 w-56 pr-8 pl-8"
            autoFocus
          />
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={() => {
              setParam('q', null);
              setSearchOpen(false);
            }}
            aria-label={t('common.clearSearch', 'Clear search')}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          aria-label={t('header.projects.searchPlaceholder', 'Search projects')}
        >
          <Search />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost">
            <Filter />
            {t('common.filters', 'Filters')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
          <DropdownMenuCheckboxItem
            checked={state.favoritesOnly}
            onCheckedChange={(checked) => setParam('favorites', checked ? '1' : null)}
          >
            {t('header.projects.favoritesOnly', 'Favorites only')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={state.myProjectsOnly}
            onCheckedChange={(checked) => setParam('mine', checked ? '1' : null)}
          >
            {t('header.projects.myProjects', 'My projects')}
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('common.access', 'Access')}</DropdownMenuLabel>
          {(['public', 'private'] as const).map((access) => (
            <DropdownMenuCheckboxItem
              key={access}
              checked={state.accessFilters.includes(access)}
              onCheckedChange={() => toggleCsvParam('access', access)}
            >
              {access === 'public'
                ? t('project.create.accessPublic', 'Public')
                : t('project.create.accessSecret', 'Private')}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('common.createdDate', 'Created date')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state.createdDateFilter}
            onValueChange={(value) => setParam('createdDate', value || null)}
          >
            {createdDateOptions.map((option) => (
              <DropdownMenuRadioItem key={option.value || 'any'} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {members.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('common.lead', 'Lead')}</DropdownMenuLabel>
              {members.slice(0, MAX_PEOPLE_LISTED).map((member) => {
                const id = member.member_id ?? member.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={`lead-${member.id}`}
                    checked={state.leadFilters.includes(id)}
                    onCheckedChange={() => toggleCsvParam('lead', id)}
                  >
                    {peopleLabel(member)}
                  </DropdownMenuCheckboxItem>
                );
              })}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('common.members', 'Members')}</DropdownMenuLabel>
              {members.slice(0, MAX_PEOPLE_LISTED).map((member) => {
                const id = member.member_id ?? member.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={`member-${member.id}`}
                    checked={state.memberFilters.includes(id)}
                    onCheckedChange={() => toggleCsvParam('member', id)}
                  >
                    {peopleLabel(member)}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </>
          )}

          {activeFilterCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={clearFilters}>
                {t('common.clearFilters', 'Clear filters')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost">
            <ArrowUpDown />
            {sortFieldLabels[state.sortField]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{t('common.sortBy', 'Sort by')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state.sortField}
            onValueChange={(value) => setParam('sortField', value)}
          >
            {(Object.keys(sortFieldLabels) as ProjectsSortField[]).map((field) => (
              <DropdownMenuRadioItem key={field} value={field}>
                {sortFieldLabels[field]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {/* Manual order is absolute, so a direction would mean nothing. */}
          {state.sortField !== 'manual' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setParam('sortDir', 'asc')}>
                {t('common.ascending', 'Ascending')}
                {state.sortDir === 'asc' && <Check className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setParam('sortDir', 'desc')}>
                {t('common.descending', 'Descending')}
                {state.sortDir === 'desc' && <Check className="ml-auto" />}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Opening the dialog goes through the URL rather than local state, so
          the button can sit in the header while the dialog lives on the page.
          Matches how the shipped projects page is opened with ?createProject=1. */}
      <Button type="button" size="sm" onClick={() => setParam('createProject', '1')}>
        <Plus />
        {t('projects.createProject', 'New project')}
      </Button>
    </div>
  );
}

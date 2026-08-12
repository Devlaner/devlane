import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Filter, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import {
  parseProjectsListSearchParams,
  type ProjectsCreatedDateFilter,
} from '../../lib/projectsListSearchParams';
import type { WorkspaceMemberApiResponse } from '../../api/types';

interface FilterChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

interface ProjectsToolbarProps {
  members: WorkspaceMemberApiResponse[];
  scopeControl?: ReactNode;
}

function FilterChip({ label, removeLabel, onRemove }: FilterChipProps) {
  return (
    <Badge variant="secondary" className="h-8 gap-1 pr-1 pl-2.5">
      <span className="max-w-48 truncate">{label}</span>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="size-6 rounded-full hover:bg-background/80"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X aria-hidden="true" />
      </Button>
    </Badge>
  );
}

/**
 * Responsive projects controls for the page body. Search, filters and display
 * mode are URL-backed so the state survives reloads and can be shared.
 */
export function ProjectsToolbar({ members, scopeControl }: ProjectsToolbarProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const state = parseProjectsListSearchParams(searchParams);

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

  const removeCsvParam = (key: string, value: string) => {
    const next = (searchParams.get(key) ?? '')
      .split(',')
      .filter((entry) => entry && entry !== value);
    setParam(key, next.join(','));
  };

  const deleteParams = (keys: string[]) => {
    const next = new URLSearchParams(searchParams);
    keys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const activeFilterCount =
    (state.createdDateFilter ? 1 : 0) +
    state.accessFilters.length +
    state.leadFilters.length +
    state.memberFilters.length;

  const clearFilters = () => {
    deleteParams(['createdDate', 'createdAfter', 'createdBefore', 'access', 'lead', 'members']);
  };

  const createdDateOptions: Array<{ value: ProjectsCreatedDateFilter; label: string }> = [
    { value: '', label: t('common.anyTime', 'Any time') },
    { value: 'today', label: t('common.today', 'Today') },
    { value: 'last7', label: t('common.last7Days', 'Last 7 days') },
    { value: 'last30', label: t('common.last30Days', 'Last 30 days') },
  ];

  const peopleLabel = (member: WorkspaceMemberApiResponse) =>
    member.member_display_name || member.member_email || t('common.member', 'Member');

  const memberById = new Map(members.map((member) => [member.member_id ?? member.id, member]));
  const personLabel = (memberId: string) => {
    const member = memberById.get(memberId);
    return member ? peopleLabel(member) : memberId;
  };

  const activeFilterChips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  state.accessFilters.forEach((access) => {
    activeFilterChips.push({
      key: `access-${access}`,
      label:
        access === 'public'
          ? t('project.create.accessPublic', 'Public')
          : t('project.create.accessSecret', 'Private'),
      onRemove: () => removeCsvParam('access', access),
    });
  });

  if (state.createdDateFilter) {
    activeFilterChips.push({
      key: 'created-date',
      label:
        createdDateOptions.find((option) => option.value === state.createdDateFilter)?.label ??
        t('common.custom', 'Custom'),
      onRemove: () => deleteParams(['createdDate', 'createdAfter', 'createdBefore']),
    });
  }

  state.leadFilters.forEach((memberId) => {
    activeFilterChips.push({
      key: `lead-${memberId}`,
      label: `${t('common.lead', 'Lead')}: ${personLabel(memberId)}`,
      onRemove: () => removeCsvParam('lead', memberId),
    });
  });

  state.memberFilters.forEach((memberId) => {
    activeFilterChips.push({
      key: `member-${memberId}`,
      label: `${t('common.member', 'Member')}: ${personLabel(memberId)}`,
      onRemove: () => removeCsvParam('members', memberId),
    });
  });

  const searchQuery = searchParams.get('q') ?? '';
  const view = searchParams.get('view') === 'grid' ? 'grid' : 'table';

  return (
    <div
      className="space-y-3 rounded-xl border bg-card/50 p-3 shadow-xs sm:p-4"
      role="region"
      aria-label={t('projects.toolbar', 'Project controls')}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {scopeControl}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:ml-auto">
          <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setParam('q', event.target.value)}
                placeholder={t('header.projects.searchPlaceholder', 'Search projects')}
                aria-label={t('header.projects.searchPlaceholder', 'Search projects')}
                className="h-11 pr-12 pl-10 sm:h-9"
              />
              {searchQuery && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setParam('q', null);
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                  aria-label={t('common.clearSearch', 'Clear search')}
                  className="absolute top-1/2 right-1 size-10 -translate-y-1/2 sm:size-8"
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 justify-between sm:h-9 sm:flex-none"
                >
                  <Filter aria-hidden="true" />
                  {t('common.filters', 'Filters')}
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 min-w-5 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-[min(70vh,32rem)] w-64 overflow-y-auto"
              >
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
                    {members.map((member) => {
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
                    {members.map((member) => {
                      const id = member.member_id ?? member.id;
                      return (
                        <DropdownMenuCheckboxItem
                          key={`member-${member.id}`}
                          checked={state.memberFilters.includes(id)}
                          onCheckedChange={() => toggleCsvParam('members', id)}
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
          </div>

          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === 'grid' || value === 'table') setParam('view', value);
            }}
            variant="outline"
            spacing={0}
            className="h-11 w-full sm:h-9 sm:w-auto"
            aria-label={t('projects.viewMode', 'Project view')}
          >
            <ToggleGroupItem
              value="grid"
              className="h-11 flex-1 px-3 sm:h-9 sm:flex-none"
              aria-label={t('projects.gridView', 'Grid view')}
              title={t('projects.gridView', 'Grid view')}
            >
              <LayoutGrid aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="table"
              className="h-11 flex-1 px-3 sm:h-9 sm:flex-none"
              aria-label={t('projects.tableView', 'Table view')}
              title={t('projects.tableView', 'Table view')}
            >
              <List aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            type="button"
            className="h-11 w-full sm:h-9 sm:w-auto"
            onClick={() => setParam('createProject', '1')}
          >
            <Plus aria-hidden="true" />
            {t('projects.createProject', 'New project')}
          </Button>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          aria-label={t('projects.activeFilters', 'Active filters')}
        >
          <span className="text-muted-foreground text-xs font-medium">
            {t('projects.activeFilters', 'Active filters')}
          </span>
          {activeFilterChips.map((filter) => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              removeLabel={t('common.removeFilter', 'Remove {{filter}} filter', {
                filter: filter.label,
              })}
              onRemove={filter.onRemove}
            />
          ))}
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearFilters}>
            {t('common.clearAll', 'Clear all')}
          </Button>
        </div>
      )}
    </div>
  );
}

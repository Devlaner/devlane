import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Filter, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import type { ProjectApiResponse } from '../../api/types';

/** How many projects to list before the filter dropdown gets unwieldy. */
const MAX_PROJECTS_LISTED = 8;

interface DraftsToolbarProps {
  projects: ProjectApiResponse[];
}

interface FilterChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
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

/** Responsive, URL-backed discovery and create controls for workspace drafts. */
export function DraftsToolbar({ projects }: DraftsToolbarProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get('q') ?? '';
  const projectIds = (searchParams.get('project') ?? '').split(',').filter(Boolean);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  /** Writes one parameter, dropping it entirely when the value goes empty. */
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const toggleProject = (projectId: string) => {
    const next = projectIds.includes(projectId)
      ? projectIds.filter((id) => id !== projectId)
      : [...projectIds, projectId];
    setParam('project', next.join(','));
  };

  const clearFilters = () => setParam('project', '');

  return (
    <div
      className="space-y-3 rounded-xl border bg-card/50 p-3 shadow-xs sm:p-4"
      role="region"
      aria-label={t('drafts.toolbar', 'Draft controls')}
    >
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setParam('q', event.target.value)}
              placeholder={t('drafts.searchPlaceholder', 'Search drafts')}
              aria-label={t('drafts.searchPlaceholder', 'Search drafts')}
              className="h-11 pr-12 pl-10 sm:h-9"
            />
            {query && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setParam('q', '');
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
                {projectIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1 min-w-5 px-1.5">
                    {projectIds.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[min(70vh,32rem)] w-64 overflow-y-auto"
            >
              <DropdownMenuLabel>{t('common.projects', 'Projects')}</DropdownMenuLabel>
              {projects.length === 0 ? (
                <DropdownMenuLabel className="text-muted-foreground font-normal">
                  {t('drafts.noProjects', 'No projects yet')}
                </DropdownMenuLabel>
              ) : (
                projects.slice(0, MAX_PROJECTS_LISTED).map((project) => (
                  <DropdownMenuCheckboxItem
                    key={project.id}
                    checked={projectIds.includes(project.id)}
                    onCheckedChange={() => toggleProject(project.id)}
                  >
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {projectIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={clearFilters}>
                    <X aria-hidden="true" />
                    {t('common.clearFilters', 'Clear filters')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* `?create=1` is what the page watches to open the composer, so the
            button writes the parameter rather than reaching into the page. */}
        <Button
          type="button"
          className="col-span-2 h-11 w-full sm:h-9 sm:w-auto"
          onClick={() => setParam('create', '1')}
        >
          <Plus aria-hidden="true" />
          {t('drafts.draftWorkItem', 'Draft a work item')}
        </Button>
      </div>

      {projectIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          aria-label={t('drafts.activeFilters', 'Active filters')}
        >
          <span className="text-muted-foreground text-xs font-medium">
            {t('drafts.activeFilters', 'Active filters')}
          </span>
          {projectIds.map((projectId) => {
            const projectLabel = projectById.get(projectId)?.name ?? projectId;
            const filterLabel = `${t('common.project', 'Project')}: ${projectLabel}`;
            return (
              <FilterChip
                key={projectId}
                label={filterLabel}
                removeLabel={t('common.removeFilter', 'Remove {{filter}} filter', {
                  filter: filterLabel,
                })}
                onRemove={() => toggleProject(projectId)}
              />
            );
          })}
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearFilters}>
            {t('common.clearAll', 'Clear all')}
          </Button>
        </div>
      )}
    </div>
  );
}

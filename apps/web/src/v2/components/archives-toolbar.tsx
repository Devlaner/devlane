import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, X } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Input } from '@/v2/components/ui/input';
import type { ProjectApiResponse } from '../../api/types';

interface ArchivesToolbarProps {
  projects: ProjectApiResponse[];
  scopeControl: ReactNode;
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

/**
 * Responsive, URL-backed discovery controls for the archives page. The
 * control surface deliberately mirrors ProjectsToolbar: scope comes first,
 * search and filters wrap below it on narrow screens, and active filters stay
 * visible rather than being hidden inside the menu.
 */
export function ArchivesToolbar({ projects, scopeControl }: ArchivesToolbarProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get('q') ?? '';
  const projectIds = (searchParams.get('project') ?? '').split(',').filter(Boolean);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  /** Writes one parameter, dropping it entirely when the value is empty. */
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
      aria-label={t('archives.toolbar', 'Archive controls')}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {scopeControl}

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center xl:ml-auto">
          <div className="relative min-w-0 sm:w-72">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setParam('q', event.target.value)}
              placeholder={t('archives.searchPlaceholder', 'Search archives')}
              aria-label={t('archives.searchPlaceholder', 'Search archives')}
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
              <Button type="button" variant="outline" className="h-11 sm:h-9">
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
                projects.map((project) => (
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
      </div>

      {projectIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          aria-label={t('archives.activeFilters', 'Active filters')}
        >
          <span className="text-muted-foreground text-xs font-medium">
            {t('archives.activeFilters', 'Active filters')}
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

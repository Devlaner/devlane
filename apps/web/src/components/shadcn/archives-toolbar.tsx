import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, X } from 'lucide-react';
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
import { projectService } from '../../services/projectService';
import type { ProjectApiResponse } from '../../api/types';

/** How many projects to list before the filter dropdown gets unwieldy. */
const MAX_PROJECTS_LISTED = 8;

/**
 * Search and project filter for the archives page, built from shadcn
 * primitives.
 *
 * State lives in the URL rather than a context, as on the drafts preview: the
 * page is the only reader, and a filtered archive stays shareable. It sits in
 * the v2 shell's header, mirroring how the shipped AppShell hangs per-page
 * controls off it.
 */
export function ArchivesToolbar({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const projectIds = (searchParams.get('project') ?? '').split(',').filter(Boolean);

  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [searchOpen, setSearchOpen] = useState(!!query);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    projectService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setProjects(list ?? []);
      })
      .catch(() => {
        /* The project filter just stays empty if the list cannot be read. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

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

  return (
    <div className="ml-auto flex items-center gap-1 pr-4">
      {searchOpen ? (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder={t('common.search', 'Search')}
            aria-label={t('common.search', 'Search')}
            className="h-8 w-56 pl-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              setParam('q', '');
              setSearchOpen(false);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('common.clearSearch', 'Clear search')}
            className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
            onClick={() => {
              setParam('q', '');
              setSearchOpen(false);
            }}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('common.search', 'Search')}
          onClick={() => setSearchOpen(true)}
        >
          <Search />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost">
            <Filter />
            {t('common.filters', 'Filters')}
            {projectIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {projectIds.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
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
                {project.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
          {projectIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setParam('project', '')}>
                <X />
                {t('common.clearFilters', 'Clear filters')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

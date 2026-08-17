import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { ListFilterChips } from '@/v2/components/list-filter-chips';
import { ListFiltersMenu, type ListFilterGroup } from '@/v2/components/list-filters-menu';
import { ProjectListToolbar } from '@/v2/components/project-list-toolbar';
import type { ProjectApiResponse } from '../../api/types';

interface DraftsToolbarProps {
  projects: ProjectApiResponse[];
}

/**
 * Discovery and create controls for workspace drafts.
 *
 * Built from the shared list chrome the project lists use — same bar, same
 * growing search field, same filter popover and chips row — so moving between
 * drafts and epics, cycles or modules never resizes the toolbar.
 */
export function DraftsToolbar({ projects }: DraftsToolbarProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const projectIds = (searchParams.get('project') ?? '').split(',').filter(Boolean);

  /** Writes one parameter, dropping it entirely when the value goes empty. */
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const groups: ListFilterGroup[] = [
    {
      key: 'project',
      label: t('common.projects', 'Projects'),
      options: projects.map((project) => ({ value: project.id, label: project.name })),
    },
  ];
  const selected = { project: projectIds };

  const toggleProject = (_groupKey: string, projectId: string) => {
    const next = projectIds.includes(projectId)
      ? projectIds.filter((id) => id !== projectId)
      : [...projectIds, projectId];
    setParam('project', next.join(','));
  };

  const clearFilters = () => setParam('project', '');

  return (
    <ProjectListToolbar
      searchPlaceholder={t('drafts.searchPlaceholder', 'Search drafts')}
      regionLabel={t('drafts.toolbar', 'Draft controls')}
      filters={
        <ListFiltersMenu
          groups={groups}
          selected={selected}
          onToggle={toggleProject}
          onReset={clearFilters}
        />
      }
      chips={
        <ListFilterChips
          groups={groups}
          selected={selected}
          onToggle={toggleProject}
          onReset={clearFilters}
        />
      }
      actions={
        /* `?create=1` is what the page watches to open the composer, so the
           button writes the parameter rather than reaching into the page. */
        <Button type="button" className="h-11 sm:h-9" onClick={() => setParam('create', '1')}>
          <Plus aria-hidden="true" />
          {t('drafts.draftWorkItem', 'Draft a work item')}
        </Button>
      }
    />
  );
}

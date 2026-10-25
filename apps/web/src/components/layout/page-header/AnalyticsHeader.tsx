import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '../../work-item';
import { projectService } from '../../../services/projectService';
import type { ProjectApiResponse } from '../../../api/types';
import { IconBarChart, IconBriefcase } from './icons';

export function AnalyticsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);

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

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  useEffect(() => {
    if (!openDropdown) {
      // Intentional: clear search when dropdown closes (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectSearch('');
    }
  }, [openDropdown]);

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconBarChart />
        </span>
        {t('header.analytics', 'Analytics')}
      </div>
      <div className="flex items-center gap-2">
        <Dropdown
          id="analytics-projects"
          openId={openDropdown}
          onOpen={setOpenDropdown}
          label={t('header.allProjects', 'All projects')}
          icon={<IconBriefcase />}
          displayValue={selectedProject?.name ?? t('header.allProjects', 'All projects')}
          panelClassName="flex min-w-[200px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
          align="right"
        >
          <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
            <input
              type="text"
              placeholder={t('common.searchEllipsis', 'Search...')}
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
            />
          </div>
          <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setOpenDropdown(null);
              }}
              className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
            >
              {t('header.allProjects', 'All projects')}
            </button>
            {filteredProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  setOpenDropdown(null);
                }}
                className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                {p.name}
              </button>
            ))}
          </div>
        </Dropdown>
      </div>
    </>
  );
}

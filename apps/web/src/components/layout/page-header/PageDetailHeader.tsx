import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { usePageDetailHeader } from '../../../contexts/PageDetailHeaderContext';
import { projectService } from '../../../services/projectService';
import { ProjectIconDisplay } from '../../ProjectIconModal';
import type { ProjectApiResponse } from '../../../api/types';
import { IconChevronDown, IconSearch, IconCheck, IconFileText } from './icons';

/**
 * Header rendered for `/:slug/projects/:projectId/pages/:pageId`. A single top
 * row that contains the project breadcrumb on the left and the per-page action
 * cluster on the right
 * (lock / link / star / more / panel-toggle). The actions slot is filled by
 * `PageDetailPage` via `useSetPageDetailHeader` so this component stays
 * stateless about the page itself.
 */
export function PageDetailHeader({
  workspaceSlug,
  projectId,
  project,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { breadcrumb, actions } = usePageDetailHeader();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;

  // Mirror ProjectSavedViewDetailHeader: project switcher dropdown on the
  // left so users can hop between projects without leaving the page-detail
  // surface, then the Pages section link, then the per-page breadcrumb
  // injected by `useSetPageDetailHeader` in PageDetailPage.
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);

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
    if (projectDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectDropdownOpen]);

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  const handleSelectProject = (targetProjectId: string) => {
    setProjectDropdownOpen(false);
    if (targetProjectId === projectId) return;
    // Land on the target project's pages list — there's no "equivalent page"
    // we can hop to in a different project; the list is the safe fallback.
    navigate(`/${workspaceSlug}/projects/${targetProjectId}/pages`);
  };

  return (
    <>
      <div
        className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm"
        ref={projectDropdownRef}
      >
        <Link
          to={issuesUrl}
          className="flex max-w-[40vw] items-center gap-1.5 truncate rounded-md px-3 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <ProjectIconDisplay
              emoji={project.emoji}
              icon_prop={project.icon_prop}
              size={16}
              className="leading-none"
            />
          </span>
          {project.name}
        </Link>
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((o) => !o)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
          aria-label={t('header.selectProject', 'Select project')}
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
        <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <Link
          to={`${baseUrl}/pages`}
          className="flex max-w-[28vw] shrink-0 items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-secondary)">
            <IconFileText />
          </span>
          {t('header.pages', 'Pages')}
        </Link>
        {breadcrumb ? (
          <>
            <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
              &gt;
            </span>
            <div className="flex min-w-0 max-w-[36vw] items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-primary)">
              {breadcrumb}
            </div>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </>
  );
}

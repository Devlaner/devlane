import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import { issueService } from '../../services/issueService';
import { moduleService } from '../../services/moduleService';
import type { WorkspaceApiResponse, ProjectApiResponse, ModuleApiResponse } from '../../api/types';
import { slugify } from '../../lib/slug';
import { MODULE_WORK_ITEMS_COUNT_EVENT } from '../../lib/moduleWorkItemsPrefs';
import { ModuleDetailHeader } from './ModuleDetailHeader';
import { YourWorkHeader } from './page-header/YourWorkHeader';
import { InboxHeader } from './page-header/InboxHeader';
import { SettingsHeader } from './page-header/SettingsHeader';
import { HomeHeader } from './page-header/HomeHeader';
import { DraftsHeader } from './page-header/DraftsHeader';
import { ProjectsHeader } from './page-header/ProjectsHeader';
import { ProjectDetailHeader } from './page-header/ProjectDetailHeader';
import { ProjectSectionHeader } from './page-header/ProjectSectionHeader';
import { WorkspaceViewsHeader } from './page-header/WorkspaceViewsHeader';
import { AnalyticsHeader } from './page-header/AnalyticsHeader';
import { ProjectSavedViewDetailHeader } from './page-header/ProjectSavedViewDetailHeader';
import { PageDetailHeader } from './page-header/PageDetailHeader';

export type ProjectSection = 'issues' | 'cycles' | 'modules' | 'views' | 'pages';

export function PageHeader() {
  const location = useLocation();
  const { workspaceSlug, projectId, moduleId, viewId, pageId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
    moduleId?: string;
    viewId?: string;
    pageId?: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  void workspace;
  void projects; // reserved for future use (e.g. breadcrumb, project list)
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projectIssueCount, setProjectIssueCount] = useState(0);
  const [module, setModule] = useState<ModuleApiResponse | null>(null);
  const [moduleWorkItemCount, setModuleWorkItemCount] = useState<number | null>(null);

  useEffect(() => {
    const onCount = (e: Event) => {
      const d = (e as CustomEvent<{ count: number }>).detail;
      if (d && typeof d.count === 'number') setModuleWorkItemCount(d.count);
    };
    window.addEventListener(MODULE_WORK_ITEMS_COUNT_EVENT, onCount);
    return () => window.removeEventListener(MODULE_WORK_ITEMS_COUNT_EVENT, onCount);
  }, []);

  useEffect(() => {
    if (!workspaceSlug) {
      // Intentional: clear when route unmounts (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspace(null);
      setProjects([]);
      setProject(null);
      setProjectIssueCount(0);
      return;
    }
    let cancelled = false;
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (!cancelled) setWorkspace(w);
        return projectService.list(workspaceSlug);
      })
      .then((list) => {
        if (!cancelled && list) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // Intentional: clear when route unmounts (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProject(null);
      setProjectIssueCount(0);
      return;
    }
    let cancelled = false;
    projectService
      .get(workspaceSlug, projectId)
      .then((p) => {
        if (!cancelled) setProject(p ?? null);
        return p ? issueService.listAll(workspaceSlug, projectId) : [];
      })
      .then((issues) => {
        if (!cancelled && Array.isArray(issues)) setProjectIssueCount(issues.length);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
        setProjectIssueCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !moduleId) {
      queueMicrotask(() => setModule(null));
      return;
    }
    let cancelled = false;
    const key = moduleId.trim().toLowerCase();
    moduleService
      .list(workspaceSlug, projectId)
      .then((mods) => {
        if (cancelled) return;
        const found =
          (mods ?? []).find((x) => x.id === moduleId) ??
          (mods ?? []).find((x) => slugify(x.name) === key) ??
          null;
        setModule(found);
      })
      .catch(() => {
        if (!cancelled) setModule(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, moduleId]);

  const pathname = location.pathname;

  useEffect(() => {
    const base = workspaceSlug && projectId ? `/${workspaceSlug}/projects/${projectId}` : '';
    const norm = pathname.replace(/\/+$/, '') || pathname;
    const onModuleDetail = Boolean(base && moduleId && norm === `${base}/modules/${moduleId}`);
    if (!onModuleDetail) queueMicrotask(() => setModuleWorkItemCount(null));
  }, [pathname, workspaceSlug, projectId, moduleId]);

  // Match route patterns to pick header
  const isWorkspaceHome = workspaceSlug && pathname === `/${workspaceSlug}`;
  const isSettings =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/settings` ||
      pathname.startsWith(`/${workspaceSlug}/settings/`));
  const isProjectsList = workspaceSlug && pathname === `/${workspaceSlug}/projects`;
  const projectBase = workspaceSlug && projectId ? `/${workspaceSlug}/projects/${projectId}` : '';
  const pathNoTrailingSlash = pathname.replace(/\/+$/, '') || pathname;
  const isIssuesPage = projectBase && pathname === `${projectBase}/issues`;
  const isCyclesPage = projectBase && pathname === `${projectBase}/cycles`;
  const isModulesPage = projectBase && pathname === `${projectBase}/modules`;
  const isModuleDetailPage =
    projectBase && moduleId && pathNoTrailingSlash === `${projectBase}/modules/${moduleId}`;
  const isViewsListPage = projectBase && pathNoTrailingSlash === `${projectBase}/views`;
  const isProjectSavedViewDetailPage =
    projectBase && !!viewId && pathNoTrailingSlash === `${projectBase}/views/${viewId}`;
  const isPagesPage = projectBase && pathname === `${projectBase}/pages`;
  const isPageDetailPage =
    projectBase && !!pageId && pathNoTrailingSlash === `${projectBase}/pages/${pageId}`;
  const isProjectSection =
    isIssuesPage || isCyclesPage || isModulesPage || isViewsListPage || isPagesPage;
  const isProjectDetail =
    workspaceSlug && projectId && pathname.startsWith(`/${workspaceSlug}/projects/${projectId}`);
  const isInbox = workspaceSlug && pathname === `/${workspaceSlug}/notifications`;
  const isProfilePage = workspaceSlug && /^\/[^/]+\/profile\/[^/]+$/.test(pathname);
  const isAnalyticsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/analytics` ||
      pathname.startsWith(`/${workspaceSlug}/analytics/`));
  const isWorkspaceViewsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/views` || pathname.startsWith(`/${workspaceSlug}/views/`));
  const isDraftsPage = workspaceSlug && pathname === `/${workspaceSlug}/drafts`;

  const projectSection: ProjectSection | null = isIssuesPage
    ? 'issues'
    : isCyclesPage
      ? 'cycles'
      : isModulesPage
        ? 'modules'
        : isViewsListPage
          ? 'views'
          : isPagesPage
            ? 'pages'
            : null;

  let content: React.ReactNode = null;
  if (isWorkspaceHome) {
    content = <HomeHeader />;
  } else if (isProfilePage) {
    content = <YourWorkHeader />;
  } else if (isInbox) {
    content = <InboxHeader />;
  } else if (isSettings) {
    content = <SettingsHeader />;
  } else if (isProjectsList && workspaceSlug) {
    content = <ProjectsHeader workspaceSlug={workspaceSlug} />;
  } else if (isAnalyticsPage && workspaceSlug) {
    content = <AnalyticsHeader workspaceSlug={workspaceSlug} />;
  } else if (isWorkspaceViewsPage && workspaceSlug) {
    content = <WorkspaceViewsHeader />;
  } else if (isDraftsPage) {
    content = <DraftsHeader />;
  } else if (isModuleDetailPage && workspaceSlug && projectId && project && module && moduleId) {
    content = (
      <ModuleDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        projectName={project.name}
        moduleId={module.id}
        moduleName={module.name}
        moduleRouteParam={moduleId}
        issueCountBadge={moduleWorkItemCount ?? module.issue_count ?? 0}
      />
    );
  } else if (isProjectSavedViewDetailPage && workspaceSlug && projectId && viewId && project) {
    content = (
      <ProjectSavedViewDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        projectName={project.name}
        viewId={viewId}
        issueCount={projectIssueCount}
      />
    );
  } else if (isPageDetailPage && workspaceSlug && projectId && project) {
    content = (
      <PageDetailHeader workspaceSlug={workspaceSlug} projectId={projectId} project={project} />
    );
  } else if (isProjectSection && workspaceSlug && projectId && project && projectSection) {
    content = (
      <ProjectSectionHeader
        key={projectId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        projectName={project.name}
        section={projectSection}
        issueCount={projectIssueCount}
      />
    );
  } else if (isProjectDetail && workspaceSlug && projectId && project) {
    content = (
      <ProjectDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        title={project.name}
      />
    );
  } else if (workspaceSlug && projectId && project) {
    content = (
      <ProjectDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        title={project.name}
      />
    );
  } else if (workspaceSlug) {
    content = <HomeHeader />;
  }

  if (content == null) return null;

  return (
    <header
      className="flex min-h-13 shrink-0 items-center justify-between border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page) py-3"
      role="banner"
    >
      {content}
    </header>
  );
}

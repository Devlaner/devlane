import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useMatch, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/shadcn/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/ui/breadcrumb';
import { Separator } from '@/components/shadcn/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/shadcn/ui/sidebar';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { Toaster } from '@/components/shadcn/ui/sonner';
import { useV2Header, V2HeaderProvider } from '../contexts/AppShellV2HeaderContext';
import { ProjectSavedViewDisplayProvider } from '../contexts/ProjectSavedViewDisplayContext';
import { WorkspaceViewsStateProvider } from '../contexts/WorkspaceViewsStateContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { WorkspaceViewDisplay } from '../types/workspaceViewDisplay';

const V2_WORKSPACE_VIEW_DISPLAY: WorkspaceViewDisplay = {
  properties: ['id', 'state', 'priority', 'assignee', 'labels', 'due_date'],
  showSubWorkItems: true,
  layout: 'list',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

/**
 * Layout for the v2 previews: the shadcn `sidebar-08` shell with the other v2
 * pages rendered inside it. It stands alongside the app's own AppShell rather
 * than replacing it, so the two can be compared side by side.
 *
 * `shadcn-v4` pins the tree to the stock new-york-v4 palette shipped by
 * ui.shadcn.com, ignoring the Devlane token bridge and the theme picker (light
 * and dark only — there is no pink variant). This is a deliberate choice to
 * keep the v2 preview matching upstream shadcn pixel-for-pixel rather than
 * following Devlane's own palette.
 *
 * The providers are split out from the layout because the layout reads what
 * they hold: a component cannot consume a context it renders itself.
 */
export function AppShellV2Page() {
  return (
    /* The views page and its toolbar both read this filter and display state,
       so it is held above the routes that render them. */
    <WorkspaceViewsStateProvider initialDisplay={V2_WORKSPACE_VIEW_DISPLAY}>
      {/* The saved-view pages read this; the shipped tree mounts it in AppShell,
          which the v2 tree sits outside of. */}
      <ProjectSavedViewDisplayProvider>
        {/* Detail pages push their breadcrumb tail and header actions up here. */}
        <V2HeaderProvider>
          <AppShellV2Layout />
        </V2HeaderProvider>
      </ProjectSavedViewDisplayProvider>
    </WorkspaceViewsStateProvider>
  );
}

function AppShellV2Layout() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { pathname } = useLocation();
  /* useParams stops at this layout's own route, so the child route's projectId
     is read from the path instead. */
  const projectMatch = useMatch('/:workspaceSlug/app-v2/projects/:projectId/*');
  const projectId = projectMatch?.params.projectId;
  const slot = useV2Header();

  /* Named from the path rather than from the child, which would need a context
     just to pass a string up one level. */
  const isProjectsRoute = pathname.endsWith('/app-v2/projects');
  const isViewsRoute = pathname.includes('/app-v2/views');
  const isDraftsRoute = pathname.endsWith('/app-v2/drafts');
  const isArchivesRoute = pathname.endsWith('/app-v2/archives');
  const isAnalyticsRoute = pathname.includes('/app-v2/analytics');
  const isProfileRoute = pathname.includes('/app-v2/profile/');

  /* The per-project pages share one route shape, so the trailing segment names
     the page rather than a condition per page. `projectId` is only bound on
     those routes, which is what separates them from the workspace-level ones
     that end in the same word (`/app-v2/views`). */
  const projectPage = projectId ? (pathname.split('/').pop() ?? '') : '';
  const PROJECT_PAGE_TITLES: Record<string, string> = {
    'work-items': t('views.workItems', 'Work items'),
    epics: t('common.epics', 'Epics'),
    cycles: t('common.cycles', 'Cycles'),
    modules: t('common.modules', 'Modules'),
    views: t('common.views', 'Views'),
    pages: t('common.pages', 'Pages'),
    intake: t('common.intake', 'Intake'),
  };

  /* A detail page's own title wins: it names the entity, which the path can't. */
  const pageTitle =
    slot.title ??
    (PROJECT_PAGE_TITLES[projectPage]
      ? PROJECT_PAGE_TITLES[projectPage]
      : isProjectsRoute
        ? t('projects.documentTitle', 'Projects')
        : isViewsRoute
          ? t('common.views', 'Views')
          : isDraftsRoute
            ? t('drafts.documentTitle', 'Drafts')
            : isArchivesRoute
              ? t('archives.documentTitle', 'Archives')
              : isAnalyticsRoute
                ? t('analytics.documentTitle', 'Analytics')
                : isProfileRoute
                  ? t('profile.documentTitle', 'Profile')
                  : t('appShellV2.documentTitle', 'App shell (v2)'));

  useDocumentTitle(pageTitle);

  /* The sidebar's dropdowns are portalled onto document.body, outside the
     element carrying the class, so their bare `border` utilities would fall
     back to currentColor. Marking the body for as long as this tree is mounted
     gives the portalled content the same border default, and removing it on
     unmount keeps it off the pages that set their borders explicitly. */
  useEffect(() => {
    document.body.classList.add('shadcn-v4');
    return () => document.body.classList.remove('shadcn-v4');
  }, []);

  return (
    <SidebarProvider className="shadcn-v4">
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to={workspaceSlug ? `/${workspaceSlug}` : '/'}>
                      {workspaceSlug ?? t('nav.workspace', 'Workspace')}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                {/* A detail page adds a middle crumb pointing back at its list;
                    without one this stays the two-level shape every list page
                    has always rendered. */}
                {slot.parent && (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link to={slot.parent.to}>{slot.parent.label}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                )}
                <BreadcrumbItem className="min-w-0">
                  {/* The entity's name arrives with its fetch. Showing a
                      placeholder beats showing the id from the path. */}
                  {slot.parent && slot.title === null ? (
                    <Skeleton className="h-4 w-40" />
                  ) : (
                    <BreadcrumbPage className="truncate">{pageTitle}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {/* Every list page owns its toolbar in the page body: the controls
              need room to wrap on small screens instead of competing with the
              breadcrumb in this 64px shell header. Only a detail page's own
              actions are hoisted up here. */}
          {slot.actions}
        </header>
        {/* Child routes render the v2 pages inside this shell; the index route
            is the workspace home. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet key={workspaceSlug} />
        </div>
        {/* Scoped to the v2 shell: the shipped interface has its own feedback
            patterns, and mounting one toaster per tree keeps them separate. */}
        <Toaster position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  );
}

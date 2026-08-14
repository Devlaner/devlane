import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useMatch, useParams } from 'react-router-dom';
import { AppSidebar } from '@/v2/components/app-sidebar';
import { PageTransition } from '@/v2/components/page-transition';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/v2/components/ui/breadcrumb';
import { Separator } from '@/v2/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/v2/components/ui/sidebar';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Toaster } from '@/v2/components/ui/sonner';
import { useAppShellHeader, AppShellHeaderProvider } from '../../contexts/AppShellHeaderContext';
import { ProjectSavedViewDisplayProvider } from '../../contexts/ProjectSavedViewDisplayContext';
import { WorkspaceViewsStateProvider } from '../../contexts/WorkspaceViewsStateProvider';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { V2_WORKSPACE_VIEW_DISPLAY } from '../../lib/workspaceViewParams';
/* Every signed-in v2 page renders inside this shell, so the v2 stylesheet
   rides along with its chunk instead of the app's global index.css. */
import '../../styles/index.css';

/**
 * The v2 chrome: the shadcn `sidebar-08` shell with the v2 pages rendered
 * inside it. It mounts on the `:workspaceSlug` route in place of the app's own
 * AppShell — which one renders is the stored interface preference, and both
 * render an <Outlet />, so the child routes below are shared.
 *
 * `shadcn-v4` pins the tree to the stock new-york-v4 palette shipped by
 * ui.shadcn.com, ignoring the Devlane token bridge and the theme picker (light
 * and dark only — there is no pink variant). This is a deliberate choice to
 * keep v2 matching upstream shadcn pixel-for-pixel rather than following
 * Devlane's own palette.
 *
 * The providers are split out from the layout because the layout reads what
 * they hold: a component cannot consume a context it renders itself.
 */
/**
 * The sidebar primitive records collapsing in a `sidebar_state` cookie for a
 * server render to read back into `defaultOpen`. Devlane's web app has no
 * server render, so the shell reads the cookie itself — otherwise the sidebar
 * writes the choice and reopens on the next load anyway.
 */
function storedSidebarOpen(): boolean {
  const match = /(?:^|;\s*)sidebar_state=(true|false)(?:;|$)/.exec(document.cookie);
  return match ? match[1] === 'true' : true;
}

export function AppShell() {
  return (
    /* The views page and its toolbar both read this filter and display state,
       so it is held above the routes that render them. */
    <WorkspaceViewsStateProvider initialDisplay={V2_WORKSPACE_VIEW_DISPLAY}>
      {/* The saved-view pages read this; the shipped tree mounts it in AppShell,
          which the v2 tree sits outside of. */}
      <ProjectSavedViewDisplayProvider>
        {/* Detail pages push their breadcrumb tail and header actions up here. */}
        <AppShellHeaderProvider>
          <AppShellLayout />
        </AppShellHeaderProvider>
      </ProjectSavedViewDisplayProvider>
    </WorkspaceViewsStateProvider>
  );
}

function AppShellLayout() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { pathname } = useLocation();
  /* useParams stops at this layout's own route, so the child route's projectId
     is read from the path instead. */
  const projectMatch = useMatch('/:workspaceSlug/projects/:projectId/*');
  const projectId = projectMatch?.params.projectId;
  const slot = useAppShellHeader();

  /* Named from the path rather than from the child, which would need a context
     just to pass a string up one level. Anchored on the workspace base so a
     nested segment of the same name (`/settings/projects`) doesn't match the
     workspace-level route. */
  const base = `/${workspaceSlug ?? ''}`;
  const isProjectsRoute = pathname === `${base}/projects`;
  const isViewsRoute = pathname.startsWith(`${base}/views`);
  const isDraftsRoute = pathname === `${base}/drafts`;
  const isArchivesRoute = pathname === `${base}/archives`;
  const isAnalyticsRoute = pathname.startsWith(`${base}/analytics`);
  const isProfileRoute = pathname.startsWith(`${base}/profile/`);

  /* The per-project pages share one route shape, so the trailing segment names
     the page rather than a condition per page. `projectId` is only bound on
     those routes, which is what separates them from the workspace-level ones
     that end in the same word (`/views`). */
  const projectPage = projectId ? (pathname.split('/').pop() ?? '') : '';
  const PROJECT_PAGE_TITLES: Record<string, string> = {
    issues: t('views.workItems', 'Work items'),
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
    <SidebarProvider className="shadcn-v4" defaultOpen={storedSidebarOpen()}>
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
          <PageTransition>
            <Outlet key={workspaceSlug} />
          </PageTransition>
        </div>
        {/* Scoped to the v2 shell: the shipped interface has its own feedback
            patterns, and mounting one toaster per tree keeps them separate. */}
        <Toaster position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  );
}

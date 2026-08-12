import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/shadcn/app-sidebar';
import { ProjectsToolbar } from '@/components/shadcn/projects-toolbar';
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
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/**
 * Layout for the v2 previews: the shadcn `sidebar-08` shell with the other v2
 * pages rendered inside it. It stands alongside the app's own AppShell rather
 * than replacing it, so the two can be compared side by side.
 *
 * `shadcn-v4` swaps the bridge's Devlane palette for the stock new-york-v4
 * tokens the block is designed against. Without it the hues, the separation
 * between sidebar and content, and the corner radius all differ from the
 * upstream demo.
 */
export function AppShellV2Page() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { pathname } = useLocation();

  useDocumentTitle(t('appShellV2.documentTitle', 'App shell (v2)'));

  /* Named from the path rather than from the child, which would need a context
     just to pass a string up one level. */
  const isProjectsRoute = pathname.endsWith('/projects');
  const pageTitle = isProjectsRoute
    ? t('projects.documentTitle', 'Projects')
    : t('appShellV2.documentTitle', 'App shell (v2)');

  /* The sidebar's dropdowns are portalled onto document.body, outside the
     element carrying the palette class, so they would render with the app's
     own tokens — a visibly brighter border than the demo's. Marking the body
     for as long as this preview is mounted brings the portalled content into
     the same palette, and removing it on unmount keeps the rest of the app on
     the Devlane one. */
  useEffect(() => {
    document.body.classList.add('shadcn-v4');
    return () => document.body.classList.remove('shadcn-v4');
  }, []);

  return (
    <SidebarProvider className="shadcn-v4">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
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
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {/* The toolbar belongs to the header, not the page, mirroring how the
              shipped AppShell hangs its per-page controls off the header. */}
          {isProjectsRoute && workspaceSlug && <ProjectsToolbar workspaceSlug={workspaceSlug} />}
        </header>
        {/* Child routes render the v2 pages inside this shell; the index route
            supplies the block's placeholder grid. */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** The block's placeholder grid, shown at the shell's index route. */
export function AppShellV2Placeholder() {
  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
    </>
  );
}

import { Outlet, useLocation } from 'react-router-dom';
import { ModulesFilterProvider } from '../../contexts/ModulesFilterContext';
import { PageDetailHeaderProvider } from '../../contexts/PageDetailHeaderContext';
import { ProjectSavedViewDisplayProvider } from '../../contexts/ProjectSavedViewDisplayContext';
import { WorkspaceViewsStateProvider } from '../../contexts/WorkspaceViewsStateContext';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { pathname } = useLocation();
  const isViewsRoute = pathname.includes('/views');
  const isCyclesPage = pathname.endsWith('/cycles');
  const isModulesRoute = pathname.includes('/modules');
  const isDraftsRoute = pathname.includes('/drafts');
  // Pages list and detail pages render their own padding/chrome so the tabs
  // row sits flush against the PageHeader (Plane parity — header bottom-border
  // doubles as the tabs-row top-border).
  const isPagesRoute = pathname.includes('/pages');

  return (
    <WorkspaceViewsStateProvider>
      <ProjectSavedViewDisplayProvider>
        <ModulesFilterProvider>
          <PageDetailHeaderProvider>
            <div className="flex h-screen flex-col overflow-hidden bg-(--bg-screen) p-3">
              <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg bg-(--bg-surface-1) shadow-(--shadow-container)">
                <Sidebar />
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg-canvas)">
                  <PageHeader />
                  <div
                    className={`main-content-scroll min-h-0 flex-1 overflow-auto p-(--padding-page) ${
                      isViewsRoute ||
                      isCyclesPage ||
                      isModulesRoute ||
                      isDraftsRoute ||
                      isPagesRoute
                        ? 'pl-0 pr-0'
                        : ''
                    } ${isModulesRoute || isDraftsRoute || isPagesRoute ? 'pt-0' : ''} ${
                      isPagesRoute ? 'pb-0' : ''
                    }`}
                  >
                    <Outlet />
                  </div>
                </main>
              </div>
            </div>
          </PageDetailHeaderProvider>
        </ModulesFilterProvider>
      </ProjectSavedViewDisplayProvider>
    </WorkspaceViewsStateProvider>
  );
}

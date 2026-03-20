import { Outlet, useLocation } from 'react-router-dom';
import { ModulesFilterProvider } from '../../contexts/ModulesFilterContext';
import { ProjectSavedViewDisplayProvider } from '../../contexts/ProjectSavedViewDisplayContext';
import { WorkspaceViewsStateProvider } from '../../contexts/WorkspaceViewsStateContext';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { pathname } = useLocation();
  const isViewsRoute = pathname.includes('/views');
  const isCyclesPage = pathname.endsWith('/cycles');

  return (
    <WorkspaceViewsStateProvider>
      <ProjectSavedViewDisplayProvider>
        <ModulesFilterProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-(--bg-screen) p-3">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-(--radius-lg) bg-(--bg-surface-1) shadow-(--shadow-container)">
              <Sidebar />
              <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg-canvas)">
                <PageHeader />
                <div
                  className={`main-content-scroll min-h-0 flex-1 overflow-auto p-(--padding-page) ${isViewsRoute || isCyclesPage ? 'pl-0 pr-0' : ''}`}
                >
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
        </ModulesFilterProvider>
      </ProjectSavedViewDisplayProvider>
    </WorkspaceViewsStateProvider>
  );
}

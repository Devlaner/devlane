/* eslint-disable react-refresh/only-export-components -- routes file exports router + layout components; keep for future use */
import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router-dom';
import { AppShell, InstanceAdminLayout } from '../components/layout';
import { RootRedirect } from '../components/RootRedirect';
import { SetupGate } from '../components/SetupGate';
import { recentsService } from '../services/recentsService';
import { InstanceAdminProtectedRoute } from './InstanceAdminProtectedRoute';
import { ProtectedRoute } from './ProtectedRoute';

const page = (m: { [k: string]: React.ComponentType }) => ({
  default: Object.values(m)[0],
});

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((m) => page({ LoginPage: m.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then((m) =>
    page({ ForgotPasswordPage: m.ForgotPasswordPage }),
  ),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((m) =>
    page({ ResetPasswordPage: m.ResetPasswordPage }),
  ),
);
const WorkspaceHomePage = lazy(() =>
  import('../pages/WorkspaceHomePage').then((m) =>
    page({ WorkspaceHomePage: m.WorkspaceHomePage }),
  ),
);
const NotificationsPage = lazy(() =>
  import('../pages/NotificationsPage').then((m) =>
    page({ NotificationsPage: m.NotificationsPage }),
  ),
);
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((m) => page({ ProfilePage: m.ProfilePage })),
);
const ProjectsListPage = lazy(() =>
  import('../pages/ProjectsListPage').then((m) => page({ ProjectsListPage: m.ProjectsListPage })),
);
const WorkspaceViewsPage = lazy(() =>
  import('../pages/WorkspaceViewsPage').then((m) =>
    page({ WorkspaceViewsPage: m.WorkspaceViewsPage }),
  ),
);
const DraftsPage = lazy(() =>
  import('../pages/DraftsPage').then((m) => page({ DraftsPage: m.DraftsPage })),
);
const ArchivesPage = lazy(() =>
  import('../pages/ArchivesPage').then((m) => page({ ArchivesPage: m.ArchivesPage })),
);
const AnalyticsOverviewPage = lazy(() =>
  import('../pages/AnalyticsOverviewPage').then((m) =>
    page({ AnalyticsOverviewPage: m.AnalyticsOverviewPage }),
  ),
);
const AnalyticsWorkItemsPage = lazy(() =>
  import('../pages/AnalyticsWorkItemsPage').then((m) =>
    page({ AnalyticsWorkItemsPage: m.AnalyticsWorkItemsPage }),
  ),
);
const IssueListPage = lazy(() =>
  import('../pages/IssueListPage').then((m) => page({ IssueListPage: m.IssueListPage })),
);
const IssueDetailPage = lazy(() =>
  import('../pages/IssueDetailPage').then((m) => page({ IssueDetailPage: m.IssueDetailPage })),
);
const BoardPage = lazy(() =>
  import('../pages/BoardPage').then((m) => page({ BoardPage: m.BoardPage })),
);
const CyclesPage = lazy(() =>
  import('../pages/CyclesPage').then((m) => page({ CyclesPage: m.CyclesPage })),
);
const ModulesPage = lazy(() =>
  import('../pages/ModulesPage').then((m) => page({ ModulesPage: m.ModulesPage })),
);
const ModuleDetailPage = lazy(() =>
  import('../pages/ModuleDetailPage').then((m) => page({ ModuleDetailPage: m.ModuleDetailPage })),
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((m) => page({ SettingsPage: m.SettingsPage })),
);
const ViewsPage = lazy(() =>
  import('../pages/ViewsPage').then((m) => page({ ViewsPage: m.ViewsPage })),
);
const ViewDetailPage = lazy(() =>
  import('../pages/ViewDetailPage').then((m) => page({ ViewDetailPage: m.ViewDetailPage })),
);
const PagesPage = lazy(() =>
  import('../pages/PagesPage').then((m) => page({ PagesPage: m.PagesPage })),
);

const InstanceAdminGeneralPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminGeneralPage: m.InstanceAdminGeneralPage }),
  ),
);
const InstanceAdminWorkspacePage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminWorkspacePage: m.InstanceAdminWorkspacePage }),
  ),
);
const InstanceAdminEmailPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminEmailPage: m.InstanceAdminEmailPage }),
  ),
);
const InstanceAdminAuthenticationPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({
      InstanceAdminAuthenticationPage: m.InstanceAdminAuthenticationPage,
    }),
  ),
);
const InstanceAdminAuthGooglePage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminAuthGooglePage: m.InstanceAdminAuthGooglePage }),
  ),
);
const InstanceAdminAuthGitHubPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminAuthGitHubPage: m.InstanceAdminAuthGitHubPage }),
  ),
);
const InstanceAdminAuthGitLabPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminAuthGitLabPage: m.InstanceAdminAuthGitLabPage }),
  ),
);
const InstanceAdminAIPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminAIPage: m.InstanceAdminAIPage }),
  ),
);
const InstanceAdminImagePage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminImagePage: m.InstanceAdminImagePage }),
  ),
);
const InstanceAdminCreateWorkspacePage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({
      InstanceAdminCreateWorkspacePage: m.InstanceAdminCreateWorkspacePage,
    }),
  ),
);
// Reserved for future instance-admin login route:
// const InstanceAdminLoginPage = lazy(() => import("../pages/instance-admin").then((m) => page({ InstanceAdminLoginPage: m.InstanceAdminLoginPage })));

const InstanceSetupWelcomePage = lazy(() =>
  import('../pages/setup').then((m) =>
    page({ InstanceSetupWelcomePage: m.InstanceSetupWelcomePage }),
  ),
);
const InstanceSetupConfigurePage = lazy(() =>
  import('../pages/setup').then((m) =>
    page({ InstanceSetupConfigurePage: m.InstanceSetupConfigurePage }),
  ),
);
const InstanceSetupCompletePage = lazy(() =>
  import('../pages/setup').then((m) =>
    page({ InstanceSetupCompletePage: m.InstanceSetupCompletePage }),
  ),
);
const InviteAcceptPage = lazy(() =>
  import('../pages/InviteAcceptPage').then((m) => page({ InviteAcceptPage: m.InviteAcceptPage })),
);
const InviteSignUpPage = lazy(() =>
  import('../pages/InviteSignUpPage').then((m) => page({ InviteSignUpPage: m.InviteSignUpPage })),
);

const PageFallback = () => (
  <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
    Loading...
  </div>
);

function AppLayout() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}

function WorkspaceLayout() {
  return <Outlet />;
}

function ProjectLayout() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
  }>();

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    recentsService
      .record(workspaceSlug, {
        entity_name: 'project',
        entity_identifier: projectId,
        project_id: projectId,
      })
      .catch(() => {});
  }, [workspaceSlug, projectId]);

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <SetupGate />,
    children: [
      {
        path: 'setup',
        element: (
          <Suspense fallback={<PageFallback />}>
            <InstanceSetupWelcomePage />
          </Suspense>
        ),
      },
      {
        path: 'setup/configure',
        element: (
          <Suspense fallback={<PageFallback />}>
            <InstanceSetupConfigurePage />
          </Suspense>
        ),
      },
      {
        path: 'setup/complete',
        element: (
          <Suspense fallback={<PageFallback />}>
            <InstanceSetupCompletePage />
          </Suspense>
        ),
      },
      {
        path: 'instance-admin/login',
        element: <Navigate to="/login" state={{ from: { pathname: '/instance-admin' } }} replace />,
      },
      {
        path: 'instance-admin',
        element: (
          <InstanceAdminProtectedRoute>
            <InstanceAdminLayout />
          </InstanceAdminProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="general" replace /> },
          {
            path: 'general',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminGeneralPage />
              </Suspense>
            ),
          },
          {
            path: 'workspace',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminWorkspacePage />
              </Suspense>
            ),
          },
          {
            path: 'workspace/create',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminCreateWorkspacePage />
              </Suspense>
            ),
          },
          {
            path: 'email',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminEmailPage />
              </Suspense>
            ),
          },
          {
            path: 'authentication',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAuthenticationPage />
              </Suspense>
            ),
          },
          {
            path: 'authentication/google',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAuthGooglePage />
              </Suspense>
            ),
          },
          {
            path: 'authentication/github',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAuthGitHubPage />
              </Suspense>
            ),
          },
          {
            path: 'authentication/gitlab',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAuthGitLabPage />
              </Suspense>
            ),
          },
          {
            path: 'ai',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAIPage />
              </Suspense>
            ),
          },
          {
            path: 'image',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminImagePage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
      {
        path: 'reset-password',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ResetPasswordPage />
          </Suspense>
        ),
      },
      {
        path: 'invite',
        element: (
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        ),
        children: [
          { index: true, element: <InviteAcceptPage /> },
          {
            path: 'sign-up',
            element: <InviteSignUpPage />,
          },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <RootRedirect /> },
          {
            path: ':workspaceSlug',
            element: <WorkspaceLayout />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <WorkspaceHomePage />
                  </Suspense>
                ),
              },
              {
                path: 'notifications',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <NotificationsPage />
                  </Suspense>
                ),
              },
              {
                path: 'profile/:userId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage />
                  </Suspense>
                ),
              },
              {
                path: 'projects',
                element: <Outlet />,
                children: [
                  {
                    index: true,
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <ProjectsListPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: ':projectId',
                    element: <ProjectLayout />,
                    children: [
                      {
                        index: true,
                        element: <Navigate to="issues" replace />,
                      },
                      {
                        path: 'issues',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <IssueListPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'issues/:issueId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <IssueDetailPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'board',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <BoardPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'cycles',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <CyclesPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'modules',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <ModulesPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'modules/:moduleId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <ModuleDetailPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'views',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <ViewsPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'views/:viewId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <ViewDetailPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'pages',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <PagesPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'settings',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <SettingsPage />
                          </Suspense>
                        ),
                      },
                    ],
                  },
                ],
              },
              {
                path: 'analytics',
                element: <Outlet />,
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  {
                    path: 'overview',
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <AnalyticsOverviewPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'work-items',
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <AnalyticsWorkItemsPage />
                      </Suspense>
                    ),
                  },
                ],
              },
              {
                path: 'views',
                element: <Navigate to="all-issues" replace />,
              },
              {
                path: 'views/:viewId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <WorkspaceViewsPage />
                  </Suspense>
                ),
              },
              {
                path: 'drafts',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <DraftsPage />
                  </Suspense>
                ),
              },
              {
                path: 'archives',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ArchivesPage />
                  </Suspense>
                ),
              },
              {
                path: 'settings',
                element: <Outlet />,
                children: [
                  {
                    index: true,
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <SettingsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'account',
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <SettingsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'projects',
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <SettingsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'projects/:projectId',
                    element: (
                      <Suspense fallback={<PageFallback />}>
                        <SettingsPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export { router };

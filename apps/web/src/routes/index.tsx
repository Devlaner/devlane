/* eslint-disable react-refresh/only-export-components -- routes file exports router + layout components; keep for future use */
import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router-dom';
import { AppShell, InstanceAdminLayout } from '../components/layout';
import { RootRedirect } from '../components/RootRedirect';
import { SetupGate } from '../components/SetupGate';
import { recentsService } from '../services/recentsService';
import { InterfaceProvider } from '../v2/contexts/InterfaceContext';
import { InstanceAdminProtectedRoute } from './InstanceAdminProtectedRoute';
import { Variant } from './InterfaceVariant';
import { PageFallback } from './PageFallback';
import { ProtectedRoute } from './ProtectedRoute';

const page = (m: { [k: string]: React.ComponentType }) => ({
  default: Object.values(m)[0],
});

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((m) => page({ LoginPage: m.LoginPage })),
);
const LoginPageV2 = lazy(() =>
  import('../v2/pages/LoginPage').then((m) => page({ LoginPage: m.LoginPage })),
);
const SignUpPageV2 = lazy(() =>
  import('../v2/pages/SignUpPage').then((m) => page({ SignUpPage: m.SignUpPage })),
);
const AppShellV2 = lazy(() =>
  import('../v2/components/layout/AppShell').then((m) => page({ AppShell: m.AppShell })),
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then((m) =>
    page({ ForgotPasswordPage: m.ForgotPasswordPage }),
  ),
);
const ForgotPasswordPageV2 = lazy(() =>
  import('../v2/pages/ForgotPasswordPage').then((m) =>
    page({ ForgotPasswordPage: m.ForgotPasswordPage }),
  ),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((m) =>
    page({ ResetPasswordPage: m.ResetPasswordPage }),
  ),
);
const ResetPasswordPageV2 = lazy(() =>
  import('../v2/pages/ResetPasswordPage').then((m) =>
    page({ ResetPasswordPage: m.ResetPasswordPage }),
  ),
);
const SignUpPage = lazy(() =>
  import('../pages/SignUpPage').then((m) => page({ SignUpPage: m.SignUpPage })),
);
const SetPasswordPage = lazy(() =>
  import('../pages/SetPasswordPage').then((m) => page({ SetPasswordPage: m.SetPasswordPage })),
);
const SetPasswordPageV2 = lazy(() =>
  import('../v2/pages/SetPasswordPage').then((m) => page({ SetPasswordPage: m.SetPasswordPage })),
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
const ProjectsListPageV2 = lazy(() =>
  import('../v2/pages/ProjectsListPage').then((m) =>
    page({ ProjectsListPage: m.ProjectsListPage }),
  ),
);
const WorkspaceViewsPage = lazy(() =>
  import('../pages/WorkspaceViewsPage').then((m) =>
    page({ WorkspaceViewsPage: m.WorkspaceViewsPage }),
  ),
);
const WorkspaceViewsPageV2 = lazy(() =>
  import('../v2/pages/WorkspaceViewsPage').then((m) =>
    page({ WorkspaceViewsPage: m.WorkspaceViewsPage }),
  ),
);
const DraftsPageV2 = lazy(() =>
  import('../v2/pages/DraftsPage').then((m) => page({ DraftsPage: m.DraftsPage })),
);
const ArchivesPageV2 = lazy(() =>
  import('../v2/pages/ArchivesPage').then((m) => page({ ArchivesPage: m.ArchivesPage })),
);
const AnalyticsOverviewPageV2 = lazy(() =>
  import('../v2/pages/AnalyticsOverviewPage').then((m) =>
    page({ AnalyticsOverviewPage: m.AnalyticsOverviewPage }),
  ),
);
const ProjectWorkItemsPageV2 = lazy(() =>
  import('../v2/pages/IssueListPage').then((m) => page({ IssueListPage: m.IssueListPage })),
);
const ProjectEpicsPageV2 = lazy(() =>
  import('../v2/pages/EpicsPage').then((m) => page({ EpicsPage: m.EpicsPage })),
);
const ProjectCyclesPageV2 = lazy(() =>
  import('../v2/pages/CyclesPage').then((m) => page({ CyclesPage: m.CyclesPage })),
);
const ProjectModulesPageV2 = lazy(() =>
  import('../v2/pages/ModulesPage').then((m) => page({ ModulesPage: m.ModulesPage })),
);
const ProjectViewsPageV2 = lazy(() =>
  import('../v2/pages/ViewsPage').then((m) => page({ ViewsPage: m.ViewsPage })),
);
const ProjectPagesPageV2 = lazy(() =>
  import('../v2/pages/PagesPage').then((m) => page({ PagesPage: m.PagesPage })),
);
const ProjectIntakePageV2 = lazy(() =>
  import('../v2/pages/IntakePage').then((m) => page({ IntakePage: m.IntakePage })),
);
const EpicDetailPageV2 = lazy(() =>
  import('../v2/pages/EpicDetailPage').then((m) => page({ EpicDetailPage: m.EpicDetailPage })),
);
const CycleDetailPageV2 = lazy(() =>
  import('../v2/pages/CycleDetailPage').then((m) => page({ CycleDetailPage: m.CycleDetailPage })),
);
const IssueDetailPageV2 = lazy(() =>
  import('../v2/pages/IssueDetailPage').then((m) => page({ IssueDetailPage: m.IssueDetailPage })),
);
const PageDetailPageV2 = lazy(() =>
  import('../v2/pages/PageDetailPage').then((m) => page({ PageDetailPage: m.PageDetailPage })),
);
const ModuleDetailPageV2 = lazy(() =>
  import('../v2/pages/ModuleDetailPage').then((m) =>
    page({ ModuleDetailPage: m.ModuleDetailPage }),
  ),
);
const ViewDetailPageV2 = lazy(() =>
  import('../v2/pages/ViewDetailPage').then((m) => page({ ViewDetailPage: m.ViewDetailPage })),
);
const WorkspaceHomePageV2 = lazy(() =>
  import('../v2/pages/WorkspaceHomePage').then((m) =>
    page({ WorkspaceHomePage: m.WorkspaceHomePage }),
  ),
);
/* Not routed through `page()`: this one takes a `scope` prop, which that
   helper's prop-less ComponentType would erase. */
const SettingsPageV2 = lazy(() =>
  import('../v2/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const AnalyticsWorkItemsPageV2 = lazy(() =>
  import('../v2/pages/AnalyticsWorkItemsPage').then((m) =>
    page({ AnalyticsWorkItemsPage: m.AnalyticsWorkItemsPage }),
  ),
);
const NotificationsPageV2 = lazy(() =>
  import('../v2/pages/NotificationsPage').then((m) =>
    page({ NotificationsPage: m.NotificationsPage }),
  ),
);
const ProfilePageV2 = lazy(() =>
  import('../v2/pages/ProfilePage').then((m) => page({ ProfilePage: m.ProfilePage })),
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
const CycleDetailPage = lazy(() =>
  import('../pages/CycleDetailPage').then((m) => page({ CycleDetailPage: m.CycleDetailPage })),
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
const PageDetailPage = lazy(() =>
  import('../pages/PageDetailPage').then((m) => page({ PageDetailPage: m.PageDetailPage })),
);
const EpicsPage = lazy(() =>
  import('../pages/EpicsPage').then((m) => page({ EpicsPage: m.EpicsPage })),
);
const EpicDetailPage = lazy(() =>
  import('../pages/EpicDetailPage').then((m) => page({ EpicDetailPage: m.EpicDetailPage })),
);
const IntakePage = lazy(() =>
  import('../pages/IntakePage').then((m) => page({ IntakePage: m.IntakePage })),
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
const InstanceAdminAdminsPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminAdminsPage: m.InstanceAdminAdminsPage }),
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
const InstanceAdminIntegrationsPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminIntegrationsPage: m.InstanceAdminIntegrationsPage }),
  ),
);
const InstanceAdminIntegrationGitHubPage = lazy(() =>
  import('../pages/instance-admin').then((m) =>
    page({ InstanceAdminIntegrationGitHubPage: m.InstanceAdminIntegrationGitHubPage }),
  ),
);

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
const CreateWorkspacePage = lazy(() =>
  import('../pages/CreateWorkspacePage').then((m) =>
    page({ CreateWorkspacePage: m.CreateWorkspacePage }),
  ),
);
const CreateWorkspacePageV2 = lazy(() =>
  import('../v2/pages/CreateWorkspacePage').then((m) =>
    page({ CreateWorkspacePage: m.CreateWorkspacePage }),
  ),
);
const InviteAcceptPage = lazy(() =>
  import('../pages/InviteAcceptPage').then((m) => page({ InviteAcceptPage: m.InviteAcceptPage })),
);
const InviteAcceptPageV2 = lazy(() =>
  import('../v2/pages/InviteAcceptPage').then((m) =>
    page({ InviteAcceptPage: m.InviteAcceptPage }),
  ),
);
const InviteSignUpPage = lazy(() =>
  import('../pages/InviteSignUpPage').then((m) => page({ InviteSignUpPage: m.InviteSignUpPage })),
);
const InviteSignUpPageV2 = lazy(() =>
  import('../v2/pages/InviteSignUpPage').then((m) =>
    page({ InviteSignUpPage: m.InviteSignUpPage }),
  ),
);

/**
 * The signed-in chrome. Which shell renders is the whole of the v1/v2 split at
 * layout level: both render an <Outlet />, so every child route below is
 * declared once and shared.
 */
function WorkspaceLayout() {
  return (
    <ProtectedRoute>
      <Variant v1={<AppShell />} v2={<AppShellV2 />} />
    </ProtectedRoute>
  );
}

/**
 * Root "/" only ever renders RootRedirect, which resolves to a workspace or to
 * setup. v1 keeps its shell around that moment; v2 has no shell to show yet —
 * its AppShell needs a :workspaceSlug, which this route has not matched.
 */
function RootLayout() {
  return (
    <ProtectedRoute>
      <Variant v1={<AppShell />} v2={<Outlet />} />
    </ProtectedRoute>
  );
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

/**
 * Holds the interface preference above every route, so <Variant> can read it
 * anywhere in the tree. It lives here rather than in App.tsx to keep the v1
 * app root free of anything v2 — this file is the one seam that knows about
 * both interfaces.
 */
function InterfaceRoot() {
  return (
    <InterfaceProvider>
      <SetupGate />
    </InterfaceProvider>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <InterfaceRoot />,
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
        /* Instance admin has no v2 counterpart: it is a separate surface from
           the workspace app and is deliberately left on the shipped chrome. */
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
            path: 'admins',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminAdminsPage />
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
          {
            path: 'integrations',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminIntegrationsPage />
              </Suspense>
            ),
          },
          {
            path: 'integrations/github',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InstanceAdminIntegrationGitHubPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'login',
        element: <Variant v1={<LoginPage />} v2={<LoginPageV2 />} />,
      },
      {
        path: 'forgot-password',
        element: <Variant v1={<ForgotPasswordPage />} v2={<ForgotPasswordPageV2 />} />,
      },
      {
        path: 'reset-password',
        element: <Variant v1={<ResetPasswordPage />} v2={<ResetPasswordPageV2 />} />,
      },
      {
        path: 'sign-up',
        element: <Variant v1={<SignUpPage />} v2={<SignUpPageV2 />} />,
      },
      {
        path: 'accounts/set-password',
        element: (
          <ProtectedRoute>
            <Variant v1={<SetPasswordPage />} v2={<SetPasswordPageV2 />} />
          </ProtectedRoute>
        ),
      },
      {
        path: 'invite',
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <Variant v1={<InviteAcceptPage />} v2={<InviteAcceptPageV2 />} />,
          },
          {
            path: 'sign-up',
            element: <Variant v1={<InviteSignUpPage />} v2={<InviteSignUpPageV2 />} />,
          },
        ],
      },
      {
        path: 'create-workspace',
        element: (
          <ProtectedRoute>
            <Variant v1={<CreateWorkspacePage />} v2={<CreateWorkspacePageV2 />} />
          </ProtectedRoute>
        ),
      },
      {
        element: <RootLayout />,
        children: [{ index: true, element: <RootRedirect /> }],
      },
      {
        path: ':workspaceSlug',
        element: <WorkspaceLayout />,
        children: [
          {
            index: true,
            element: <Variant v1={<WorkspaceHomePage />} v2={<WorkspaceHomePageV2 />} />,
          },
          {
            path: 'notifications',
            element: <Variant v1={<NotificationsPage />} v2={<NotificationsPageV2 />} />,
          },
          {
            path: 'profile/:userId',
            element: <Variant v1={<ProfilePage />} v2={<ProfilePageV2 />} />,
          },
          {
            path: 'projects',
            element: <Outlet />,
            children: [
              {
                index: true,
                element: <Variant v1={<ProjectsListPage />} v2={<ProjectsListPageV2 />} />,
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
                    element: <Variant v1={<IssueListPage />} v2={<ProjectWorkItemsPageV2 />} />,
                  },
                  {
                    path: 'issues/:issueId',
                    element: <Variant v1={<IssueDetailPage />} v2={<IssueDetailPageV2 />} />,
                  },
                  {
                    /* v1 keeps its dedicated board page; v2 folds the board into
                       the work items page as a layout, so it redirects there. */
                    path: 'board',
                    element: (
                      <Variant
                        v1={<BoardPage />}
                        v2={<Navigate to="../issues?layout=board" replace relative="path" />}
                      />
                    ),
                  },
                  {
                    path: 'cycles',
                    element: <Variant v1={<CyclesPage />} v2={<ProjectCyclesPageV2 />} />,
                  },
                  {
                    path: 'cycles/:cycleId',
                    element: <Variant v1={<CycleDetailPage />} v2={<CycleDetailPageV2 />} />,
                  },
                  {
                    path: 'modules',
                    element: <Variant v1={<ModulesPage />} v2={<ProjectModulesPageV2 />} />,
                  },
                  {
                    path: 'modules/:moduleId',
                    element: <Variant v1={<ModuleDetailPage />} v2={<ModuleDetailPageV2 />} />,
                  },
                  {
                    path: 'views',
                    element: <Variant v1={<ViewsPage />} v2={<ProjectViewsPageV2 />} />,
                  },
                  {
                    path: 'views/:viewId',
                    element: <Variant v1={<ViewDetailPage />} v2={<ViewDetailPageV2 />} />,
                  },
                  {
                    path: 'pages',
                    element: <Variant v1={<PagesPage />} v2={<ProjectPagesPageV2 />} />,
                  },
                  {
                    path: 'pages/:pageId',
                    element: <Variant v1={<PageDetailPage />} v2={<PageDetailPageV2 />} />,
                  },
                  {
                    path: 'epics',
                    element: <Variant v1={<EpicsPage />} v2={<ProjectEpicsPageV2 />} />,
                  },
                  {
                    path: 'epics/:epicId',
                    element: <Variant v1={<EpicDetailPage />} v2={<EpicDetailPageV2 />} />,
                  },
                  {
                    path: 'intake',
                    element: <Variant v1={<IntakePage />} v2={<ProjectIntakePageV2 />} />,
                  },
                  {
                    path: 'settings',
                    element: (
                      <Variant v1={<SettingsPage />} v2={<SettingsPageV2 scope="project" />} />
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
                  <Variant v1={<AnalyticsOverviewPage />} v2={<AnalyticsOverviewPageV2 />} />
                ),
              },
              {
                path: 'work-items',
                element: (
                  <Variant v1={<AnalyticsWorkItemsPage />} v2={<AnalyticsWorkItemsPageV2 />} />
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
            element: <Variant v1={<WorkspaceViewsPage />} v2={<WorkspaceViewsPageV2 />} />,
          },
          {
            path: 'drafts',
            element: <Variant v1={<DraftsPage />} v2={<DraftsPageV2 />} />,
          },
          {
            path: 'archives',
            element: <Variant v1={<ArchivesPage />} v2={<ArchivesPageV2 />} />,
          },
          {
            path: 'settings',
            element: <Outlet />,
            children: [
              {
                index: true,
                element: (
                  <Variant v1={<SettingsPage />} v2={<SettingsPageV2 scope="workspace" />} />
                ),
              },
              {
                path: 'account',
                element: <Variant v1={<SettingsPage />} v2={<SettingsPageV2 scope="account" />} />,
              },
              {
                path: 'projects',
                element: <Variant v1={<SettingsPage />} v2={<SettingsPageV2 scope="projects" />} />,
              },
              {
                path: 'projects/:projectId',
                element: <Variant v1={<SettingsPage />} v2={<SettingsPageV2 scope="projects" />} />,
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

/* eslint-disable react-refresh/only-export-components -- routes file exports router + layout components; keep for future use */
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
const LoginPageV2 = lazy(() =>
  import('../pages/LoginPageV2').then((m) => page({ LoginPageV2: m.LoginPageV2 })),
);
const SignUpPageV2 = lazy(() =>
  import('../pages/SignUpPageV2').then((m) => page({ SignUpPageV2: m.SignUpPageV2 })),
);
const AppShellV2Page = lazy(() =>
  import('../pages/AppShellV2Page').then((m) => page({ AppShellV2Page: m.AppShellV2Page })),
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then((m) =>
    page({ ForgotPasswordPage: m.ForgotPasswordPage }),
  ),
);
const ForgotPasswordPageV2 = lazy(() =>
  import('../pages/ForgotPasswordPageV2').then((m) =>
    page({ ForgotPasswordPageV2: m.ForgotPasswordPageV2 }),
  ),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((m) =>
    page({ ResetPasswordPage: m.ResetPasswordPage }),
  ),
);
const ResetPasswordPageV2 = lazy(() =>
  import('../pages/ResetPasswordPageV2').then((m) =>
    page({ ResetPasswordPageV2: m.ResetPasswordPageV2 }),
  ),
);
const SignUpPage = lazy(() =>
  import('../pages/SignUpPage').then((m) => page({ SignUpPage: m.SignUpPage })),
);
const SetPasswordPage = lazy(() =>
  import('../pages/SetPasswordPage').then((m) => page({ SetPasswordPage: m.SetPasswordPage })),
);
const SetPasswordPageV2 = lazy(() =>
  import('../pages/SetPasswordPageV2').then((m) =>
    page({ SetPasswordPageV2: m.SetPasswordPageV2 }),
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
const ProjectsListPageV2 = lazy(() =>
  import('../pages/ProjectsListPageV2').then((m) =>
    page({ ProjectsListPageV2: m.ProjectsListPageV2 }),
  ),
);
const WorkspaceViewsPage = lazy(() =>
  import('../pages/WorkspaceViewsPage').then((m) =>
    page({ WorkspaceViewsPage: m.WorkspaceViewsPage }),
  ),
);
const WorkspaceViewsPageV2 = lazy(() =>
  import('../pages/WorkspaceViewsPageV2').then((m) =>
    page({ WorkspaceViewsPageV2: m.WorkspaceViewsPageV2 }),
  ),
);
const DraftsPageV2 = lazy(() =>
  import('../pages/DraftsPageV2').then((m) => page({ DraftsPageV2: m.DraftsPageV2 })),
);
const ArchivesPageV2 = lazy(() =>
  import('../pages/ArchivesPageV2').then((m) => page({ ArchivesPageV2: m.ArchivesPageV2 })),
);
const AnalyticsOverviewPageV2 = lazy(() =>
  import('../pages/AnalyticsOverviewPageV2').then((m) =>
    page({ AnalyticsOverviewPageV2: m.AnalyticsOverviewPageV2 }),
  ),
);
const ProjectWorkItemsPageV2 = lazy(() =>
  import('../pages/ProjectWorkItemsPageV2').then((m) =>
    page({ ProjectWorkItemsPageV2: m.ProjectWorkItemsPageV2 }),
  ),
);
const ProjectEpicsPageV2 = lazy(() =>
  import('../pages/ProjectEpicsPageV2').then((m) =>
    page({ ProjectEpicsPageV2: m.ProjectEpicsPageV2 }),
  ),
);
const ProjectCyclesPageV2 = lazy(() =>
  import('../pages/ProjectCyclesPageV2').then((m) =>
    page({ ProjectCyclesPageV2: m.ProjectCyclesPageV2 }),
  ),
);
const ProjectModulesPageV2 = lazy(() =>
  import('../pages/ProjectModulesPageV2').then((m) =>
    page({ ProjectModulesPageV2: m.ProjectModulesPageV2 }),
  ),
);
const ProjectViewsPageV2 = lazy(() =>
  import('../pages/ProjectViewsPageV2').then((m) =>
    page({ ProjectViewsPageV2: m.ProjectViewsPageV2 }),
  ),
);
const ProjectPagesPageV2 = lazy(() =>
  import('../pages/ProjectPagesPageV2').then((m) =>
    page({ ProjectPagesPageV2: m.ProjectPagesPageV2 }),
  ),
);
const ProjectIntakePageV2 = lazy(() =>
  import('../pages/ProjectIntakePageV2').then((m) =>
    page({ ProjectIntakePageV2: m.ProjectIntakePageV2 }),
  ),
);
const EpicDetailPageV2 = lazy(() =>
  import('../pages/EpicDetailPageV2').then((m) => page({ EpicDetailPageV2: m.EpicDetailPageV2 })),
);
const CycleDetailPageV2 = lazy(() =>
  import('../pages/CycleDetailPageV2').then((m) =>
    page({ CycleDetailPageV2: m.CycleDetailPageV2 }),
  ),
);
const IssueDetailPageV2 = lazy(() =>
  import('../pages/IssueDetailPageV2').then((m) =>
    page({ IssueDetailPageV2: m.IssueDetailPageV2 }),
  ),
);
const PageDetailPageV2 = lazy(() =>
  import('../pages/PageDetailPageV2').then((m) => page({ PageDetailPageV2: m.PageDetailPageV2 })),
);
const ModuleDetailPageV2 = lazy(() =>
  import('../pages/ModuleDetailPageV2').then((m) =>
    page({ ModuleDetailPageV2: m.ModuleDetailPageV2 }),
  ),
);
const ViewDetailPageV2 = lazy(() =>
  import('../pages/ViewDetailPageV2').then((m) => page({ ViewDetailPageV2: m.ViewDetailPageV2 })),
);
const WorkspaceHomePageV2 = lazy(() =>
  import('../pages/WorkspaceHomePageV2').then((m) =>
    page({ WorkspaceHomePageV2: m.WorkspaceHomePageV2 }),
  ),
);
/* Not routed through `page()`: this one takes a `scope` prop, which that
   helper's prop-less ComponentType would erase. */
const SettingsPageV2 = lazy(() =>
  import('../pages/SettingsPageV2').then((m) => ({ default: m.SettingsPageV2 })),
);
const AnalyticsWorkItemsPageV2 = lazy(() =>
  import('../pages/AnalyticsWorkItemsPageV2').then((m) =>
    page({ AnalyticsWorkItemsPageV2: m.AnalyticsWorkItemsPageV2 }),
  ),
);
const NotificationsPageV2 = lazy(() =>
  import('../pages/NotificationsPageV2').then((m) =>
    page({ NotificationsPageV2: m.NotificationsPageV2 }),
  ),
);
const ProfilePageV2 = lazy(() =>
  import('../pages/ProfilePageV2').then((m) => page({ ProfilePageV2: m.ProfilePageV2 })),
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
  import('../pages/CreateWorkspacePageV2').then((m) =>
    page({ CreateWorkspacePageV2: m.CreateWorkspacePageV2 }),
  ),
);
const InviteAcceptPage = lazy(() =>
  import('../pages/InviteAcceptPage').then((m) => page({ InviteAcceptPage: m.InviteAcceptPage })),
);
const InviteAcceptPageV2 = lazy(() =>
  import('../pages/InviteAcceptPageV2').then((m) =>
    page({ InviteAcceptPageV2: m.InviteAcceptPageV2 }),
  ),
);
const InviteSignUpPage = lazy(() =>
  import('../pages/InviteSignUpPage').then((m) => page({ InviteSignUpPage: m.InviteSignUpPage })),
);
const InviteSignUpPageV2 = lazy(() =>
  import('../pages/InviteSignUpPageV2').then((m) =>
    page({ InviteSignUpPageV2: m.InviteSignUpPageV2 }),
  ),
);

const PageFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
      {t('common.loading', 'Loading…')}
    </div>
  );
};

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
        element: (
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: 'login-v2',
        element: (
          <Suspense fallback={<PageFallback />}>
            <LoginPageV2 />
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
        path: 'forgot-password-v2',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ForgotPasswordPageV2 />
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
        path: 'reset-password-v2',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ResetPasswordPageV2 />
          </Suspense>
        ),
      },
      {
        path: 'sign-up',
        element: (
          <Suspense fallback={<PageFallback />}>
            <SignUpPage />
          </Suspense>
        ),
      },
      {
        path: 'sign-up-v2',
        element: (
          <Suspense fallback={<PageFallback />}>
            <SignUpPageV2 />
          </Suspense>
        ),
      },
      {
        path: 'accounts/set-password',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageFallback />}>
              <SetPasswordPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'accounts/set-password-v2',
        element: (
          <ProtectedRoute signInPath="/login-v2">
            <Suspense fallback={<PageFallback />}>
              <SetPasswordPageV2 />
            </Suspense>
          </ProtectedRoute>
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
        path: 'invite-v2',
        element: (
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        ),
        children: [
          { index: true, element: <InviteAcceptPageV2 /> },
          {
            path: 'sign-up',
            element: <InviteSignUpPageV2 />,
          },
        ],
      },
      {
        path: 'create-workspace',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageFallback />}>
              <CreateWorkspacePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'create-workspace-v2',
        element: (
          <ProtectedRoute signInPath="/login-v2">
            <Suspense fallback={<PageFallback />}>
              <CreateWorkspacePageV2 />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        /* Design previews. AppShellV2Page is the layout: it brings its own
           shell, so it sits outside AppLayout rather than inside it — nesting
           it there would render the shipped sidebar behind this one. The v2
           pages are its children, so the preview sidebar stays put while
           navigating between them. */
        path: ':workspaceSlug/app-v2',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageFallback />}>
              <AppShellV2Page />
            </Suspense>
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageFallback />}>
                <WorkspaceHomePageV2 />
              </Suspense>
            ),
          },
          {
            path: 'projects',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ProjectsListPageV2 />
              </Suspense>
            ),
          },
          {
            /* The per-project pages the v2 sidebar links to. Same segments as
               the shipped project routes, so the two trees can be compared by
               swapping `/app-v2/projects/:id` for `/projects/:id`. */
            path: 'projects/:projectId',
            element: <Outlet />,
            children: [
              { index: true, element: <Navigate to="work-items" replace /> },
              {
                path: 'work-items',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectWorkItemsPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'work-items/:issueId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <IssueDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'epics',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectEpicsPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'epics/:epicId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <EpicDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'cycles',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectCyclesPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'cycles/:cycleId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <CycleDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'modules',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectModulesPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'modules/:moduleId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ModuleDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'views',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectViewsPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'views/:viewId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ViewDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'pages',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectPagesPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'pages/:pageId',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <PageDetailPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'intake',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ProjectIntakePageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'settings',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <SettingsPageV2 scope="project" />
                  </Suspense>
                ),
              },
              {
                /* The shipped BoardPage is a redirect and nothing else; nested
                   here its slug/id guard is structurally satisfied, so the whole
                   page collapses into this route entry. */
                path: 'board',
                element: <Navigate to="../work-items?layout=board" replace relative="path" />,
              },
            ],
          },
          /* Same shape as the shipped views routes: the bare path lands on the
             default view rather than rendering an empty picker. */
          { path: 'views', element: <Navigate to="all-issues" replace /> },
          {
            path: 'views/:viewId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <WorkspaceViewsPageV2 />
              </Suspense>
            ),
          },
          {
            path: 'drafts',
            element: (
              <Suspense fallback={<PageFallback />}>
                <DraftsPageV2 />
              </Suspense>
            ),
          },
          {
            path: 'archives',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ArchivesPageV2 />
              </Suspense>
            ),
          },
          {
            path: 'notifications',
            element: (
              <Suspense fallback={<PageFallback />}>
                <NotificationsPageV2 />
              </Suspense>
            ),
          },
          {
            path: 'profile/:userId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ProfilePageV2 />
              </Suspense>
            ),
          },
          /* Settings keeps the shipped tree's shape — workspace at the root,
             account and per-project settings below it — so a `?section=` link
             works the same in both interfaces. */
          {
            path: 'settings',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPageV2 scope="workspace" />
              </Suspense>
            ),
          },
          {
            path: 'settings/account',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPageV2 scope="account" />
              </Suspense>
            ),
          },
          {
            path: 'settings/projects',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPageV2 scope="projects" />
              </Suspense>
            ),
          },
          {
            path: 'settings/projects/:projectId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPageV2 scope="projects" />
              </Suspense>
            ),
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
                    <AnalyticsOverviewPageV2 />
                  </Suspense>
                ),
              },
              {
                path: 'work-items',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AnalyticsWorkItemsPageV2 />
                  </Suspense>
                ),
              },
            ],
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
                        path: 'cycles/:cycleId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <CycleDetailPage />
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
                        path: 'pages/:pageId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <PageDetailPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'epics',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <EpicsPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'epics/:epicId',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <EpicDetailPage />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'intake',
                        element: (
                          <Suspense fallback={<PageFallback />}>
                            <IntakePage />
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

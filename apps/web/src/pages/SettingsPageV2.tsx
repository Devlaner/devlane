import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ActivityIcon,
  ArchiveIcon,
  BellIcon,
  ClockIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LockIcon,
  PlugIcon,
  SettingsIcon,
  TagIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  WebhookIcon,
  ZapIcon,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  SettingsShell,
  type SettingsSectionGroup,
} from '@/components/shadcn/settings/settings-shell';
import { ApiTokensPanel } from '@/components/shadcn/settings/api-tokens-panel';
import { NotificationPreferencesPanel } from '@/components/shadcn/settings/notification-preferences-panel';
import { AccountActivityPanel } from '@/components/shadcn/settings/account/account-activity-panel';
import { AccountPreferencesPanel } from '@/components/shadcn/settings/account/account-preferences-panel';
import { AccountProfilePanel } from '@/components/shadcn/settings/account/account-profile-panel';
import { AccountSecurityPanel } from '@/components/shadcn/settings/account/account-security-panel';
import { ProjectAutomationsPanel } from '@/components/shadcn/settings/project/project-automations-panel';
import { ProjectFeaturesPanel } from '@/components/shadcn/settings/project/project-features-panel';
import { ProjectGeneralPanel } from '@/components/shadcn/settings/project/project-general-panel';
import { ProjectLabelsPanel } from '@/components/shadcn/settings/project/project-labels-panel';
import { ProjectMembersPanel } from '@/components/shadcn/settings/project/project-members-panel';
import { ProjectStatesPanel } from '@/components/shadcn/settings/project/project-states-panel';
import { WorkspaceExportsPanel } from '@/components/shadcn/settings/workspace/workspace-exports-panel';
import { WorkspaceGeneralPanel } from '@/components/shadcn/settings/workspace/workspace-general-panel';
import { WorkspaceMembersPanel } from '@/components/shadcn/settings/workspace/workspace-members-panel';
/* The heavy domain panels are shared with the shipped interface rather than
   re-implemented: they own their own API flows, and v2 pages already reuse the
   app's domain components this way (see IssueDetailPageV2). */
import { IntegrationsSection } from '../components/integrations/IntegrationsSection';
import { ProjectEstimatesSettings } from '../components/settings/ProjectEstimatesSettings';
import { WebhooksSettings } from '../components/settings/WebhooksSettings';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { notificationPreferenceService } from '../services/notificationPreferenceService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { workspaceService } from '../services/workspaceService';
import type {
  NotificationPreferencesResponse,
  ProjectApiResponse,
  WorkspaceApiResponse,
} from '../api/types';

/** Which settings tree the page renders. */
export type SettingsScope = 'account' | 'workspace' | 'projects' | 'project';

type AccountSection =
  | 'profile'
  | 'preferences'
  | 'notifications'
  | 'security'
  | 'activity'
  | 'tokens';
type WorkspaceSection =
  | 'general'
  | 'members'
  | 'notifications'
  | 'integrations'
  | 'exports'
  | 'webhooks'
  | 'api-tokens';
type ProjectSection =
  | 'general'
  | 'members'
  | 'features'
  | 'notifications'
  | 'states'
  | 'labels'
  | 'estimates'
  | 'automations';

interface SettingsPageV2Props {
  scope: SettingsScope;
}

/**
 * The v2 settings surface. One page serves the account, workspace, and project
 * trees: they share the chrome and differ only in their section list, so the
 * scope decides which nav and which panels are rendered.
 *
 * The section lives in `?section=`, matching the shipped settings page, so a
 * link into a specific section keeps working across both interfaces.
 */
export function SettingsPageV2({ scope }: SettingsPageV2Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug, projectId: projectIdFromPath } = useParams<{
    workspaceSlug: string;
    projectId?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!workspaceSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([workspaceService.getBySlug(workspaceSlug), projectService.list(workspaceSlug)])
        .then(([ws, list]) => {
          if (cancelled) return;
          setWorkspace(ws ?? null);
          setProjects(list ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setWorkspace(null);
          setProjects([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const selectedProjectId =
    projectIdFromPath && projects.some((p) => p.id === projectIdFromPath)
      ? projectIdFromPath
      : scope === 'projects'
        ? (projects[0]?.id ?? null)
        : (projectIdFromPath ?? null);
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const requestedSection = searchParams.get('section');
  const setSection = (section: string) => {
    setSearchParams({ section }, { replace: false });
  };

  /* The breadcrumb names the scope. Only the account and projects trees sit
     under the workspace settings root, so only they get the middle crumb. */
  const headerTitle =
    scope === 'account'
      ? t('settings.tabs.account', 'Account')
      : scope === 'workspace'
        ? t('settings.documentTitle', 'Settings')
        : scope === 'project'
          ? t('settings.project.pageTitle', 'Project settings')
          : (selectedProject?.name ?? t('settings.tabs.projects', 'Projects'));
  const parentCrumb = useMemo(
    () =>
      scope === 'account' || scope === 'projects'
        ? {
            label: t('settings.documentTitle', 'Settings'),
            to: `/${workspaceSlug}/app-v2/settings`,
          }
        : null,
    [scope, t, workspaceSlug],
  );
  useSetV2Header({ parent: parentCrumb, title: headerTitle, actions: null });

  /* Per-scope notification load/save pairs, kept stable so the panel's effect
     only re-runs when the target scope changes. */
  const loadAccountPrefs = useCallback(() => userService.getNotificationPreferences(), []);
  const saveAccountPrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      userService.updateNotificationPreferences(partial),
    [],
  );
  const loadWorkspacePrefs = useCallback(
    () => notificationPreferenceService.getWorkspace(workspaceSlug ?? ''),
    [workspaceSlug],
  );
  const saveWorkspacePrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      notificationPreferenceService.updateWorkspace(workspaceSlug ?? '', partial),
    [workspaceSlug],
  );
  const loadProjectPrefs = useCallback(
    () => notificationPreferenceService.getProject(workspaceSlug ?? '', selectedProjectId ?? ''),
    [workspaceSlug, selectedProjectId],
  );
  const saveProjectPrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      notificationPreferenceService.updateProject(
        workspaceSlug ?? '',
        selectedProjectId ?? '',
        partial,
      ),
    [workspaceSlug, selectedProjectId],
  );

  const onProjectUpdated = useCallback((updated: ProjectApiResponse) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);
  const onProjectArchived = useCallback((archivedId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== archivedId));
  }, []);

  const tabs =
    scope === 'project'
      ? undefined
      : [
          {
            id: 'account',
            label: t('settings.tabs.account', 'Account'),
            to: `/${workspaceSlug}/app-v2/settings/account`,
          },
          {
            id: 'workspace',
            label: t('settings.tabs.workspace', 'Workspace'),
            to: `/${workspaceSlug}/app-v2/settings`,
          },
          {
            id: 'projects',
            label: t('settings.tabs.projects', 'Projects'),
            to: `/${workspaceSlug}/app-v2/settings/projects`,
          },
        ];

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!workspace || !workspaceSlug) {
    return (
      <p className="text-muted-foreground py-8 text-sm">
        {t('settings.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  if (scope === 'account') {
    const sections: SettingsSectionGroup<AccountSection>[] = [
      {
        items: [
          { id: 'profile', label: t('settings.account.profileTitle', 'Profile'), icon: UserIcon },
          {
            id: 'preferences',
            label: t('settings.preferences.title', 'Preferences'),
            icon: SettingsIcon,
          },
          {
            id: 'notifications',
            label: t('settings.notifications.title', 'Notifications'),
            icon: BellIcon,
          },
          { id: 'security', label: t('settings.security.title', 'Security'), icon: LockIcon },
          { id: 'activity', label: t('settings.activity.title', 'Activity'), icon: ActivityIcon },
        ],
      },
      {
        label: t('settings.groups.developer', 'Developer'),
        items: [
          {
            id: 'tokens',
            label: t('settings.tokens.title', 'Personal Access Tokens'),
            icon: KeyRoundIcon,
          },
        ],
      },
    ];
    const valid = sections.flatMap((g) => g.items).map((i) => i.id);
    const section = (
      valid.includes(requestedSection as AccountSection) ? requestedSection : 'profile'
    ) as AccountSection;

    return (
      <SettingsShell
        title={t('settings.documentTitle', 'Settings')}
        description={t('settings.account.pageDescription', 'Your personal Devlane account.')}
        tabs={tabs}
        activeTabId="account"
        groups={sections}
        activeSection={section}
        onSectionChange={setSection}
      >
        {section === 'profile' && <AccountProfilePanel />}
        {section === 'preferences' && <AccountPreferencesPanel />}
        {section === 'notifications' && (
          <NotificationPreferencesPanel
            load={loadAccountPrefs}
            save={saveAccountPrefs}
            title={t('settings.notifications.account.title', 'Notifications')}
            description={t(
              'settings.notifications.account.description',
              'Your default notifications across every workspace. Workspaces and projects can override these.',
            )}
          />
        )}
        {section === 'security' && <AccountSecurityPanel />}
        {section === 'activity' && <AccountActivityPanel workspaceSlug={workspaceSlug} />}
        {section === 'tokens' && (
          <ApiTokensPanel
            title={t('settings.tokens.title', 'Personal Access Tokens')}
            description={t(
              'settings.tokens.subtitle',
              'Generate secure API tokens to integrate your data with external systems and applications.',
            )}
            addLabel={t('settings.tokens.add', 'Add personal access token')}
            load={async () => (await userService.listTokens()).tokens ?? []}
            create={(payload) => userService.createToken(payload)}
            revoke={(tokenId) => userService.revokeToken(tokenId)}
          />
        )}
      </SettingsShell>
    );
  }

  if (scope === 'workspace') {
    const sections: SettingsSectionGroup<WorkspaceSection>[] = [
      {
        label: t('settings.groups.administration', 'Administration'),
        items: [
          {
            id: 'general',
            label: t('settings.workspace.generalTitle', 'General'),
            icon: LayoutGridIcon,
          },
          { id: 'members', label: t('settings.members.title', 'Members'), icon: UsersIcon },
          {
            id: 'notifications',
            label: t('settings.notifications.title', 'Notifications'),
            icon: BellIcon,
          },
          {
            id: 'integrations',
            label: t('settings.integrations.title', 'Integrations'),
            icon: PlugIcon,
          },
          { id: 'exports', label: t('settings.export.title', 'Exports'), icon: UploadIcon },
        ],
      },
      {
        label: t('settings.groups.developer', 'Developer'),
        items: [
          { id: 'webhooks', label: t('settings.webhooks.title', 'Webhooks'), icon: WebhookIcon },
          {
            id: 'api-tokens',
            label: t('settings.apiTokens.title', 'API Tokens'),
            icon: KeyRoundIcon,
          },
        ],
      },
    ];
    const valid = sections.flatMap((g) => g.items).map((i) => i.id);
    const section = (
      valid.includes(requestedSection as WorkspaceSection) ? requestedSection : 'general'
    ) as WorkspaceSection;

    return (
      <SettingsShell
        title={t('settings.documentTitle', 'Settings')}
        description={t(
          'settings.workspace.pageDescription',
          'Manage {{name}} and everyone who works in it.',
          { name: workspace.name },
        )}
        tabs={tabs}
        activeTabId="workspace"
        groups={sections}
        activeSection={section}
        onSectionChange={setSection}
      >
        {section === 'general' && (
          <WorkspaceGeneralPanel workspace={workspace} onWorkspaceUpdated={setWorkspace} />
        )}
        {section === 'members' && <WorkspaceMembersPanel workspaceSlug={workspaceSlug} />}
        {section === 'notifications' && (
          <NotificationPreferencesPanel
            key={workspaceSlug}
            load={loadWorkspacePrefs}
            save={saveWorkspacePrefs}
            title={t('settings.notifications.workspace.title', 'Workspace notifications')}
            description={t(
              'settings.notifications.workspace.description',
              "How you're notified for work in this workspace. Overrides your account defaults; projects can override this.",
            )}
          />
        )}
        {section === 'integrations' && (
          <IntegrationsSection workspaceSlug={workspaceSlug} projects={projects} />
        )}
        {section === 'exports' && (
          <WorkspaceExportsPanel workspaceSlug={workspaceSlug} projects={projects} />
        )}
        {section === 'webhooks' && <WebhooksSettings workspaceSlug={workspaceSlug} />}
        {section === 'api-tokens' && (
          <ApiTokensPanel
            title={t('settings.apiTokens.title', 'API Tokens')}
            description={t(
              'settings.apiTokens.subtitle',
              'Service tokens authenticate as this workspace. Only admins can manage them.',
            )}
            addLabel={t('settings.apiTokens.add', 'Add service token')}
            load={async () => (await workspaceService.listTokens(workspaceSlug)).tokens ?? []}
            create={(payload) => workspaceService.createToken(workspaceSlug, payload)}
            revoke={(tokenId) => workspaceService.revokeToken(workspaceSlug, tokenId)}
            loadErrorMessage={(error) =>
              (error as { response?: { status?: number } })?.response?.status === 403
                ? t(
                    'settings.apiTokens.error.adminOnlyManage',
                    'Only workspace admins can manage service tokens.',
                  )
                : t('settings.apiTokens.error.load', 'Could not load service tokens.')
            }
          />
        )}
      </SettingsShell>
    );
  }

  /* Project scope — reached from the workspace's Projects tab (with a picker) or
     from inside a project (its own chrome, so no tabs and no picker). */
  const sections: SettingsSectionGroup<ProjectSection>[] = [
    {
      items: [
        {
          id: 'general',
          label: t('settings.project.generalTitle', 'General'),
          icon: LayoutGridIcon,
        },
        { id: 'members', label: t('settings.members.title', 'Members'), icon: UsersIcon },
        { id: 'features', label: t('settings.features.shortTitle', 'Features'), icon: ZapIcon },
        {
          id: 'notifications',
          label: t('settings.notifications.title', 'Notifications'),
          icon: BellIcon,
        },
        { id: 'states', label: t('settings.states.title', 'States'), icon: ActivityIcon },
        { id: 'labels', label: t('settings.labels.title', 'Labels'), icon: TagIcon },
        { id: 'estimates', label: t('settings.estimates.title', 'Estimates'), icon: ClockIcon },
        {
          id: 'automations',
          label: t('settings.automations.title', 'Automations'),
          icon: ArchiveIcon,
        },
      ],
    },
  ];
  const valid = sections.flatMap((g) => g.items).map((i) => i.id);
  const section = (
    valid.includes(requestedSection as ProjectSection) ? requestedSection : 'general'
  ) as ProjectSection;

  const picker =
    scope === 'projects' && projects.length > 0 ? (
      <Select
        value={selectedProjectId ?? undefined}
        onValueChange={(value) =>
          navigate(`/${workspaceSlug}/app-v2/settings/projects/${value}?section=${section}`)
        }
      >
        <SelectTrigger className="w-full" aria-label={t('settings.project.pickerLabel', 'Project')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : undefined;

  return (
    <SettingsShell
      title={
        scope === 'project'
          ? t('settings.project.pageTitle', 'Project settings')
          : t('settings.documentTitle', 'Settings')
      }
      description={
        selectedProject
          ? t('settings.project.pageDescription', 'Configure {{name}}.', {
              name: selectedProject.name,
            })
          : t('settings.project.noProjects', 'Create a project to configure it here.')
      }
      tabs={tabs}
      activeTabId="projects"
      groups={sections}
      activeSection={section}
      onSectionChange={setSection}
      aside={picker}
    >
      {!selectedProject ? (
        <p className="text-muted-foreground text-sm">
          {t('settings.project.noProjects', 'Create a project to configure it here.')}
        </p>
      ) : (
        <>
          {section === 'general' && (
            <ProjectGeneralPanel
              workspaceSlug={workspaceSlug}
              project={selectedProject}
              onProjectUpdated={onProjectUpdated}
              onProjectArchived={onProjectArchived}
            />
          )}
          {section === 'members' && (
            <ProjectMembersPanel
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              project={selectedProject}
              onProjectUpdated={onProjectUpdated}
            />
          )}
          {section === 'features' && (
            <ProjectFeaturesPanel
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              project={selectedProject}
              onProjectUpdated={onProjectUpdated}
            />
          )}
          {section === 'notifications' && (
            <NotificationPreferencesPanel
              key={selectedProject.id}
              load={loadProjectPrefs}
              save={saveProjectPrefs}
              title={t('settings.notifications.project.title', 'Project notifications')}
              description={t(
                'settings.notifications.project.description',
                "How you're notified for work in this project. Overrides your workspace and account defaults.",
              )}
            />
          )}
          {section === 'states' && (
            <ProjectStatesPanel
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              projectId={selectedProject.id}
            />
          )}
          {section === 'labels' && (
            <ProjectLabelsPanel
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              projectId={selectedProject.id}
            />
          )}
          {section === 'estimates' && (
            <ProjectEstimatesSettings
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              projectId={selectedProject.id}
            />
          )}
          {section === 'automations' && (
            <ProjectAutomationsPanel
              key={selectedProject.id}
              workspaceSlug={workspaceSlug}
              project={selectedProject}
              onProjectUpdated={onProjectUpdated}
            />
          )}
        </>
      )}
    </SettingsShell>
  );
}

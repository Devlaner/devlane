import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SUPPORTED_LANGUAGES, setLanguage as setUiLanguage, type LanguageCode } from '../i18n';
import { Card, CardContent, Button, Avatar, Modal } from '../components/ui';
import { CoverImageModal } from '../components/CoverImageModal';
import { IntegrationsSection } from '../components/integrations/IntegrationsSection';
import { ProjectEstimatesSettings } from '../components/settings/ProjectEstimatesSettings';
import { NotificationPreferencesPanel } from '../components/settings/NotificationPreferencesPanel';
import { WebhooksSettings } from '../components/settings/WebhooksSettings';
import { notificationPreferenceService } from '../services/notificationPreferenceService';
import { accountService } from '../services/accountService';
import { UploadImageModal } from '../components/UploadImageModal';
import { ProjectIconModal, ProjectIconDisplay } from '../components/ProjectIconModal';
import { getImageUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { useInterfaceVersion, type InterfaceVersion } from '../contexts/InterfaceContext';
import { mapPathToV1, mapPathToV2 } from '../lib/interfaceRedirect';
import { workspaceService } from '../services/workspaceService';
import { ProjectNetworkSelect } from '../components/ProjectNetworkSelect';
import { projectService } from '../services/projectService';
import { labelService } from '../services/labelService';
import { stateService } from '../services/stateService';
import { userService } from '../services/userService';
import { authService } from '../services/authService';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  LabelApiResponse,
  ProjectApiResponse,
  ProjectInviteApiResponse,
  ProjectMemberApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceInviteApiResponse,
  WorkspaceMemberApiResponse,
  UserActivityItem,
  ApiTokenResponse,
  NotificationPreferencesResponse,
} from '../api/types';
import {
  IconGrid,
  IconPencil,
  IconChevronDown,
  IconChevronUp,
  IconMoreVertical,
  IconSearch,
  IconPlus,
  IconRefresh,
  IconCog,
  IconActivity,
  IconInfo,
  IconEye,
  IconEyeOff,
  IconMessageCircle,
  IconLayers,
  IconFileText,
  IconInbox,
  IconClock,
  IconArchive,
  IconTrash,
  IconLink,
} from '../components/settings/icons';
import {
  type WorkspaceSettingsSection,
  type ProjectSettingsSection,
  type AccountSettingsSection,
} from '../components/settings/sections-config';
import { SettingsNav } from '../components/settings/SettingsNav';
import { WorkspaceApiTokensPanel } from '../components/settings/WorkspaceApiTokensPanel';
import { ExportModal } from '../components/settings/modals/ExportModal';
import { InviteModal } from '../components/settings/modals/InviteModal';
import { ProjectStateModal } from '../components/settings/modals/ProjectStateModal';
import { ProjectLabelModal } from '../components/settings/modals/ProjectLabelModal';
import { formatRelativeTime, getTimezoneOptions } from '../lib/settingsHelpers';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { workspaceSlug, projectId: projectIdFromPath } = useParams<{
    workspaceSlug: string;
    projectId?: string;
  }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, setUserFromApi, logout, refreshUser } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInviteApiResponse[]>([]);
  const [projectInvites, setProjectInvites] = useState<ProjectInviteApiResponse[]>([]);
  const [projectStates, setProjectStates] = useState<StateApiResponse[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberApiResponse[]>([]);
  const [projectLabels, setProjectLabels] = useState<LabelApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(t('settings.documentTitle', 'Settings'));

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
      workspaceService.listMembers(workspaceSlug),
      workspaceService.listInvites(workspaceSlug),
    ])
      .then(([w, list, membersList, invitesList]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProjects(list ?? []);
        setWorkspaceMembers(membersList ?? []);
        setWorkspaceInvites(invitesList ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProjects([]);
          setWorkspaceMembers([]);
          setWorkspaceInvites([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const isAccountTab = location.pathname.includes('/settings/account');
  const isProjectsTab = location.pathname.includes('/settings/projects');
  const section = (searchParams.get('section') as WorkspaceSettingsSection) || 'general';
  const rawAccountSection = searchParams.get('section') as AccountSettingsSection | null;
  const accountSectionsList: AccountSettingsSection[] = [
    'profile',
    'preferences',
    'notifications',
    'security',
    'activity',
    'tokens',
  ];
  const accountSection =
    rawAccountSection && accountSectionsList.includes(rawAccountSection)
      ? rawAccountSection
      : 'profile';
  const projectIdFromQuery = searchParams.get('projectId');
  const projectIdParam = projectIdFromPath ?? projectIdFromQuery;
  const projectSectionParam = searchParams.get('section') as ProjectSettingsSection | null;
  const projectSectionsList: ProjectSettingsSection[] = [
    'general',
    'members',
    'features',
    'notifications',
    'states',
    'labels',
    'estimates',
    'automations',
  ];
  const projectSection =
    projectSectionParam && projectSectionsList.includes(projectSectionParam)
      ? projectSectionParam
      : 'general';
  const selectedProjectId =
    projectIdParam && projects.some((p) => p.id === projectIdParam)
      ? projectIdParam
      : (projects[0]?.id ?? null);
  const selectedProject = selectedProjectId
    ? (projects.find((p) => p.id === selectedProjectId) ?? null)
    : null;

  // Notification preference load/save, one pair per scope. Kept stable so the
  // panel's effect only re-runs when the target scope changes.
  const loadAccountNotifPrefs = useCallback(() => userService.getNotificationPreferences(), []);
  const saveAccountNotifPrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      userService.updateNotificationPreferences(partial),
    [],
  );
  const loadWorkspaceNotifPrefs = useCallback(
    () => notificationPreferenceService.getWorkspace(workspaceSlug ?? ''),
    [workspaceSlug],
  );
  const saveWorkspaceNotifPrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      notificationPreferenceService.updateWorkspace(workspaceSlug ?? '', partial),
    [workspaceSlug],
  );
  const loadProjectNotifPrefs = useCallback(
    () => notificationPreferenceService.getProject(workspaceSlug ?? '', selectedProjectId ?? ''),
    [workspaceSlug, selectedProjectId],
  );
  const saveProjectNotifPrefs = useCallback(
    (partial: Partial<NotificationPreferencesResponse>) =>
      notificationPreferenceService.updateProject(
        workspaceSlug ?? '',
        selectedProjectId ?? '',
        partial,
      ),
    [workspaceSlug, selectedProjectId],
  );
  const pendingInvites = workspaceInvites.filter((i) => !i.accepted);
  const pendingProjectInvites = projectInvites.filter((i) => !i.accepted);

  useEffect(() => {
    if (!workspaceSlug || !selectedProjectId) {
      setProjectMembers([]);
      setProjectLabels([]);
      setProjectInvites([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      projectService.listMembers(workspaceSlug, selectedProjectId),
      labelService.list(workspaceSlug, selectedProjectId),
      projectService.listInvites(workspaceSlug, selectedProjectId),
    ])
      .then(([membersList, labelsList, invitesList]) => {
        if (cancelled) return;
        setProjectMembers(membersList ?? []);
        setProjectLabels(labelsList ?? []);
        setProjectInvites(invitesList ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectMembers([]);
          setProjectLabels([]);
          setProjectInvites([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, selectedProjectId]);

  useEffect(() => {
    if (isProjectsTab && projectSection === 'states' && workspaceSlug && selectedProjectId) {
      let cancelled = false;
      stateService
        .list(workspaceSlug, selectedProjectId)
        .then((list) => {
          if (!cancelled) setProjectStates(list ?? []);
        })
        .catch(() => {
          if (!cancelled) setProjectStates([]);
        });
      return () => {
        cancelled = true;
      };
    }
    setProjectStates([]);
  }, [isProjectsTab, projectSection, workspaceSlug, selectedProjectId]);

  useEffect(() => {
    if (workspace?.name != null) setWorkspaceName(workspace.name);
  }, [workspace?.id, workspace?.name]);

  useEffect(() => {
    if (selectedProject) {
      setProjectName(selectedProject.name);
      setProjectDescription(selectedProject.description ?? '');
      if (selectedProject.timezone != null) setProjectTimezone(selectedProject.timezone);
      // Reflect the project's persisted network visibility (2 = public, 0 = secret).
      setProjectNetwork(selectedProject.network === 0 ? 'private' : 'public');
      setProjectLeadId(selectedProject.project_lead_id ?? null);
      setDefaultAssigneeId(selectedProject.default_assignee_id ?? null);
      setGuestAccess(selectedProject.guest_view_all_features ?? false);
      setFeatureCycles(selectedProject.cycle_view ?? true);
      setFeatureModules(selectedProject.module_view ?? true);
      setFeatureViews(selectedProject.issue_views_view ?? true);
      setFeaturePages(selectedProject.page_view ?? true);
      setFeatureIntake(selectedProject.intake_view ?? false);
      setFeatureTimeTracking(selectedProject.is_time_tracking_enabled ?? false);
      const months = selectedProject.archive_in ?? 0;
      setAutoArchive(months > 0);
      if (months > 0) setAutoArchiveMonths(months);
      const closeMonths = selectedProject.close_in ?? 0;
      setAutoClose(closeMonths > 0);
      if (closeMonths > 0) setAutoCloseMonths(closeMonths);
    }
  }, [
    selectedProject,
    selectedProject?.id,
    selectedProject?.name,
    selectedProject?.description,
    selectedProject?.timezone,
    selectedProject?.project_lead_id,
    selectedProject?.default_assignee_id,
    selectedProject?.guest_view_all_features,
    selectedProject?.network,
    selectedProject?.cycle_view,
    selectedProject?.module_view,
    selectedProject?.issue_views_view,
    selectedProject?.page_view,
    selectedProject?.intake_view,
    selectedProject?.is_time_tracking_enabled,
    selectedProject?.archive_in,
    selectedProject?.close_in,
  ]);

  // Persist the auto-archive automation: archive_in is the number of months (0
  // disables it). Optimistically flips the toggle, then saves.
  const persistAutoArchive = async (enabled: boolean, months: number) => {
    if (!workspaceSlug || !selectedProjectId) return;
    setAutoArchive(enabled);
    setAutoArchiveMonths(months);
    setAutoArchiveSaving(true);
    try {
      const updated = await projectService.update(workspaceSlug, selectedProjectId, {
        archive_in: enabled ? months : 0,
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      // Revert the toggle to the persisted value on failure.
      const persisted = selectedProject?.archive_in ?? 0;
      setAutoArchive(persisted > 0);
      if (persisted > 0) setAutoArchiveMonths(persisted);
    } finally {
      setAutoArchiveSaving(false);
    }
  };

  // Persist the auto-close automation: close_in is the number of months (0
  // disables it). Optimistically flips the toggle, then saves.
  const persistAutoClose = async (enabled: boolean, months: number) => {
    if (!workspaceSlug || !selectedProjectId) return;
    setAutoClose(enabled);
    setAutoCloseMonths(months);
    setAutoCloseSaving(true);
    try {
      const updated = await projectService.update(workspaceSlug, selectedProjectId, {
        close_in: enabled ? months : 0,
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      // Revert the toggle to the persisted value on failure.
      const persisted = selectedProject?.close_in ?? 0;
      setAutoClose(persisted > 0);
      if (persisted > 0) setAutoCloseMonths(persisted);
    } finally {
      setAutoCloseSaving(false);
    }
  };

  const [workspaceName, setWorkspaceName] = useState('');
  const [companySize, setCompanySize] = useState('51-200');
  const [generalUpdateLoading, setGeneralUpdateLoading] = useState(false);
  const [generalUpdateError, setGeneralUpdateError] = useState<string | null>(null);
  const [membersSearch, setMembersSearch] = useState('');
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
  const [exportProjectOpen, setExportProjectOpen] = useState(false);
  const [exportProjectValue, setExportProjectValue] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') ?? '');
  const [displayName, setDisplayName] = useState(user?.name?.split(' ')[0]?.toLowerCase() ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  // Email-change flow: 'idle' (show Change), 'request' (enter new email),
  // 'verify' (enter the emailed code).
  const [emailChangeStep, setEmailChangeStep] = useState<'idle' | 'request' | 'verify'>('idle');
  const [emailChangeNew, setEmailChangeNew] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeBusy, setEmailChangeBusy] = useState(false);

  const apiErrorMessage = (e: unknown, fallback: string): string => {
    if (
      e &&
      typeof e === 'object' &&
      'response' in e &&
      typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
    ) {
      return (e as { response: { data: { error: string } } }).response.data.error;
    }
    return fallback;
  };

  // Bumped whenever the email-change flow is reset/cancelled; in-flight requests
  // captured an earlier value and bail out instead of resurrecting the panel.
  const emailFlowToken = useRef(0);

  const resetEmailChange = () => {
    emailFlowToken.current += 1;
    setEmailChangeStep('idle');
    setEmailChangeNew('');
    setEmailChangeCode('');
    setEmailChangeError(null);
    setEmailChangeBusy(false);
  };

  const requestEmailChange = async () => {
    const token = emailFlowToken.current;
    setEmailChangeError(null);
    setEmailChangeBusy(true);
    try {
      await accountService.requestEmailChange(emailChangeNew.trim());
      if (emailFlowToken.current !== token) return;
      setEmailChangeStep('verify');
    } catch (e: unknown) {
      if (emailFlowToken.current !== token) return;
      setEmailChangeError(
        apiErrorMessage(
          e,
          t('settings.account.emailChange.sendError', 'Failed to send the confirmation code'),
        ),
      );
    } finally {
      if (emailFlowToken.current === token) setEmailChangeBusy(false);
    }
  };

  const verifyEmailChange = async () => {
    const token = emailFlowToken.current;
    setEmailChangeError(null);
    setEmailChangeBusy(true);
    try {
      const updated = await accountService.verifyEmailChange(emailChangeCode.trim());
      if (emailFlowToken.current !== token) return;
      setProfileEmail(updated);
      await refreshUser();
      if (emailFlowToken.current !== token) return;
      resetEmailChange();
    } catch (e: unknown) {
      if (emailFlowToken.current !== token) return;
      setEmailChangeError(
        apiErrorMessage(
          e,
          t('settings.account.emailChange.confirmError', 'Failed to confirm the new email'),
        ),
      );
    } finally {
      if (emailFlowToken.current === token) setEmailChangeBusy(false);
    }
  };

  const deactivateAccount = async () => {
    setDeactivateError(null);
    setDeactivateBusy(true);
    try {
      await accountService.deactivate();
      await logout();
    } catch (e: unknown) {
      setDeactivateError(
        apiErrorMessage(
          e,
          t('settings.account.deactivate.error', 'Failed to deactivate account. Please try again.'),
        ),
      );
      setDeactivateBusy(false);
    }
  };
  const { theme, setTheme } = useTheme();
  const { interfaceVersion, setInterfaceVersion } = useInterfaceVersion();
  const handleInterfaceVersionChange = (value: InterfaceVersion) => {
    setInterfaceVersion(value);
    const target =
      value === 'v2'
        ? mapPathToV2(location.pathname, location.search)
        : mapPathToV1(location.pathname, location.search);
    if (target) navigate(target, { replace: true });
  };
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('monday');
  const [timezone, setTimezone] = useState('UTC');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectNetwork, setProjectNetwork] = useState('public');
  const [projectTimezone, setProjectTimezone] = useState('UTC+04:00 Baku');
  const [projectLeadId, setProjectLeadId] = useState<string | null>(null);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null);
  const [guestAccess, setGuestAccess] = useState(true);
  const [projectMembersSearch, setProjectMembersSearch] = useState('');
  const [projectUpdateLoading, setProjectUpdateLoading] = useState(false);
  const [projectUpdateError, setProjectUpdateError] = useState<string | null>(null);
  const [archivingProject, setArchivingProject] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<'workspace' | 'project' | null>(null);
  const [projectLabelModalOpen, setProjectLabelModalOpen] = useState(false);
  const [projectLabelEdit, setProjectLabelEdit] = useState<LabelApiResponse | null>(null);
  const [projectLabelName, setProjectLabelName] = useState('');
  const [projectLabelColor, setProjectLabelColor] = useState('#6366f1');
  const [projectStateModalOpen, setProjectStateModalOpen] = useState(false);
  const [projectStateEdit, setProjectStateEdit] = useState<StateApiResponse | null>(null);
  const [projectStateName, setProjectStateName] = useState('');
  const [projectStateColor, setProjectStateColor] = useState('#94a3b8');
  const [projectStateGroup, setProjectStateGroup] = useState('backlog');

  const refreshProjectStates = useCallback(async () => {
    if (!workspaceSlug || !selectedProjectId) return;
    const list = await stateService.list(workspaceSlug, selectedProjectId);
    setProjectStates(list ?? []);
  }, [workspaceSlug, selectedProjectId]);

  const setStateAsDefault = useCallback(
    async (st: StateApiResponse) => {
      if (!workspaceSlug || !selectedProjectId) return;
      try {
        await stateService.update(workspaceSlug, selectedProjectId, st.id, { default: true });
        await refreshProjectStates();
      } catch {
        // ignore; the list stays as-is on failure
      }
    },
    [workspaceSlug, selectedProjectId, refreshProjectStates],
  );

  // Move a state up or down within its own group by reassigning sequences for
  // that group, so the order is well-defined even when states share the default
  // sequence value.
  const moveStateWithinGroup = useCallback(
    async (st: StateApiResponse, direction: -1 | 1) => {
      if (!workspaceSlug || !selectedProjectId) return;
      const groupKey = (st.group ?? 'backlog').toLowerCase();
      const inGroup = projectStates
        .filter((s) => (s.group ?? 'backlog').toLowerCase() === groupKey)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      const from = inGroup.findIndex((s) => s.id === st.id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= inGroup.length) return;
      const reordered = [...inGroup];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
      try {
        // One atomic backend call so a partial failure can't leave the group's
        // order half-applied.
        await stateService.reorder(
          workspaceSlug,
          selectedProjectId,
          reordered.map((s, i) => ({ id: s.id, sequence: i })),
        );
        await refreshProjectStates();
      } catch {
        // ignore; the list stays as-is on failure
      }
    },
    [workspaceSlug, selectedProjectId, projectStates, refreshProjectStates],
  );

  const [featureCycles, setFeatureCycles] = useState(true);
  const [featureModules, setFeatureModules] = useState(true);
  const [featureViews, setFeatureViews] = useState(true);
  const [featurePages, setFeaturePages] = useState(true);
  const [featureIntake, setFeatureIntake] = useState(false);
  const [featureTimeTracking, setFeatureTimeTracking] = useState(false);
  const [autoArchive, setAutoArchive] = useState(false);
  const [autoArchiveMonths, setAutoArchiveMonths] = useState(3);
  const [autoArchiveSaving, setAutoArchiveSaving] = useState(false);
  const [autoClose, setAutoClose] = useState(false);
  const [autoCloseMonths, setAutoCloseMonths] = useState(3);
  const [autoCloseSaving, setAutoCloseSaving] = useState(false);
  const [pendingInvitesExpanded, setPendingInvitesExpanded] = useState(true);
  const [pendingInviteMenuId, setPendingInviteMenuId] = useState<string | null>(null);
  const pendingInviteMenuRef = useRef<HTMLDivElement>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRows, setInviteRows] = useState<
    { id: number; email: string; role: 'member' | 'admin' }[]
  >([{ id: 0, email: '', role: 'member' }]);
  const [inviting, setInviting] = useState(false);

  const submitInviteModal = useCallback(async () => {
    if (!workspaceSlug || inviting) return;
    const rows = inviteRows
      .map((r) => ({ email: r.email.trim(), role: r.role }))
      .filter((r) => r.email.length > 0);
    if (rows.length === 0) {
      setInviteModalOpen(false);
      setInviteTarget(null);
      setInviteRows([{ id: 0, email: '', role: 'member' }]);
      return;
    }
    setInviting(true);
    try {
      const roleNum = (r: { role: 'member' | 'admin' }) => (r.role === 'admin' ? 20 : 10);
      if (inviteTarget === 'project' && selectedProjectId) {
        await Promise.all(
          rows.map((r) =>
            projectService.createInvite(workspaceSlug, selectedProjectId, {
              email: r.email,
              role: roleNum(r),
            }),
          ),
        );
        const refreshed = await projectService.listInvites(workspaceSlug, selectedProjectId);
        setProjectInvites(refreshed ?? []);
      } else {
        await Promise.all(
          rows.map((r) =>
            workspaceService.createInvite(workspaceSlug, {
              email: r.email,
              role: roleNum(r),
            }),
          ),
        );
        const refreshed = await workspaceService.listInvites(workspaceSlug);
        setWorkspaceInvites(refreshed ?? []);
      }
      setInviteModalOpen(false);
      setInviteTarget(null);
      setInviteRows([{ id: 0, email: '', role: 'member' }]);
    } finally {
      setInviting(false);
    }
  }, [workspaceSlug, inviting, inviteRows, inviteTarget, selectedProjectId]);

  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [preferencesSaveLoading, setPreferencesSaveLoading] = useState(false);
  const [timezoneDropdownOpen, setTimezoneDropdownOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const timezoneDropdownRef = useRef<HTMLDivElement>(null);
  const [projectTimezoneDropdownOpen, setProjectTimezoneDropdownOpen] = useState(false);
  const [projectTimezoneSearch, setProjectTimezoneSearch] = useState('');
  const projectTimezoneDropdownRef = useRef<HTMLDivElement>(null);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [activityList, setActivityList] = useState<UserActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [tokensList, setTokensList] = useState<ApiTokenResponse[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [createTokenModalOpen, setCreateTokenModalOpen] = useState(false);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);
  const [tokenForm, setTokenForm] = useState({
    label: '',
    description: '',
    expiresIn: '' as string,
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [accountCoverModalOpen, setAccountCoverModalOpen] = useState(false);
  const [accountAvatarModalOpen, setAccountAvatarModalOpen] = useState(false);
  const [projectCoverModalOpen, setProjectCoverModalOpen] = useState(false);
  const [projectIconModalOpen, setProjectIconModalOpen] = useState(false);
  const [workspaceLogoModalOpen, setWorkspaceLogoModalOpen] = useState(false);
  const navigate = useNavigate();

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const filteredTimezoneOptions = useMemo(() => {
    if (!timezoneSearch.trim()) return timezoneOptions;
    const q = timezoneSearch.toLowerCase();
    return timezoneOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [timezoneOptions, timezoneSearch]);
  const filteredProjectTimezoneOptions = useMemo(() => {
    if (!projectTimezoneSearch.trim()) return timezoneOptions;
    const q = projectTimezoneSearch.toLowerCase();
    return timezoneOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [timezoneOptions, projectTimezoneSearch]);

  useEffect(() => {
    if (!isAccountTab || !user) return;
    let cancelled = false;
    authService.getMe().then((api) => {
      if (cancelled || !api) return;
      setFirstName(api.first_name ?? user?.name?.split(' ')[0] ?? '');
      setLastName(api.last_name ?? '');
      setDisplayName(api.display_name ?? '');
      setProfileEmail(api.email ?? '');
      const tz = (api as { user_timezone?: string }).user_timezone;
      if (tz) setTimezone(tz);
    });
    return () => {
      cancelled = true;
    };
  }, [isAccountTab, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- user for prefetch; kept for future use

  useEffect(() => {
    if (!isAccountTab || accountSection !== 'activity') return;
    let cancelled = false;
    setActivityLoading(true);
    userService
      .getActivity()
      .then((r) => {
        if (!cancelled) {
          setActivityList(r.activities ?? []);
          setActivityLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAccountTab, accountSection]);

  useEffect(() => {
    if (!isAccountTab || accountSection !== 'tokens') return;
    let cancelled = false;
    setTokensLoading(true);
    userService
      .listTokens()
      .then((r) => {
        if (!cancelled) {
          setTokensList(r.tokens ?? []);
          setTokensLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setTokensLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAccountTab, accountSection]);

  useEffect(() => {
    if (!timezoneDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (timezoneDropdownRef.current && !timezoneDropdownRef.current.contains(e.target as Node)) {
        setTimezoneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [timezoneDropdownOpen]);

  useEffect(() => {
    if (!projectTimezoneDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (
        projectTimezoneDropdownRef.current &&
        !projectTimezoneDropdownRef.current.contains(e.target as Node)
      ) {
        setProjectTimezoneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [projectTimezoneDropdownOpen]);

  useEffect(() => {
    if (!pendingInviteMenuId) return;
    const close = (e: MouseEvent) => {
      if (
        pendingInviteMenuRef.current &&
        !pendingInviteMenuRef.current.contains(e.target as Node)
      ) {
        setPendingInviteMenuId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pendingInviteMenuId]);

  useEffect(() => {
    if (isProjectsTab && workspace && projects.length > 0 && !projectIdParam) {
      navigate(`/${workspace.slug}/settings/projects/${projects[0].id}`, {
        replace: true,
      });
    }
  }, [isProjectsTab, workspace, projects.length, projectIdParam, navigate]); // eslint-disable-line react-hooks/exhaustive-deps -- projects for redirect; kept for future use

  const filteredMembers = membersSearch.trim()
    ? workspaceMembers.filter((m) => {
        const term = membersSearch.toLowerCase();
        const idMatch = m.member_id.toLowerCase().includes(term);
        const nameMatch = (m.member_display_name ?? '').toLowerCase().includes(term);
        const emailUser = (m.member_email ?? '').split('@')[0]?.toLowerCase() ?? '';
        const emailMatch = emailUser.includes(term);
        return idMatch || nameMatch || emailMatch;
      })
    : workspaceMembers;
  const filteredProjectMembers = projectMembersSearch.trim()
    ? projectMembers.filter((m) =>
        (() => {
          const term = projectMembersSearch.toLowerCase();
          const memberId = (m.member_id ?? '').toLowerCase();
          const wm = workspaceMembers.find((wm) => wm.member_id === m.member_id);
          const name = (wm?.member_display_name ?? '').toLowerCase();
          const emailUser = (wm?.member_email ?? '').split('@')[0]?.toLowerCase() ?? '';
          return memberId.includes(term) || name.includes(term) || emailUser.includes(term);
        })(),
      )
    : projectMembers;
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="px-(--padding-page) py-8 text-(--txt-secondary)">
        {t('settings.workspaceNotFound', 'Workspace not found.')}
      </div>
    );
  }

  const workspaceDisplayName = workspaceName || workspace.name;
  const workspaceUrl = `devlane.example.com/${workspace.slug}`;
  const roleLabel = (role: number) => (role >= 20 ? 'admin' : 'member');
  const memberLabel = (memberId: string | null | undefined) => {
    if (!memberId) return '—';
    const m = workspaceMembers.find((wm) => wm.member_id === memberId);
    const display = m?.member_display_name?.trim();
    if (display) return display;
    const emailUser = m?.member_email?.split('@')[0]?.trim();
    if (emailUser) return emailUser;
    return t('settings.members.fallbackName', 'Member');
  };

  const setSection = (s: WorkspaceSettingsSection) => {
    setSearchParams({ section: s });
  };
  const setAccountSection = (s: AccountSettingsSection) => {
    setSearchParams({ section: s });
  };
  const setProjectSection = (projectId: string, s: ProjectSettingsSection) => {
    if (projectIdFromPath) {
      setSearchParams({ section: s });
    } else {
      setSearchParams({ projectId, section: s });
    }
  };
  const setProjectId = (projectId: string) => {
    navigate(`/${workspace.slug}/settings/projects/${projectId}`);
    setSearchParams({ section: 'general' });
  };
  const baseSettingsUrl = `/${workspace.slug}/settings`;
  const accountSettingsUrl = `/${workspace.slug}/settings/account`;
  const projectsSettingsUrl = `/${workspace.slug}/settings/projects${projects.length ? `/${projects[0].id}` : ''}`;

  return (
    <div className="min-h-0 flex-1 px-(--padding-page) pb-8">
      {/* Main tabs: Account | Workspace | Projects */}
      <div className="flex gap-1 border-b border-(--border-subtle)">
        <Link
          to={accountSettingsUrl}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
            isAccountTab
              ? 'border-(--brand-default) text-(--txt-primary)'
              : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
          }`}
        >
          {t('settings.tabs.account', 'Account')}
        </Link>
        <Link
          to={baseSettingsUrl}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
            !isAccountTab && !isProjectsTab
              ? 'border-(--brand-default) text-(--txt-primary)'
              : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
          }`}
        >
          {t('settings.tabs.workspace', 'Workspace')}
        </Link>
        <Link
          to={projectsSettingsUrl}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
            isProjectsTab
              ? 'border-(--brand-default) text-(--txt-primary)'
              : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
          }`}
        >
          {t('settings.tabs.projects', 'Projects')}
        </Link>
      </div>

      {/* Layout: sidebar + main */}
      <div className="mt-6 flex gap-8">
        {/* Sidebar */}
        <SettingsNav
          isAccountTab={isAccountTab}
          isProjectsTab={isProjectsTab}
          user={user}
          displayName={displayName}
          accountSection={accountSection}
          setAccountSection={setAccountSection}
          workspace={workspace}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setProjectId={setProjectId}
          projectSection={projectSection}
          setProjectSection={setProjectSection}
          section={section}
          setSection={setSection}
        />

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {isAccountTab && accountSection === 'profile' && (
            <div className="space-y-6">
              <div className="relative h-48 rounded-(--radius-md)">
                {/* Cover background (clipped to rounded corners; no overflow on outer so avatar can overlap) */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-(--radius-md) bg-(--bg-layer-2)"
                  style={
                    getImageUrl(user?.coverImageUrl)
                      ? {
                          backgroundImage: `url(${getImageUrl(user?.coverImageUrl)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined
                  }
                >
                  {!getImageUrl(user?.coverImageUrl) && (
                    <div className="absolute inset-0 bg-gradient-to-br from-(--neutral-800) to-(--neutral-1000)" />
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 z-10 gap-1.5 text-[13px]"
                  onClick={() => setAccountCoverModalOpen(true)}
                >
                  {t('settings.cover.change', 'Change cover')}
                </Button>
                <div className="absolute bottom-0 left-4 -mb-8 z-10">
                  <button
                    type="button"
                    onClick={() => setAccountAvatarModalOpen(true)}
                    className="block h-24 w-20 overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-(--brand-default)"
                    aria-label={t(
                      'settings.account.changeProfilePicture',
                      'Change profile picture',
                    )}
                  >
                    {getImageUrl(user?.avatarUrl) ? (
                      <img
                        src={getImageUrl(user?.avatarUrl)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-(--bg-accent-primary) text-sm font-medium text-(--txt-on-color)">
                        {(user?.name ?? '')
                          .split(/\s+/)
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || '?'}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="pt-10">
                <h2 className="text-lg font-semibold text-(--txt-primary)">
                  {firstName} {lastName}
                </h2>
                <p className="text-sm text-(--txt-tertiary)">{user?.email}</p>
              </div>
              <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.account.firstName', 'First name')}{' '}
                    <span className="text-(--txt-danger-primary)">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.account.lastName', 'Last name')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.account.displayName', 'Display name')}{' '}
                    <span className="text-(--txt-danger-primary)">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.account.email', 'Email')}{' '}
                    <span className="text-(--txt-danger-primary)">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={profileEmail}
                      readOnly
                      disabled
                      className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 text-sm text-(--txt-tertiary) cursor-not-allowed"
                    />
                    {emailChangeStep === 'idle' && (
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => {
                          setEmailChangeError(null);
                          setEmailChangeNew('');
                          setEmailChangeStep('request');
                        }}
                      >
                        {t('common.change', 'Change')}
                      </Button>
                    )}
                  </div>
                  {emailChangeStep === 'request' && (
                    <div className="mt-2 space-y-2 rounded-(--radius-md) border border-(--border-subtle) p-3">
                      <p className="text-sm text-(--txt-secondary)">
                        {t(
                          'settings.account.emailChange.requestPrompt',
                          "Enter your new email. We'll send a confirmation code to it.",
                        )}
                      </p>
                      <input
                        type="email"
                        value={emailChangeNew}
                        onChange={(e) => setEmailChangeNew(e.target.value)}
                        placeholder={t(
                          'settings.account.emailChange.newEmailPlaceholder',
                          'new@email.com',
                        )}
                        className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={emailChangeBusy || !emailChangeNew.trim()}
                          onClick={requestEmailChange}
                        >
                          {emailChangeBusy
                            ? t('settings.account.emailChange.sending', 'Sending…')
                            : t('settings.account.emailChange.sendCode', 'Send code')}
                        </Button>
                        <Button variant="secondary" onClick={resetEmailChange}>
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {emailChangeStep === 'verify' && (
                    <div className="mt-2 space-y-2 rounded-(--radius-md) border border-(--border-subtle) p-3">
                      <p className="text-sm text-(--txt-secondary)">
                        <Trans
                          i18nKey="settings.account.emailChange.verifyPrompt"
                          defaults="Enter the code we sent to <b>{{email}}</b>."
                          values={{ email: emailChangeNew.trim() }}
                          components={{ b: <span className="text-(--txt-primary)" /> }}
                        />
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={emailChangeCode}
                        onChange={(e) => setEmailChangeCode(e.target.value)}
                        placeholder={t(
                          'settings.account.emailChange.codePlaceholder',
                          '6-digit code',
                        )}
                        className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={emailChangeBusy || !emailChangeCode.trim()}
                          onClick={verifyEmailChange}
                        >
                          {emailChangeBusy
                            ? t('settings.account.emailChange.confirming', 'Confirming…')
                            : t('settings.account.emailChange.confirmEmail', 'Confirm email')}
                        </Button>
                        <Button variant="secondary" onClick={resetEmailChange}>
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {emailChangeError && (
                    <p className="mt-1 text-sm text-(--txt-danger-primary)">{emailChangeError}</p>
                  )}
                </div>
              </div>
              {profileError && (
                <p className="text-sm text-(--txt-danger-primary)">{profileError}</p>
              )}
              <Button
                disabled={profileSaveLoading}
                onClick={async () => {
                  setProfileError(null);
                  setProfileSaveLoading(true);
                  try {
                    const api = await userService.updateMe({
                      first_name: firstName,
                      last_name: lastName,
                      display_name: displayName,
                    });
                    setUserFromApi(api);
                  } catch (e: unknown) {
                    setProfileError(
                      e &&
                        typeof e === 'object' &&
                        'response' in e &&
                        typeof (e as { response?: { data?: { error?: string } } }).response?.data
                          ?.error === 'string'
                        ? (e as { response: { data: { error: string } } }).response.data.error
                        : t('settings.account.profileSaveError', 'Failed to save profile'),
                    );
                  } finally {
                    setProfileSaveLoading(false);
                  }
                }}
              >
                {profileSaveLoading
                  ? t('common.saving', 'Saving…')
                  : t('settings.account.saveChanges', 'Save changes')}
              </Button>
              <Card variant="outlined" className="border-(--border-subtle)">
                <button
                  type="button"
                  onClick={() => setDeactivateOpen(!deactivateOpen)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-(--txt-danger-primary)">
                    {t('settings.account.deactivate.title', 'Deactivate account')}
                  </span>
                  <span
                    className={`text-(--txt-icon-tertiary) transition-transform ${deactivateOpen ? 'rotate-180' : ''}`}
                  >
                    <IconChevronDown />
                  </span>
                </button>
                {deactivateOpen && (
                  <CardContent className="border-t border-(--border-subtle) pt-3">
                    <p className="text-sm text-(--txt-secondary)">
                      {t(
                        'settings.account.deactivate.description',
                        'This deactivates your account and signs you out everywhere. Reactivating it requires an administrator.',
                      )}
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-3 text-(--txt-danger-primary)"
                      disabled={deactivateBusy}
                      onClick={() => setDeactivateConfirmOpen(true)}
                    >
                      {deactivateBusy
                        ? t('settings.account.deactivate.busy', 'Deactivating…')
                        : t('settings.account.deactivate.title', 'Deactivate account')}
                    </Button>
                  </CardContent>
                )}
              </Card>
              <Modal
                open={deactivateConfirmOpen}
                onClose={() => {
                  if (deactivateBusy) return;
                  setDeactivateError(null);
                  setDeactivateConfirmOpen(false);
                }}
                title={t('settings.account.deactivate.confirmTitle', 'Deactivate account?')}
              >
                <div className="space-y-4">
                  <p className="text-sm text-(--txt-secondary)">
                    {t(
                      'settings.account.deactivate.confirmBody',
                      "You'll be signed out everywhere and won't be able to sign back in. Reactivating your account requires an administrator.",
                    )}
                  </p>
                  {deactivateError && (
                    <p className="text-sm text-(--txt-danger-primary)">{deactivateError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={deactivateBusy}
                      onClick={() => {
                        setDeactivateError(null);
                        setDeactivateConfirmOpen(false);
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      className="text-(--txt-danger-primary)"
                      disabled={deactivateBusy}
                      onClick={() => void deactivateAccount()}
                    >
                      {deactivateBusy
                        ? t('settings.account.deactivate.busy', 'Deactivating…')
                        : t('settings.account.deactivate.confirm', 'Deactivate')}
                    </Button>
                  </div>
                </div>
              </Modal>
              <CoverImageModal
                open={accountCoverModalOpen}
                onClose={() => setAccountCoverModalOpen(false)}
                onSelect={async (url) => {
                  try {
                    const api = await userService.updateMe({
                      cover_image: url,
                    });
                    setUserFromApi(api);
                  } catch {
                    // error could be shown in modal or toast
                  }
                }}
                title={t('settings.account.selectCoverImage', 'Select cover image')}
              />
              <UploadImageModal
                open={accountAvatarModalOpen}
                onClose={() => setAccountAvatarModalOpen(false)}
                onSave={async (url) => {
                  try {
                    const api = await userService.updateMe({ avatar: url });
                    setUserFromApi(api);
                  } catch {
                    // error shown in modal
                  }
                }}
                title={t('settings.account.uploadProfilePicture', 'Upload profile picture')}
              />
            </div>
          )}

          {isAccountTab && accountSection === 'preferences' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-(--txt-primary)">
                  {t('settings.preferences.title', 'Preferences')}
                </h2>
                <p className="mt-0.5 text-sm text-(--txt-secondary)">
                  {t(
                    'settings.preferences.subtitle',
                    'Customize your app experience the way you work',
                  )}
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-(--txt-primary)">
                    {t('settings.preferences.theme.title', 'Theme')}
                  </label>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.preferences.theme.help',
                      'Select or customize your interface color scheme.',
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {(
                      [
                        {
                          value: 'light' as ThemePreference,
                          label: t('settings.preferences.theme.light', 'Light'),
                          bg: '#f4f5f7',
                          surface: '#ffffff',
                          brand: '#4b72c4',
                          row1: '#1a1a2e',
                        },
                        {
                          value: 'dark' as ThemePreference,
                          label: t('settings.preferences.theme.dark', 'Dark'),
                          bg: '#1f2227',
                          surface: '#27292e',
                          brand: '#5e8de8',
                          row1: '#e8e8f2',
                        },
                        {
                          value: 'pink' as ThemePreference,
                          label: t('settings.preferences.theme.pink', 'Pink'),
                          bg: '#fce8ef',
                          surface: '#fff5f8',
                          brand: '#c4336a',
                          row1: '#2a1820',
                        },
                        {
                          value: 'system' as ThemePreference,
                          label: t('settings.preferences.theme.system', 'System'),
                          bg: 'linear-gradient(135deg,#1f2227 50%,#f4f5f7 50%)',
                          surface: null,
                          brand: null,
                          row1: null,
                        },
                      ] as const
                    ).map(({ value, label, bg, surface, brand, row1 }) => {
                      const selected = theme === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTheme(value)}
                          aria-pressed={selected}
                          className={[
                            'relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-default)',
                            selected
                              ? 'border-(--brand-default) shadow-sm'
                              : 'border-(--border-subtle) hover:border-(--border-strong-1)',
                          ].join(' ')}
                          style={{ width: '4.75rem' }}
                        >
                          {/* Mini UI preview card */}
                          <div
                            className="h-12 w-full overflow-hidden rounded"
                            style={{ background: bg }}
                          >
                            {surface && brand && row1 ? (
                              <div className="flex h-full flex-col gap-1 p-1.5">
                                {/* Simulated header bar */}
                                <div
                                  className="h-1.5 w-3/4 rounded-full"
                                  style={{ background: brand, opacity: 0.75 }}
                                />
                                {/* Simulated content rows */}
                                <div
                                  className="mt-0.5 flex flex-col gap-1"
                                  style={{
                                    background: surface,
                                    borderRadius: 3,
                                    padding: '3px 4px',
                                  }}
                                >
                                  <div
                                    className="h-1 w-full rounded-full"
                                    style={{ background: row1, opacity: 0.18 }}
                                  />
                                  <div
                                    className="h-1 w-4/5 rounded-full"
                                    style={{ background: row1, opacity: 0.12 }}
                                  />
                                  <div
                                    className="h-1 w-3/5 rounded-full"
                                    style={{ background: row1, opacity: 0.1 }}
                                  />
                                </div>
                              </div>
                            ) : (
                              /* System: split dark/light preview */
                              <div className="flex h-full">
                                <div className="flex h-full w-1/2 flex-col gap-1 p-1.5">
                                  <div className="h-1.5 w-3/4 rounded-full bg-[#5e8de8] opacity-75" />
                                  <div className="h-1 w-full rounded-full bg-[#e8e8f2] opacity-20" />
                                  <div className="h-1 w-4/5 rounded-full bg-[#e8e8f2] opacity-15" />
                                </div>
                                <div className="flex h-full w-1/2 flex-col gap-1 p-1.5">
                                  <div className="h-1.5 w-3/4 rounded-full bg-[#4b72c4] opacity-75" />
                                  <div className="h-1 w-full rounded-full bg-[#1a1a2e] opacity-20" />
                                  <div className="h-1 w-4/5 rounded-full bg-[#1a1a2e] opacity-15" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Selected checkmark badge */}
                          {selected && (
                            <span
                              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ background: 'var(--brand-default)' }}
                              aria-hidden
                            >
                              ✓
                            </span>
                          )}

                          <span className="text-[11px] font-medium text-(--txt-secondary)">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--txt-primary)">
                    {t('settings.preferences.interfaceVersion.title', 'Interface')}
                  </label>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.preferences.interfaceVersion.help',
                      'Choose which Devlane interface you want to use. Some admin-only pages still open in the classic interface either way.',
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ['v1', t('settings.preferences.interfaceVersion.v1', 'Classic')],
                        ['v2', t('settings.preferences.interfaceVersion.v2', 'New (Beta)')],
                      ] as [InterfaceVersion, string][]
                    ).map(([value, label]) => {
                      const selected = interfaceVersion === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleInterfaceVersionChange(value)}
                          aria-pressed={selected}
                          className={[
                            'rounded-(--radius-md) border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-default)',
                            selected
                              ? 'border-(--brand-default) bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                              : 'border-(--border-subtle) text-(--txt-secondary) hover:border-(--border-strong-1)',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--txt-primary)">
                    {t('settings.preferences.firstDayOfWeek.title', 'First day of the week')}
                  </label>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.preferences.firstDayOfWeek.help',
                      'This will change how all calendars in your app look.',
                    )}
                  </p>
                  <div className="relative mt-2 max-w-xs">
                    <select
                      value={firstDayOfWeek}
                      onChange={(e) => setFirstDayOfWeek(e.target.value)}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      <option value="sunday">
                        {t('settings.preferences.firstDayOfWeek.sunday', 'Sunday')}
                      </option>
                      <option value="monday">
                        {t('settings.preferences.firstDayOfWeek.monday', 'Monday')}
                      </option>
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--txt-primary)">
                  {t('settings.preferences.languageAndTime', 'Language & Time')}
                </h3>
                <div className="mt-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-(--txt-primary)">
                      {t('settings.preferences.timezone.title', 'Timezone')}
                    </label>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t('settings.preferences.timezone.help', 'Current timezone setting.')}
                    </p>
                    <div className="relative mt-2 max-w-xs" ref={timezoneDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setTimezoneDropdownOpen((o) => !o)}
                        className="flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                      >
                        <span className="truncate">
                          {timezoneOptions.find((o) => o.value === timezone)?.label ?? timezone}
                        </span>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                          <IconChevronDown />
                        </span>
                      </button>
                      {timezoneDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) shadow-lg">
                          <div className="border-b border-(--border-subtle) p-2">
                            <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
                              <IconSearch />
                              <input
                                type="text"
                                value={timezoneSearch}
                                onChange={(e) => setTimezoneSearch(e.target.value)}
                                placeholder={t('common.search', 'Search')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder)"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1">
                            {filteredTimezoneOptions.map((o) => (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() => {
                                  setTimezone(o.value);
                                  setTimezoneDropdownOpen(false);
                                  setTimezoneSearch('');
                                }}
                                className={`w-full rounded-(--radius-md) px-2 py-1.5 text-left text-sm ${o.value === timezone ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)' : 'text-(--txt-primary) hover:bg-(--bg-layer-transparent-hover)'}`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--txt-primary)">
                      {t('settings.preferences.language.title', 'Language')}
                    </label>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.preferences.language.help',
                        'Choose the language used in the user interface.',
                      )}
                    </p>
                    <div className="relative mt-2 max-w-xs">
                      <select
                        value={i18n.resolvedLanguage ?? i18n.language}
                        onChange={(e) => setUiLanguage(e.target.value as LanguageCode)}
                        className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                      >
                        {SUPPORTED_LANGUAGES.map((lng) => (
                          <option key={lng.code} value={lng.code}>
                            {lng.label}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                        <IconChevronDown />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                disabled={preferencesSaveLoading}
                onClick={async () => {
                  setPreferencesSaveLoading(true);
                  try {
                    await userService.updateMe({ user_timezone: timezone });
                  } finally {
                    setPreferencesSaveLoading(false);
                  }
                }}
              >
                {preferencesSaveLoading
                  ? t('common.saving', 'Saving…')
                  : t('settings.preferences.save', 'Save preferences')}
              </Button>
            </div>
          )}

          {isAccountTab && accountSection === 'notifications' && (
            <NotificationPreferencesPanel
              load={loadAccountNotifPrefs}
              save={saveAccountNotifPrefs}
              title={t('settings.notifications.account.title', 'Notifications')}
              description={t(
                'settings.notifications.account.description',
                'Your default notifications across every workspace. Workspaces and projects can override these.',
              )}
            />
          )}

          {isAccountTab && accountSection === 'security' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-(--txt-primary)">
                {t('settings.security.changePassword', 'Change password')}
              </h2>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.security.currentPassword', 'Current password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('settings.security.oldPasswordPlaceholder', 'Old password')}
                      className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-9 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                      aria-label={
                        showCurrentPass
                          ? t('settings.security.hidePassword', 'Hide password')
                          : t('settings.security.showPassword', 'Show password')
                      }
                    >
                      {showCurrentPass ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.security.newPassword', 'New password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t(
                        'settings.security.newPasswordPlaceholder',
                        'Enter new password',
                      )}
                      className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-9 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                      aria-label={
                        showNewPass
                          ? t('settings.security.hidePassword', 'Hide password')
                          : t('settings.security.showPassword', 'Show password')
                      }
                    >
                      {showNewPass ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.security.confirmPassword', 'Confirm password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t(
                        'settings.security.confirmPasswordPlaceholder',
                        'Confirm password',
                      )}
                      className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-9 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                      aria-label={
                        showConfirmPass
                          ? t('settings.security.hidePassword', 'Hide password')
                          : t('settings.security.showPassword', 'Show password')
                      }
                    >
                      {showConfirmPass ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
              </div>
              {changePasswordError && (
                <p className="text-sm text-(--txt-danger-primary)">{changePasswordError}</p>
              )}
              <Button
                disabled={
                  changePasswordLoading ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                onClick={async () => {
                  setChangePasswordError(null);
                  if (newPassword.length < 8) {
                    setChangePasswordError(
                      t(
                        'settings.security.passwordTooShort',
                        'New password must be at least 8 characters',
                      ),
                    );
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setChangePasswordError(
                      t(
                        'settings.security.passwordMismatch',
                        'New password and confirmation do not match',
                      ),
                    );
                    return;
                  }
                  setChangePasswordLoading(true);
                  try {
                    await userService.changePassword({
                      current_password: currentPassword,
                      new_password: newPassword,
                    });
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  } catch (e: unknown) {
                    const msg =
                      e &&
                      typeof e === 'object' &&
                      'response' in e &&
                      typeof (e as { response?: { data?: { error?: string } } }).response?.data
                        ?.error === 'string'
                        ? (e as { response: { data: { error: string } } }).response.data.error
                        : t('settings.security.changeError', 'Failed to change password');
                    setChangePasswordError(msg);
                  } finally {
                    setChangePasswordLoading(false);
                  }
                }}
              >
                {changePasswordLoading
                  ? t('settings.security.changing', 'Changing…')
                  : t('settings.security.changePassword', 'Change password')}
              </Button>
            </div>
          )}

          {isAccountTab && accountSection === 'activity' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-(--txt-primary)">
                  {t('settings.activity.title', 'Activity')}
                </h2>
                <p className="mt-0.5 text-sm text-(--txt-secondary)">
                  {t(
                    'settings.activity.subtitle',
                    'Track your recent actions and changes across all projects and work items.',
                  )}
                </p>
              </div>
              {activityLoading ? (
                <div className="py-10 text-center text-sm text-(--txt-tertiary)">
                  {t('settings.activity.loading', 'Loading activity…')}
                </div>
              ) : activityList.length === 0 ? (
                <Card variant="outlined">
                  <CardContent className="py-10 text-center">
                    <p className="text-sm text-(--txt-tertiary)">
                      {t('settings.activity.empty', 'No activity yet.')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-4">
                  {activityList.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-3 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
                        {a.type === 'comment' ? <IconMessageCircle /> : <IconActivity />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-(--txt-secondary)">
                          {t('settings.activity.youCommented', 'You commented {{time}}', {
                            time: formatRelativeTime(a.created_at),
                          })}
                        </p>
                        {a.description && (
                          <p className="mt-1 text-sm font-medium text-(--txt-primary)">
                            {a.description}
                          </p>
                        )}
                        {a.issue_id && a.issue_name && workspaceSlug && (
                          <Link
                            to={`/${workspaceSlug}/projects/${a.project_id}/issues/${a.issue_id}`}
                            className="mt-1 inline-block text-sm text-(--txt-accent-primary) hover:underline"
                          >
                            {a.issue_name}
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAccountTab && accountSection === 'tokens' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-(--txt-primary)">
                    {t('settings.tokens.title', 'Personal Access Tokens')}
                  </h2>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.tokens.subtitle',
                      'Generate secure API tokens to integrate your data with external systems and applications.',
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setCreateTokenModalOpen(true);
                    setCreatedTokenValue(null);
                    setTokenForm({ label: '', description: '', expiresIn: '' });
                  }}
                >
                  <IconPlus />
                  {t('settings.tokens.add', 'Add personal access token')}
                </Button>
              </div>
              {tokensLoading ? (
                <div className="py-10 text-center text-sm text-(--txt-tertiary)">
                  {t('settings.tokens.loading', 'Loading tokens…')}
                </div>
              ) : tokensList.length === 0 ? (
                <Card variant="outlined">
                  <CardContent className="py-10 text-center">
                    <p className="text-sm text-(--txt-tertiary)">
                      {t('settings.tokens.empty', 'No tokens yet.')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {tokensList.map((tok) => (
                    <div
                      key={tok.id}
                      className="flex items-center justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-(--txt-primary)">{tok.label}</p>
                        {tok.description && (
                          <p className="text-xs text-(--txt-tertiary)">{tok.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-(--txt-placeholder)">
                          {t('settings.tokens.created', 'Created {{time}}', {
                            time: formatRelativeTime(tok.created_at),
                          })}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-(--txt-danger-primary)"
                        disabled={revokingId === tok.id}
                        onClick={async () => {
                          setRevokingId(tok.id);
                          try {
                            await userService.revokeToken(tok.id);
                            setTokensList((prev) => prev.filter((x) => x.id !== tok.id));
                          } finally {
                            setRevokingId(null);
                          }
                        }}
                      >
                        {revokingId === tok.id
                          ? t('settings.tokens.revoking', 'Revoking…')
                          : t('settings.tokens.revoke', 'Revoke')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Modal
                open={createTokenModalOpen}
                onClose={() => {
                  setCreateTokenModalOpen(false);
                  setCreatedTokenValue(null);
                }}
                title={
                  createdTokenValue
                    ? t('settings.tokens.createdTitle', 'Token created')
                    : t('settings.tokens.createTitle', 'Create token')
                }
              >
                {createdTokenValue ? (
                  <div className="space-y-4">
                    <p className="text-sm text-(--txt-secondary)">
                      {t(
                        'settings.tokens.copyWarning',
                        'Copy this token now; it will not be shown again.',
                      )}
                    </p>
                    <div className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 font-mono text-sm text-(--txt-primary) break-all">
                      {createdTokenValue}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setCreateTokenModalOpen(false);
                          setCreatedTokenValue(null);
                        }}
                      >
                        {t('common.done', 'Done')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                        {t('settings.tokens.form.title', 'Title')}
                      </label>
                      <input
                        type="text"
                        value={tokenForm.label}
                        onChange={(e) => setTokenForm((f) => ({ ...f, label: e.target.value }))}
                        placeholder={t('settings.tokens.form.title', 'Title')}
                        className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                        {t('common.description', 'Description')}
                      </label>
                      <textarea
                        value={tokenForm.description}
                        onChange={(e) =>
                          setTokenForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder={t('common.description', 'Description')}
                        rows={2}
                        className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                        {t('settings.tokens.form.expiration', 'Expiration')}
                      </label>
                      <div className="relative max-w-xs">
                        <select
                          value={tokenForm.expiresIn}
                          onChange={(e) =>
                            setTokenForm((f) => ({
                              ...f,
                              expiresIn: e.target.value,
                            }))
                          }
                          className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                        >
                          <option value="">
                            {t('settings.tokens.expiry.never', 'Never expires')}
                          </option>
                          <option value="7d">{t('settings.tokens.expiry.week', '1 week')}</option>
                          <option value="30d">
                            {t('settings.tokens.expiry.month', '1 month')}
                          </option>
                          <option value="90d">
                            {t('settings.tokens.expiry.threeMonths', '3 months')}
                          </option>
                          <option value="365d">{t('settings.tokens.expiry.year', '1 year')}</option>
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                          <IconChevronDown />
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setCreateTokenModalOpen(false)}>
                        {t('common.cancel', 'Cancel')}
                      </Button>
                      <Button
                        disabled={!tokenForm.label.trim()}
                        onClick={async () => {
                          try {
                            const res = await userService.createToken({
                              label: tokenForm.label.trim(),
                              description: tokenForm.description.trim() || undefined,
                              expires_in: tokenForm.expiresIn || undefined,
                            });
                            setCreatedTokenValue(res.token);
                            const list = await userService.listTokens();
                            setTokensList(list.tokens ?? []);
                          } catch {
                            // could set error state
                          }
                        }}
                      >
                        {t('settings.tokens.generate', 'Generate token')}
                      </Button>
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          )}

          {isProjectsTab && selectedProject && projectSection === 'general' && (
            <div className="space-y-6">
              <div className="relative h-48 rounded-(--radius-md)">
                <div
                  className="absolute inset-0 overflow-hidden rounded-(--radius-md) bg-(--bg-layer-2)"
                  style={
                    getImageUrl(selectedProject?.cover_image)
                      ? {
                          backgroundImage: `url(${getImageUrl(selectedProject?.cover_image)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined
                  }
                >
                  {!getImageUrl(selectedProject?.cover_image) && (
                    <div className="absolute inset-0 bg-gradient-to-br from-(--neutral-800) to-(--neutral-1000)" />
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 z-10 gap-1.5 text-[13px]"
                  onClick={() => setProjectCoverModalOpen(true)}
                >
                  {t('settings.cover.change', 'Change cover')}
                </Button>
                <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setProjectIconModalOpen(true)}
                    className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label={t('settings.project.changeIcon', 'Change project icon')}
                  >
                    <ProjectIconDisplay
                      emoji={selectedProject.emoji}
                      icon_prop={selectedProject.icon_prop}
                      size={28}
                    />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
                      {projectName || selectedProject.name}
                    </p>
                    <p className="text-xs text-white/90 drop-shadow-sm">
                      {selectedProject.identifier} · {t('settings.project.public', 'Public')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.project.name', 'Project name')}
                  </label>
                  <input
                    type="text"
                    value={projectName || selectedProject.name}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('common.description', 'Description')}
                  </label>
                  <textarea
                    value={(projectDescription || selectedProject.description) ?? ''}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                    placeholder={t('settings.project.descriptionPlaceholder', 'Description...')}
                    className="w-full resize-y rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.project.id', 'Project ID')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={selectedProject.identifier}
                      className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 text-sm text-(--txt-tertiary)"
                    />
                    <span
                      className="text-(--txt-icon-tertiary)"
                      title={t('settings.project.identifierTooltip', 'Project identifier')}
                    >
                      <IconInfo />
                    </span>
                  </div>
                </div>
                <ProjectNetworkSelect
                  value={projectNetwork}
                  onChange={async (v) => {
                    if (!workspaceSlug || !selectedProjectId) return;
                    const prev = projectNetwork;
                    setProjectNetwork(v);
                    try {
                      const updated = await projectService.update(
                        workspaceSlug,
                        selectedProjectId,
                        {
                          network: v === 'public' ? 2 : 0,
                        },
                      );
                      setProjects((prevProjects) =>
                        prevProjects.map((p) => (p.id === updated.id ? updated : p)),
                      );
                    } catch {
                      setProjectNetwork(prev); // revert on failure
                    }
                  }}
                />
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.project.timezone', 'Project Timezone')}
                  </label>
                  <div className="relative max-w-xs" ref={projectTimezoneDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setProjectTimezoneDropdownOpen((o) => !o)}
                      className="flex w-full items-center justify-between rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      <span className="truncate">
                        {timezoneOptions.find((o) => o.value === projectTimezone)?.label ??
                          projectTimezone}
                      </span>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                        <IconChevronDown />
                      </span>
                    </button>
                    {projectTimezoneDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) shadow-lg">
                        <div className="border-b border-(--border-subtle) p-2">
                          <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
                            <IconSearch />
                            <input
                              type="text"
                              value={projectTimezoneSearch}
                              onChange={(e) => setProjectTimezoneSearch(e.target.value)}
                              placeholder={t('common.search', 'Search')}
                              className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder)"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {filteredProjectTimezoneOptions.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => {
                                setProjectTimezone(o.value);
                                setProjectTimezoneDropdownOpen(false);
                                setProjectTimezoneSearch('');
                              }}
                              className={`w-full rounded-(--radius-md) px-2 py-1.5 text-left text-sm ${o.value === projectTimezone ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)' : 'text-(--txt-primary) hover:bg-(--bg-layer-transparent-hover)'}`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {projectUpdateError && (
                <p className="text-sm text-(--txt-danger-primary)">{projectUpdateError}</p>
              )}
              <Button
                disabled={projectUpdateLoading}
                onClick={async () => {
                  if (!workspaceSlug || !selectedProjectId || !projectName.trim()) return;
                  setProjectUpdateError(null);
                  setProjectUpdateLoading(true);
                  try {
                    const updated = await projectService.update(workspaceSlug, selectedProjectId, {
                      name: projectName.trim(),
                      description: projectDescription ?? '',
                      timezone: projectTimezone,
                    });
                    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                    if (selectedProject?.id === updated.id) {
                      setProjectUpdateError(null);
                    }
                  } catch (err: unknown) {
                    const msg =
                      (err as { response?: { data?: { error?: string } } })?.response?.data
                        ?.error ?? t('settings.project.updateError', 'Failed to update project');
                    setProjectUpdateError(msg);
                  } finally {
                    setProjectUpdateLoading(false);
                  }
                }}
              >
                {projectUpdateLoading
                  ? t('common.updating', 'Updating…')
                  : t('settings.project.update', 'Update project')}
              </Button>
              {selectedProject?.created_at && (
                <p className="text-sm text-(--txt-tertiary)">
                  {t('settings.project.createdOn', 'Created on {{date}}', {
                    date: new Date(selectedProject.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }),
                  })}
                </p>
              )}
              {workspaceSlug && selectedProjectId && (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-(--txt-primary)">
                      {t('settings.project.archive.title', 'Archive project')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.project.archive.description',
                        'Hide this project and its work from the workspace. You can restore it later from Archives.',
                      )}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0 text-(--txt-danger-primary)"
                    disabled={archivingProject}
                    onClick={async () => {
                      if (!workspaceSlug || !selectedProjectId) return;
                      setArchivingProject(true);
                      try {
                        await projectService.archive(workspaceSlug, selectedProjectId);
                        setProjects((prev) => prev.filter((p) => p.id !== selectedProjectId));
                        navigate(`/${workspaceSlug}`);
                      } catch {
                        setProjectUpdateError(
                          t('settings.project.archive.error', 'Failed to archive project.'),
                        );
                        setArchivingProject(false);
                      }
                    }}
                  >
                    {archivingProject
                      ? t('settings.project.archive.busy', 'Archiving…')
                      : t('settings.project.archive.title', 'Archive project')}
                  </Button>
                </div>
              )}
              {workspaceSlug && selectedProjectId && (
                <>
                  <CoverImageModal
                    open={projectCoverModalOpen}
                    onClose={() => setProjectCoverModalOpen(false)}
                    onSelect={async (url) => {
                      try {
                        const updated = await projectService.update(
                          workspaceSlug,
                          selectedProjectId,
                          { cover_image: url },
                        );
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                      } catch {
                        // error could be shown
                      }
                    }}
                    title={t('settings.project.selectCover', 'Select project cover')}
                  />
                  <ProjectIconModal
                    open={projectIconModalOpen}
                    onClose={() => setProjectIconModalOpen(false)}
                    currentEmoji={selectedProject?.emoji}
                    currentIconProp={selectedProject?.icon_prop}
                    onSelect={async (selection) => {
                      try {
                        const payload =
                          selection.emoji != null
                            ? { emoji: selection.emoji, icon_prop: undefined }
                            : {
                                emoji: undefined,
                                icon_prop: selection.icon_prop ?? undefined,
                              };
                        const updated = await projectService.update(
                          workspaceSlug,
                          selectedProjectId,
                          payload,
                        );
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                      } catch {
                        // error could be shown
                      }
                    }}
                    title={t('settings.project.iconModalTitle', 'Project icon')}
                  />
                </>
              )}
            </div>
          )}

          {isProjectsTab && selectedProject && projectSection === 'members' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-(--txt-primary)">
                {t('settings.members.title', 'Members')}
              </h2>
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-(--txt-primary)">
                      {t('settings.members.projectLead.title', 'Project Lead')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.members.projectLead.help',
                        'Select the project lead for the project.',
                      )}
                    </p>
                  </div>
                  <div className="relative min-w-[180px]">
                    <select
                      value={projectLeadId ?? ''}
                      onChange={async (e) => {
                        const v = e.target.value || null;
                        const previous = projectLeadId;
                        setProjectLeadId(v);
                        if (!workspaceSlug || !selectedProjectId) return;
                        try {
                          const updated = await projectService.update(
                            workspaceSlug,
                            selectedProjectId,
                            { project_lead_id: v ?? '' },
                          );
                          setProjects((prev) =>
                            prev.map((p) => (p.id === updated.id ? updated : p)),
                          );
                        } catch {
                          setProjectLeadId(previous);
                        }
                      }}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      <option value="">{t('common.select', 'Select')}</option>
                      {workspaceMembers.map((m) => (
                        <option key={m.member_id} value={m.member_id ?? ''}>
                          {memberLabel(m.member_id)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-(--txt-primary)">
                      {t('settings.members.defaultAssignee.title', 'Default Assignee')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.members.defaultAssignee.help',
                        'Select the default assignee for the project.',
                      )}
                    </p>
                  </div>
                  <div className="relative min-w-[120px]">
                    <select
                      value={defaultAssigneeId ?? 'none'}
                      onChange={async (e) => {
                        const v = e.target.value === 'none' ? null : e.target.value;
                        const previous = defaultAssigneeId;
                        setDefaultAssigneeId(v);
                        if (!workspaceSlug || !selectedProjectId) return;
                        try {
                          const updated = await projectService.update(
                            workspaceSlug,
                            selectedProjectId,
                            { default_assignee_id: v ?? '' },
                          );
                          setProjects((prev) =>
                            prev.map((p) => (p.id === updated.id ? updated : p)),
                          );
                        } catch {
                          setDefaultAssigneeId(previous);
                        }
                      }}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      <option value="none">{t('common.none', 'None')}</option>
                      {workspaceMembers.map((m) => (
                        <option key={m.member_id} value={m.member_id}>
                          {memberLabel(m.member_id)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div>
                    <p
                      id={`guest-toggle-label-${selectedProjectId ?? 'project'}`}
                      className="text-sm font-medium text-(--txt-primary)"
                    >
                      {t('settings.members.guestAccess.title', 'Guest access')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.members.guestAccess.help',
                        'This will allow guests to have view access to all the project work items.',
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={guestAccess}
                    aria-labelledby={`guest-toggle-label-${selectedProjectId ?? 'project'}`}
                    onClick={async () => {
                      const next = !guestAccess;
                      setGuestAccess(next);
                      if (!workspaceSlug || !selectedProjectId) return;
                      try {
                        const updated = await projectService.update(
                          workspaceSlug,
                          selectedProjectId,
                          { guest_view_all_features: next },
                        );
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                      } catch {
                        setGuestAccess(guestAccess);
                      }
                    }}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${guestAccess ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'}`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${guestAccess ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-(--txt-primary)">
                  {t('settings.members.title', 'Members')}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1.5">
                    <span className="text-(--txt-icon-tertiary)">
                      <IconSearch />
                    </span>
                    <input
                      type="text"
                      value={projectMembersSearch}
                      onChange={(e) => setProjectMembersSearch(e.target.value)}
                      placeholder={t('common.search', 'Search')}
                      className="w-32 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setInviteTarget('project');
                      setInviteModalOpen(true);
                    }}
                  >
                    <IconPlus /> {t('settings.members.add', 'Add member')}
                  </Button>
                </div>
              </div>
              <Card className="border-0 shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-(--border-subtle)">
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.fullName', 'Full name')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.displayName', 'Display name')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.accountType', 'Account type')}
                        </th>
                        <th className="py-3 font-medium text-(--txt-secondary)">
                          {t('settings.members.joiningDate', 'Joining date')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjectMembers.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar name={memberLabel(m.member_id)} size="sm" />
                              <span className="text-(--txt-primary)">
                                {memberLabel(m.member_id)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-(--txt-secondary)">
                            {memberLabel(m.member_id)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="relative inline-block min-w-[100px]">
                              <select
                                value={roleLabel(m.role)}
                                onChange={async (e) => {
                                  const v = e.target.value as 'member' | 'admin';
                                  const role = v === 'admin' ? 20 : 10;
                                  if (!workspaceSlug || !selectedProjectId || role === m.role)
                                    return;
                                  try {
                                    await projectService.updateMember(
                                      workspaceSlug,
                                      selectedProjectId,
                                      m.id,
                                      role,
                                    );
                                    const list = await projectService.listMembers(
                                      workspaceSlug,
                                      selectedProjectId,
                                    );
                                    setProjectMembers(list ?? []);
                                  } catch {
                                    // could toast
                                  }
                                }}
                                className="w-full appearance-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1.5 pl-2.5 pr-7 text-sm capitalize text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                              >
                                <option value="member">
                                  {t('settings.role.member', 'Member')}
                                </option>
                                <option value="admin">{t('settings.role.admin', 'Admin')}</option>
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                                <IconChevronDown />
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-(--txt-secondary)">
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {pendingProjectInvites.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-(--txt-primary) mb-2">
                    {t('settings.members.pendingInvites', 'Pending invites')}
                  </h3>
                  <div className="space-y-2">
                    {pendingProjectInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3"
                      >
                        <span className="text-sm text-(--txt-primary)">{inv.email}</span>
                        <span className="rounded-full bg-(--bg-warning-subtle) px-2.5 py-0.5 text-xs font-medium text-(--txt-warning-primary)">
                          {t('settings.members.pending', 'Pending')}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (!workspaceSlug || !selectedProjectId) return;
                            try {
                              await projectService.deleteInvite(
                                workspaceSlug,
                                selectedProjectId,
                                inv.id,
                              );
                              const list = await projectService.listInvites(
                                workspaceSlug,
                                selectedProjectId,
                              );
                              setProjectInvites(list ?? []);
                            } catch {
                              // Intentionally empty (kept for future use)
                            }
                          }}
                        >
                          {t('settings.members.revoke', 'Revoke')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isProjectsTab && selectedProject && projectSection === 'features' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-(--txt-primary)">
                  {t('settings.features.title', 'Projects and work items')}
                </h2>
                <p className="mt-0.5 text-sm text-(--txt-secondary)">
                  {t('settings.features.subtitle', 'Toggle these on or off this project.')}
                </p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    id: 'cycles',
                    label: t('settings.features.cycles.label', 'Cycles'),
                    desc: t(
                      'settings.features.cycles.desc',
                      'Timebox work per project and adjust the time period as needed. One cycle can be 2 weeks, the next 1 week.',
                    ),
                    value: featureCycles,
                    set: setFeatureCycles,
                    key: 'cycle_view' as const,
                  },
                  {
                    id: 'modules',
                    label: t('settings.features.modules.label', 'Modules'),
                    desc: t(
                      'settings.features.modules.desc',
                      'Organize work into sub-projects with dedicated leads and assignees.',
                    ),
                    value: featureModules,
                    set: setFeatureModules,
                    key: 'module_view' as const,
                  },
                  {
                    id: 'views',
                    label: t('settings.features.views.label', 'Views'),
                    desc: t(
                      'settings.features.views.desc',
                      'Save custom sorts, filters, and display options or share them with your team.',
                    ),
                    value: featureViews,
                    set: setFeatureViews,
                    key: 'issue_views_view' as const,
                  },
                  {
                    id: 'pages',
                    label: t('settings.features.pages.label', 'Pages'),
                    desc: t(
                      'settings.features.pages.desc',
                      'Create and edit free-form content; notes, docs, anything.',
                    ),
                    value: featurePages,
                    set: setFeaturePages,
                    key: 'page_view' as const,
                  },
                  {
                    id: 'intake',
                    label: t('settings.features.intake.label', 'Intake'),
                    desc: t(
                      'settings.features.intake.desc',
                      'Let non-members share bugs, feedback, and suggestions; without disrupting your workflow.',
                    ),
                    value: featureIntake,
                    set: setFeatureIntake,
                    key: 'intake_view' as const,
                  },
                ].map(({ id, label, desc, value, set, key }) => (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-(--txt-icon-tertiary)">
                        {id === 'cycles' && <IconClock />}
                        {id === 'modules' && <IconGrid />}
                        {id === 'views' && <IconLayers />}
                        {id === 'pages' && <IconFileText />}
                        {id === 'intake' && <IconInbox />}
                      </span>
                      <div>
                        <p
                          id={`feature-toggle-label-${id}-${selectedProjectId ?? 'project'}`}
                          className="text-sm font-medium text-(--txt-primary)"
                        >
                          {label}
                        </p>
                        <p className="mt-0.5 text-sm text-(--txt-secondary)">{desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value}
                      aria-labelledby={`feature-toggle-label-${id}-${selectedProjectId ?? 'project'}`}
                      onClick={async () => {
                        const next = !value;
                        set(next);
                        if (!workspaceSlug || !selectedProjectId) return;
                        try {
                          const updated = await projectService.update(
                            workspaceSlug,
                            selectedProjectId,
                            { [key]: next },
                          );
                          setProjects((prev) =>
                            prev.map((p) => (p.id === updated.id ? updated : p)),
                          );
                        } catch {
                          set(value);
                        }
                      }}
                      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${value ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'}`}
                    >
                      <span
                        className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--txt-primary)">
                  {t('settings.features.workManagement.title', 'Work management')}
                </h3>
                <p className="mt-0.5 text-sm text-(--txt-secondary)">
                  {t(
                    'settings.features.workManagement.subtitle',
                    'Manage your work and projects with ease.',
                  )}
                </p>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-(--txt-icon-tertiary)">
                    <IconClock />
                  </span>
                  <div>
                    <p
                      id={`feature-toggle-label-time-tracking-${selectedProjectId ?? 'project'}`}
                      className="text-sm font-medium text-(--txt-primary)"
                    >
                      {t('settings.features.timeTracking.label', 'Time Tracking')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-secondary)">
                      {t(
                        'settings.features.timeTracking.desc',
                        'Log time spent on work items and projects.',
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={featureTimeTracking}
                  aria-labelledby={`feature-toggle-label-time-tracking-${selectedProjectId ?? 'project'}`}
                  onClick={async () => {
                    const next = !featureTimeTracking;
                    setFeatureTimeTracking(next);
                    if (!workspaceSlug || !selectedProjectId) return;
                    try {
                      const updated = await projectService.update(
                        workspaceSlug,
                        selectedProjectId,
                        { is_time_tracking_enabled: next },
                      );
                      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                    } catch {
                      setFeatureTimeTracking(featureTimeTracking);
                    }
                  }}
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${featureTimeTracking ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'}`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${featureTimeTracking ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>
          )}

          {isProjectsTab && selectedProject && projectSection === 'notifications' && (
            <NotificationPreferencesPanel
              key={selectedProject.id}
              load={loadProjectNotifPrefs}
              save={saveProjectNotifPrefs}
              title={t('settings.notifications.project.title', 'Project notifications')}
              description={t(
                'settings.notifications.project.description',
                "How you're notified for work in this project. Overrides your workspace and account defaults.",
              )}
            />
          )}

          {isProjectsTab && selectedProject && projectSection === 'states' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-(--txt-primary)">
                    {t('settings.states.title', 'States')}
                  </h2>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.states.subtitle',
                      'Define and customize workflow states to track the progress of your work items.',
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setProjectStateEdit(null);
                    setProjectStateName('');
                    setProjectStateColor('#94a3b8');
                    setProjectStateGroup('backlog');
                    setProjectStateModalOpen(true);
                  }}
                >
                  <IconPlus /> {t('settings.states.add', 'Add state')}
                </Button>
              </div>
              <div className="space-y-4">
                {(() => {
                  const byGroup = projectStates.reduce<Record<string, StateApiResponse[]>>(
                    (acc, s) => {
                      const g = (s.group ?? 'backlog').toLowerCase();
                      if (!acc[g]) acc[g] = [];
                      acc[g].push(s);
                      return acc;
                    },
                    {},
                  );
                  const order = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'];
                  const groupKeys = [...new Set([...order, ...Object.keys(byGroup)])];
                  return groupKeys.map((group) => {
                    const states = byGroup[group] ?? [];
                    return (
                      <div key={group}>
                        <h3 className="text-sm font-medium text-(--txt-secondary) mb-2 capitalize">
                          {group}
                        </h3>
                        <div className="space-y-2">
                          {states.length === 0 ? (
                            <p className="text-sm text-(--txt-tertiary) py-2">
                              {t('settings.states.emptyGroup', 'No states in this group.')}
                            </p>
                          ) : (
                            states.map((st, stIndex) => (
                              <Card
                                key={st.id}
                                variant="outlined"
                                className="flex items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: st.color ?? 'var(--border-subtle)',
                                    }}
                                  />
                                  <span className="text-sm font-medium text-(--txt-primary)">
                                    {st.name}
                                  </span>
                                  {st.default && (
                                    <span className="rounded-full bg-(--bg-accent-subtle) px-2 py-0.5 text-[11px] font-medium text-(--txt-accent-primary)">
                                      {t('settings.states.default', 'Default')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label={t('settings.states.moveUp', 'Move {{name}} up', {
                                      name: st.name,
                                    })}
                                    disabled={stIndex === 0}
                                    onClick={() => moveStateWithinGroup(st, -1)}
                                    className="flex size-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    {}
                                    <span aria-hidden>↑</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t(
                                      'settings.states.moveDown',
                                      'Move {{name}} down',
                                      {
                                        name: st.name,
                                      },
                                    )}
                                    disabled={stIndex === states.length - 1}
                                    onClick={() => moveStateWithinGroup(st, 1)}
                                    className="flex size-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    {}
                                    <span aria-hidden>↓</span>
                                  </button>
                                  {!st.default && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setStateAsDefault(st)}
                                    >
                                      {t('settings.states.setDefault', 'Set default')}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setProjectStateEdit(st);
                                      setProjectStateName(st.name);
                                      setProjectStateColor(st.color ?? '#94a3b8');
                                      setProjectStateGroup(st.group ?? 'backlog');
                                      setProjectStateModalOpen(true);
                                    }}
                                  >
                                    {t('common.edit', 'Edit')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="text-(--txt-danger-primary)"
                                    onClick={async () => {
                                      if (!workspaceSlug || !selectedProjectId) return;
                                      try {
                                        await stateService.delete(
                                          workspaceSlug,
                                          selectedProjectId,
                                          st.id,
                                        );
                                        const list = await stateService.list(
                                          workspaceSlug,
                                          selectedProjectId,
                                        );
                                        setProjectStates(list ?? []);
                                      } catch {
                                        // Intentionally empty (kept for future use)
                                      }
                                    }}
                                  >
                                    {t('common.delete', 'Delete')}
                                  </Button>
                                </div>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {isProjectsTab && selectedProject && projectSection === 'labels' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-(--txt-primary)">
                    {t('settings.labels.title', 'Labels')}
                  </h2>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {t(
                      'settings.labels.subtitle',
                      'Create custom labels to categorize and organize your work items.',
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setProjectLabelEdit(null);
                    setProjectLabelName('');
                    setProjectLabelColor('#6366f1');
                    setProjectLabelModalOpen(true);
                  }}
                >
                  <IconPlus /> {t('settings.labels.add', 'Add label')}
                </Button>
              </div>
              <div className="space-y-2">
                {projectLabels.map((label) => (
                  <Card
                    key={label.id}
                    variant="outlined"
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: label.color ?? 'var(--border-subtle)',
                        }}
                      />
                      <span className="text-sm font-medium capitalize text-(--txt-primary)">
                        {label.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setProjectLabelEdit(label);
                          setProjectLabelName(label.name);
                          setProjectLabelColor(label.color ?? '#6366f1');
                          setProjectLabelModalOpen(true);
                        }}
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-(--txt-danger-primary)"
                        onClick={async () => {
                          if (!workspaceSlug || !selectedProjectId) return;
                          try {
                            await labelService.delete(workspaceSlug, selectedProjectId, label.id);
                            const list = await labelService.list(workspaceSlug, selectedProjectId);
                            setProjectLabels(list ?? []);
                          } catch {
                            // Intentionally empty (kept for future use)
                          }
                        }}
                      >
                        {t('common.delete', 'Delete')}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isProjectsTab &&
            selectedProject &&
            workspaceSlug &&
            selectedProjectId &&
            projectSection === 'estimates' && (
              <ProjectEstimatesSettings
                workspaceSlug={workspaceSlug}
                projectId={selectedProjectId}
              />
            )}

          {isProjectsTab && selectedProject && projectSection === 'automations' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-(--txt-primary)">
                  {t('settings.automations.title', 'Automations')}
                </h2>
                <p className="mt-0.5 text-sm text-(--txt-secondary)">
                  {t(
                    'settings.automations.subtitle',
                    'Configure automated actions to streamline your project management workflow and reduce manual tasks.',
                  )}
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-(--txt-icon-tertiary)">
                      <IconArchive />
                    </span>
                    <div>
                      <p
                        id={`auto-archive-toggle-${selectedProjectId ?? 'project'}`}
                        className="text-sm font-medium text-(--txt-primary)"
                      >
                        {t(
                          'settings.automations.autoArchive.title',
                          'Auto-archive closed work items',
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-(--txt-secondary)">
                        {t(
                          'settings.automations.autoArchive.desc',
                          'Devlane will auto archive work items that have been completed or canceled.',
                        )}
                      </p>
                      {autoArchive && (
                        <label className="mt-2 flex items-center gap-2 text-sm text-(--txt-secondary)">
                          {t('settings.automations.archiveAfter', 'Archive after')}
                          <select
                            value={autoArchiveMonths}
                            disabled={autoArchiveSaving}
                            onChange={(e) => persistAutoArchive(true, Number(e.target.value))}
                            className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                          >
                            <option value={1}>
                              {t('settings.automations.months.one', '1 month')}
                            </option>
                            <option value={3}>
                              {t('settings.automations.months.three', '3 months')}
                            </option>
                            <option value={6}>
                              {t('settings.automations.months.six', '6 months')}
                            </option>
                            <option value={12}>
                              {t('settings.automations.months.twelve', '12 months')}
                            </option>
                          </select>
                          {t('settings.automations.ofInactivity', 'of inactivity')}
                        </label>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoArchive}
                    aria-labelledby={`auto-archive-toggle-${selectedProjectId ?? 'project'}`}
                    disabled={autoArchiveSaving}
                    onClick={() => persistAutoArchive(!autoArchive, autoArchiveMonths)}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${autoArchive ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'}`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoArchive ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-(--txt-icon-tertiary)">
                      <IconTrash />
                    </span>
                    <div>
                      <p
                        id={`auto-close-toggle-${selectedProjectId ?? 'project'}`}
                        className="text-sm font-medium text-(--txt-primary)"
                      >
                        {t('settings.automations.autoClose.title', 'Auto-close work items')}
                      </p>
                      <p className="mt-0.5 text-sm text-(--txt-secondary)">
                        {t(
                          'settings.automations.autoClose.desc',
                          "Devlane will automatically close work items that haven't been completed or canceled.",
                        )}
                      </p>
                      {autoClose && (
                        <label className="mt-2 flex items-center gap-2 text-sm text-(--txt-secondary)">
                          {t('settings.automations.closeAfter', 'Close after')}
                          <select
                            value={autoCloseMonths}
                            disabled={autoCloseSaving}
                            onChange={(e) => persistAutoClose(true, Number(e.target.value))}
                            className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                          >
                            <option value={1}>
                              {t('settings.automations.months.one', '1 month')}
                            </option>
                            <option value={3}>
                              {t('settings.automations.months.three', '3 months')}
                            </option>
                            <option value={6}>
                              {t('settings.automations.months.six', '6 months')}
                            </option>
                            <option value={12}>
                              {t('settings.automations.months.twelve', '12 months')}
                            </option>
                          </select>
                          {t('settings.automations.ofInactivity', 'of inactivity')}
                        </label>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoClose}
                    aria-labelledby={`auto-close-toggle-${selectedProjectId ?? 'project'}`}
                    disabled={autoCloseSaving}
                    onClick={() => persistAutoClose(!autoClose, autoCloseMonths)}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${autoClose ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'}`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoClose ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isAccountTab && !isProjectsTab && section === 'general' && (
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--bg-layer-2) text-lg font-semibold text-(--txt-secondary)">
                  {workspace?.logo && getImageUrl(workspace.logo) ? (
                    <img
                      src={getImageUrl(workspace.logo)!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (workspace?.name?.charAt(0).toUpperCase() ?? '')
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-(--txt-primary)">
                    {workspaceDisplayName}
                  </h2>
                  <p className="text-sm text-(--txt-tertiary)">{workspaceUrl}</p>
                  <button
                    type="button"
                    onClick={() => setWorkspaceLogoModalOpen(true)}
                    className="mt-1 flex items-center gap-1 text-sm font-medium text-(--txt-accent-primary) hover:underline"
                  >
                    <IconPencil />
                    {t('settings.workspace.editLogo', 'Edit logo')}
                  </button>
                </div>
              </div>
              <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.workspace.name', 'Workspace name')}
                  </label>
                  <input
                    type="text"
                    value={workspaceName || workspace.name}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.workspace.companySize', 'Company size')}
                  </label>
                  <div className="relative">
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      {COMPANY_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.workspace.url', 'Workspace URL')}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={workspaceUrl}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 text-sm text-(--txt-tertiary)"
                  />
                </div>
              </div>
              {generalUpdateError && (
                <p className="text-sm text-(--txt-danger-primary)">{generalUpdateError}</p>
              )}
              <Button
                disabled={generalUpdateLoading}
                onClick={async () => {
                  if (!workspaceSlug || !workspaceName.trim()) return;
                  setGeneralUpdateError(null);
                  setGeneralUpdateLoading(true);
                  try {
                    const updated = await workspaceService.update(workspaceSlug, {
                      name: workspaceName.trim(),
                    });
                    setWorkspace(updated);
                  } catch (err: unknown) {
                    const msg =
                      (err as { response?: { data?: { error?: string } } })?.response?.data
                        ?.error ??
                      t('settings.workspace.updateError', 'Failed to update workspace');
                    setGeneralUpdateError(msg);
                  } finally {
                    setGeneralUpdateLoading(false);
                  }
                }}
              >
                {generalUpdateLoading
                  ? t('common.updating', 'Updating…')
                  : t('settings.workspace.update', 'Update workspace')}
              </Button>
              <Card variant="outlined" className="border-(--border-subtle)">
                <button
                  type="button"
                  onClick={() => setDeleteWorkspaceOpen(!deleteWorkspaceOpen)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-(--txt-danger-primary)">
                    {t('settings.workspace.delete.title', 'Delete this workspace')}
                  </span>
                  <span
                    className={`text-(--txt-icon-tertiary) transition-transform ${deleteWorkspaceOpen ? 'rotate-180' : ''}`}
                  >
                    <IconChevronDown />
                  </span>
                </button>
                {deleteWorkspaceOpen && (
                  <CardContent className="border-t border-(--border-subtle) pt-3">
                    <p className="text-sm text-(--txt-secondary)">
                      {t(
                        'settings.workspace.delete.description',
                        'This action cannot be undone. All projects and data in this workspace will be permanently removed.',
                      )}
                    </p>
                    <Button variant="secondary" className="mt-3 text-(--txt-danger-primary)">
                      {t('settings.workspace.delete.button', 'Delete workspace')}
                    </Button>
                  </CardContent>
                )}
              </Card>
              {workspaceSlug && (
                <UploadImageModal
                  open={workspaceLogoModalOpen}
                  onClose={() => setWorkspaceLogoModalOpen(false)}
                  onSave={async (url) => {
                    try {
                      const updated = await workspaceService.update(workspaceSlug!, { logo: url });
                      setWorkspace(updated);
                    } catch {
                      // error shown in modal
                    }
                  }}
                  title={t('settings.workspace.uploadLogo', 'Upload workspace logo')}
                />
              )}
            </div>
          )}

          {!isAccountTab && !isProjectsTab && section === 'members' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-(--txt-primary)">
                    {t('settings.members.title', 'Members')}
                  </h2>
                  <span className="rounded-full bg-(--brand-200) px-2 py-0.5 text-xs font-medium text-(--txt-primary)">
                    {workspaceMembers.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1.5">
                    <span className="text-(--txt-icon-tertiary)">
                      <IconSearch />
                    </span>
                    <input
                      type="text"
                      value={membersSearch}
                      onChange={(e) => setMembersSearch(e.target.value)}
                      placeholder={t('settings.members.searchPlaceholder', 'Search...')}
                      className="w-40 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setInviteTarget('workspace');
                      setInviteModalOpen(true);
                    }}
                  >
                    <IconPlus />
                    {t('settings.members.add', 'Add member')}
                  </Button>
                </div>
              </div>
              <Card className="border-0 shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-(--border-subtle)">
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.fullName', 'Full name')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.displayName', 'Display name')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.emailAddress', 'Email address')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.accountType', 'Account type')}
                        </th>
                        <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                          {t('settings.members.authentication', 'Authentication')}
                        </th>
                        <th className="py-3 font-medium text-(--txt-secondary)">
                          {t('settings.members.joiningDate', 'Joining date')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar name={memberLabel(m.member_id)} size="sm" />
                              <span className="text-(--txt-primary)">
                                {memberLabel(m.member_id)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-(--txt-secondary)">
                            {m.member_display_name?.trim() || memberLabel(m.member_id)}
                          </td>
                          <td className="py-3 pr-4 text-(--txt-secondary)">
                            {m.member_email ?? '—'}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="relative inline-block min-w-[100px]">
                              <select
                                value={roleLabel(m.role)}
                                onChange={async (e) => {
                                  const v = e.target.value as 'member' | 'admin';
                                  const role = v === 'admin' ? 20 : 10;
                                  if (!workspaceSlug || role === m.role) return;
                                  try {
                                    await workspaceService.updateMember(workspaceSlug, m.id, role);
                                    const list = await workspaceService.listMembers(workspaceSlug);
                                    setWorkspaceMembers(list ?? []);
                                  } catch {
                                    // could toast or set per-row error
                                  }
                                }}
                                className="w-full appearance-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1.5 pl-2.5 pr-7 text-sm capitalize text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                              >
                                <option value="member">
                                  {t('settings.role.member', 'Member')}
                                </option>
                                <option value="admin">{t('settings.role.admin', 'Admin')}</option>
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                                <IconChevronDown />
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-(--txt-secondary)">
                            {t('settings.members.authEmail', 'Email')}
                          </td>
                          <td className="py-3 text-(--txt-secondary)">
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setPendingInvitesExpanded((e) => !e)}
                  className="flex w-full items-center gap-2 rounded-md py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-transparent-hover)"
                >
                  {t('settings.members.pendingInvites', 'Pending invites')}
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--brand-200) px-2 py-0.5 text-xs font-medium text-(--brand-default)">
                    {pendingInvites.length}
                  </span>
                  <span className="ml-auto flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
                    {pendingInvitesExpanded ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {pendingInvitesExpanded && (
                  <div className="mt-2 space-y-2">
                    {pendingInvites.length === 0 ? (
                      <p className="py-4 text-sm text-(--txt-tertiary)">
                        {t('settings.members.noPendingInvites', 'No pending invites.')}
                      </p>
                    ) : (
                      pendingInvites.map((inv) => {
                        const initial = inv.email.charAt(0).toUpperCase();
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center gap-3 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-(--bg-layer-2) text-sm font-medium text-(--txt-secondary)">
                              {initial}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-sm text-(--txt-primary)">
                              {inv.email}
                            </span>
                            <span className="shrink-0 rounded-full bg-(--bg-warning-subtle) px-2.5 py-0.5 text-xs font-medium text-(--txt-warning-primary)">
                              {t('settings.members.pending', 'Pending')}
                            </span>
                            <div className="relative shrink-0 min-w-[100px]">
                              <select
                                defaultValue={roleLabel(inv.role)}
                                className="w-full appearance-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1.5 pl-2.5 pr-7 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                              >
                                <option value="member">
                                  {t('settings.role.member', 'Member')}
                                </option>
                                <option value="admin">{t('settings.role.admin', 'Admin')}</option>
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                                <IconChevronDown />
                              </span>
                            </div>
                            <div
                              className="relative shrink-0"
                              ref={
                                pendingInviteMenuId === inv.id ? pendingInviteMenuRef : undefined
                              }
                            >
                              <button
                                type="button"
                                className="flex size-8 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                                aria-label={t('common.moreOptions', 'More options')}
                                aria-expanded={pendingInviteMenuId === inv.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingInviteMenuId((id) => (id === inv.id ? null : inv.id));
                                }}
                              >
                                <IconMoreVertical />
                              </button>
                              {pendingInviteMenuId === inv.id && (
                                <div
                                  className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-lg"
                                  role="menu"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                                    onClick={async () => {
                                      setPendingInviteMenuId(null);
                                      const url = `${window.location.origin}/invite?token=${inv.token}`;
                                      try {
                                        await navigator.clipboard.writeText(url);
                                      } catch {
                                        // Intentionally empty (kept for future use)
                                      }
                                    }}
                                  >
                                    <IconLink />
                                    {t('settings.members.copyLink', 'Copy link')}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-destructive) hover:bg-(--bg-destructive-subtle)"
                                    onClick={async () => {
                                      setPendingInviteMenuId(null);
                                      if (!workspaceSlug) return;
                                      try {
                                        await workspaceService.deleteInvite(workspaceSlug, inv.id);
                                        const list =
                                          await workspaceService.listInvites(workspaceSlug);
                                        setWorkspaceInvites(list ?? []);
                                      } catch {
                                        // could toast
                                      }
                                    }}
                                  >
                                    <IconTrash />
                                    {t('common.remove', 'Remove')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isAccountTab && !isProjectsTab && section === 'notifications' && workspaceSlug && (
            <NotificationPreferencesPanel
              key={workspaceSlug}
              load={loadWorkspaceNotifPrefs}
              save={saveWorkspaceNotifPrefs}
              title={t('settings.notifications.workspace.title', 'Workspace notifications')}
              description={t(
                'settings.notifications.workspace.description',
                "How you're notified for work in this workspace. Overrides your account defaults; projects can override this.",
              )}
            />
          )}

          {!isAccountTab && !isProjectsTab && section === 'api-tokens' && workspaceSlug && (
            <WorkspaceApiTokensPanel workspaceSlug={workspaceSlug} />
          )}

          {!isAccountTab && !isProjectsTab && section === 'integrations' && workspaceSlug && (
            <IntegrationsSection workspaceSlug={workspaceSlug} projects={projects} />
          )}

          {!isAccountTab && !isProjectsTab && section === 'exports' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-(--txt-primary)">
                  {t('settings.export.title', 'Exports')}
                </h2>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  {t(
                    'settings.export.subtitle',
                    'Export your project data in various formats and access your export history with download links.',
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.export.exportingProject', 'Exporting project')}
                  </label>
                  <div className="relative min-w-[200px]">
                    <select
                      value={exportProjectValue}
                      onChange={(e) => setExportProjectValue(e.target.value)}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      <option value="all">
                        {t('settings.export.allProjects', 'All projects')}
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                    {t('settings.export.format', 'Format')}
                  </label>
                  <div className="relative min-w-[120px]">
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                    >
                      {}
                      <option value="csv">CSV</option>
                      {}
                      <option value="json">JSON</option>
                      <option value="xlsx">{t('settings.export.formatExcel', 'Excel')}</option>
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                      <IconChevronDown />
                    </span>
                  </div>
                </div>
                <Button onClick={() => setExportProjectOpen(true)}>
                  {t('settings.export.export', 'Export')}
                </Button>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--txt-primary)">
                    {t('settings.export.previous', 'Previous exports')}
                  </h3>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm font-medium text-(--txt-secondary) hover:text-(--txt-primary)"
                  >
                    <IconRefresh />
                    {t('settings.export.refreshStatus', 'Refresh status')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-(--txt-tertiary)">
                    {t('settings.export.prev', '← Prev')}
                  </span>
                  <span className="text-sm text-(--txt-tertiary)">
                    {t('settings.export.next', 'Next →')}
                  </span>
                </div>
                <Card variant="outlined" className="mt-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <IconCog />
                    <p className="mt-2 text-sm font-medium text-(--txt-secondary)">
                      {t('settings.export.empty', 'No exports yet')}
                    </p>
                    <p className="mt-0.5 text-sm text-(--txt-tertiary)">
                      {t(
                        'settings.export.emptyHelp',
                        'Anytime you export, you will also have a copy here for reference.',
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {!isAccountTab && !isProjectsTab && section === 'webhooks' && workspaceSlug && (
            <WebhooksSettings workspaceSlug={workspaceSlug} />
          )}
        </main>
      </div>

      {/* Export modal */}
      <ExportModal
        open={exportProjectOpen}
        onClose={() => !exporting && setExportProjectOpen(false)}
        workspaceSlug={workspaceSlug}
        workspace={workspace}
        projects={projects}
        exportFormat={exportFormat}
        exportProjectValue={exportProjectValue}
        setExportProjectValue={setExportProjectValue}
        exporting={exporting}
        setExporting={setExporting}
        setExportProjectOpen={setExportProjectOpen}
      />

      {/* Invite people to collaborate modal */}
      <InviteModal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setInviteTarget(null);
          setInviteRows([{ id: 0, email: '', role: 'member' }]);
        }}
        inviteTarget={inviteTarget}
        inviteRows={inviteRows}
        setInviteRows={setInviteRows}
        inviting={inviting}
        submitInviteModal={submitInviteModal}
      />

      {/* Project state (workflow) add/edit modal */}
      <ProjectStateModal
        open={projectStateModalOpen}
        onClose={() => {
          setProjectStateModalOpen(false);
          setProjectStateEdit(null);
        }}
        workspaceSlug={workspaceSlug}
        selectedProjectId={selectedProjectId}
        projectStateEdit={projectStateEdit}
        setProjectStateEdit={setProjectStateEdit}
        projectStateName={projectStateName}
        setProjectStateName={setProjectStateName}
        projectStateColor={projectStateColor}
        setProjectStateColor={setProjectStateColor}
        projectStateGroup={projectStateGroup}
        setProjectStateGroup={setProjectStateGroup}
        setProjectStates={setProjectStates}
        setProjectStateModalOpen={setProjectStateModalOpen}
      />

      {/* Project label add/edit modal */}
      <ProjectLabelModal
        open={projectLabelModalOpen}
        onClose={() => {
          setProjectLabelModalOpen(false);
          setProjectLabelEdit(null);
        }}
        workspaceSlug={workspaceSlug}
        selectedProjectId={selectedProjectId}
        projectLabelEdit={projectLabelEdit}
        setProjectLabelEdit={setProjectLabelEdit}
        projectLabelName={projectLabelName}
        setProjectLabelName={setProjectLabelName}
        projectLabelColor={projectLabelColor}
        setProjectLabelColor={setProjectLabelColor}
        setProjectLabels={setProjectLabels}
        setProjectLabelModalOpen={setProjectLabelModalOpen}
      />
    </div>
  );
}

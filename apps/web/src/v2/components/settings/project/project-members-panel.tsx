import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Input } from '@/v2/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Switch } from '@/v2/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { InviteMembersDialog } from '@/v2/components/settings/invite-members-dialog';
import {
  MemberRoleSelect,
  ROLE_ADMIN,
  ROLE_MEMBER,
  memberName,
} from '@/v2/components/settings/member-role-select';
import { SettingRow, SettingsPanel } from '@/v2/components/settings/settings-panel';
import { projectService } from '../../../../services/projectService';
import { workspaceService } from '../../../../services/workspaceService';
import type {
  ProjectApiResponse,
  ProjectInviteApiResponse,
  ProjectMemberApiResponse,
  WorkspaceMemberApiResponse,
} from '../../../../api/types';

interface ProjectMembersPanelProps {
  workspaceSlug: string;
  project: ProjectApiResponse;
  onProjectUpdated: (project: ProjectApiResponse) => void;
}

const NO_SELECTION = 'none';

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

/** Project lead, default assignee, guest access, and the project's member list. */
export function ProjectMembersPanel({
  workspaceSlug,
  project,
  onProjectUpdated,
}: ProjectMembersPanelProps) {
  const { t } = useTranslation();
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [members, setMembers] = useState<ProjectMemberApiResponse[]>([]);
  const [invites, setInvites] = useState<ProjectInviteApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  /* Seeded from the project and then owned locally: every control writes through
     to the API and reverts itself on failure, so there is nothing to re-sync.
     The page remounts this panel per project, which resets these. */
  const [leadId, setLeadId] = useState(project.project_lead_id ?? NO_SELECTION);
  const [assigneeId, setAssigneeId] = useState(project.default_assignee_id ?? NO_SELECTION);
  const [guestAccess, setGuestAccess] = useState(project.guest_view_all_features ?? false);

  const refreshMembers = useCallback(async () => {
    setMembers((await projectService.listMembers(workspaceSlug, project.id)) ?? []);
  }, [workspaceSlug, project.id]);

  const refreshInvites = useCallback(async () => {
    setInvites((await projectService.listInvites(workspaceSlug, project.id)) ?? []);
  }, [workspaceSlug, project.id]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      Promise.all([
        workspaceService.listMembers(workspaceSlug),
        projectService.listMembers(workspaceSlug, project.id),
        projectService.listInvites(workspaceSlug, project.id),
      ])
        .then(([workspaceList, memberList, inviteList]) => {
          if (cancelled) return;
          setWorkspaceMembers(workspaceList ?? []);
          setMembers(memberList ?? []);
          setInvites(inviteList ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setWorkspaceMembers([]);
          setMembers([]);
          setInvites([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, project.id]);

  const fallbackName = t('settings.members.fallbackName', 'Member');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) =>
      memberName(workspaceMembers, m.member_id, fallbackName).toLowerCase().includes(term),
    );
  }, [members, workspaceMembers, search, fallbackName]);

  const pendingInvites = invites.filter((i) => !i.accepted);

  /** Persists one project field, reverting the local control if it fails. */
  const persist = async <T,>(
    payload: Record<string, unknown>,
    revert: (value: T) => void,
    previous: T,
  ) => {
    try {
      onProjectUpdated(await projectService.update(workspaceSlug, project.id, payload));
    } catch {
      revert(previous);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.members.title', 'Members')}
      description={t(
        'settings.members.projectDescription',
        'Who works on this project, and the defaults new work inherits.',
      )}
      actions={
        <>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search', 'Search')}
              className="h-8 w-40 pl-7"
              aria-label={t('common.search', 'Search')}
            />
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <PlusIcon />
            {t('settings.members.add', 'Add member')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SettingRow
          title={t('settings.members.projectLead.title', 'Project Lead')}
          description={t(
            'settings.members.projectLead.help',
            'Select the project lead for the project.',
          )}
          control={
            <Select
              value={leadId}
              onValueChange={(value) => {
                const previous = leadId;
                setLeadId(value);
                void persist(
                  { project_lead_id: value === NO_SELECTION ? '' : value },
                  setLeadId,
                  previous,
                );
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-48"
                aria-label={t('settings.members.projectLead.title', 'Project Lead')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>{t('common.none', 'None')}</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.member_id} value={member.member_id}>
                    {memberName(workspaceMembers, member.member_id, fallbackName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          title={t('settings.members.defaultAssignee.title', 'Default Assignee')}
          description={t(
            'settings.members.defaultAssignee.help',
            'Select the default assignee for the project.',
          )}
          control={
            <Select
              value={assigneeId}
              onValueChange={(value) => {
                const previous = assigneeId;
                setAssigneeId(value);
                void persist(
                  { default_assignee_id: value === NO_SELECTION ? '' : value },
                  setAssigneeId,
                  previous,
                );
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-48"
                aria-label={t('settings.members.defaultAssignee.title', 'Default Assignee')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>{t('common.none', 'None')}</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.member_id} value={member.member_id}>
                    {memberName(workspaceMembers, member.member_id, fallbackName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <SettingRow
          titleId="project-guest-access-label"
          title={t('settings.members.guestAccess.title', 'Guest access')}
          description={t(
            'settings.members.guestAccess.help',
            'This will allow guests to have view access to all the project work items.',
          )}
          control={
            <Switch
              checked={guestAccess}
              aria-labelledby="project-guest-access-label"
              onCheckedChange={(next) => {
                const previous = guestAccess;
                setGuestAccess(next);
                void persist({ guest_view_all_features: next }, setGuestAccess, previous);
              }}
            />
          }
        />
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.members.fullName', 'Full name')}</TableHead>
                <TableHead>{t('settings.members.accountType', 'Account type')}</TableHead>
                <TableHead>{t('settings.members.joiningDate', 'Joining date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center">
                    {t('settings.members.noMatches', 'No members match this search.')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((member) => {
                  const name = memberName(workspaceMembers, member.member_id, fallbackName);
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-xs">
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <MemberRoleSelect
                          value={member.role}
                          aria-label={t('settings.members.roleFor', 'Role for {{name}}', { name })}
                          onChange={async (role) => {
                            if (role === member.role) return;
                            try {
                              await projectService.updateMember(
                                workspaceSlug,
                                project.id,
                                member.id,
                                role,
                              );
                              await refreshMembers();
                            } catch {
                              /* The row keeps its persisted role. */
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t('settings.members.pendingInvites', 'Pending invites')}
          </h3>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm">{invite.email}</span>
              <Badge variant="secondary">{t('settings.members.pending', 'Pending')}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await projectService.deleteInvite(workspaceSlug, project.id, invite.id);
                    await refreshInvites();
                  } catch {
                    /* The list stays as-is on failure. */
                  }
                }}
              >
                {t('settings.members.revoke', 'Revoke')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <InviteMembersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        description={t(
          'settings.members.inviteProjectDescription',
          'Invited people get access to this project only.',
        )}
        onSubmit={async (rows) => {
          await Promise.all(
            rows.map((row) =>
              projectService.createInvite(workspaceSlug, project.id, {
                email: row.email,
                role: row.role === 'admin' ? ROLE_ADMIN : ROLE_MEMBER,
              }),
            ),
          );
          await refreshInvites();
        }}
      />
    </SettingsPanel>
  );
}

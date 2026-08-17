import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinkIcon, MoreVerticalIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Input } from '@/v2/components/ui/input';
import { Skeleton } from '@/v2/components/ui/skeleton';
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
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import { workspaceService } from '../../../../services/workspaceService';
import type { WorkspaceInviteApiResponse, WorkspaceMemberApiResponse } from '../../../../api/types';

interface WorkspaceMembersPanelProps {
  workspaceSlug: string;
}

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

/** Workspace member list, role changes, and pending invites. */
export function WorkspaceMembersPanel({ workspaceSlug }: WorkspaceMembersPanelProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [invites, setInvites] = useState<WorkspaceInviteApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const refreshMembers = useCallback(async () => {
    setMembers((await workspaceService.listMembers(workspaceSlug)) ?? []);
  }, [workspaceSlug]);

  const refreshInvites = useCallback(async () => {
    setInvites((await workspaceService.listInvites(workspaceSlug)) ?? []);
  }, [workspaceSlug]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      Promise.all([
        workspaceService.listMembers(workspaceSlug),
        workspaceService.listInvites(workspaceSlug),
      ])
        .then(([memberList, inviteList]) => {
          if (cancelled) return;
          setMembers(memberList ?? []);
          setInvites(inviteList ?? []);
        })
        .catch(() => {
          if (cancelled) return;
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
  }, [workspaceSlug]);

  const fallbackName = t('settings.members.fallbackName', 'Member');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => {
      const emailUser = (m.member_email ?? '').split('@')[0]?.toLowerCase() ?? '';
      return (
        m.member_id.toLowerCase().includes(term) ||
        (m.member_display_name ?? '').toLowerCase().includes(term) ||
        emailUser.includes(term)
      );
    });
  }, [members, search]);

  const pendingInvites = invites.filter((i) => !i.accepted);

  const changeRole = async (member: WorkspaceMemberApiResponse, role: number) => {
    if (role === member.role) return;
    try {
      await workspaceService.updateMember(workspaceSlug, member.id, role);
      await refreshMembers();
    } catch {
      /* The row keeps its persisted role; the list is re-read on the next change. */
    }
  };

  return (
    <SettingsPanel
      title={
        <span className="flex items-center gap-2">
          {t('settings.members.title', 'Members')}
          <Badge variant="secondary">{members.length}</Badge>
        </span>
      }
      description={t(
        'settings.members.workspaceDescription',
        'Everyone with access to this workspace.',
      )}
      actions={
        <>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('settings.members.searchPlaceholder', 'Search...')}
              className="h-8 w-40 pl-7"
              aria-label={t('settings.members.searchPlaceholder', 'Search...')}
            />
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <PlusIcon />
            {t('settings.members.add', 'Add member')}
          </Button>
        </>
      }
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.members.fullName', 'Full name')}</TableHead>
                <TableHead>{t('settings.members.emailAddress', 'Email address')}</TableHead>
                <TableHead>{t('settings.members.accountType', 'Account type')}</TableHead>
                <TableHead>{t('settings.members.joiningDate', 'Joining date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    {t('settings.members.noMatches', 'No members match this search.')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((member) => {
                  const name = memberName(members, member.member_id, fallbackName);
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
                      <TableCell className="text-muted-foreground">
                        {member.member_email ?? '—'}
                      </TableCell>
                      <TableCell>
                        <MemberRoleSelect
                          value={member.role}
                          onChange={(role) => void changeRole(member, role)}
                          aria-label={t('settings.members.roleFor', 'Role for {{name}}', { name })}
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

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {t('settings.members.pendingInvites', 'Pending invites')}
          <Badge variant="secondary">{pendingInvites.length}</Badge>
        </h3>
        {pendingInvites.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('settings.members.noPendingInvites', 'No pending invites.')}
          </p>
        ) : (
          pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md text-xs">
                  {invite.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{invite.email}</span>
              <Badge variant="secondary">{t('settings.members.pending', 'Pending')}</Badge>
              <span className="text-muted-foreground text-sm capitalize">
                {invite.role >= ROLE_ADMIN
                  ? t('settings.role.admin', 'Admin')
                  : t('settings.role.member', 'Member')}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('common.moreOptions', 'More options')}
                  >
                    <MoreVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}/invite?token=${invite.token}`,
                        );
                      } catch {
                        /* Clipboard access can be denied by the browser. */
                      }
                    }}
                  >
                    <LinkIcon />
                    {t('settings.members.copyLink', 'Copy link')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await workspaceService.deleteInvite(workspaceSlug, invite.id);
                        await refreshInvites();
                      } catch {
                        /* The list stays as-is on failure. */
                      }
                    }}
                  >
                    <Trash2Icon />
                    {t('common.remove', 'Remove')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      <InviteMembersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        description={t(
          'settings.members.inviteWorkspaceDescription',
          'Invited people get access to every public project in this workspace.',
        )}
        onSubmit={async (rows) => {
          await Promise.all(
            rows.map((row) =>
              workspaceService.createInvite(workspaceSlug, {
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

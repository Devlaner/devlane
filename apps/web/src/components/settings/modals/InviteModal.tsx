import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../ui';
import { IconChevronDown, IconPlus } from '../icons';

export interface InviteRow {
  id: number;
  email: string;
  role: 'member' | 'admin';
}

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  inviteTarget: 'workspace' | 'project' | null;
  inviteRows: InviteRow[];
  setInviteRows: Dispatch<SetStateAction<InviteRow[]>>;
  inviting: boolean;
  submitInviteModal: () => Promise<void>;
}

/** Invite-people-to-collaborate modal, shared by the workspace and project member sections. */
export function InviteModal({
  open,
  onClose,
  inviteTarget,
  inviteRows,
  setInviteRows,
  inviting,
  submitInviteModal,
}: InviteModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('settings.invite.title', 'Invite people to collaborate')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form="invite-collaborators-form" disabled={inviting}>
            {inviting
              ? t('settings.invite.sending', 'Sending…')
              : t('settings.invite.send', 'Send invitations')}
          </Button>
        </>
      }
    >
      <form
        id="invite-collaborators-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitInviteModal();
        }}
      >
        <p className="mb-4 text-sm text-(--txt-secondary)">
          {inviteTarget === 'project'
            ? t('settings.invite.subtitleProject', 'Invite people to this project.')
            : t(
                'settings.invite.subtitleWorkspace',
                'Invite people to collaborate on your workspace.',
              )}
        </p>
        <div className="space-y-3">
          {inviteRows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={row.email}
                onChange={(e) =>
                  setInviteRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, email: e.target.value } : r)),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey) return;
                  e.preventDefault();
                  void submitInviteModal();
                }}
                placeholder={t('settings.invite.emailPlaceholder', 'name@company.com')}
                className="min-w-[200px] flex-1 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
              />
              <div className="relative min-w-[100px]">
                <select
                  value={row.role}
                  onChange={(e) =>
                    setInviteRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, role: e.target.value as 'member' | 'admin' } : r,
                      ),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    if (!e.ctrlKey && !e.metaKey) return;
                    e.preventDefault();
                    void submitInviteModal();
                  }}
                  className="w-full appearance-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-2.5 pr-7 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                >
                  <option value="member">{t('settings.invite.roleMember', 'Member')}</option>
                  <option value="admin">{t('settings.invite.roleAdmin', 'Admin')}</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setInviteRows((prev) => [
                ...prev,
                { id: Date.now(), email: '', role: 'member' as const },
              ])
            }
            className="flex items-center gap-1.5 text-sm font-medium text-(--txt-accent-primary) hover:underline"
          >
            <IconPlus />
            {t('settings.invite.addMore', 'Add more')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

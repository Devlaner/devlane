import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { apiErrorMessage } from '@/v2/components/settings/settings-panel';

export type InviteRole = 'member' | 'admin';

export interface InviteRow {
  email: string;
  role: InviteRole;
}

interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  /** Called with the non-empty rows; the dialog closes when it resolves. */
  onSubmit: (rows: InviteRow[]) => Promise<void>;
}

/** Invites one or more people by email, each with its own role. */
export function InviteMembersDialog({
  open,
  onOpenChange,
  description,
  onSubmit,
}: InviteMembersDialogProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<{ id: number; email: string; role: InviteRole }[]>([
    { id: 0, email: '', role: 'member' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank row rather than the last attempt's emails. */
  useEffect(() => {
    if (!open) {
      setRows([{ id: 0, email: '', role: 'member' }]);
      setError(null);
    }
  }, [open]);

  const filled = rows.filter((r) => r.email.trim().length > 0);

  const handleSubmit = async () => {
    if (filled.length === 0) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(filled.map((r) => ({ email: r.email.trim(), role: r.role })));
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err, t('settings.members.inviteError', 'Failed to send invites.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('settings.members.inviteTitle', 'Invite people')}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          id="invite-members-v2-form"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`invite-email-${row.id}`} className={index > 0 ? 'sr-only' : ''}>
                  {t('settings.members.emailAddress', 'Email address')}
                </Label>
                <Input
                  id={`invite-email-${row.id}`}
                  type="email"
                  value={row.email}
                  placeholder="name@example.com"
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, email: e.target.value } : r)),
                    )
                  }
                />
              </div>
              <div className="w-36 space-y-2">
                <Label htmlFor={`invite-role-${row.id}`} className={index > 0 ? 'sr-only' : ''}>
                  {t('settings.members.accountType', 'Account type')}
                </Label>
                <Select
                  value={row.role}
                  onValueChange={(value) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, role: value as InviteRole } : r)),
                    )
                  }
                >
                  <SelectTrigger id={`invite-role-${row.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t('settings.role.member', 'Member')}</SelectItem>
                    <SelectItem value="admin">{t('settings.role.admin', 'Admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                aria-label={t('settings.members.removeInviteRow', 'Remove this invite')}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { id: (prev.at(-1)?.id ?? 0) + 1, email: '', role: 'member' },
                ])
              }
            >
              <PlusIcon />
              {t('settings.members.addAnother', 'Add another')}
            </Button>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            form="invite-members-v2-form"
            disabled={submitting || filled.length === 0}
          >
            {submitting
              ? t('settings.members.inviting', 'Sending…')
              : t('settings.members.sendInvites', 'Send invites')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import type { WorkspaceMemberApiResponse } from '../../../api/types';

/** Devlane stores roles as numbers; 20 and above is an admin. */
export const ROLE_ADMIN = 20;
export const ROLE_MEMBER = 10;

export function roleLabel(role: number): 'admin' | 'member' {
  return role >= ROLE_ADMIN ? 'admin' : 'member';
}

/**
 * Resolves a member id to a display name, preferring the display name, then the
 * email's local part.
 */
export function memberName(
  members: WorkspaceMemberApiResponse[],
  memberId: string | null | undefined,
  fallback: string,
): string {
  if (!memberId) return '—';
  const member = members.find((m) => m.member_id === memberId);
  const display = member?.member_display_name?.trim();
  if (display) return display;
  const emailUser = member?.member_email?.split('@')[0]?.trim();
  return emailUser || fallback;
}

interface MemberRoleSelectProps {
  value: number;
  disabled?: boolean;
  onChange: (role: number) => void;
  'aria-label': string;
}

/** Member/Admin picker used by both the workspace and project member tables. */
export function MemberRoleSelect({
  value,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: MemberRoleSelectProps) {
  const { t } = useTranslation();
  return (
    <Select
      value={roleLabel(value)}
      disabled={disabled}
      onValueChange={(next) => onChange(next === 'admin' ? ROLE_ADMIN : ROLE_MEMBER)}
    >
      <SelectTrigger size="sm" className="w-32" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">{t('settings.role.member', 'Member')}</SelectItem>
        <SelectItem value="admin">{t('settings.role.admin', 'Admin')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

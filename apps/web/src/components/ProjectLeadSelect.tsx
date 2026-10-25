import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { WorkspaceMemberApiResponse } from '../api/types';

interface ProjectLeadSelectProps {
  value: string | null;
  members: WorkspaceMemberApiResponse[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const memberLabel = (
  members: WorkspaceMemberApiResponse[],
  memberId: string | null | undefined,
  t: TFunction,
) => {
  if (!memberId) return '—';
  const m = members.find((wm) => wm.member_id === memberId);
  const display = m?.member_display_name?.trim();
  if (display) return display;
  const emailUser = m?.member_email?.split('@')[0]?.trim();
  if (emailUser) return emailUser;
  return t('common.member', 'Member');
};

export function ProjectLeadSelect({ value, members, onChange, disabled }: ProjectLeadSelectProps) {
  const { t } = useTranslation();
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value || null;
    onChange(v);
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-(--txt-primary)">
        {t('common.projectLead', 'Project Lead')}
      </p>
      <div className="relative min-w-[180px]">
        <select
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
        >
          <option value="">{t('common.select', 'Select')}</option>
          {members.map((m) => (
            <option key={m.member_id} value={m.member_id ?? ''}>
              {memberLabel(members, m.member_id, t)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

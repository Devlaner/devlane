import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface ProjectNetworkSelectProps {
  value: string;
  onChange: (value: 'public' | 'private') => void;
  disabled?: boolean;
}

export function ProjectNetworkSelect({ value, onChange, disabled }: ProjectNetworkSelectProps) {
  const { t } = useTranslation();
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value === 'private' ? 'private' : 'public';
    onChange(v);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
        {t('project.network.label', 'Network')}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
        >
          <option value="public">{t('project.network.public', 'Public')}</option>
          <option value="private">{t('project.network.private', 'Private')}</option>
        </select>
      </div>
    </div>
  );
}

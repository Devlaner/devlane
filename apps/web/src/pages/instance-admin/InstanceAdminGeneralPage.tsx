import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InstanceGeneralSection } from '../../api/types';

export function InstanceAdminGeneralPage() {
  const { t } = useTranslation();
  const [instanceName, setInstanceName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useDocumentTitle(t('instanceAdmin.general.documentTitle', 'General settings'));

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const g = (settings.general || {}) as InstanceGeneralSection;
        setInstanceName(String(g.instance_name ?? '').trim());
        setAdminEmail(String(g.admin_email ?? '').trim());
        setInstanceId(String(g.instance_id ?? '').trim());
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = () => {
    setError('');
    setSaving(true);
    // Only instance_name is editable; backend preserves admin_email and instance_id
    instanceSettingsService
      .updateSection('general', { instance_name: instanceName })
      .then(() => {})
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-xl" />
        </div>
        <section className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2.5">
            <div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-0.5 h-8 w-full rounded" />
            </div>
            <div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-0.5 h-8 w-full rounded" />
            </div>
            <div>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-0.5 h-8 w-full rounded" />
            </div>
          </div>
        </section>
        <Skeleton className="h-8 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          {t('instanceAdmin.general.title', 'General settings')}
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          {t(
            'instanceAdmin.general.subtitle',
            'Change the name of your instance. Admin email and instance ID are set at setup and cannot be changed here.',
          )}
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
          {t('instanceAdmin.general.instanceDetails', 'Instance details')}
        </h2>
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-(--txt-secondary)">
            {t('instanceAdmin.general.instanceName', 'Name of instance')}
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-(--txt-secondary)">
            {t('instanceAdmin.general.email', 'Email')}
            <input
              type="email"
              readOnly
              value={adminEmail}
              className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2.5 py-1.5 text-xs text-(--txt-tertiary) focus:outline-none"
            />
            <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
              {t('instanceAdmin.general.emailHint', 'Set at initial setup.')}
            </p>
          </label>
          <label className="block text-xs font-medium text-(--txt-secondary)">
            {t('instanceAdmin.general.instanceId', 'Instance ID')}
            <input
              type="text"
              readOnly
              value={instanceId}
              className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2.5 py-1.5 text-xs text-(--txt-tertiary) focus:outline-none"
            />
            <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
              {t('instanceAdmin.general.instanceIdHint', 'Generated at setup.')}
            </p>
          </label>
        </div>
      </section>

      <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
        {saving ? t('common.saving', 'Saving…') : t('common.saveChanges', 'Save changes')}
      </Button>
    </div>
  );
}

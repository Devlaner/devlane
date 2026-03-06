import { useEffect, useState } from 'react';
import { Button, Skeleton } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceGeneralSection } from '../../api/types';

export function InstanceAdminGeneralPage() {
  const [instanceName, setInstanceName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        <h1 className="text-base font-semibold text-[var(--txt-primary)]">General settings</h1>
        <p className="mt-0.5 text-xs text-[var(--txt-secondary)]">
          Change the name of your instance. Admin email and instance ID are set at setup and cannot be changed here.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--txt-secondary)]">Instance details</h2>
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-[var(--txt-secondary)]">
            Name of instance
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className="mt-0.5 block w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-2.5 py-1.5 text-xs text-[var(--txt-primary)] focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--txt-secondary)]">
            Email
            <input
              type="email"
              readOnly
              value={adminEmail}
              className="mt-0.5 block w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2.5 py-1.5 text-xs text-[var(--txt-tertiary)] focus:outline-none"
            />
            <p className="mt-0.5 text-[11px] text-[var(--txt-tertiary)]">Set at initial setup.</p>
          </label>
          <label className="block text-xs font-medium text-[var(--txt-secondary)]">
            Instance ID
            <input
              type="text"
              readOnly
              value={instanceId}
              className="mt-0.5 block w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2.5 py-1.5 text-xs text-[var(--txt-tertiary)] focus:outline-none"
            />
            <p className="mt-0.5 text-[11px] text-[var(--txt-tertiary)]">Generated at setup.</p>
          </label>
        </div>
      </section>

      <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

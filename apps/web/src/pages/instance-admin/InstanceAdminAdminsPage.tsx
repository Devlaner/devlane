import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Avatar, Button, Modal, Skeleton } from '../../components/ui';
import { instanceAdminService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InstanceAdminApiResponse } from '../../api/types';

export function InstanceAdminAdminsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<InstanceAdminApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  useDocumentTitle(t('instanceAdmin.admins.documentTitle', 'Admins'));

  useEffect(() => {
    let cancelled = false;
    instanceAdminService
      .listAdmins()
      .then((list) => {
        if (!cancelled) setAdmins(list);
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

  const refresh = () => instanceAdminService.listAdmins().then(setAdmins);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const email = addEmail.trim();
    if (!email) return;
    setError('');
    setAdding(true);
    instanceAdminService
      .addAdmin(email)
      .then(() => refresh())
      .then(() => setAddEmail(''))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setAdding(false));
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    setError('');
    setRemoving(true);
    instanceAdminService
      .removeAdmin(removeTarget.id)
      .then(() => refresh())
      .then(() => setRemoveTarget(null))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setRemoving(false));
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-full max-w-lg rounded" />
        <ul className="space-y-2">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          {t('instanceAdmin.admins.title', 'Instance admins')}
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          {t('instanceAdmin.admins.subtitle', "People who can manage this instance's settings.")}
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <form onSubmit={handleAdd} className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder={t('instanceAdmin.admins.emailPlaceholder', 'person@example.com')}
            aria-label={t('instanceAdmin.admins.emailAriaLabel', 'New admin email')}
            className="block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:border-(--border-strong) focus:outline-none"
          />
          <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
            {t(
              'instanceAdmin.admins.accountHint',
              'The person must already have a Devlane account.',
            )}
          </p>
        </div>
        <Button size="sm" type="submit" className="text-xs" disabled={adding || !addEmail.trim()}>
          {adding
            ? t('instanceAdmin.admins.adding', 'Adding…')
            : t('instanceAdmin.admins.addAdmin', 'Add admin')}
        </Button>
      </form>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
          {t('instanceAdmin.admins.listHeading', 'Admins • {{count}}', { count: admins.length })}
        </h2>
        <ul className="space-y-2">
          {admins.map((a) => {
            const name =
              a.user_display_name ||
              a.user_email ||
              t('instanceAdmin.admins.unknownUser', 'Unknown user');
            const isSelf = user?.id === a.user_id;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar name={name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-(--txt-primary)">
                      {name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-(--txt-tertiary)">
                          {t('instanceAdmin.admins.you', '(you)')}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-(--txt-tertiary)">{a.user_email ?? '—'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded bg-(--bg-layer-2) px-1.5 py-0.5 text-[11px] font-medium text-(--txt-secondary)">
                    {t('instanceAdmin.admins.roleBadge', 'Admin')}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    className="text-xs"
                    disabled={admins.length <= 1}
                    title={
                      admins.length <= 1
                        ? t(
                            'instanceAdmin.admins.lastAdminTooltip',
                            'The last admin cannot be removed',
                          )
                        : undefined
                    }
                    onClick={() => setRemoveTarget({ id: a.id, name })}
                  >
                    {t('instanceAdmin.admins.remove', 'Remove')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Modal
        open={removeTarget !== null}
        onClose={() => {
          if (!removing) setRemoveTarget(null);
        }}
        title={t('instanceAdmin.admins.removeModalTitle', 'Remove instance admin')}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="text-xs"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing
                ? t('instanceAdmin.admins.removing', 'Removing…')
                : t('instanceAdmin.admins.removeAdmin', 'Remove admin')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-(--txt-secondary)">
          {removeTarget && (
            <Trans
              i18nKey="instanceAdmin.admins.removeConfirm"
              defaults="Remove <b>{{name}}</b> as an instance admin? They will lose access to instance settings."
              values={{ name: removeTarget.name }}
              components={{ b: <span className="font-medium text-(--txt-primary)" /> }}
            />
          )}
        </p>
      </Modal>
    </div>
  );
}

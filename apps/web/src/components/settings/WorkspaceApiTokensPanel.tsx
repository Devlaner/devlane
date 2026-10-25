import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, Button, Modal } from '../ui';
import { IconPlus, IconChevronDown } from './icons';
import { workspaceService } from '../../services/workspaceService';
import { formatRelativeTime } from '../../lib/settingsHelpers';
import type { ApiTokenResponse } from '../../api/types';

interface WorkspaceApiTokensPanelProps {
  workspaceSlug: string;
}

/**
 * Workspace-scoped service API tokens (issue #201). Admins can mint tokens that
 * authenticate as the workspace, list them, and revoke them. The plain secret is
 * shown once at creation and never again. Non-admins get a 403 from the API and
 * see the load error surfaced here.
 */
export function WorkspaceApiTokensPanel({ workspaceSlug }: WorkspaceApiTokensPanelProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<ApiTokenResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', description: '', expiresIn: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    workspaceService
      .listTokens(workspaceSlug)
      .then((res) => {
        if (!cancelled) setTokens(res.tokens ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setTokens([]);
        setLoadError(
          err?.response?.status === 403
            ? t(
                'settings.apiTokens.error.adminOnlyManage',
                'Only workspace admins can manage service tokens.',
              )
            : t('settings.apiTokens.error.load', 'Could not load service tokens.'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const openCreateModal = () => {
    setCreatedToken(null);
    setCreateError(null);
    setForm({ label: '', description: '', expiresIn: '' });
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreatedToken(null);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await workspaceService.createToken(workspaceSlug, {
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        expires_in: form.expiresIn || undefined,
      });
      setCreatedToken(res.token);
      const list = await workspaceService.listTokens(workspaceSlug);
      setTokens(list.tokens ?? []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setCreateError(
        status === 403
          ? t(
              'settings.apiTokens.error.adminOnlyCreate',
              'Only workspace admins can create service tokens.',
            )
          : t('settings.apiTokens.error.create', 'Could not create the token. Please try again.'),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setRevokingId(tokenId);
    setRevokeError(null);
    try {
      await workspaceService.revokeToken(workspaceSlug, tokenId);
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } catch {
      setRevokeError(
        t('settings.apiTokens.error.revoke', 'Could not revoke the token. Please try again.'),
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-(--txt-primary)">
            {t('settings.apiTokens.title', 'API Tokens')}
          </h2>
          <p className="mt-0.5 text-sm text-(--txt-secondary)">
            {t(
              'settings.apiTokens.description',
              'Generate service tokens that authenticate as this workspace so scripts and integrations can access it without a personal account.',
            )}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreateModal}>
          <IconPlus />
          {t('settings.apiTokens.add', 'Add workspace token')}
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-(--txt-tertiary)">
          {t('settings.apiTokens.loading', 'Loading tokens…')}
        </div>
      ) : loadError ? (
        <Card variant="outlined">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-(--txt-tertiary)">{loadError}</p>
          </CardContent>
        </Card>
      ) : tokens.length === 0 ? (
        <Card variant="outlined">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-(--txt-tertiary)">
              {t('settings.apiTokens.empty', 'No workspace tokens yet.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {revokeError && <p className="text-sm text-(--txt-danger-primary)">{revokeError}</p>}
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-(--txt-primary)">{token.label}</p>
                {token.description && (
                  <p className="text-xs text-(--txt-tertiary)">{token.description}</p>
                )}
                <p className="mt-0.5 text-xs text-(--txt-placeholder)">
                  {t('common.created', 'Created')} {formatRelativeTime(token.created_at)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="text-(--txt-danger-primary)"
                disabled={revokingId === token.id}
                onClick={() => handleRevoke(token.id)}
              >
                {revokingId === token.id
                  ? t('settings.apiTokens.revoking', 'Revoking…')
                  : t('settings.apiTokens.revoke', 'Revoke')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createModalOpen}
        onClose={closeCreateModal}
        title={
          createdToken
            ? t('settings.apiTokens.createdTitle', 'Token created')
            : t('settings.apiTokens.createTitle', 'Create workspace token')
        }
      >
        {createdToken ? (
          <div className="space-y-4">
            <p className="text-sm text-(--txt-secondary)">
              {t('settings.apiTokens.copyHint', 'Copy this token now; it will not be shown again.')}
            </p>
            <div className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 font-mono text-sm text-(--txt-primary) break-all">
              {createdToken}
            </div>
            <div className="flex justify-end">
              <Button onClick={closeCreateModal}>{t('common.done', 'Done')}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                {t('settings.apiTokens.titleLabel', 'Title')}
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t('settings.apiTokens.titleLabel', 'Title')}
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                {t('common.description', 'Description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('common.description', 'Description')}
                rows={2}
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                {t('settings.apiTokens.expiration', 'Expiration')}
              </label>
              <div className="relative max-w-xs">
                <select
                  value={form.expiresIn}
                  onChange={(e) => setForm((f) => ({ ...f, expiresIn: e.target.value }))}
                  className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
                >
                  <option value="">{t('settings.apiTokens.expires.never', 'Never expires')}</option>
                  <option value="7d">{t('settings.apiTokens.expires.1week', '1 week')}</option>
                  <option value="30d">{t('settings.apiTokens.expires.1month', '1 month')}</option>
                  <option value="90d">{t('settings.apiTokens.expires.3months', '3 months')}</option>
                  <option value="365d">{t('settings.apiTokens.expires.1year', '1 year')}</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </div>
            </div>
            {createError && <p className="text-sm text-(--txt-danger-primary)">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeCreateModal}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button disabled={!form.label.trim() || creating} onClick={handleCreate}>
                {creating
                  ? t('settings.apiTokens.generating', 'Generating…')
                  : t('settings.apiTokens.generate', 'Generate token')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

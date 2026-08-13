import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Textarea } from '@/v2/components/ui/textarea';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import { formatRelativeTime } from '../../../lib/settingsHelpers';
import type { ApiTokenResponse, CreateTokenRequest } from '../../../api/types';

interface ApiTokensPanelProps {
  title: string;
  description: string;
  addLabel: string;
  load: () => Promise<ApiTokenResponse[]>;
  create: (payload: CreateTokenRequest) => Promise<{ token: string }>;
  revoke: (tokenId: string) => Promise<void>;
  /** Lets the workspace scope turn a 403 into its own admins-only wording. */
  loadErrorMessage?: (error: unknown) => string;
}

/**
 * Token list + create/revoke, shared by the account's personal access tokens and
 * the workspace's service tokens: the two differ only in which service they call
 * and in how a failed load reads.
 */
export function ApiTokensPanel({
  title,
  description,
  addLabel,
  load,
  create,
  revoke,
  loadErrorMessage,
}: ApiTokensPanelProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<ApiTokenResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', description: '', expiresIn: 'never' });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTokens(await load());
    } catch (error) {
      setTokens([]);
      setLoadError(
        loadErrorMessage?.(error) ??
          apiErrorMessage(error, t('settings.tokens.loadError', 'Could not load tokens.')),
      );
    } finally {
      setLoading(false);
    }
  }, [load, loadErrorMessage, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDialog = () => {
    setCreatedToken(null);
    setCreateError(null);
    setCopied(false);
    setForm({ label: '', description: '', expiresIn: 'never' });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await create({
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        expires_in: form.expiresIn === 'never' ? undefined : form.expiresIn,
      });
      setCreatedToken(res.token);
      await refresh();
    } catch (error) {
      setCreateError(
        apiErrorMessage(error, t('settings.tokens.createError', 'Failed to create the token.')),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setRevokingId(tokenId);
    setRevokeError(null);
    try {
      await revoke(tokenId);
      setTokens((prev) => prev.filter((x) => x.id !== tokenId));
    } catch (error) {
      setRevokeError(
        apiErrorMessage(error, t('settings.tokens.revokeError', 'Failed to revoke the token.')),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
    } catch {
      /* Clipboard access can be denied; the token stays selectable on screen. */
    }
  };

  return (
    <SettingsPanel
      title={title}
      description={description}
      actions={
        <Button size="sm" onClick={openDialog}>
          <PlusIcon />
          {addLabel}
        </Button>
      }
    >
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {revokeError && <p className="text-destructive text-sm">{revokeError}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tokens.length === 0 && !loadError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.tokens.empty', 'No tokens yet.')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'settings.tokens.emptyHelp',
                'Tokens let external systems talk to Devlane on your behalf.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{token.label}</p>
                {token.description && (
                  <p className="text-muted-foreground truncate text-xs">{token.description}</p>
                )}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('settings.tokens.created', 'Created {{time}}', {
                    time: formatRelativeTime(token.created_at),
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                disabled={revokingId === token.id}
                onClick={() => void handleRevoke(token.id)}
              >
                {revokingId === token.id
                  ? t('settings.tokens.revoking', 'Revoking…')
                  : t('settings.tokens.revoke', 'Revoke')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {createdToken
                ? t('settings.tokens.createdTitle', 'Token created')
                : t('settings.tokens.createTitle', 'Create token')}
            </DialogTitle>
            <DialogDescription>
              {createdToken
                ? t(
                    'settings.tokens.copyWarning',
                    'Copy this token now; it will not be shown again.',
                  )
                : t(
                    'settings.tokens.createDescription',
                    'Name the token so you can recognise it later, and pick when it expires.',
                  )}
            </DialogDescription>
          </DialogHeader>

          {createdToken ? (
            <div className="flex flex-col gap-4">
              <div className="bg-muted flex items-start gap-2 rounded-md border px-3 py-2">
                <code className="min-w-0 flex-1 font-mono text-sm break-all">{createdToken}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => void copyToken()}
                  aria-label={t('common.copy', 'Copy')}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setDialogOpen(false)}>{t('common.done', 'Done')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <form
                id="create-token-v2-form"
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="token-label">{t('settings.tokens.form.title', 'Title')}</Label>
                  <Input
                    id="token-label"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-description">
                    {t('common.description', 'Description')}
                  </Label>
                  <Textarea
                    id="token-description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-expiry">
                    {t('settings.tokens.form.expiration', 'Expiration')}
                  </Label>
                  <Select
                    value={form.expiresIn}
                    onValueChange={(value) => setForm((f) => ({ ...f, expiresIn: value }))}
                  >
                    <SelectTrigger id="token-expiry" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">
                        {t('settings.tokens.expiry.never', 'Never expires')}
                      </SelectItem>
                      <SelectItem value="7d">
                        {t('settings.tokens.expiry.week', '1 week')}
                      </SelectItem>
                      <SelectItem value="30d">
                        {t('settings.tokens.expiry.month', '1 month')}
                      </SelectItem>
                      <SelectItem value="90d">
                        {t('settings.tokens.expiry.threeMonths', '3 months')}
                      </SelectItem>
                      <SelectItem value="365d">
                        {t('settings.tokens.expiry.year', '1 year')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createError && <p className="text-destructive text-sm">{createError}</p>}
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  form="create-token-v2-form"
                  disabled={creating || !form.label.trim()}
                >
                  {creating
                    ? t('common.saving', 'Saving…')
                    : t('settings.tokens.generate', 'Generate token')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

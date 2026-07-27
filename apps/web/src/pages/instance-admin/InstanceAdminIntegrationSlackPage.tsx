import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { InstanceAdminCopyRow } from '../../components/instance-admin';
import { instanceSettingsService } from '../../services/instanceService';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InstanceSlackAppSection } from '../../api/types';
import { useTranslation, Trans } from 'react-i18next';

const IconSlack = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 127 127" aria-hidden>
    <path
      d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z"
      fill="#E01E5A"
    />
    <path
      d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z"
      fill="#36C5F0"
    />
    <path
      d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z"
      fill="#2EB67D"
    />
    <path
      d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z"
      fill="#ECB22E"
    />
  </svg>
);

/**
 * Configure the Slack App credentials for the whole instance. Until this is
 * filled in, no workspace can connect Slack. Secrets (client secret, signing
 * secret) are encrypted at rest and never echoed back from the API — the form
 * clears the field after save and shows a *_set badge instead.
 */
export function InstanceAdminIntegrationSlackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Form state. Secrets default to empty; if the corresponding *_set is true,
  // the placeholder tells the user "(unchanged if blank)".
  const [clientID, setClientID] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clientSecretSet, setClientSecretSet] = useState(false);
  const [signingSecret, setSigningSecret] = useState('');
  const [signingSecretSet, setSigningSecretSet] = useState(false);

  // For the snapshot we compare against to compute isDirty.
  const [initial, setInitial] = useState({
    clientID: '',
  });

  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showSigningSecret, setShowSigningSecret] = useState(false);

  // URL the admin pastes into the Slack App's "OAuth & Permissions" settings.
  const [oauthRedirectBase, setOauthRedirectBase] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useDocumentTitle('Slack integration');

  const redirectUrl = useMemo(
    () => (oauthRedirectBase ? `${oauthRedirectBase}/auth/slack/callback` : ''),
    [oauthRedirectBase],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([instanceSettingsService.getSettings(), authService.getAuthConfig()])
      .then(([settings, cfg]) => {
        if (cancelled) return;
        const s = (settings.slack_app || {}) as InstanceSlackAppSection;
        setClientID(s.client_id ?? '');
        setClientSecretSet(s.client_secret_set ?? false);
        setSigningSecretSet(s.signing_secret_set ?? false);
        setInitial({
          clientID: s.client_id ?? '',
        });
        if (cfg.oauth_redirect_base) setOauthRedirectBase(cfg.oauth_redirect_base);
        else if (typeof window !== 'undefined') setOauthRedirectBase(window.location.origin);
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

  const isDirty =
    clientID !== initial.clientID || clientSecret.length > 0 || signingSecret.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const payload: InstanceSlackAppSection = {
      client_id: clientID.trim(),
    };
    if (clientSecret.trim()) payload.client_secret = clientSecret.trim();
    if (signingSecret.trim()) payload.signing_secret = signingSecret.trim();

    instanceSettingsService
      .updateSection('slack_app', payload as import('../../api/types').InstanceSettingSectionValue)
      .then((res) => {
        const v = (res.value || {}) as InstanceSlackAppSection;
        setClientID(v.client_id ?? '');
        setClientSecretSet(v.client_secret_set ?? false);
        setSigningSecretSet(v.signing_secret_set ?? false);
        setInitial({
          clientID: v.client_id ?? '',
        });
        // Clear local secret fields — they've been saved.
        setClientSecret('');
        setSigningSecret('');
        setSuccess('Slack App settings saved. Workspaces can now connect.');
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-(--bg-layer-1)" />
        <div className="h-4 w-96 rounded bg-(--bg-layer-1)" />
        <div className="h-10 w-full rounded bg-(--bg-layer-1)" />
        <div className="h-10 w-full rounded bg-(--bg-layer-1)" />
        <div className="h-32 w-full rounded bg-(--bg-layer-1)" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center text-(--txt-icon-secondary)">
          <IconSlack />
        </span>
        <div>
          <h1 className="text-base font-semibold text-(--txt-primary)">
            {t('instanceAdmin.slack.title', 'Slack App')}
          </h1>
          <p className="text-xs text-(--txt-secondary)">
            {t(
              'instanceAdmin.slack.description',
              'Register a Slack App and paste its credentials here. The App is the bridge that lets Devlane exchange notifications, synchronize activity, and enable Slack-powered workflows across all workspaces on this instance.',
            )}
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-(--txt-danger-primary)">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <div className="mb-6 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4 text-xs text-(--txt-secondary)">
        <p className="font-medium text-(--txt-primary)">
          {t('instanceAdmin.slack.quickSetup', 'First time? Quick setup:')}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <Trans i18nKey="instanceAdmin.slack.step1">
              Open{' '}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--txt-accent) hover:underline"
              >
                Slack API → Your Apps → Create New App
              </a>
              .
            </Trans>
          </li>

          <li>
            <Trans i18nKey="instanceAdmin.slack.step2">
              {' '}
              Under <span className="font-mono">OAuth &amp; Permissions</span>, add the Redirect URL
              provided below.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="instanceAdmin.slack.step3">
              Add the required bot scopes: <span className="font-mono">chat:write</span>,{' '}
              <span className="font-mono">channels:read</span>,{' '}
              <span className="font-mono">groups:read</span>.
            </Trans>
          </li>
          <li>{t('instanceAdmin.slack.step4', 'Install the app in your Slack workspace.')}</li>
          <li>
            <Trans i18nKey="instanceAdmin.slack.step5">
              Copy the Client ID, Client Secret, and Signing Secret from{' '}
              <span className="font-mono">Basic Information</span> into Devlane.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="instanceAdmin.slack.step6">
              Still need help? See the{' '}
              <a
                href="https://docs.slack.dev/quickstart/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--txt-accent) hover:underline"
              >
                Slack Quickstart Guide
              </a>
              .
            </Trans>
          </li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            {t('instanceAdmin.slack.credentialsTitle', 'Credentials from your Slack App')}
          </h2>
          <div className="space-y-3">
            <Input
              label="Client ID"
              value={clientID}
              onChange={(e) => setClientID(e.target.value)}
              autoComplete="off"
              placeholder="e.g. 1234567890.1234567890123"
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              <Trans i18nKey="instanceAdmin.slack.clientIdHint">
                Found under <span className="font-mono">Basic Information → App Credentials</span>.
                This value is public and safe to share.
              </Trans>
            </p>

            <div className="relative">
              <Input
                label="Client secret"
                type={showClientSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={clientSecretSet ? '(unchanged if left blank)' : 'Enter client secret'}
              />
              <button
                type="button"
                onClick={() => setShowClientSecret(!showClientSecret)}
                className="absolute top-7 right-2 p-1 text-(--txt-icon-tertiary) hover:text-(--txt-icon-secondary)"
                aria-label={showClientSecret ? 'Hide client secret' : 'Show client secret'}
              >
                {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-(--txt-tertiary)">
              <Trans i18nKey="instanceAdmin.slack.clientSecretHint">
                Sent with the Client ID during the OAuth token exchange (
                <span className="font-mono">oauth.v2.access</span>). Stored encrypted at rest.
              </Trans>
            </p>

            <div className="relative">
              <Input
                label="Signing secret"
                type={showSigningSecret ? 'text' : 'password'}
                value={signingSecret}
                onChange={(e) => setSigningSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={
                  signingSecretSet ? '(unchanged if left blank)' : 'Enter signing secret'
                }
              />
              <button
                type="button"
                onClick={() => setShowSigningSecret(!showSigningSecret)}
                className="absolute top-7 right-2 p-1 text-(--txt-icon-tertiary) hover:text-(--txt-icon-secondary)"
                aria-label={showSigningSecret ? 'Hide signing secret' : 'Show signing secret'}
              >
                {showSigningSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-(--txt-tertiary)">
              <Trans i18nKey="instanceAdmin.slack.signingSecretHint">
                Used to verify that inbound requests genuinely come from Slack. Stored encrypted at
                rest (set <span className="font-mono">INSTANCE_ENCRYPTION_KEY</span> on the API).
              </Trans>
            </p>
          </div>
        </div>

        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            {t('instanceAdmin.slack.urlsTitle', 'Devlane URLs to paste into the Slack App')}
          </h2>
          <div className="space-y-3">
            <InstanceAdminCopyRow
              label="OAuth Redirect URL"
              hint="Paste this into the Slack App's OAuth & Permissions → Redirect URLs field."
              value={redirectUrl}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            onClick={() => void navigate('/instance-admin/integrations')}
            className="bg-transparent text-(--txt-secondary) shadow-none hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          >
            {t('instanceAdmin.slack.goBack', 'Go back')}
          </Button>
        </div>
      </form>
    </div>
  );
}

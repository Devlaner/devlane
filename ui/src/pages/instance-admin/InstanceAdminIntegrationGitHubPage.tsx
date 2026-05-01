import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { InstanceAdminCopyRow } from '../../components/instance-admin';
import { instanceSettingsService } from '../../services/instanceService';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceGitHubAppSection } from '../../api/types';

const IconGitHub = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

/**
 * Configure the GitHub App credentials for the whole instance. Until this is
 * filled in, no workspace can connect GitHub. Secrets (client secret, private
 * key, webhook secret) are encrypted at rest and never echoed back from the
 * API — the form clears the field after save and shows a *_set badge instead.
 */
export function InstanceAdminIntegrationGitHubPage() {
  const navigate = useNavigate();

  // Form state. Secrets default to empty; if the corresponding *_set is true,
  // the placeholder tells the user "(unchanged if blank)".
  const [appID, setAppID] = useState('');
  const [appName, setAppName] = useState('');
  const [clientID, setClientID] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clientSecretSet, setClientSecretSet] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [privateKeySet, setPrivateKeySet] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookSecretSet, setWebhookSecretSet] = useState(false);

  // For the snapshot we compare against to compute isDirty.
  const [initial, setInitial] = useState({
    appID: '',
    appName: '',
    clientID: '',
  });

  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // URLs we need to display (admin pastes into the App's settings on github.com).
  const [oauthRedirectBase, setOauthRedirectBase] = useState('');
  const [oauthJsOrigin, setOauthJsOrigin] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const callbackUrl = useMemo(
    () => (oauthRedirectBase ? `${oauthRedirectBase}/auth/github-app/callback` : ''),
    [oauthRedirectBase],
  );
  const webhookUrl = useMemo(
    () => (oauthRedirectBase ? `${oauthRedirectBase}/webhooks/github` : ''),
    [oauthRedirectBase],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([instanceSettingsService.getSettings(), authService.getAuthConfig()])
      .then(([settings, cfg]) => {
        if (cancelled) return;
        const g = (settings.github_app || {}) as InstanceGitHubAppSection;
        setAppID(g.app_id ?? '');
        setAppName(g.app_name ?? '');
        setClientID(g.client_id ?? '');
        setClientSecretSet(g.client_secret_set ?? false);
        setPrivateKeySet(g.private_key_set ?? false);
        setWebhookSecretSet(g.webhook_secret_set ?? false);
        setInitial({
          appID: g.app_id ?? '',
          appName: g.app_name ?? '',
          clientID: g.client_id ?? '',
        });
        if (cfg.oauth_redirect_base) setOauthRedirectBase(cfg.oauth_redirect_base);
        if (cfg.oauth_js_origin) {
          setOauthJsOrigin(cfg.oauth_js_origin);
        } else if (typeof window !== 'undefined') {
          setOauthJsOrigin(window.location.origin);
        }
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
    appID !== initial.appID ||
    appName !== initial.appName ||
    clientID !== initial.clientID ||
    clientSecret.length > 0 ||
    privateKey.length > 0 ||
    webhookSecret.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const payload: InstanceGitHubAppSection = {
      app_id: appID.trim(),
      app_name: appName.trim(),
      client_id: clientID.trim(),
    };
    if (clientSecret.trim()) payload.client_secret = clientSecret.trim();
    if (privateKey.trim()) payload.private_key = privateKey;
    if (webhookSecret.trim()) payload.webhook_secret = webhookSecret.trim();

    instanceSettingsService
      .updateSection('github_app', payload as import('../../api/types').InstanceSettingSectionValue)
      .then((res) => {
        const v = (res.value || {}) as InstanceGitHubAppSection;
        setAppID(v.app_id ?? '');
        setAppName(v.app_name ?? '');
        setClientID(v.client_id ?? '');
        setClientSecretSet(v.client_secret_set ?? false);
        setPrivateKeySet(v.private_key_set ?? false);
        setWebhookSecretSet(v.webhook_secret_set ?? false);
        setInitial({
          appID: v.app_id ?? '',
          appName: v.app_name ?? '',
          clientID: v.client_id ?? '',
        });
        // Clear local secret fields — they've been saved.
        setClientSecret('');
        setPrivateKey('');
        setWebhookSecret('');
        setSuccess('GitHub App settings saved. Workspaces can now connect.');
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
          <IconGitHub />
        </span>
        <div>
          <h1 className="text-base font-semibold text-(--txt-primary)">GitHub App</h1>
          <p className="text-xs text-(--txt-secondary)">
            Register a GitHub App and paste its credentials here. The App is the bridge that lets
            Devlane sync pull requests with issues across all workspaces on this instance.
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-(--txt-danger-primary)">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <div className="mb-6 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4 text-xs text-(--txt-secondary)">
        <p className="font-medium text-(--txt-primary)">First time? Quick setup:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Open{' '}
            <a
              href="https://github.com/settings/apps/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--txt-accent) hover:underline"
            >
              GitHub Settings → Developer settings → GitHub Apps → New GitHub App
            </a>
            .
          </li>
          <li>Set the URLs and webhook from the boxes below.</li>
          <li>
            Permissions: <span className="font-mono">Contents: Read</span>,{' '}
            <span className="font-mono">Issues: R/W</span>,{' '}
            <span className="font-mono">Pull requests: R/W</span>,{' '}
            <span className="font-mono">Metadata: Read</span>.
          </li>
          <li>
            Subscribe to events: <span className="font-mono">Pull request</span>,{' '}
            <span className="font-mono">Push</span>,{' '}
            <span className="font-mono">Issue comment</span>,{' '}
            <span className="font-mono">Installation</span>,{' '}
            <span className="font-mono">Installation repositories</span>.
          </li>
          <li>
            After creating, copy the App ID, App slug, Client ID, and generate a Client Secret +
            Private key (.pem) + Webhook secret. Paste them here.
          </li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            Credentials from your GitHub App
          </h2>
          <div className="space-y-3">
            <Input
              label="App ID"
              value={appID}
              onChange={(e) => setAppID(e.target.value)}
              autoComplete="off"
              placeholder="e.g. 1234567"
              inputMode="numeric"
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              The numeric App ID shown at the top of your GitHub App settings page.
            </p>

            <Input
              label="App slug"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              autoComplete="off"
              placeholder="e.g. devlane-acme"
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              The URL-safe slug from your App's public page,{' '}
              <span className="font-mono">github.com/apps/&lt;slug&gt;</span>. Used to build the
              install link.
            </p>

            <Input
              label="Client ID"
              value={clientID}
              onChange={(e) => setClientID(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Iv1.abc123def456"
            />

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
              Generate a fresh client secret in your App's settings under "Client secrets".
            </p>

            <div className="relative">
              <Input
                label="Webhook secret"
                type={showWebhookSecret ? 'text' : 'password'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={
                  webhookSecretSet ? '(unchanged if left blank)' : 'Enter webhook secret'
                }
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute top-7 right-2 p-1 text-(--txt-icon-tertiary) hover:text-(--txt-icon-secondary)"
                aria-label={showWebhookSecret ? 'Hide webhook secret' : 'Show webhook secret'}
              >
                {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-(--txt-tertiary)">
              Use the same secret you set in the App's "Webhook" → "Webhook secret" field. Devlane
              uses it to verify each delivery's HMAC signature.
            </p>

            <label className="block text-xs font-medium text-(--txt-secondary)">
              Private key (PEM)
              <div className="relative mt-0.5">
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  spellCheck={false}
                  rows={showPrivateKey ? 8 : 4}
                  placeholder={
                    privateKeySet
                      ? '(unchanged if left blank)'
                      : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n'
                  }
                  className={`block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 font-mono text-xs text-(--txt-primary) focus:outline-none ${
                    showPrivateKey ? '' : '[-webkit-text-security:disc] [text-security:disc]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="absolute right-2 top-2 p-1 text-(--txt-icon-tertiary) hover:text-(--txt-icon-secondary)"
                  aria-label={showPrivateKey ? 'Hide private key' : 'Show private key'}
                >
                  {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <p className="text-[11px] text-(--txt-tertiary)">
              Paste the entire <span className="font-mono">.pem</span> downloaded from your App's
              "Generate a private key" button. Stored encrypted at rest (set{' '}
              <span className="font-mono">INSTANCE_ENCRYPTION_KEY</span> on the API).
            </p>
          </div>
        </div>

        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            Devlane URLs to paste into the GitHub App
          </h2>
          <div className="space-y-3">
            <InstanceAdminCopyRow
              label="Homepage URL"
              hint="Paste this into the GitHub App Homepage URL field."
              value={oauthJsOrigin}
            />
            <InstanceAdminCopyRow
              label="Setup URL / Callback URL"
              hint="Paste this into the GitHub App Setup URL and User authorization callback URL fields. Tick 'Redirect on update'."
              value={callbackUrl}
            />
            <InstanceAdminCopyRow
              label="Webhook URL"
              hint="Paste this into the GitHub App Webhook URL field. Make sure 'Active' is on."
              value={webhookUrl}
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
            Go back
          </Button>
        </div>
      </form>
    </div>
  );
}

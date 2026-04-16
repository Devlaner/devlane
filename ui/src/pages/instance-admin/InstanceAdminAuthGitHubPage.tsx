import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/ui';
import { InstanceAdminCopyRow, InstanceAdminToggleSwitch } from '../../components/instance-admin';
import { instanceSettingsService } from '../../services/instanceService';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceAuthSection, InstanceOAuthSection } from '../../api/types';
import { Eye, EyeOff } from 'lucide-react';

const IconGitHub = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export function InstanceAdminAuthGitHubPage() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretSet, setSecretSet] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const [initialClientId, setInitialClientId] = useState('');
  const [initialSecret, setInitialSecret] = useState('');
  const [initialEnabled, setInitialEnabled] = useState(false);

  const [oauthRedirectBase, setOauthRedirectBase] = useState('');
  const [oauthJsOrigin, setOauthJsOrigin] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([instanceSettingsService.getSettings(), authService.getAuthConfig()])
      .then(([settings, cfg]) => {
        if (cancelled) return;
        const o = (settings.oauth || {}) as InstanceOAuthSection;
        const a = (settings.auth || {}) as InstanceAuthSection;
        setClientId(o.github_client_id ?? '');
        setInitialClientId(o.github_client_id ?? '');
        setSecretSet(o.github_client_secret_set ?? false);
        if (o.github_client_secret) {
          setClientSecret(o.github_client_secret);
          setInitialSecret(o.github_client_secret);
        }
        setEnabled(a.github ?? false);
        setInitialEnabled(a.github ?? false);
        if (cfg.oauth_redirect_base) setOauthRedirectBase(cfg.oauth_redirect_base);
        if (cfg.oauth_js_origin) setOauthJsOrigin(cfg.oauth_js_origin);
        else if (typeof window !== 'undefined') setOauthJsOrigin(window.location.origin);
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

  const callbackUrl = oauthRedirectBase ? `${oauthRedirectBase}/auth/github/callback/` : '';

  const isDirty =
    clientId !== initialClientId || clientSecret !== initialSecret || enabled !== initialEnabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const oauthPayload: Record<string, unknown> = {
      github_client_id: clientId.trim(),
    };
    if (clientSecret.trim()) {
      oauthPayload.github_client_secret = clientSecret.trim();
    }

    const authPayload = { github: enabled };

    Promise.all([
      instanceSettingsService.updateSection('oauth', oauthPayload),
      instanceSettingsService.updateSection('auth', authPayload),
    ])
      .then(([oauthRes]) => {
        setSuccess('Your GitHub authentication is configured. You should test it now.');
        if (oauthRes.value) {
          const v = oauthRes.value as InstanceOAuthSection;
          setClientId(v.github_client_id ?? '');
          setInitialClientId(v.github_client_id ?? '');
          setSecretSet(v.github_client_secret_set ?? false);
          if (v.github_client_secret) {
            setClientSecret(v.github_client_secret);
            setInitialSecret(v.github_client_secret);
          }
        }
        setInitialEnabled(enabled);
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
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center text-(--txt-icon-secondary)">
            <IconGitHub />
          </span>
          <div>
            <h1 className="text-base font-semibold text-(--txt-primary)">GitHub</h1>
            <p className="text-xs text-(--txt-secondary)">
              Allow members to login or sign up for Devlane with their GitHub accounts.
            </p>
          </div>
        </div>
        <InstanceAdminToggleSwitch
          checked={enabled}
          onChange={(v) => setEnabled(v)}
          disabled={saving}
        />
      </div>

      {error && <p className="mb-4 text-sm text-(--txt-danger-primary)">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            GitHub-provided details for Devlane
          </h2>
          <div className="space-y-3">
            <Input
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              placeholder="Your client ID from your GitHub OAuth App."
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              Your client ID lives in your GitHub OAuth App settings.{' '}
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--txt-accent) hover:underline"
              >
                Learn more
              </a>
            </p>
            <div className="relative">
              <Input
                label="Client secret"
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={secretSet ? '(unchanged if left blank)' : 'Enter client secret'}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute top-7 right-2 p-1 text-(--txt-icon-tertiary) hover:text-(--txt-icon-secondary)"
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-(--txt-tertiary)">
              Your client secret should also be in your GitHub OAuth App settings.{' '}
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--txt-accent) hover:underline"
              >
                Learn more
              </a>
            </p>
          </div>
        </div>

        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            Devlane-provided details for GitHub
          </h2>
          <div className="space-y-3">
            <InstanceAdminCopyRow
              label="Homepage URL"
              hint="Paste this into your GitHub OAuth App Homepage URL field."
              value={oauthJsOrigin}
            />
            <InstanceAdminCopyRow
              label="Authorization callback URL"
              hint="Paste this into your GitHub OAuth App Authorization callback URL field."
              value={callbackUrl}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            onClick={() => void navigate('/instance-admin/authentication')}
            className="bg-transparent text-(--txt-secondary) shadow-none hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          >
            Go back
          </Button>
        </div>
      </form>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/ui';
import { InstanceAdminCopyRow, InstanceAdminToggleSwitch } from '../../components/instance-admin';
import { instanceSettingsService } from '../../services/instanceService';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceAuthSection, InstanceOAuthSection } from '../../api/types';
import { Eye, EyeOff } from 'lucide-react';

const IconGitLab = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#E24329" aria-hidden>
    <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.252.84 4.116 1.263L1.452 9.449.11 13.587a.924.924 0 00.331 1.023L12 23.054l11.559-8.444a.92.92 0 00.396-1.023z" />
  </svg>
);

export function InstanceAdminAuthGitLabPage() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [gitlabHost, setGitlabHost] = useState('');
  const [secretSet, setSecretSet] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const [initialClientId, setInitialClientId] = useState('');
  const [initialSecret, setInitialSecret] = useState('');
  const [initialHost, setInitialHost] = useState('');
  const [initialEnabled, setInitialEnabled] = useState(false);

  const [oauthRedirectBase, setOauthRedirectBase] = useState('');

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
        setClientId(o.gitlab_client_id ?? '');
        setInitialClientId(o.gitlab_client_id ?? '');
        setGitlabHost(o.gitlab_host ?? '');
        setInitialHost(o.gitlab_host ?? '');
        setSecretSet(o.gitlab_client_secret_set ?? false);
        if (o.gitlab_client_secret) {
          setClientSecret(o.gitlab_client_secret);
          setInitialSecret(o.gitlab_client_secret);
        }
        setEnabled(a.gitlab ?? false);
        setInitialEnabled(a.gitlab ?? false);
        if (cfg.oauth_redirect_base) setOauthRedirectBase(cfg.oauth_redirect_base);
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

  const callbackUrl = oauthRedirectBase ? `${oauthRedirectBase}/auth/gitlab/callback/` : '';

  const isDirty =
    clientId !== initialClientId ||
    clientSecret !== initialSecret ||
    gitlabHost !== initialHost ||
    enabled !== initialEnabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const oauthPayload: Record<string, unknown> = {
      gitlab_client_id: clientId.trim(),
      gitlab_host: gitlabHost.trim(),
    };
    if (clientSecret.trim()) {
      oauthPayload.gitlab_client_secret = clientSecret.trim();
    }

    const authPayload = { gitlab: enabled };

    Promise.all([
      instanceSettingsService.updateSection('oauth', oauthPayload),
      instanceSettingsService.updateSection('auth', authPayload),
    ])
      .then(([oauthRes]) => {
        setSuccess('Your GitLab authentication is configured. You should test it now.');
        if (oauthRes.value) {
          const v = oauthRes.value as InstanceOAuthSection;
          setClientId(v.gitlab_client_id ?? '');
          setInitialClientId(v.gitlab_client_id ?? '');
          setGitlabHost(v.gitlab_host ?? '');
          setInitialHost(v.gitlab_host ?? '');
          setSecretSet(v.gitlab_client_secret_set ?? false);
          if (v.gitlab_client_secret) {
            setClientSecret(v.gitlab_client_secret);
            setInitialSecret(v.gitlab_client_secret);
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
            <IconGitLab />
          </span>
          <div>
            <h1 className="text-base font-semibold text-(--txt-primary)">GitLab</h1>
            <p className="text-xs text-(--txt-secondary)">
              Allow members to log in or sign up for Devlane with their GitLab accounts.
            </p>
          </div>
        </div>
        <InstanceAdminToggleSwitch checked={enabled} onChange={(v) => setEnabled(v)} disabled={saving} />
      </div>

      {error && <p className="mb-4 text-sm text-(--txt-danger-primary)">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            GitLab-provided details for Devlane
          </h2>
          <div className="space-y-3">
            <Input
              label="Host URL (optional)"
              value={gitlabHost}
              onChange={(e) => setGitlabHost(e.target.value)}
              autoComplete="off"
              placeholder="https://gitlab.com"
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              Leave blank for gitlab.com. Set your self-hosted GitLab URL for on-premises
              installations.
            </p>
            <Input
              label="Application ID (Client ID)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              placeholder="Your application ID from GitLab."
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              Your application ID lives in your GitLab application settings.{' '}
              <a
                href="https://gitlab.com/-/user_settings/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--txt-accent) hover:underline"
              >
                Learn more
              </a>
            </p>
            <div className="relative">
              <Input
                label="Secret"
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={secretSet ? '(unchanged if left blank)' : 'Enter secret'}
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
              Your secret should also be in your GitLab application settings.{' '}
              <a
                href="https://gitlab.com/-/user_settings/applications"
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
            Devlane-provided details for GitLab
          </h2>
          <div className="space-y-3">
            <InstanceAdminCopyRow
              label="Redirect URI"
              hint="Paste this into your GitLab application Redirect URI field."
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

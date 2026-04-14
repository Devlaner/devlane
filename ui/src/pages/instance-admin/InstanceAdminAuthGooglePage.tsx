import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceAuthSection, InstanceOAuthSection } from '../../api/types';
import { Copy, Eye, EyeOff } from 'lucide-react';

function CopyRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-(--txt-secondary)">{label}</label>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-(--txt-accent) hover:bg-(--bg-subtle) disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <input
        readOnly
        value={value}
        className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5 font-mono text-xs text-(--txt-primary)"
        aria-label={label}
      />
      <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">{hint}</p>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-(--neutral-400) has-[:checked]:bg-(--brand-default)">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

const IconGoogle = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function InstanceAdminAuthGooglePage() {
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
        setClientId(o.google_client_id ?? '');
        setInitialClientId(o.google_client_id ?? '');
        setSecretSet(o.google_client_secret_set ?? false);
        if (o.google_client_secret) {
          setClientSecret(o.google_client_secret);
          setInitialSecret(o.google_client_secret);
        }
        setEnabled(a.google ?? false);
        setInitialEnabled(a.google ?? false);
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

  const callbackUrl = oauthRedirectBase ? `${oauthRedirectBase}/auth/google/callback/` : '';

  const isDirty =
    clientId !== initialClientId || clientSecret !== initialSecret || enabled !== initialEnabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const oauthPayload: Record<string, unknown> = {
      google_client_id: clientId.trim(),
    };
    if (clientSecret.trim()) {
      oauthPayload.google_client_secret = clientSecret.trim();
    }

    const authPayload = { google: enabled };

    Promise.all([
      instanceSettingsService.updateSection('oauth', oauthPayload),
      instanceSettingsService.updateSection('auth', authPayload),
    ])
      .then(([oauthRes]) => {
        setSuccess('Your Google authentication is configured. You should test it now.');
        if (oauthRes.value) {
          const v = oauthRes.value as InstanceOAuthSection;
          setClientId(v.google_client_id ?? '');
          setInitialClientId(v.google_client_id ?? '');
          setSecretSet(v.google_client_secret_set ?? false);
          if (v.google_client_secret) {
            setClientSecret(v.google_client_secret);
            setInitialSecret(v.google_client_secret);
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
            <IconGoogle />
          </span>
          <div>
            <h1 className="text-base font-semibold text-(--txt-primary)">Google</h1>
            <p className="text-xs text-(--txt-secondary)">
              Allow members to login or sign up for Devlane with their Google accounts.
            </p>
          </div>
        </div>
        <ToggleSwitch checked={enabled} onChange={(v) => setEnabled(v)} disabled={saving} />
      </div>

      {error && <p className="mb-4 text-sm text-(--txt-danger-primary)">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-4">
          <h2 className="mb-4 text-sm font-semibold text-(--txt-primary)">
            Google-provided details for Devlane
          </h2>
          <div className="space-y-3">
            <Input
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              placeholder="Your client ID lives in your Google API Console."
            />
            <p className="text-[11px] text-(--txt-tertiary)">
              Your client ID lives in your Google API Console.{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
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
              Your client secret should also be in your Google API Console.{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
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
            Devlane-provided details for Google
          </h2>
          <div className="space-y-3">
            <CopyRow
              label="Origin URL"
              hint="We will auto-generate this. Paste this into your Authorized JavaScript origins field. For this OAuth client here."
              value={oauthJsOrigin}
            />
            <CopyRow
              label="Callback URI"
              hint="We will auto-generate this. Paste this into your Authorized Redirect URI field. For this OAuth client here."
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

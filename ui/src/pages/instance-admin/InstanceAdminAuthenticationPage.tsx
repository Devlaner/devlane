import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Skeleton } from '../../components/ui';
import { InstanceAdminToggleSwitch } from '../../components/instance-admin';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceAuthSection, InstanceOAuthSection } from '../../api/types';

const IconEnvelope = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconKey = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
    <path d="m21 2-9.6 9.6" />
    <path d="M15.5 7.5a5 5 0 1 1-7 7" />
  </svg>
);
const IconGoogle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
const IconGitHub = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);
const IconGitLab = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.252.84 4.116 1.263L1.452 9.449.11 13.587a.924.924 0 00.331 1.023L12 23.054l11.559-8.444a.92.92 0 00.396-1.023z" />
  </svg>
);

type OAuthProviderKey = 'google' | 'github' | 'gitlab';

interface AuthMode {
  key: keyof InstanceAuthSection;
  Icon: () => React.ReactElement;
  name: string;
  desc: string;
  isOAuth?: boolean;
  oauthKey?: OAuthProviderKey;
  editPath?: string;
}

const AUTH_MODES: AuthMode[] = [
  {
    key: 'magic_code',
    Icon: IconEnvelope,
    name: 'Unique codes',
    desc: 'Log in or sign up for Devlane using codes sent via email. You need to have set up SMTP to use this method.',
  },
  {
    key: 'password',
    Icon: IconKey,
    name: 'Passwords',
    desc: 'Allow members to create accounts with passwords and use it with their email addresses to sign in.',
  },
  {
    key: 'google',
    Icon: IconGoogle,
    name: 'Google',
    desc: 'Allow members to log in or sign up for Devlane with their Google accounts.',
    isOAuth: true,
    oauthKey: 'google',
    editPath: '/instance-admin/authentication/google',
  },
  {
    key: 'github',
    Icon: IconGitHub,
    name: 'GitHub',
    desc: 'Allow members to log in or sign up for Devlane with their GitHub accounts.',
    isOAuth: true,
    oauthKey: 'github',
    editPath: '/instance-admin/authentication/github',
  },
  {
    key: 'gitlab',
    Icon: IconGitLab,
    name: 'GitLab',
    desc: 'Allow members to log in or sign up for Devlane with their GitLab accounts.',
    isOAuth: true,
    oauthKey: 'gitlab',
    editPath: '/instance-admin/authentication/gitlab',
  },
];

function isOAuthConfigured(oauthKey: OAuthProviderKey, oauth: InstanceOAuthSection): boolean {
  switch (oauthKey) {
    case 'google':
      return !!(oauth.google_client_id && oauth.google_client_secret_set);
    case 'github':
      return !!(oauth.github_client_id && oauth.github_client_secret_set);
    case 'gitlab':
      return !!(oauth.gitlab_client_id && oauth.gitlab_client_secret_set);
    default:
      return false;
  }
}

function countEnabledAuthMethods(auth: InstanceAuthSection): number {
  let n = 0;
  if (auth.magic_code) n++;
  if (auth.password) n++;
  if (auth.google) n++;
  if (auth.github) n++;
  if (auth.gitlab) n++;
  return n;
}

export function InstanceAdminAuthenticationPage() {
  const [auth, setAuth] = useState<InstanceAuthSection>({
    allow_public_signup: true,
    magic_code: true,
    password: true,
    google: false,
    github: false,
    gitlab: false,
  });
  const [oauth, setOauth] = useState<InstanceOAuthSection>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const a = (settings.auth || {}) as InstanceAuthSection;
        setAuth({
          allow_public_signup: a.allow_public_signup ?? true,
          magic_code: a.magic_code ?? true,
          password: a.password ?? true,
          google: a.google ?? false,
          github: a.github ?? false,
          gitlab: a.gitlab ?? false,
        });
        const o = (settings.oauth || {}) as InstanceOAuthSection;
        setOauth(o);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = (key: keyof InstanceAuthSection, value: boolean) => {
    if (!value && key !== 'allow_public_signup') {
      if (countEnabledAuthMethods(auth) <= 1) {
        setError(
          'At least one authentication method must remain enabled. Please enable another method before disabling this one.',
        );
        return;
      }
    }
    const prev = auth;
    const next = { ...auth, [key]: value };
    setAuth(next);
    setError('');
    setSaving(true);
    instanceSettingsService
      .updateSection('auth', next)
      .then(() => {})
      .catch((err) => {
        setError(getApiErrorMessage(err));
        setAuth(prev);
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div>
          <Skeleton className="h-4 w-80" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-xl" />
        </div>
        <section className="flex items-start justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </section>
        <section>
          <Skeleton className="mb-3 h-3 w-48" />
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-full max-w-xs" />
                  </div>
                </div>
                <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          Manage authentication modes for your instance
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          Configure authentication modes for your team and restrict sign-ups to be invite only.
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section className="flex items-start justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3">
        <div>
          <p className="text-xs font-medium text-(--txt-primary)">
            Allow anyone to sign up even without an invite
          </p>
          <p className="mt-0.5 text-xs text-(--txt-secondary)">
            Toggling this off will only let users sign up when they are invited.
          </p>
        </div>
        <InstanceAdminToggleSwitch
          checked={auth.allow_public_signup ?? true}
          onChange={(v) => handleToggle('allow_public_signup', v)}
          disabled={saving}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
          Available authentication modes
        </h2>
        <ul className="space-y-2">
          {AUTH_MODES.map((item) => {
            const Icon = item.Icon;
            const on = auth[item.key] ?? false;
            const configured =
              item.isOAuth && item.oauthKey ? isOAuthConfigured(item.oauthKey, oauth) : false;

            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex shrink-0 text-(--txt-icon-tertiary) [&_svg]:size-4 [&_svg]:shrink-0">
                    <Icon />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-(--txt-primary)">{item.name}</p>
                    <p className="text-xs text-(--txt-secondary)">{item.desc}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.isOAuth && item.editPath && (
                    <>
                      <Link
                        to={item.editPath}
                        className={
                          configured
                            ? 'rounded px-2.5 py-1 text-xs font-medium text-(--txt-accent) hover:bg-(--bg-accent-subtle)'
                            : 'inline-flex items-center gap-1.5 rounded border border-(--border-subtle) px-2.5 py-1 text-xs font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)'
                        }
                      >
                        {configured ? (
                          'Edit'
                        ) : (
                          <>
                            <Settings2 className="h-3.5 w-3.5" />
                            Configure
                          </>
                        )}
                      </Link>
                      <span
                        className="inline-flex"
                        title={
                          !configured && !on
                            ? 'Add OAuth client credentials on the configuration page before enabling this provider.'
                            : on && !configured
                              ? 'OAuth credentials are missing or invalid. Open Configure to fix or turn this off.'
                              : undefined
                        }
                      >
                        <InstanceAdminToggleSwitch
                          checked={on}
                          onChange={(v) => handleToggle(item.key, v)}
                          disabled={saving || (!configured && !on)}
                        />
                      </span>
                    </>
                  )}
                  {!item.isOAuth && (
                    <InstanceAdminToggleSwitch
                      checked={on}
                      onChange={(v) => handleToggle(item.key, v)}
                      disabled={saving}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Skeleton } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InstanceGitHubAppSection, InstanceSlackAppSection } from '../../api/types';

const IconGitHub = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const IconSlack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.958a2.528 2.528 0 0 1 2.523 2.52 2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zM15.165 17.687a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

interface ProviderRow {
  id: 'github' | 'slack';
  name: string;
  desc: string;
  Icon: () => React.ReactElement;
  editPath: string;
  configured: boolean;
}

function isGitHubAppConfigured(s: InstanceGitHubAppSection): boolean {
  return !!(
    s.app_id &&
    s.app_name &&
    s.client_id &&
    s.client_secret_set &&
    s.private_key_set &&
    s.webhook_secret_set
  );
}

function isSlackAppConfigured(s: InstanceSlackAppSection): boolean {
  return !!(s.client_id && s.client_secret_set);
}

export function InstanceAdminIntegrationsPage() {
  const { t } = useTranslation();
  const [github, setGithub] = useState<InstanceGitHubAppSection>({});
  const [slack, setSlack] = useState<InstanceSlackAppSection>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useDocumentTitle(t('instanceAdmin.integrations.documentTitle', 'Integrations'));

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const g = (settings.github_app || {}) as InstanceGitHubAppSection;
        setGithub(g);
        const sl = (settings.slack_app || {}) as InstanceSlackAppSection;
        setSlack(sl);
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

  const providers: ProviderRow[] = [
    {
      id: 'github',
      name: 'GitHub',
      desc: t(
        'instanceAdmin.integrations.github.desc',
        'Two-way sync between GitHub pull requests and Devlane issues, plus PR ↔ issue auto-linking via branch names and commit messages.',
      ),
      Icon: IconGitHub,
      editPath: '/instance-admin/integrations/github',
      configured: isGitHubAppConfigured(github),
    },
    {
      id: 'slack',
      name: 'Slack',
      desc: t(
        'instanceAdmin.integrations.slack.desc',
        'Push issue events directly to Slack channels. Get notified when issues are created, move across states, or receive comments.',
      ),
      Icon: IconSlack,
      editPath: '/instance-admin/integrations/slack',
      configured: isSlackAppConfigured(slack),
    },
  ];

  if (loading) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-xl" />
        </div>
        <ul className="space-y-2">
          {[1].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Skeleton className="size-4 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          {t('instanceAdmin.integrations.title', 'Integrations available on this instance')}
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          {t(
            'instanceAdmin.integrations.subtitle',
            'Configure third-party app credentials. Once an integration is configured here, workspace admins can connect it from their workspace settings.',
          )}
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
          {t('instanceAdmin.integrations.sourceControl', 'Source control')}
        </h2>
        <ul className="space-y-2">
          {providers.map((p) => {
            const Icon = p.Icon;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex shrink-0 text-(--txt-icon-tertiary) [&_svg]:size-4 [&_svg]:shrink-0">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-(--txt-primary)">{p.name}</p>
                      {p.configured ? (
                        <span className="rounded bg-(--bg-success-subtle) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-success-primary)">
                          {t('instanceAdmin.integrations.configured', 'Configured')}
                        </span>
                      ) : (
                        <span className="rounded bg-(--bg-layer-1) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                          {t('instanceAdmin.integrations.notConfigured', 'Not configured')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-(--txt-secondary)">{p.desc}</p>
                  </div>
                </div>
                <Link
                  to={p.editPath}
                  className={
                    p.configured
                      ? 'rounded px-2.5 py-1 text-xs font-medium text-(--txt-accent) hover:bg-(--bg-accent-subtle)'
                      : 'inline-flex items-center gap-1.5 rounded border border-(--border-subtle) px-2.5 py-1 text-xs font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)'
                  }
                >
                  {p.configured ? (
                    t('common.edit', 'Edit')
                  ) : (
                    <>
                      <Settings2 className="size-3.5" aria-hidden />
                      {t('common.configure', 'Configure')}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

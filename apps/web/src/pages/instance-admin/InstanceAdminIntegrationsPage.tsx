import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Skeleton } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InstanceGitHubAppSection, InstanceSlackAppSection } from '../../api/types';
import { IconGitHub, IconSlack } from '../../components/icons/IntegrationIcons';

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
          {t('instanceAdmin.integrations.providers', 'Available integrations')}
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

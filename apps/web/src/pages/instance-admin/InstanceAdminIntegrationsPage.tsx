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
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 127 127" aria-hidden>
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

type ProviderCategory = 'source-control' | 'messaging';

interface ProviderRow {
  id: 'github' | 'slack';
  name: string;
  desc: string;
  Icon: () => React.ReactElement;
  editPath: string;
  configured: boolean;
  category: ProviderCategory;
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

function isSlackConfigured(s: InstanceSlackAppSection): boolean {
  return !!(s.client_id && s.client_secret_set && s.signing_secret_set);
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
        const sl = (settings.slack || {}) as InstanceSlackAppSection;
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
      category: 'source-control',
    },
    {
      id: 'slack',
      name: 'Slack',
      desc: 'Post Devlane notifications (assigned, state changed, commented, mentioned) to a Slack channel per project.',
      Icon: IconSlack,
      editPath: '/instance-admin/integrations/slack',
      configured: isSlackConfigured(slack),
      category: 'messaging',
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
          {[1, 2].map((i) => (
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

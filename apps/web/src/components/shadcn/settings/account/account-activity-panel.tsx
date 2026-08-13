import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActivityIcon, MessageCircleIcon } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/shadcn/ui/empty';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { SettingsPanel } from '@/components/shadcn/settings/settings-panel';
import { formatRelativeTime } from '../../../../lib/settingsHelpers';
import { userService } from '../../../../services/userService';
import type { UserActivityItem } from '../../../../api/types';

interface AccountActivityPanelProps {
  workspaceSlug?: string;
}

/** The signed-in user's recent actions across projects. */
export function AccountActivityPanel({ workspaceSlug }: AccountActivityPanelProps) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    userService
      .getActivity()
      .then((r) => {
        if (cancelled) return;
        setActivities(r.activities ?? []);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsPanel
      title={t('settings.activity.title', 'Activity')}
      description={t(
        'settings.activity.subtitle',
        'Track your recent actions and changes across all projects and work items.',
      )}
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : activities.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.activity.empty', 'No activity yet.')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {activities.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-lg border px-4 py-3">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                {item.type === 'comment' ? (
                  <MessageCircleIcon className="size-4" />
                ) : (
                  <ActivityIcon className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm">
                  {t('settings.activity.youCommented', 'You commented {{time}}', {
                    time: formatRelativeTime(item.created_at),
                  })}
                </p>
                {item.description && <p className="mt-1 text-sm font-medium">{item.description}</p>}
                {item.issue_id && item.issue_name && workspaceSlug && item.project_id && (
                  <Link
                    to={`/${workspaceSlug}/app-v2/projects/${item.project_id}/work-items/${item.issue_id}`}
                    className="text-primary mt-1 inline-block text-sm hover:underline"
                  >
                    {item.issue_name}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </SettingsPanel>
  );
}

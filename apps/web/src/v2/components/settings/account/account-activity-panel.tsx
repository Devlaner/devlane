import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActivityIcon, MessageCircleIcon } from 'lucide-react';
import { Card, CardContent } from '@/v2/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/v2/components/ui/empty';
import { Separator } from '@/v2/components/ui/separator';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import { describeActivity } from '../../../../lib/activityDescription';
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
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : activities.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.activity.empty', 'No activity yet.')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <ol>
            {activities.map((item, index) => (
              <li key={item.id}>
                {index > 0 && <Separator />}
                <div className="hover:bg-accent/40 flex gap-3 px-6 py-4 transition-colors">
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                    {item.type === 'comment' ? (
                      <MessageCircleIcon className="size-4" />
                    ) : (
                      <ActivityIcon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-sm">
                      {item.type === 'comment'
                        ? t('settings.activity.youCommented', 'You commented {{time}}', {
                            time: formatRelativeTime(item.created_at),
                          })
                        : t('settings.activity.youUpdated', 'You made an update {{time}}', {
                            time: formatRelativeTime(item.created_at),
                          })}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-sm font-medium">{describeActivity(item)}</p>
                    )}
                    {item.issue_id && item.issue_name && workspaceSlug && item.project_id && (
                      <Link
                        to={`/${workspaceSlug}/projects/${item.project_id}/issues/${item.issue_id}`}
                        className="text-primary mt-1 inline-block text-sm hover:underline"
                      >
                        {item.issue_name}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </SettingsPanel>
  );
}

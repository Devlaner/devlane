import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Switch } from '@/v2/components/ui/switch';
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import type { NotificationPreferencesResponse } from '../../../api/types';

type Prefs = NotificationPreferencesResponse;
type InAppKey = 'property_change' | 'state_change' | 'issue_completed' | 'comment' | 'mention';
type EmailKey = keyof Prefs & `email_${string}`;

const ROWS: { id: string; label: string; desc: string; inApp: InAppKey; email: EmailKey }[] = [
  {
    id: 'property',
    label: 'Property changes',
    desc: "Notify me when work items' properties like assignees, priority, or estimates change.",
    inApp: 'property_change',
    email: 'email_property_change',
  },
  {
    id: 'state',
    label: 'State change',
    desc: 'Notify me when a work item moves to a different state.',
    inApp: 'state_change',
    email: 'email_state_change',
  },
  {
    id: 'completed',
    label: 'Work item completed',
    desc: 'Notify me when a work item is completed.',
    inApp: 'issue_completed',
    email: 'email_issue_completed',
  },
  {
    id: 'comments',
    label: 'Comments',
    desc: 'Notify me when someone comments on a work item.',
    inApp: 'comment',
    email: 'email_comment',
  },
  {
    id: 'mentions',
    label: 'Mentions',
    desc: 'Notify me when someone mentions me in a comment or description.',
    inApp: 'mention',
    email: 'email_mention',
  },
];

interface NotificationPreferencesPanelProps {
  load: () => Promise<Prefs>;
  save: (partial: Partial<Prefs>) => Promise<Prefs>;
  title?: string;
  description?: string;
}

/**
 * Per-type notification toggles with independent in-app and email columns.
 * `load`/`save` abstract the scope (account, workspace, or project) so the same
 * panel serves all three.
 */
export function NotificationPreferencesPanel({
  load,
  save,
  title,
  description,
}: NotificationPreferencesPanelProps) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((p) => {
        if (!cancelled) setPrefs(p);
      })
      .catch(() => {
        if (!cancelled) setPrefs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggle = async (key: InAppKey | EmailKey) => {
    if (!prefs) return;
    const next = !prefs[key];
    /* Update only this key via a functional update so a concurrent toggle of a
       different switch is never stomped by this one's success or failure. */
    setPrefs((cur) => (cur ? { ...cur, [key]: next } : cur));
    try {
      const saved = await save({ [key]: next });
      setPrefs((cur) => (cur ? { ...cur, [key]: saved[key] } : cur));
    } catch {
      setPrefs((cur) => (cur ? { ...cur, [key]: !next } : cur));
    }
  };

  const loaded = prefs !== null;

  return (
    <SettingsPanel
      title={title ?? t('settings.notifications.title', 'Notifications')}
      description={
        description ??
        t(
          'settings.notifications.description',
          'Choose which updates reach you in-app and by email.',
        )
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/50 text-muted-foreground flex items-center gap-4 border-b px-4 py-2 text-xs font-medium">
          <span className="flex-1">{t('settings.notifications.columnType', 'Type')}</span>
          <span className="w-14 text-center">
            {t('settings.notifications.columnInApp', 'In-app')}
          </span>
          <span className="w-14 text-center">
            {t('settings.notifications.columnEmail', 'Email')}
          </span>
        </div>
        {ROWS.map(({ id, label, desc, inApp, email }) => {
          const rowLabel = t(`settings.notifications.row.${id}.label`, label);
          const rowDesc = t(`settings.notifications.row.${id}.desc`, desc);
          return (
            <div key={id} className="flex items-start gap-4 border-b px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{rowLabel}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{rowDesc}</p>
              </div>
              <div className="flex w-14 justify-center">
                {loaded ? (
                  <Switch
                    checked={!!prefs?.[inApp]}
                    onCheckedChange={() => void toggle(inApp)}
                    aria-label={t('settings.notifications.inAppAria', '{{label}} in-app', {
                      label: rowLabel,
                    })}
                  />
                ) : (
                  <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                )}
              </div>
              <div className="flex w-14 justify-center">
                {loaded ? (
                  <Switch
                    checked={!!prefs?.[email]}
                    onCheckedChange={() => void toggle(email)}
                    aria-label={t('settings.notifications.emailAria', '{{label}} email', {
                      label: rowLabel,
                    })}
                  />
                ) : (
                  <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsPanel>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/v2/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/v2/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/v2/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import { TimezoneCombobox } from '@/v2/components/settings/timezone-combobox';
import {
  SUPPORTED_LANGUAGES,
  setLanguage as setUiLanguage,
  type LanguageCode,
} from '../../../../i18n';
import { useTheme, type ThemePreference } from '../../../../contexts/ThemeContext';
import { useInterfaceVersion, type InterfaceVersion } from '../../../contexts/InterfaceContext';
import { authService } from '../../../../services/authService';
import { userService } from '../../../../services/userService';

/* Each swatch previews the palette its theme applies; the values mirror the
   tokens those themes set, so the preview stays readable in any current theme. */
const THEME_SWATCHES: {
  value: ThemePreference;
  bg: string;
  surface: string | null;
  brand: string | null;
  line: string | null;
}[] = [
  { value: 'light', bg: '#f4f5f7', surface: '#ffffff', brand: '#4b72c4', line: '#1a1a2e' },
  { value: 'dark', bg: '#1f2227', surface: '#27292e', brand: '#5e8de8', line: '#e8e8f2' },
  { value: 'pink', bg: '#fce8ef', surface: '#fff5f8', brand: '#c4336a', line: '#2a1820' },
  {
    value: 'system',
    bg: 'linear-gradient(135deg,#1f2227 50%,#f4f5f7 50%)',
    surface: null,
    brand: null,
    line: null,
  },
];

/** Theme, week start, timezone, and interface language. */
export function AccountPreferencesPanel() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  /* Both interfaces answer to the same URLs, so switching only flips the
     preference — the route tree re-renders the other interface in place. */
  const { interfaceVersion, setInterfaceVersion } = useInterfaceVersion();
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('monday');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService.getMe().then((api) => {
      if (cancelled || !api) return;
      const tz = (api as { user_timezone?: string }).user_timezone;
      if (tz) setTimezone(tz);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const themeLabels: Record<ThemePreference, string> = {
    light: t('settings.preferences.theme.light', 'Light'),
    dark: t('settings.preferences.theme.dark', 'Dark'),
    pink: t('settings.preferences.theme.pink', 'Pink'),
    system: t('settings.preferences.theme.system', 'System'),
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await userService.updateMe({ user_timezone: timezone });
      toast.success(t('settings.preferences.saved', 'Preferences saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.preferences.title', 'Preferences')}
      description={t(
        'settings.preferences.subtitle',
        'Customize your app experience the way you work',
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.preferences.theme.title', 'Theme')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.preferences.theme.help',
              'Select or customize your interface color scheme.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label={t('settings.preferences.theme.title', 'Theme')}
            className="flex flex-wrap gap-3"
          >
            {THEME_SWATCHES.map(({ value, bg, surface, brand, line }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'focus-visible:ring-ring relative flex w-24 flex-col items-center gap-1.5 rounded-lg border-2 p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40 hover:bg-accent/40',
                  )}
                >
                  <span
                    className="h-14 w-full overflow-hidden rounded-md border"
                    style={{ background: bg }}
                  >
                    {surface && brand && line ? (
                      <span className="flex h-full flex-col gap-1 p-1.5">
                        <span
                          className="h-1.5 w-3/4 rounded-full"
                          style={{ background: brand, opacity: 0.75 }}
                        />
                        <span
                          className="mt-0.5 flex flex-col gap-1 rounded-[3px] px-1 py-[3px]"
                          style={{ background: surface }}
                        >
                          <span
                            className="h-1 w-full rounded-full"
                            style={{ background: line, opacity: 0.18 }}
                          />
                          <span
                            className="h-1 w-4/5 rounded-full"
                            style={{ background: line, opacity: 0.12 }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="flex h-full">
                        <span className="flex h-full w-1/2 flex-col gap-1 p-1.5">
                          <span className="h-1.5 w-3/4 rounded-full bg-[#5e8de8] opacity-75" />
                          <span className="h-1 w-full rounded-full bg-[#e8e8f2] opacity-20" />
                        </span>
                        <span className="flex h-full w-1/2 flex-col gap-1 p-1.5">
                          <span className="h-1.5 w-3/4 rounded-full bg-[#4b72c4] opacity-75" />
                          <span className="h-1 w-full rounded-full bg-[#1a1a2e] opacity-20" />
                        </span>
                      </span>
                    )}
                  </span>
                  {selected && (
                    <span
                      className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full"
                      aria-hidden
                    >
                      <CheckIcon className="size-3" />
                    </span>
                  )}
                  <span className="text-xs font-medium">{themeLabels[value]}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.preferences.interfaceVersion.title', 'Interface')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.preferences.interfaceVersion.help',
              'Choose which Devlane interface you want to use. Some admin-only pages still open in the classic interface either way.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={interfaceVersion}
            onValueChange={(value) => {
              if (value) setInterfaceVersion(value as InterfaceVersion);
            }}
            aria-label={t('settings.preferences.interfaceVersion.title', 'Interface')}
          >
            <ToggleGroupItem value="v1" className="px-4">
              {t('settings.preferences.interfaceVersion.v1', 'Classic')}
            </ToggleGroupItem>
            <ToggleGroupItem value="v2" className="px-4">
              {t('settings.preferences.interfaceVersion.v2', 'New (Beta)')}
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.preferences.regionalTitle', 'Language and region')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.preferences.regionalDescription',
              'How dates, times, and the interface itself are presented to you.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pref-language">
                {t('settings.preferences.language.title', 'Language')}
              </FieldLabel>
              <Select
                value={i18n.resolvedLanguage ?? i18n.language}
                onValueChange={(value) => setUiLanguage(value as LanguageCode)}
              >
                <SelectTrigger id="pref-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lng) => (
                    <SelectItem key={lng.code} value={lng.code}>
                      {lng.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {t(
                  'settings.preferences.language.help',
                  'Choose the language used in the user interface.',
                )}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="pref-first-day">
                {t('settings.preferences.firstDayOfWeek.title', 'First day of the week')}
              </FieldLabel>
              <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
                <SelectTrigger id="pref-first-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday">
                    {t('settings.preferences.firstDayOfWeek.sunday', 'Sunday')}
                  </SelectItem>
                  <SelectItem value="monday">
                    {t('settings.preferences.firstDayOfWeek.monday', 'Monday')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {t(
                  'settings.preferences.firstDayOfWeek.help',
                  'This will change how all calendars in your app look.',
                )}
              </FieldDescription>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="pref-timezone">
                {t('settings.preferences.timezone.title', 'Timezone')}
              </FieldLabel>
              <div className="sm:max-w-sm">
                <TimezoneCombobox id="pref-timezone" value={timezone} onChange={setTimezone} />
              </div>
              <FieldDescription>
                {t('settings.preferences.timezone.help', 'Current timezone setting.')}
              </FieldDescription>
            </Field>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button disabled={saving} onClick={() => void savePreferences()}>
            {saving
              ? t('common.saving', 'Saving…')
              : t('settings.preferences.save', 'Save preferences')}
          </Button>
        </CardFooter>
      </Card>
    </SettingsPanel>
  );
}

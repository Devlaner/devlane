import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { toast } from 'sonner';
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
import { useTheme } from '../../../../contexts/ThemeContext';
import { useInterfaceVersion, type InterfaceVersion } from '../../../contexts/InterfaceContext';
import {
  ACCENT_COLOR_PRESETS,
  useAccentColor,
  type AccentColor,
} from '../../../contexts/AccentColorContext';
import { useIsDarkTheme } from '../../../hooks/useIsDarkTheme';
import { authService } from '../../../../services/authService';
import { userService } from '../../../../services/userService';

/* Mode and accent are one card because they are one decision — how the interface
   is painted — split across two axes. Each mode carries a glyph rather than a
   palette preview: a preview would read as a colour choice, which is the row
   below it. Pink is a v1-only palette the shadcn subtree has no values for, so
   the v2 picker leaves it out; the choice stays available in the classic
   interface. */
type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODES: { value: ThemeMode; icon: typeof SunIcon }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
];

/**
 * The dot in front of an accent preset's label.
 *
 * Every swatch is a literal, `default` included: a dot painted from `--primary`
 * would follow the accent already applied instead of previewing the one the
 * reader is about to pick.
 */
function ColorDot({
  swatch,
  isDark,
}: {
  swatch: { light: string; dark: string };
  isDark: boolean;
}) {
  return (
    <span
      className="size-3.5 shrink-0 rounded-full border"
      style={{ background: isDark ? swatch.dark : swatch.light }}
      aria-hidden
    />
  );
}

/** Theme, week start, timezone, and interface language. */
export function AccountPreferencesPanel() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  /* Orthogonal to the light/dark choice above: the preset only repaints the
     filled action colour, in whichever mode is active. */
  const { accentColor, setAccentColor } = useAccentColor();
  const isDark = useIsDarkTheme();
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

  const themeLabels: Record<ThemeMode, string> = {
    light: t('settings.preferences.theme.light', 'Light'),
    dark: t('settings.preferences.theme.dark', 'Dark'),
    system: t('settings.preferences.theme.system', 'System'),
  };

  const accentColorLabels: Record<AccentColor, string> = {
    default: t('settings.preferences.colorTheme.default', 'Default'),
    blue: t('settings.preferences.colorTheme.blue', 'Blue'),
    violet: t('settings.preferences.colorTheme.violet', 'Violet'),
    green: t('settings.preferences.colorTheme.green', 'Green'),
    orange: t('settings.preferences.colorTheme.orange', 'Orange'),
    rose: t('settings.preferences.colorTheme.rose', 'Rose'),
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
            {t('settings.preferences.appearance.title', 'Appearance')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.preferences.appearance.help',
              'Two independent choices: the mode decides whether the interface is light or dark, the accent decides the color it fills buttons and focus rings with.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="pref-theme-mode">
              {t('settings.preferences.theme.title', 'Mode')}
            </FieldLabel>
            <ToggleGroup
              id="pref-theme-mode"
              type="single"
              variant="outline"
              /* Pink is not offered here and cannot render in this subtree, so
                 a reader who set it in the classic interface sees the mode it
                 actually gets. Their stored preference is left alone until they
                 pick something else. */
              value={theme === 'pink' ? 'light' : theme}
              onValueChange={(value) => {
                if (value) setTheme(value as ThemeMode);
              }}
              aria-label={t('settings.preferences.theme.title', 'Mode')}
              className="w-fit"
            >
              {THEME_MODES.map(({ value, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value} className="gap-2 px-4">
                  <Icon className="size-4" aria-hidden />
                  {themeLabels[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="pref-accent-color">
              {t('settings.preferences.colorTheme.accent', 'Accent')}
            </FieldLabel>
            <ToggleGroup
              id="pref-accent-color"
              type="single"
              variant="outline"
              value={accentColor}
              onValueChange={(value) => {
                if (value) setAccentColor(value as AccentColor);
              }}
              aria-label={t('settings.preferences.colorTheme.accent', 'Accent')}
              className="w-fit"
            >
              {ACCENT_COLOR_PRESETS.map((preset) => (
                <ToggleGroupItem key={preset.value} value={preset.value} className="gap-2 px-4">
                  <ColorDot swatch={preset.swatch} isDark={isDark} />
                  {accentColorLabels[preset.value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              {t(
                'settings.preferences.colorTheme.accentHelp',
                'Recolors filled buttons and focus rings only. Surfaces, borders and text stay as they are.',
              )}
            </FieldDescription>
          </Field>
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

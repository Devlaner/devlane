import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/ui/button';
import { Label } from '@/components/shadcn/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { SettingsPanel } from '@/components/shadcn/settings/settings-panel';
import { TimezoneCombobox } from '@/components/shadcn/settings/timezone-combobox';
import {
  SUPPORTED_LANGUAGES,
  setLanguage as setUiLanguage,
  type LanguageCode,
} from '../../../../i18n';
import { useTheme, type ThemePreference } from '../../../../contexts/ThemeContext';
import { useInterfaceVersion, type InterfaceVersion } from '../../../../contexts/InterfaceContext';
import { mapPathToV1, mapPathToV2 } from '../../../../lib/interfaceRedirect';
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
  const { interfaceVersion, setInterfaceVersion } = useInterfaceVersion();
  const location = useLocation();
  const navigate = useNavigate();
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('monday');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);

  const handleInterfaceVersionChange = (value: InterfaceVersion) => {
    setInterfaceVersion(value);
    const target =
      value === 'v2'
        ? mapPathToV2(location.pathname, location.search)
        : mapPathToV1(location.pathname, location.search);
    if (target) navigate(target, { replace: true });
  };

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

  return (
    <SettingsPanel
      title={t('settings.preferences.title', 'Preferences')}
      description={t(
        'settings.preferences.subtitle',
        'Customize your app experience the way you work',
      )}
    >
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          {t('settings.preferences.theme.title', 'Theme')}
        </legend>
        <p className="text-muted-foreground text-sm">
          {t('settings.preferences.theme.help', 'Select or customize your interface color scheme.')}
        </p>
        <div className="flex flex-wrap gap-3">
          {THEME_SWATCHES.map(({ value, bg, surface, brand, line }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-ring relative flex w-20 flex-col items-center gap-1.5 rounded-lg border-2 p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  selected ? 'border-primary' : 'hover:border-muted-foreground/40 border-border',
                )}
              >
                <span className="h-12 w-full overflow-hidden rounded" style={{ background: bg }}>
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
                    className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full"
                    aria-hidden
                  >
                    <CheckIcon className="size-2.5" />
                  </span>
                )}
                <span className="text-xs font-medium">{themeLabels[value]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          {t('settings.preferences.interfaceVersion.title', 'Interface')}
        </legend>
        <p className="text-muted-foreground text-sm">
          {t(
            'settings.preferences.interfaceVersion.help',
            'Choose which Devlane interface you want to use. Some admin-only pages still open in the classic interface either way.',
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['v1', t('settings.preferences.interfaceVersion.v1', 'Classic')],
              ['v2', t('settings.preferences.interfaceVersion.v2', 'New (Beta)')],
            ] as [InterfaceVersion, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={interfaceVersion === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleInterfaceVersionChange(value)}
              aria-pressed={interfaceVersion === value}
            >
              {label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pref-first-day">
            {t('settings.preferences.firstDayOfWeek.title', 'First day of the week')}
          </Label>
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
          <p className="text-muted-foreground text-sm">
            {t(
              'settings.preferences.firstDayOfWeek.help',
              'This will change how all calendars in your app look.',
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pref-language">
            {t('settings.preferences.language.title', 'Language')}
          </Label>
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
          <p className="text-muted-foreground text-sm">
            {t(
              'settings.preferences.language.help',
              'Choose the language used in the user interface.',
            )}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pref-timezone">
            {t('settings.preferences.timezone.title', 'Timezone')}
          </Label>
          <div className="max-w-sm">
            <TimezoneCombobox id="pref-timezone" value={timezone} onChange={setTimezone} />
          </div>
          <p className="text-muted-foreground text-sm">
            {t('settings.preferences.timezone.help', 'Current timezone setting.')}
          </p>
        </div>
      </div>

      <div>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await userService.updateMe({ user_timezone: timezone });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving
            ? t('common.saving', 'Saving…')
            : t('settings.preferences.save', 'Save preferences')}
        </Button>
      </div>
    </SettingsPanel>
  );
}

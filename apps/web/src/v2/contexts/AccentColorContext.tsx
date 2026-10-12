/* eslint-disable react-refresh/only-export-components -- context file exports AccentColorProvider + useAccentColor + the preset list they share */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const ACCENT_COLOR_STORAGE_KEY = 'devlane-v2-accent-color';

/**
 * The v2 accent presets, defined in `v2/styles/v2-color-themes.css`.
 *
 * A colour layer only, orthogonal to the light/dark/system choice the app's own
 * ThemeContext holds: each preset ships a light and a dark block, so changing one
 * never changes the other.
 */
export type AccentColor = 'default' | 'blue' | 'violet' | 'green' | 'orange' | 'rose';

export interface AccentPreset {
  value: AccentColor;
  /** Swatch colour for the picker, mirroring what the CSS preset sets. */
  swatch: { light: string; dark: string };
}

/* `default` has no CSS block — it is the stock new-york-v4 action colour the v2
   shell already renders in. Its swatch is that colour as a literal rather than
   `--primary`, which would follow whichever accent is currently applied and so
   never show what picking `default` would actually give. */
export const ACCENT_COLOR_PRESETS: AccentPreset[] = [
  { value: 'default', swatch: { light: 'oklch(0.205 0 0)', dark: 'oklch(0.922 0 0)' } },
  {
    value: 'blue',
    swatch: { light: 'oklch(0.488 0.243 264.376)', dark: 'oklch(0.707 0.165 254.624)' },
  },
  {
    value: 'violet',
    swatch: { light: 'oklch(0.491 0.27 292.581)', dark: 'oklch(0.702 0.183 293.541)' },
  },
  {
    value: 'green',
    swatch: { light: 'oklch(0.527 0.154 150.069)', dark: 'oklch(0.792 0.209 151.711)' },
  },
  {
    value: 'orange',
    swatch: { light: 'oklch(0.553 0.195 38.402)', dark: 'oklch(0.75 0.183 55.934)' },
  },
  {
    value: 'rose',
    swatch: { light: 'oklch(0.514 0.222 16.935)', dark: 'oklch(0.712 0.194 13.428)' },
  },
];

interface AccentColorContextValue {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

function getStoredAccentColor(): AccentColor {
  if (typeof window === 'undefined') return 'default';
  const stored = window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
  return ACCENT_COLOR_PRESETS.some((preset) => preset.value === stored)
    ? (stored as AccentColor)
    : 'default';
}

/**
 * Holds the v2 accent preset and mirrors it onto document.body.
 *
 * The CSS presets key off `data-v2-accent` on the element that carries
 * `.shadcn-v4` — variables resolve from the nearest ancestor that defines them,
 * so the attribute has to sit on the same nodes as the class rather than on the
 * root. The shell puts it on its own wrapper; this provider covers the body,
 * where Radix portals its dropdowns, popovers and tooltips.
 *
 * Mounted by the v2 shell only, so a reader on v1 neither loads nor is affected
 * by any of it.
 */
export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(getStoredAccentColor);

  const setAccentColor = useCallback((value: AccentColor) => {
    setAccentColorState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, value);
    }
  }, []);

  useLayoutEffect(() => {
    document.body.dataset.v2Accent = accentColor;
    return () => {
      delete document.body.dataset.v2Accent;
    };
  }, [accentColor]);

  const value = useMemo<AccentColorContextValue>(
    () => ({ accentColor, setAccentColor }),
    [accentColor, setAccentColor],
  );

  return <AccentColorContext.Provider value={value}>{children}</AccentColorContext.Provider>;
}

export function useAccentColor(): AccentColorContextValue {
  const ctx = useContext(AccentColorContext);
  if (!ctx) throw new Error('useAccentColor must be used within AccentColorProvider');
  return ctx;
}

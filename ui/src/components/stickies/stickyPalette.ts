/** Plane light — plane/packages/editor/src/styles/variables.css [data-theme*="light"] */
export const STICKY_BACKGROUND_COLORS_LIGHT = [
  '#d6d6d8',
  '#ffd5d7',
  '#fdd4e3',
  '#ffe3cd',
  '#c3f0de',
  '#c5eff9',
  '#c9dafb',
  '#e3d8fd',
] as const;

/** Plane dark — same file [data-theme*="dark"] */
export const STICKY_BACKGROUND_COLORS_DARK = [
  '#404144',
  '#593032',
  '#562e3d',
  '#583e2a',
  '#1d4a3b',
  '#1f495c',
  '#223558',
  '#3d325a',
] as const;

/** Prior muted palette → Plane light hex (canonical slot) */
const LEGACY_STICKY_BACKGROUND_HEX: Record<string, string> = {
  '#cfcfd2': '#d6d6d8',
  '#f0c8ca': '#ffd5d7',
  '#f0c9d6': '#fdd4e3',
  '#f5dcc8': '#ffe3cd',
  '#bae8d5': '#c3f0de',
  '#bae4ef': '#c5eff9',
  '#bfd3ef': '#c9dafb',
  '#d9cef5': '#e3d8fd',
};

const STICKY_KEY_ORDER = [
  'gray',
  'peach',
  'pink',
  'orange',
  'green',
  'light-blue',
  'dark-blue',
  'purple',
] as const;

function normalizeHexColor(input: string): string | null {
  const t = input.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(t)) {
    const h = t.slice(1).toLowerCase();
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return null;
}

/** Palette slot 0–7, or -1 if unknown / invalid */
export function getStickyColorSlot(stored: string | undefined): number {
  const raw = (stored || '').trim();
  if (!raw) return -1;
  if (raw.toLowerCase() === '#0d0d0d') return 0;
  const lower = raw.toLowerCase();
  const keyIndex = STICKY_KEY_ORDER.indexOf(lower as (typeof STICKY_KEY_ORDER)[number]);
  if (keyIndex >= 0) return keyIndex;
  const hex = normalizeHexColor(raw);
  if (!hex) return -1;
  const upgraded = LEGACY_STICKY_BACKGROUND_HEX[hex] ?? hex;
  let idx = (STICKY_BACKGROUND_COLORS_LIGHT as readonly string[]).indexOf(upgraded);
  if (idx >= 0) return idx;
  idx = (STICKY_BACKGROUND_COLORS_DARK as readonly string[]).indexOf(hex);
  if (idx >= 0) return idx;
  return -1;
}

export function resolveStickyBackgroundForDisplay(
  stored: string | undefined,
  isDark: boolean,
): string {
  const slot = getStickyColorSlot(stored);
  if (slot >= 0) {
    return isDark ? STICKY_BACKGROUND_COLORS_DARK[slot] : STICKY_BACKGROUND_COLORS_LIGHT[slot];
  }
  const hex = normalizeHexColor((stored || '').trim());
  return hex || (isDark ? STICKY_BACKGROUND_COLORS_DARK[0] : STICKY_BACKGROUND_COLORS_LIGHT[0]);
}

export function pickRandomStickyBackground(): string {
  const i = Math.floor(Math.random() * STICKY_BACKGROUND_COLORS_LIGHT.length);
  return STICKY_BACKGROUND_COLORS_LIGHT[i];
}

/** Canonical light-hex for this stored value (picker selection + API palette keys). */
export function paletteLightHexForStored(stored: string | undefined): string | null {
  const slot = getStickyColorSlot(stored);
  if (slot >= 0) return STICKY_BACKGROUND_COLORS_LIGHT[slot];
  const hex = normalizeHexColor((stored || '').trim());
  return hex;
}

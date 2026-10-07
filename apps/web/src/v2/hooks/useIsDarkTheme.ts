import { useEffect, useState } from 'react';

/**
 * Whether the app is currently painting its dark palette.
 *
 * Read from the root attribute rather than from the theme preference so the
 * `system` setting resolves the same way the stylesheets do, with no second
 * copy of the media-query logic. Used by UI that has to draw a colour the CSS
 * cannot supply — a swatch previewing a theme other than the active one.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.getAttribute('data-theme') === 'dark');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

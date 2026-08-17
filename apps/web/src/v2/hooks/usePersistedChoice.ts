import { useEffect, useRef, useState } from 'react';

/**
 * A single-choice piece of view state that survives a visit, for the v2 screens
 * whose choice has no place in the URL.
 *
 * `persisted` is the subset of values worth remembering, which is not always
 * every value the caller can set. A scope that hides the thing the page exists
 * to show — an archived-only inbox, say — is fine to switch to and wrong to
 * come back to, so setting it is allowed but drops the stored value instead of
 * recording it, and the next visit opens at `fallback`.
 *
 * Pass a null `storageKey` while its inputs are unknown; nothing is read or
 * written until it resolves.
 */
function readStored<T extends string>(
  storageKey: string | null,
  persisted: readonly T[],
): T | null {
  if (!storageKey) return null;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  return stored && (persisted as readonly string[]).includes(stored) ? (stored as T) : null;
}

export function usePersistedChoice<T extends string>(
  storageKey: string | null,
  persisted: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  /* Read on the first render rather than in an effect, so the page paints the
     remembered choice instead of flashing the fallback first. */
  const [value, setValue] = useState<T>(() => readStored(storageKey, persisted) ?? fallback);
  /** Key the current value was read for; a later key means a different subject. */
  const restoredKey = useRef<string | null>(storageKey);

  useEffect(() => {
    if (restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    const next = readStored(storageKey, persisted) ?? fallback;
    /* Deferred so the state lands after this effect rather than during it. */
    queueMicrotask(() => setValue(next));
  }, [fallback, persisted, storageKey]);

  useEffect(() => {
    if (!storageKey || restoredKey.current !== storageKey) return;
    try {
      if ((persisted as readonly string[]).includes(value)) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      /* quota or private mode: the session keeps working, it just won't persist */
    }
  }, [persisted, storageKey, value]);

  return [value, setValue];
}

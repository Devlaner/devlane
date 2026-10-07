import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Serialises only the persisted keys, in a stable order, for comparison and storage. */
function serializePersisted(searchParams: URLSearchParams, keys: readonly string[]): string {
  const picked = new URLSearchParams();
  keys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) picked.set(key, value);
  });
  return picked.toString();
}

function readStored(storageKey: string, keys: readonly string[]): string {
  try {
    const raw = localStorage.getItem(storageKey) ?? '';
    return serializePersisted(new URLSearchParams(raw), keys);
  } catch {
    return '';
  }
}

function writeStored(storageKey: string, value: string): void {
  try {
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  } catch {
    // Private mode or a full quota: the URL still carries the state for this visit.
  }
}

/**
 * Remembers a page's view-shaping search params across visits.
 *
 * The URL stays the source of truth — a link carrying any of these params wins
 * and nothing is restored over it. Storage only fills in the blanks when the
 * page is entered without them (sidebar link, breadcrumb, project switch),
 * which is where the selection used to be lost. Restoring happens once per
 * storage key, so clearing the state on the page is not undone.
 *
 * Pass a null `storageKey` while the key's inputs (workspace, project) are
 * still unknown; nothing is read or written until it resolves.
 */
export function usePersistedSearchParams(storageKey: string | null, keys: readonly string[]): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = serializePersisted(searchParams, keys);

  const restoredKey = useRef<string | null>(null);
  /** Value written to the URL by a restore, until the router applies it. */
  const pendingRestore = useRef<string | null>(null);

  useEffect(() => {
    if (!storageKey || restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    pendingRestore.current = null;

    if (current) return;
    const stored = readStored(storageKey, keys);
    if (!stored) return;

    pendingRestore.current = stored;
    const next = new URLSearchParams(searchParams);
    new URLSearchParams(stored).forEach((value, key) => next.set(key, value));
    setSearchParams(next, { replace: true });
  }, [current, keys, searchParams, setSearchParams, storageKey]);

  useEffect(() => {
    if (!storageKey || restoredKey.current !== storageKey) return;
    if (pendingRestore.current !== null) {
      // Don't persist the empty state the restore is about to replace.
      if (current !== pendingRestore.current) return;
      pendingRestore.current = null;
    }
    writeStored(storageKey, current);
  }, [current, storageKey]);
}

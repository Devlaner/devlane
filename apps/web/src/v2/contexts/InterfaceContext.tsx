/* eslint-disable react-refresh/only-export-components -- context file exports InterfaceProvider + useInterfaceVersion */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const INTERFACE_STORAGE_KEY = 'devlane-interface-version';

export type InterfaceVersion = 'v1' | 'v2';

interface InterfaceContextValue {
  interfaceVersion: InterfaceVersion;
  setInterfaceVersion: (version: InterfaceVersion) => void;
}

const InterfaceContext = createContext<InterfaceContextValue | null>(null);

function getStoredInterfaceVersion(): InterfaceVersion {
  if (typeof window === 'undefined') return 'v1';
  return window.localStorage.getItem(INTERFACE_STORAGE_KEY) === 'v2' ? 'v2' : 'v1';
}

export function InterfaceProvider({ children }: { children: ReactNode }) {
  const [interfaceVersion, setInterfaceVersionState] =
    useState<InterfaceVersion>(getStoredInterfaceVersion);

  const setInterfaceVersion = useCallback((version: InterfaceVersion) => {
    setInterfaceVersionState(version);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INTERFACE_STORAGE_KEY, version);
    }
  }, []);

  const value = useMemo<InterfaceContextValue>(
    () => ({ interfaceVersion, setInterfaceVersion }),
    [interfaceVersion, setInterfaceVersion],
  );

  return <InterfaceContext.Provider value={value}>{children}</InterfaceContext.Provider>;
}

export function useInterfaceVersion(): InterfaceContextValue {
  const ctx = useContext(InterfaceContext);
  if (!ctx) throw new Error('useInterfaceVersion must be used within InterfaceProvider');
  return ctx;
}

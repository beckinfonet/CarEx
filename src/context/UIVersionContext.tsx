import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UIVersion = 'v1' | 'v2';

interface UIVersionContextValue {
  version: UIVersion;
  setVersion: (v: UIVersion) => void;
  inviteDismissed: boolean;
  dismissInvite: () => void;
}

const STORAGE_KEY_VERSION = 'ui_design_version';
const STORAGE_KEY_INVITE  = 'ui_design_invite_dismissed_v2';

const UIVersionContext = createContext<UIVersionContextValue | null>(null);

export const UIVersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [version, setVersionState] = useState<UIVersion>('v1');
  const [inviteDismissed, setInviteDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedVersion, storedDismissed] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_VERSION),
          AsyncStorage.getItem(STORAGE_KEY_INVITE),
        ]);
        if (storedVersion === 'v2') setVersionState('v2');
        if (storedDismissed === 'true') setInviteDismissed(true);
      } catch (e) {
        console.error('UIVersionContext hydration failed:', e);
      }
    })();
  }, []);

  const setVersion = useCallback((v: UIVersion) => {
    setVersionState(v);
    AsyncStorage.setItem(STORAGE_KEY_VERSION, v).catch((e) =>
      console.error('UIVersionContext setVersion persist failed:', e)
    );
  }, []);

  const dismissInvite = useCallback(() => {
    setInviteDismissed(true);
    AsyncStorage.setItem(STORAGE_KEY_INVITE, 'true').catch((e) =>
      console.error('UIVersionContext dismissInvite persist failed:', e)
    );
  }, []);

  return (
    <UIVersionContext.Provider value={{ version, setVersion, inviteDismissed, dismissInvite }}>
      {children}
    </UIVersionContext.Provider>
  );
};

export function useUIVersion(): UIVersionContextValue {
  const ctx = useContext(UIVersionContext);
  if (!ctx) throw new Error('useUIVersion must be used within a UIVersionProvider');
  return ctx;
}

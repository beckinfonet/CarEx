import React, {
  createContext, useContext, useEffect, useRef, useState, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';

const STORAGE_KEY = '@carex.personality.tier.v1';
const DEFAULT_TIER: PersonalityTier = 'wholesome';
const CYCLE_ORDER: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

/** Canonical display order for the three tiers — exported for non-cycling consumers (e.g. picker sheet). */
export const ALL_TIERS: PersonalityTier[] = CYCLE_ORDER;

function isTier(v: unknown): v is PersonalityTier {
  return v === 'wholesome' || v === 'sarcastic' || v === 'unhinged';
}

interface PersonalityContextType {
  tier: PersonalityTier;
  setTier: (tier: PersonalityTier) => void;
  cycleTier: () => void;
}

const PersonalityContext = createContext<PersonalityContextType | undefined>(undefined);

export const PersonalityProvider = ({ children }: { children: ReactNode }) => {
  const [tier, setTierState] = useState<PersonalityTier>(DEFAULT_TIER);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (isTier(stored)) setTierState(stored);
      } catch (e) {
        console.error('[PersonalityContext] hydrate failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist tier changes. Skip the initial mount so the DEFAULT_TIER value
  // doesn't overwrite a freshly-hydrated stored value (and avoids one redundant
  // AsyncStorage write on every app launch).
  const persistMountRef = useRef(true);
  useEffect(() => {
    if (persistMountRef.current) {
      persistMountRef.current = false;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, tier).catch((e) => {
      console.error('[PersonalityContext] persist failed', e);
    });
  }, [tier]);

  const setTier = (next: PersonalityTier) => {
    setTierState(next);
  };

  const cycleTier = () => {
    setTierState((current) => {
      const nextIdx = (CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length;
      return CYCLE_ORDER[nextIdx];
    });
  };

  return (
    <PersonalityContext.Provider value={{ tier, setTier, cycleTier }}>
      {children}
    </PersonalityContext.Provider>
  );
};

export const usePersonality = () => {
  const ctx = useContext(PersonalityContext);
  if (!ctx) {
    throw new Error('usePersonality must be used within a PersonalityProvider');
  }
  return ctx;
};

import React, {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';

const STORAGE_KEY = '@carex.personality.tier.v1';
const DEFAULT_TIER: PersonalityTier = 'wholesome';
const CYCLE_ORDER: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

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

  const setTier = (next: PersonalityTier) => {
    setTierState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((e) => {
      console.error('[PersonalityContext] persist failed', e);
    });
  };

  const cycleTier = () => {
    const idx = CYCLE_ORDER.indexOf(tier);
    const nextIdx = (idx + 1) % CYCLE_ORDER.length;
    setTier(CYCLE_ORDER[nextIdx]);
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

import React, {
  createContext, useContext, useEffect, useRef, useState, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PersonalityTier = 'wholesome' | 'sarcastic' | 'unhinged';

const STORAGE_KEY = '@carex.personality.tier.v1';
const UNHINGED_ACCEPTED_KEY = '@carex.personality.unhinged.accepted.v1';
const DEFAULT_TIER: PersonalityTier = 'wholesome';
const CYCLE_ORDER: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

/** Canonical display order for the three tiers — exported for non-cycling consumers (e.g. picker sheet). */
export const ALL_TIERS: PersonalityTier[] = CYCLE_ORDER;

function isTier(v: unknown): v is PersonalityTier {
  return v === 'wholesome' || v === 'sarcastic' || v === 'unhinged';
}

/**
 * Result of a tier-change request:
 * - 'switched' — the tier state was updated to the requested value.
 * - 'needs-consent' — the caller asked for UNHINGED but the user has not yet
 *   accepted the consent gate; the tier was NOT updated. Caller should open
 *   the consent modal and call acceptUnhinged() before retrying.
 */
export type TierChangeResult = 'needs-consent' | 'switched';

interface PersonalityContextType {
  tier: PersonalityTier;
  setTier: (tier: PersonalityTier) => void;
  cycleTier: () => TierChangeResult;
  requestTier: (tier: PersonalityTier) => TierChangeResult;
  unhingedAccepted: boolean;
  acceptUnhinged: () => void;
}

const PersonalityContext = createContext<PersonalityContextType | undefined>(undefined);

export const PersonalityProvider = ({ children }: { children: ReactNode }) => {
  const [tier, setTierState] = useState<PersonalityTier>(DEFAULT_TIER);
  const [unhingedAccepted, setUnhingedAccepted] = useState<boolean>(false);

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
      try {
        const storedAccepted = await AsyncStorage.getItem(UNHINGED_ACCEPTED_KEY);
        if (cancelled) return;
        setUnhingedAccepted(storedAccepted === 'true');
      } catch (e) {
        console.error('[PersonalityContext] hydrate unhinged-accepted failed', e);
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

  const acceptUnhinged = () => {
    setUnhingedAccepted(true);
    AsyncStorage.setItem(UNHINGED_ACCEPTED_KEY, 'true').catch((e) => {
      console.error('[PersonalityContext] persist unhinged-accepted failed', e);
    });
  };

  const requestTier = (next: PersonalityTier): TierChangeResult => {
    if (next === 'unhinged' && !unhingedAccepted) return 'needs-consent';
    setTierState(next);
    return 'switched';
  };

  const cycleTier = (): TierChangeResult => {
    const nextIdx = (CYCLE_ORDER.indexOf(tier) + 1) % CYCLE_ORDER.length;
    const next = CYCLE_ORDER[nextIdx];
    if (next === 'unhinged' && !unhingedAccepted) return 'needs-consent';
    setTierState(next);
    return 'switched';
  };

  return (
    <PersonalityContext.Provider
      value={{ tier, setTier, cycleTier, requestTier, unhingedAccepted, acceptUnhinged }}
    >
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

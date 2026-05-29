import React, { createContext, useState, useContext, useEffect, useRef, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

/**
 * FavoritesContext — single source of truth for the listing-card heart icon.
 *
 * Storage shape (kept compatible with the legacy CarDetailsScreen + FavoritesScreen
 * implementations that wrote/read AsyncStorage directly):
 *   Key:   'favorites'
 *   Value: JSON.stringify(carIdsArray)   // e.g. '["abc123","def456"]'
 *
 * Per-user reset mirrors CartContext.tsx:51-64 — when `user.localId` transitions
 * from one value to another, in-memory state is cleared so the next user doesn't
 * see the previous user's hearts. AsyncStorage is NOT cleared on logout (matches
 * CartContext behavior); the next user starts with an empty Set and overwrites on
 * first toggle. See PLAN.md threat T-MN8-02.
 */

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const prevUidRef = useRef<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('favorites');
        if (cancelled) return;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavoriteIds(new Set(parsed.filter((id): id is string => typeof id === 'string')));
          }
        }
      } catch (e) {
        console.error('Failed to load favorites', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-user reset: clear in-memory Set on user.localId transition.
  // Mirrors CartContext.tsx:57-64 (skip-on-mount via prevUidRef sentinel).
  useEffect(() => {
    const currentUid = user?.localId || null;
    if (prevUidRef.current !== null && prevUidRef.current !== currentUid) {
      setFavoriteIds(new Set());
    }
    prevUidRef.current = currentUid;
  }, [user?.localId]);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Persist alongside state update. Fire-and-forget; errors logged.
      AsyncStorage.setItem('favorites', JSON.stringify(Array.from(next))).catch(e =>
        console.error('Failed to persist favorites', e),
      );
      return next;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within a FavoritesProvider');
  return context;
};

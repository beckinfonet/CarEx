import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from '../constants/translations';
import { AuthService } from '../services/AuthService';

type Language = 'RU' | 'EN';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof TRANSLATIONS.RU;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Persistence key for the user's chosen UI language (NI18N-02).
 */
const LANGUAGE_KEY = '@carex_language';

/**
 * LanguageProvider — persistent language selection (NI18N-02).
 *
 * Hydrates from AsyncStorage on mount (default 'RU' when absent), and on
 * setLanguage persists to AsyncStorage AND — only when a user is logged in — to
 * the backend via PUT /api/users/:uid (AuthService.updateBackendUser; language
 * is a user-profile field, MOB-01 does not apply).
 *
 * The uid is read lazily from the stored userData (AuthService.getUserData) at
 * setLanguage time rather than via useAuth(). This provider sits BELOW
 * StripeProvider in App.tsx (RESEARCH Pitfall 6) — adding useAuth here would
 * require reordering the provider stack, which risks the no-breaking-changes
 * constraint. The lazy read keeps the provider order untouched and naturally
 * guards the backend write: no stored user → no backend call (no crash before
 * auth is ready). The hydrate effect mirrors FavoritesContext.tsx:34-53
 * (cancellable on unmount).
 */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('RU'); // Default to Russian

  // Hydrate from AsyncStorage on mount (cancellable; mirrors FavoritesContext).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (cancelled) return;
        if (stored === 'RU' || stored === 'EN') {
          setLanguageState(stored);
        }
      } catch (e) {
        console.error('Failed to load language', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Persist locally (fire-and-forget) so the choice survives restart.
    AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(e =>
      console.error('Failed to persist language', e),
    );
    // Persist to the backend ONLY when a user is logged in. Read the uid lazily
    // from stored userData so this provider never depends on useAuth (no App.tsx
    // reorder) and never fires a backend write before auth is ready.
    (async () => {
      try {
        const userData = await AuthService.getUserData();
        const uid = userData?.localId;
        if (uid) {
          await AuthService.updateBackendUser(uid, { language: lang });
        }
      } catch (e) {
        console.error('Failed to persist language to backend', e);
      }
    })();
  }, []);

  const t = TRANSLATIONS[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

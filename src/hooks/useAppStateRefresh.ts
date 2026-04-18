import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type RefreshFn = () => Promise<unknown>;

/**
 * Subscribes to AppState transitions. On background→active (or inactive→active),
 * invokes `refresh`. Pass `null` or `undefined` as `refresh` to disable (e.g. when
 * logged out, D-16).
 *
 * Cooldown / dedupe is the caller's responsibility — AuthContext.refreshUser owns
 * the 30s cooldown shared with the 403 interceptor path (see Plan 04-04 + 04-CONTEXT
 * D-14/D-15). The `cooldownMs` option is accepted-but-ignored here so Plan 04-06
 * can pass `{ cooldownMs: 30_000 }` from App.tsx without an API break when/if a
 * future refactor moves cooldown ownership back into the hook.
 */
export const useAppStateRefresh = (
  refresh: RefreshFn | null | undefined,
  _options: { cooldownMs?: number } = {},
) => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      // Fire only on the background→active (or inactive→active) transition per D-13.
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        if (!refresh) return; // D-16: caller passes null/undefined when logged out
        refresh().catch((err) =>
          console.error('AppState foreground refresh failed', err),
        );
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);
};

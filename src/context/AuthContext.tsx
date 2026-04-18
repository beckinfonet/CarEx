import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { AuthService } from '../services/AuthService';
import {
  setTokenProvider,
  setModerationRefreshListener,
} from '../services/http/client';

  interface AuthContextType {
    user: any;
    loading: boolean;
    isAdmin: boolean;
    adminRole: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    requestSeller: () => Promise<void>;
    requestBroker: () => Promise<void>;
    requestLogistics: () => Promise<void>;
    verifyPhone: (code: string) => Promise<void>;
    sendPhoneOtp: () => Promise<void>;
    deleteAccount: () => Promise<void>;
  }

  const AuthContext = createContext<AuthContextType | undefined>(undefined);

  export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminRole, setAdminRole] = useState<string | null>(null);

    // Plan 04-04: cross-call state held in refs so interceptors (which read
    // synchronously) and concurrent callers share the same values.
    //   - currentIdTokenRef: latest Firebase idToken; exposed to the request
    //     interceptor via the getter passed to setTokenProvider (D-04).
    //   - refreshInFlightRef: in-flight refresh promise so parallel callers
    //     await the same fetch (D-15 dedupe).
    //   - lastRefreshAtRef: wall-clock timestamp of the last successful
    //     refresh; shared between AppState + 403-interceptor paths to enforce
    //     the 30s cooldown (04-CONTEXT specifics line 246).
    const currentIdTokenRef = useRef<string | null>(null);
    const refreshInFlightRef = useRef<Promise<any> | null>(null);
    const lastRefreshAtRef = useRef<number>(0);
    // WR-02 (Phase 4 review): monotonic counter bumped on logout so an
    // in-flight refresh that resolves AFTER logout can detect the mismatch
    // and skip its setUser — otherwise a late backendUser would spread onto
    // userRef.current (null) and resurrect the logged-out user.
    const refreshGenerationRef = useRef<number>(0);

    // Keep the latest `user` visible to the refresh listener closure without
    // reintroducing the effect on every user-state change. The listener fires
    // on a 403 at arbitrary times, so it must read the freshest `user` by ref.
    const userRef = useRef<any>(null);
    useEffect(() => {
      userRef.current = user;
    }, [user]);

    // Internal refresh — shared implementation used by both the public
    // `refreshUser` AND the moderationRefreshListener wired on mount.
    //   - `skipInterceptor: true` sets the loop-guard axios config flag on
    //     the refresh request so the response interceptor in
    //     src/services/http/client.ts does NOT recurse (D-11).
    //   - Dedupe (D-15) + 30s cooldown + D-16 logged-out skip all live here so
    //     the two entry points (AppState foreground, 403 interceptor) share a
    //     single policy enforcement point.
    //
    // Grep-bait invariant (04-CONTEXT specifics line 238): the loop-guard
    // flag string below is the 2-of-2 legitimate occurrence in mobile
    // source. Plan 04-01's client.ts holds the 1-of-2.
    // WR-03 (Phase 4 review): all public callbacks exposed via the context
    // value are memoized with useCallback so their identity is stable across
    // re-renders of AuthProvider. This stops useAppStateRefresh (App.tsx)
    // from tearing down + re-subscribing the AppState listener on every
    // render. Dependency arrays are intentionally empty for ref/setter-only
    // callbacks; user-reading callbacks list [user] to re-bind on user change
    // (still far fewer rebuilds than on every render).
    const checkAdminStatus = useCallback(async (uid: string) => {
      try {
        const status = await AuthService.getAdminStatus(uid);
        setIsAdmin(status.isAdmin);
        setAdminRole(status.isAdmin ? status.role : null);
      } catch {
        setIsAdmin(false);
        setAdminRole(null);
      }
    }, []);

    const refreshUserInternal = useCallback(async ({
      skipInterceptor,
      force = false,
    }: {
      skipInterceptor: boolean;
      // WR-01 (Phase 4 review): explicit user-initiated refreshes (e.g.
      // requestSeller, verifyPhone) pass `force: true` to bypass the shared
      // 30s cooldown. Dedupe and the logged-out guard still apply — only
      // the cooldown is skipped. Passive callers (AppState foreground,
      // screens polling on mount) continue to honor the cooldown.
      force?: boolean;
    }): Promise<void> => {
      const currentUser = userRef.current;
      if (!currentUser?.localId) {
        // D-16: no-op when logged out. Avoids useless `/api/users/undefined`.
        return;
      }

      if (refreshInFlightRef.current) {
        // D-15 dedupe: share the in-flight promise with concurrent callers.
        await refreshInFlightRef.current;
        return;
      }

      const now = Date.now();
      if (!force && now - lastRefreshAtRef.current < 30_000) {
        // Shared 30s cooldown for AppState + 403-interceptor paths.
        // Bypassed when `force` is set so explicit user actions always
        // surface their backend state mutation.
        return;
      }

      const uid = currentUser.localId;
      // WR-02: snapshot the generation before we await the network. If
      // logout bumps the counter while we're in flight, we drop the result.
      const myGen = refreshGenerationRef.current;
      refreshInFlightRef.current = (async () => {
        try {
          const config = skipInterceptor
            ? { _skipModerationInterceptor: true }
            : undefined;
          const backendUser = await AuthService.getBackendUser(uid, config);
          // WR-02: stale result after logout → drop, do not setUser.
          if (refreshGenerationRef.current !== myGen) return;
          if (backendUser) {
            const updatedUser = { ...userRef.current, ...backendUser };
            setUser(updatedUser);
            await checkAdminStatus(uid);
          }
          lastRefreshAtRef.current = Date.now();
        } finally {
          refreshInFlightRef.current = null;
        }
      })();

      await refreshInFlightRef.current;
    }, [checkAdminStatus]);

    // Public refreshUser — AppState handler, screens, and internal callers.
    // Default path does NOT skip the interceptor: a 403 during a normal
    // refresh is still caught by the interceptor, which calls the listener
    // (which IS configured with skipInterceptor=true). One-level recursion
    // bounded by design.
    const refreshUser = useCallback(async (): Promise<void> => {
      await refreshUserInternal({ skipInterceptor: false });
    }, [refreshUserInternal]);

    // WR-01 (Phase 4 review): explicit user-initiated refresh that bypasses
    // the 30s cooldown. Used after mutations like requestSeller/Broker/
    // Logistics and verifyPhone so the UI reflects the server's new state
    // even when a prior passive refresh happened within the cooldown window.
    const refreshUserForced = useCallback(async (): Promise<void> => {
      await refreshUserInternal({ skipInterceptor: false, force: true });
    }, [refreshUserInternal]);

    useEffect(() => {
      // Register client-level listeners BEFORE loadStorageData so the very
      // first network call (inside loadStorageData → getBackendUser) already
      // sees a configured tokenProvider. Order matters (04-PATTERNS).
      setTokenProvider(() => currentIdTokenRef.current);
      setModerationRefreshListener(async () => {
        // Listener path MUST set the skip flag to avoid interceptor recursion
        // on the refresh request itself (D-11).
        //
        // Fix for CR-01 (Phase 4 review): the listener fetches DIRECTLY
        // rather than delegating to refreshUserInternal so it bypasses the
        // dedupe guard. Otherwise, if the public `refreshUser()` (which does
        // NOT skip the interceptor) hits a 403, the interceptor awaits the
        // listener, which would await the same in-flight promise (set by the
        // original caller) — circular await → deadlock. By going direct,
        // the listener can complete while the caller's promise is still
        // pending, letting the interceptor resolve and the caller surface
        // the ModerationError. Cooldown is also bypassed here because a 403
        // is an authoritative signal that our cached user state is stale.
        const currentUser = userRef.current;
        if (!currentUser?.localId) return;
        // WR-02: snapshot generation so a mid-await logout invalidates us.
        const myGen = refreshGenerationRef.current;
        try {
          const backendUser = await AuthService.getBackendUser(
            currentUser.localId,
            { _skipModerationInterceptor: true },
          );
          // WR-02: if logout bumped the generation while we were awaiting,
          // drop the result so we don't resurrect a logged-out user.
          if (refreshGenerationRef.current !== myGen) return;
          if (backendUser) {
            setUser({ ...userRef.current, ...backendUser });
            await checkAdminStatus(currentUser.localId);
          }
          lastRefreshAtRef.current = Date.now();
        } catch (err) {
          console.error('Moderation refresh listener fetch failed', err);
        }
      });
      loadStorageData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadStorageData = useCallback(async () => {
      try {
        const userData = await AuthService.getUserData();
        // Hydrate the token ref from AsyncStorage so the request interceptor
        // can attach Authorization on the very first call after cold start.
        const storedToken = await AuthService.getToken();
        if (storedToken) {
          currentIdTokenRef.current = storedToken;
        }
        if (userData && userData.localId) {
          const backendUser = await AuthService.getBackendUser(userData.localId);
          setUser({ ...userData, ...backendUser });
          await checkAdminStatus(userData.localId);
        } else if (userData) {
           setUser(userData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, [checkAdminStatus]);

    const login = useCallback(async (email: string, password: string) => {
      const data = await AuthService.signIn(email, password);
      // Sync the token ref immediately after signIn resolves so any network
      // call that follows (getBackendUser below) already carries the Bearer
      // header via the shared client's request interceptor.
      currentIdTokenRef.current = data.idToken;
      let userData = { email: data.email, localId: data.localId };

      const backendUser = await AuthService.getBackendUser(data.localId);
      if (backendUser) {
          userData = { ...userData, ...backendUser };
      }

      await AuthService.saveToken(data.idToken, userData);
      setUser(userData);
      await checkAdminStatus(data.localId);
    }, [checkAdminStatus]);

    const signup = useCallback(async (email: string, password: string) => {
      const data = await AuthService.signUp(email, password);
      currentIdTokenRef.current = data.idToken;
      const userData = { email: data.email, localId: data.localId };

      // Create backend user
      await AuthService.createBackendUser(data.localId, data.email);

      await AuthService.saveToken(data.idToken, userData);
      setUser(userData);
    }, []);

    const logout = useCallback(async () => {
      // Clear the token ref FIRST — before any other teardown or awaits — so
      // the request interceptor cannot attach a stale Bearer on any call
      // triggered by the logout teardown itself.
      currentIdTokenRef.current = null;
      // WR-02: bump BEFORE any awaits so any in-flight refresh that resolves
      // after this point (either path — refreshUserInternal IIFE or the
      // moderation listener) sees the generation mismatch and drops its
      // setUser call instead of resurrecting the logged-out user.
      refreshGenerationRef.current += 1;
      await AuthService.logout();
      setUser(null);
      setIsAdmin(false);
      setAdminRole(null);
      // Reset cross-call refresh state so the next login's first refresh is
      // immediate (no stale cooldown) and no dangling promise points at the
      // pre-logout user's data.
      lastRefreshAtRef.current = 0;
      refreshInFlightRef.current = null;
    }, []);

    const requestSeller = useCallback(async () => {
      if (user && user.localId) {
        await AuthService.requestSellerStatus(user.localId);
        // WR-01: explicit user action — bypass the 30s cooldown so the
        // pending-request UI shows up immediately instead of waiting for
        // the next AppState foreground transition.
        await refreshUserForced();
      }
    }, [user, refreshUserForced]);

    const requestBroker = useCallback(async () => {
      if (user && user.localId) {
        await AuthService.requestBrokerStatus(user.localId);
        // WR-01: explicit user action — bypass cooldown.
        await refreshUserForced();
      }
    }, [user, refreshUserForced]);

    const requestLogistics = useCallback(async () => {
      if (user && user.localId) {
        await AuthService.requestLogisticsStatus(user.localId);
        // WR-01: explicit user action — bypass cooldown.
        await refreshUserForced();
      }
    }, [user, refreshUserForced]);

    const sendPhoneOtp = useCallback(async () => {
      if (!user?.phoneNumber || !user?.localId) return;
      const phoneNumber = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber.replace(/\s/g, '')}`;
      await AuthService.sendOtp(phoneNumber);
    }, [user]);

    const verifyPhone = useCallback(async (code: string) => {
      if (!user?.phoneNumber || !user?.localId) return;
      await AuthService.verifyOtp(user.phoneNumber, code, user.localId);
      // WR-01: explicit user action — bypass cooldown so isPhoneVerified
      // flips to true immediately.
      await refreshUserForced();
    }, [user, refreshUserForced]);

    const deleteAccount = useCallback(async () => {
        if (user && user.localId) {
            const token = await AuthService.getToken();
            if (token) {
                await AuthService.deleteAccount(token, user.localId);
                await logout();
            }
        }
    }, [user, logout]);

    // WR-03: memoize the context value so consumers of useAuth() only
    // re-render when actual state (user/loading/isAdmin/adminRole) changes
    // — not on every AuthProvider render. All callback identities are
    // already stable via useCallback above.
    const contextValue = useMemo(
      () => ({
        user,
        loading,
        isAdmin,
        adminRole,
        login,
        signup,
        logout,
        refreshUser,
        requestSeller,
        requestBroker,
        requestLogistics,
        sendPhoneOtp,
        verifyPhone,
        deleteAccount,
      }),
      [
        user,
        loading,
        isAdmin,
        adminRole,
        login,
        signup,
        logout,
        refreshUser,
        requestSeller,
        requestBroker,
        requestLogistics,
        sendPhoneOtp,
        verifyPhone,
        deleteAccount,
      ],
    );

    return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    );
  };

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

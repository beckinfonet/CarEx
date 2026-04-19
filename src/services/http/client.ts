// Shared axios client for all carEx backend calls.
//
// Scope (D-01): baseURL = API_URL — only carEx-backend-bound requests.
// Firebase Identity REST calls remain on plain `axios` by design: they are a
// different auth surface (API key in the query string, not idToken in the
// Authorization header). Never import this client from those call sites.
//
// Interceptors:
//   - Request (D-02, D-04): Unconditional Bearer injection whenever
//     tokenProvider() returns a non-null value. baseURL already scopes URLs,
//     so no URL-matching check is needed on config.url.
//   - Response (D-09, D-10, D-11): On HTTP 403 with body.error matching the
//     suspension code, await the registered moderationRefreshListener
//     (Plan 04-04 points it at AuthContext.refreshUser), then throw a typed
//     ModerationError. Callers can opt out via the loop-guard config flag
//     to prevent recursion on the refresh path itself.
//
// Grep-bait invariants enforced by Plan 04-01 acceptance criteria:
//   - The loop-guard flag name appears exactly TWICE in this file (the
//     declaration-merged property + the boolean read in the response
//     interceptor). Plan 04-04 adds the second legitimate codebase occurrence
//     at the refreshUser call site.
//   - The suspension discriminator string is extracted to ACCOUNT_SUSPENDED
//     below so it appears only once as a literal; the discriminator check and
//     the ModerationError code argument both reference the constant.

import axios, { AxiosRequestConfig } from 'axios';
import { API_URL } from '../../constants/config';
import { ModerationError } from '../moderation/errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipModerationInterceptor?: boolean;
    // Plan 05-12 (UAT Test 8): set on the refresh request itself to bypass the
    // 401 interceptor (would loop otherwise — the refresh endpoint hits a
    // different host, but kept symmetric to the moderation skip flag for
    // future-proofing if the refresh path ever crosses apiClient).
    _skipIdTokenRefresh?: boolean;
    // Internal flag: set by the 401 interceptor on the retry attempt so a
    // second 401 on the same request short-circuits to logout instead of
    // recursing into another refresh attempt.
    _idTokenRefreshAttempted?: boolean;
  }
}

// Single source of truth for the backend suspension discriminator string
// (Phase 3 D-15). Both the interceptor match and the thrown ModerationError
// code reference this constant.
const ACCOUNT_SUSPENDED = 'account_suspended';

// Module-level getters registered by AuthContext on mount (D-04, D-09).
// `let` (not React state) gives synchronous reads inside interceptors.
let tokenProvider: (() => string | null) | null = null;
export function setTokenProvider(fn: () => string | null) {
  tokenProvider = fn;
}

let moderationRefreshListener: (() => Promise<void>) | null = null;
export function setModerationRefreshListener(fn: () => Promise<void>) {
  moderationRefreshListener = fn;
}

// Plan 05-12: 401-triggered idToken refresh listener. AuthContext registers a
// single-flight refresher here on mount. The listener returns the new idToken
// on success, or null when the refresh permanently failed (TOKEN_EXPIRED /
// INVALID_REFRESH_TOKEN / USER_DISABLED — caller should bounce to logout).
let idTokenRefreshListener: (() => Promise<string | null>) | null = null;
export function setIdTokenRefreshListener(
  fn: () => Promise<string | null>,
) {
  idTokenRefreshListener = fn;
}

// Plan 05-12: AuthContext-registered logout trigger. Called by the 401
// interceptor when the listener returned null (permanent refresh failure)
// OR when a request 401s a SECOND time after the retry. Listener-style
// (rather than a direct AuthContext import) avoids a circular dep between
// http/client and context/AuthContext.
let logoutTrigger: (() => Promise<void>) | null = null;
export function setLogoutTrigger(fn: () => Promise<void>) {
  logoutTrigger = fn;
}

// Shared instance — every `apiClient.xxx` call is scoped to the carEx backend.
export const apiClient = axios.create({ baseURL: API_URL });

// Request interceptor — unconditional Bearer per D-02.
apiClient.interceptors.request.use((config) => {
  const token = tokenProvider?.();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — moderation 403 handler (D-09, D-10, D-11).
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const res = err.response;
    const isAcctSuspended =
      res?.status === 403 && res?.data?.error === ACCOUNT_SUSPENDED;
    const skipFlag =
      (err.config as AxiosRequestConfig | undefined)
        ?._skipModerationInterceptor === true;

    if (isAcctSuspended && !skipFlag) {
      try {
        await moderationRefreshListener?.();
      } catch (refreshErr) {
        // Swallow: we still want to surface ModerationError to the caller.
        console.error('Moderation refresh listener failed', refreshErr);
      }
      throw new ModerationError(
        ACCOUNT_SUSPENDED,
        res.data?.status,
        res.data?.reasonCategory,
        res.data?.note,
        403,
      );
    }

    throw err;
  },
);

// Plan 05-12 (UAT Test 8): 401-triggered idToken refresh + single retry.
// Registered AFTER the 403 interceptor so the 403 handler runs FIRST on its
// own status code path. On 401:
//   1. If refresh is opted-out (loop guard) OR already attempted on this
//      request, propagate the error (and trigger logout if it's the
//      "second 401 in a row" case → permanent auth failure).
//   2. Otherwise, await the registered listener (single-flight refresh).
//      On success, mutate the original config's Authorization header with
//      the new token, mark the request as "attempted", and re-issue via
//      apiClient(config). On failure, propagate the original 401 (the
//      listener itself triggered logout via setLogoutTrigger).
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config: AxiosRequestConfig | undefined = err.config;
    const status = err.response?.status;
    if (status !== 401 || !config) throw err;

    if (config._skipIdTokenRefresh || config._idTokenRefreshAttempted) {
      // Already tried once — trigger logout for permanent auth failure.
      if (config._idTokenRefreshAttempted && logoutTrigger) {
        try {
          await logoutTrigger();
        } catch (logoutErr) {
          console.error('Logout trigger failed after second 401', logoutErr);
        }
      }
      throw err;
    }

    if (!idTokenRefreshListener) {
      // No listener registered — fail open and propagate the original error.
      throw err;
    }

    let newToken: string | null = null;
    try {
      newToken = await idTokenRefreshListener();
    } catch (refreshErr) {
      console.error('idToken refresh listener failed', refreshErr);
      throw err;
    }
    if (!newToken) {
      // Listener already triggered logout (returned null on permanent
      // failure). Propagate the original 401 to the caller.
      throw err;
    }

    // Single retry with the new token. Mark the request as attempted so a
    // recurring 401 on the same request short-circuits next time around.
    config._idTokenRefreshAttempted = true;
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${newToken}`;
    return apiClient(config);
  },
);

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

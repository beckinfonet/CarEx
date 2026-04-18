# Phase 4: Mobile Plumbing (Mobile) - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 8 (4 NEW, 3 MODIFIED, 1+ test file NEW)
**Analogs found:** 8 / 8

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/services/http/client.ts` | NEW | service (shared HTTP client) | request-response + interceptor | `src/services/AuthService.ts` (axios + API_URL top-of-file) | role-match (no prior interceptor pattern) |
| `src/services/moderation/ModerationService.ts` | NEW | service (object-module wrapping 7 admin writes + 1 read) | request-response | `src/services/AuthService.ts` (object-module pattern, per-method try/catch) | exact (same role + data flow) |
| `src/services/moderation/errors.ts` | NEW (optional) | utility (typed error class) | transform (normalizes axios errors) | No direct analog — RESEARCH fallback | no analog |
| `src/hooks/useAppStateRefresh.ts` | NEW | hook (listener wrapper) | event-driven (AppState transitions) | `src/hooks/useNetwork.ts` (subscribe/unsubscribe pattern) | exact (same role + data flow) |
| `src/context/AuthContext.tsx` | MODIFIED | provider (auth state + refresh dedupe + token provider registration) | request-response + event | `src/context/AuthContext.tsx:29-68` (self — extending the existing refreshUser + init effect) | self-reference |
| `src/services/AuthService.ts` | MODIFIED | service (migrate backend-facing calls to shared client) | request-response | `src/services/AuthService.ts:70-96` (self — swap `axios.` → shared client for backend URLs) | self-reference |
| `App.tsx` | MODIFIED | entry (mount hook inside AuthProvider subtree) | event-driven | `App.tsx:54-98` + `OfflineNotice` at line 62 (root-mounted listener consumer) | self-reference |
| Test files (TBD path) | NEW | test | request-response / event-driven | `__tests__/App.test.tsx` (jest + react-test-renderer harness) | role-match (minimal pre-existing test pattern) |

## Pattern Assignments

### `src/services/http/client.ts` (NEW — service, interceptor)

**Analog:** `src/services/AuthService.ts:1-10` (axios + API_URL import block — the top-of-file shape every service in this codebase starts with)

**Imports pattern** (lines 1-3 of AuthService):
```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/config';
```

Copy verbatim: `import axios from 'axios';` and `import { API_URL } from '../constants/config';` — the `AsyncStorage` import is NOT needed here (per D-04 the token provider is a module-level getter set by AuthContext; interceptor never touches AsyncStorage).

**Instance creation pattern** (new — no codebase analog; follows D-01 + D-04 from CONTEXT):
```typescript
// From 04-CONTEXT D-04 — copy verbatim into this file
let tokenProvider: (() => string | null) | null = null;
export function setTokenProvider(fn: () => string | null) { tokenProvider = fn; }

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = tokenProvider?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Per CONTEXT specifics line 248: `baseURL` already scopes URL-matching — the interceptor body is a one-liner, no URL check needed.

**Response interceptor pattern** (new — follows D-09 + D-11 from CONTEXT):
```typescript
// Registered refresh listener — AuthContext sets this on mount (same idea as setTokenProvider).
let moderationRefreshListener: (() => Promise<void>) | null = null;
export function setModerationRefreshListener(fn: () => Promise<void>) {
  moderationRefreshListener = fn;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const res = err.response;
    const isAcctSuspended =
      res?.status === 403 && res?.data?.error === 'account_suspended';
    if (isAcctSuspended && !err.config?._skipModerationInterceptor) {
      try { await moderationRefreshListener?.(); } catch { /* swallow — log in listener */ }
      throw new ModerationError(
        'account_suspended',
        res.data.status,
        res.data.reasonCategory,
        res.data.note,
        403,
      );
    }
    throw err;
  }
);
```

**Error handling convention to MIRROR** (AuthService.ts:13-22 — per-method try/catch → re-throw):
```typescript
try {
  const response = await axios.post(...);
  return response.data;
} catch (error) {
  throw error.response ? error.response.data.error : error;
}
```

Callers of the shared client continue this convention. The 403-interceptor only specializes one branch (`account_suspended`) — every other failure remains a normal axios rejection for the caller's try/catch.

---

### `src/services/moderation/ModerationService.ts` (NEW — service, CRUD-style request-response)

**Analog:** `src/services/AuthService.ts:11, 245-293` (object-module export shape + "Admin Methods" section — the closest structural sibling)

**Module shape pattern** (AuthService.ts:11 + closing line 376):
```typescript
export const AuthService = {
  methodA: async (...) => { ... },
  methodB: async (...) => { ... },
  // ...
};
```

Mirror as:
```typescript
import { apiClient } from '../http/client';
import { ModerationError } from './errors'; // or inline in this file per D-07

export const ModerationService = {
  // --- Admin writes ---
  suspend: async (targetUid: string, body: { ... }) => { ... },
  unsuspend: async (targetUid: string) => { ... },
  revokeRole: async (targetUid: string, body: { ... }) => { ... },
  restoreRole: async (targetUid: string, body: { ... }) => { ... },
  editProviderProfile: async (targetUid: string, body: any) => { ... },
  deleteProviderProfile: async (targetUid: string) => { ... },

  // --- Reads ---
  getHistory: async (targetUid: string) => { ... }, // Phase 5 stub per D-05 / Discretion
};
```

**Per-method pattern to mirror** (AuthService.ts:245-253 — `approveRequest`, the closest shape to ModerationService methods: admin-gated POST with body):
```typescript
approveRequest: async (callerUid: string, targetUid: string, type: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/admin/requests/${targetUid}/approve`, { callerUid, type });
    return response.data;
  } catch (error) {
    console.error('Failed to approve request', error);
    throw error;
  }
},
```

Adapt verbatim for each ModerationService method:
```typescript
suspend: async (targetUid: string, body: {
  severity: 'blocked_with_review' | 'permanently_banned' | 'feature_limited';
  reasonCategory: string;
  reasonNote?: string;
  callerUid: string; // per Phase 3 D-03 dual-accept, still send in body until Phase 6 QUAL-03
}) => {
  try {
    const response = await apiClient.post(`/api/admin/moderation/${targetUid}/suspend`, body);
    return response.data;
  } catch (error) {
    console.error('Failed to suspend user', error);
    throw error; // response interceptor already converted 403 account_suspended → ModerationError
  }
},
```

Two key differences from AuthService methods:
1. **Use `apiClient` not `axios`** — inherits Bearer auto-injection + 403 interceptor
2. **URL is path-only** (`/api/admin/moderation/...`) — `baseURL` on the instance prepends `API_URL`

**Method signature mapping to Phase 2 backend routes** (from CONTEXT D-05):
| Method | HTTP | Path |
|--------|------|------|
| `suspend` | POST | `/api/admin/moderation/:targetUid/suspend` |
| `unsuspend` | PATCH | `/api/admin/moderation/:targetUid/unsuspend` |
| `revokeRole` | POST | `/api/admin/moderation/:targetUid/revoke-role` |
| `restoreRole` | POST | `/api/admin/moderation/:targetUid/restore-role` |
| `editProviderProfile` | POST | `/api/admin/moderation/:targetUid/edit-profile` |
| `deleteProviderProfile` | DELETE | `/api/admin/moderation/:targetUid/provider-profile` |
| `getHistory` | GET | `/api/admin/moderation/:targetUid/history` (Phase 5 — ship as stub per Discretion) |

**Stub pattern for `getHistory`** (per Claude's Discretion bullet):
```typescript
getHistory: async (targetUid: string) => {
  // Phase 5 adds GET /api/admin/moderation/:targetUid/history.
  // Shipping a stub now so consumers can type-check; throws until route exists.
  throw new Error('Not implemented — Phase 5 adds the /history route');
  // Post-Phase-5 replacement:
  // const response = await apiClient.get(`/api/admin/moderation/${targetUid}/history`);
  // return response.data;
},
```

---

### `src/services/moderation/errors.ts` (NEW optional — utility, transform)

**Analog:** None in existing codebase — the `ModerationError` class is the first typed error class in the app.

**Copy verbatim from CONTEXT D-07:**
```typescript
export class ModerationError extends Error {
  constructor(
    public code: 'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string,
    public status?: string,        // moderationStatus.state — 'blocked_with_review' | 'feature_limited' | …
    public reasonCategory?: string,
    public note?: string,
    public httpStatus?: number,
  ) {
    super(`ModerationError: ${code}`);
    this.name = 'ModerationError'; // preserve class name after transpile
  }
}
```

Per CONTEXT specifics line 242: extends `Error` (not plain object) so `instanceof ModerationError` is reliable across the screens that will `catch (err)` in Phase 5/6.

**Planner decision:** planner may inline this class at the top of `ModerationService.ts` instead of a separate file — CONTEXT D-07 notes either is acceptable. Rationale for separation: Phase 5/6 can import the type without pulling in the service (avoids circular import if screens want to type-check without calling the service).

---

### `src/hooks/useAppStateRefresh.ts` (NEW — hook, event-driven)

**Analog:** `src/hooks/useNetwork.ts` — EXACT structural match. Same "subscribe on mount via addEventListener, cleanup on unmount" shape; swap `NetInfo` → `AppState`.

**Full analog source** (useNetwork.ts, lines 1-19):
```typescript
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const useNetwork = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(!!state.isConnected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return isConnected;
};
```

**Mirror shape for Phase 4** (combines analog pattern + CONTEXT D-13/D-14/D-15/D-16):
```typescript
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type RefreshFn = () => Promise<unknown>;

export const useAppStateRefresh = (
  refresh: RefreshFn | null | undefined,
  options: { cooldownMs?: number } = {},
) => {
  const cooldownMs = options.cooldownMs ?? 30_000;
  const lastRefreshAtRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      // background → active transition only
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        if (!refresh) return; // D-16: skip when logged out (caller passes null/undefined)
        const now = Date.now();
        if (now - lastRefreshAtRef.current < cooldownMs) return; // D-14: 30s cooldown
        lastRefreshAtRef.current = now;
        refresh().catch((err) => console.error('Foreground refresh failed', err));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh, cooldownMs]);
};
```

Three key shape deltas from `useNetwork`:
1. Hook returns void (no state) — it's a side-effect hook, not a reactive value hook
2. Uses `useRef` for `lastRefreshAt` and `appStateRef` (synchronous reads; not React state)
3. Accepts `refresh` callback and `options` — caller (App.tsx) passes `useAuth().refreshUser` and respects D-16 by passing `undefined` when `user === null`

Note: CONTEXT specifics line 246 calls out that the cooldown is SHARED with the 403-interceptor refreshes — so the canonical `lastRefreshAt` actually belongs inside `AuthContext.refreshUser()`, not inside this hook. Planner decides: either (a) track cooldown in hook only (simpler, acceptable minor double-refresh edge case), or (b) move cooldown into `AuthContext.refreshUser()` so both call paths share it. CONTEXT specifics lean (b).

---

### `src/context/AuthContext.tsx` (MODIFIED — provider, wire token provider + dedupe)

**Analog:** The file itself — existing patterns to extend, not replace.

**Extension point 1 — init effect** (lines 29-31, where `loadStorageData()` is currently called):
```typescript
useEffect(() => {
  loadStorageData();
}, []);
```

**Modify to register client listeners on mount** (per D-04):
```typescript
import { setTokenProvider, setModerationRefreshListener } from '../services/http/client';

// inside AuthProvider — add after existing useState block:
const currentIdTokenRef = useRef<string | null>(null);
const refreshInFlightRef = useRef<Promise<any> | null>(null);
const lastRefreshAtRef = useRef<number>(0);

useEffect(() => {
  setTokenProvider(() => currentIdTokenRef.current);
  setModerationRefreshListener(() => refreshUser({ _internal: true }));
  loadStorageData();
}, []);
```

Token caching path: `loadStorageData` and `login` already load user data; add `currentIdTokenRef.current = data.idToken` at those sites so the getter has a fresh value. The `AuthService.saveToken(data.idToken, userData)` call at line 79 tells us where login stores the token — mirror by setting the ref in the same block.

**Extension point 2 — refreshUser** (lines 61-68 — current function body):
```typescript
const refreshUser = async () => {
  if (user && user.localId) {
    const backendUser = await AuthService.getBackendUser(user.localId);
    const updatedUser = { ...user, ...backendUser };
    setUser(updatedUser);
    await checkAdminStatus(user.localId);
  }
};
```

**Wrap with dedupe per D-15 + shared cooldown per specifics line 246:**
```typescript
const refreshUser = async () => {
  if (!user?.localId) return; // D-16
  if (refreshInFlightRef.current) return refreshInFlightRef.current; // D-15 dedupe

  // shared cooldown — AppState + interceptor both respect it
  const now = Date.now();
  if (now - lastRefreshAtRef.current < 30_000) return; // skip silent

  refreshInFlightRef.current = (async () => {
    try {
      const backendUser = await AuthService.getBackendUser(user.localId);
      const updatedUser = { ...user, ...backendUser };
      setUser(updatedUser);
      await checkAdminStatus(user.localId);
      lastRefreshAtRef.current = Date.now();
      return updatedUser;
    } finally {
      refreshInFlightRef.current = null;
    }
  })();
  return refreshInFlightRef.current;
};
```

**Extension point 3 — expose refresh cooldown bypass for interceptor** (per D-11 — interceptor must call `refreshUser` with a flag that bypasses the "normal" guards when needed):
Planner decides whether the listener function wraps refreshUser with `_skipModerationInterceptor` in its AxiosRequestConfig. The cleanest shape: `AuthService.getBackendUser` should accept an optional axios config and forward it:
```typescript
// AuthService.ts modification:
getBackendUser: async (firebaseUid: string, config?: AxiosRequestConfig) => {
  try {
    const response = await apiClient.get(`/api/users/${firebaseUid}`, config);
    return response.data;
  } catch (error) {
    console.error('Failed to get backend user', error);
    return null;
  }
},

// AuthContext refreshUser modification:
const backendUser = await AuthService.getBackendUser(
  user.localId,
  { _skipModerationInterceptor: true } as any, // grep-bait: 1 of 2 allowed call sites per specifics line 238
);
```

---

### `src/services/AuthService.ts` (MODIFIED — migrate backend-facing calls to shared client)

**Analog:** The file itself — methodical swap per method.

**Keep on plain `axios`** (per D-01 anti-pattern line 224):
- `signUp` (line 12-23) — Identity Toolkit
- `signIn` (line 25-36) — Identity Toolkit
- `sendPasswordResetEmail` (line 38-48) — Identity Toolkit
- `deleteAccount` line 215 — the `${AUTH_URL}:delete` call stays on axios (the other `${API_URL}/api/users/${firebaseUid}` DELETE moves to shared client)

**Migrate to `apiClient`** (all backend-facing methods — `${API_URL}/api/...`):
- `createBackendUser` (line 70-76)
- `getBackendUser` (line 78-86) — **critical** — this is the refreshUser target
- `updateBackendUser` (line 88-96)
- `uploadAvatar` (line 98-116) — keep `Content-Type: multipart/form-data` header; shared client allows per-call header overrides
- `requestSellerStatus` / `requestBrokerStatus` / `requestLogisticsStatus` (lines 118-146)
- `getBrokerProfile` / `updateBrokerProfile` / `getLogisticsProfile` / `updateLogisticsProfile` (lines 148-190)
- `sendOtp` / `verifyOtp` (lines 192-210)
- `deleteAccount`'s backend leg: `axios.delete(\`${API_URL}/api/users/${firebaseUid}\`)` (line 214) — migrate
- All `getAdminStatus` / `getAdminRequests` / `approveRequest` / `rejectRequest` / `getAdminUsers` / `addAdminUser` / `removeAdminUser` (lines 225-293)
- `createPaymentIntent` / `confirmBooking` (lines 297-323) — note 30s timeout stays via axios config
- `createOrders` / `getBuyerOrders` / `getProviderOrders` / `updateOrderStatus` / `updateServiceStatus` (lines 327-375)

**Migration pattern — example (getBackendUser, lines 78-86):**
```typescript
// BEFORE
getBackendUser: async (firebaseUid: string) => {
  try {
    const response = await axios.get(`${API_URL}/api/users/${firebaseUid}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get backend user', error);
    return null;
  }
},

// AFTER
import { apiClient } from './http/client';

getBackendUser: async (firebaseUid: string, config?: AxiosRequestConfig) => {
  try {
    const response = await apiClient.get(`/api/users/${firebaseUid}`, config);
    return response.data;
  } catch (error) {
    console.error('Failed to get backend user', error);
    return null;
  }
},
```

Two surface changes per method:
1. `axios.X(\`${API_URL}/api/...\`)` → `apiClient.X('/api/...')` (strip `${API_URL}` prefix; `baseURL` on instance prepends it)
2. For `getBackendUser` specifically: add optional `config?: AxiosRequestConfig` so AuthContext can pass `_skipModerationInterceptor`

**Zero new methods added** — per MOB-01 guardrail and anti-pattern line 223: `grep -c 'moderation\|suspend\|revoke' src/services/AuthService.ts` must return 0 before and after.

---

### `App.tsx` (MODIFIED — mount AppState hook inside AuthProvider subtree)

**Analog:** `App.tsx:62` — `<OfflineNotice />` mounted inside NavigationContainer, consuming `useNetwork()` internally. Same root-mounted listener-consumer pattern.

**Current structure** (lines 53-99):
```typescript
function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <StripeProvider ...>
            <LanguageProvider>
            <NavigationContainer linking={linking}>
              <OfflineNotice />
              ...
```

**Option A (recommended per D-13 — minimal inline consumer component):**
```typescript
// At top of App.tsx, outside App() function:
import { useAppStateRefresh } from './src/hooks/useAppStateRefresh';
import { useAuth } from './src/context/AuthContext';

const AppStateRefreshEffect = () => {
  const { user, refreshUser } = useAuth();
  // Pass null refresh when logged out — hook D-16 guards on null/undefined
  useAppStateRefresh(user?.localId ? refreshUser : null);
  return null;
};

// Inside <AuthProvider> ... </AuthProvider> subtree, above NavigationContainer:
<AuthProvider>
  <CartProvider>
    <AppStateRefreshEffect />
    <StripeProvider ...>
      ...
```

Why a wrapper component: `useAuth()` requires being inside AuthProvider, so the hook call cannot live directly in `App()` body (which wraps AuthProvider). The same rule that forced `OfflineNotice` to be a child component applies here.

**Placement rule (D-13 verbatim):** "inside the AuthProvider subtree" + "above NavigationContainer" — matches existing `OfflineNotice` positioning.

---

### Test files (NEW — Claude's Discretion on path)

**Analog:** `__tests__/App.test.tsx` (lines 1-13) — the ONLY existing test. Minimal `react-test-renderer.act()` harness.

**Existing pattern:**
```typescript
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
```

**Recommended test targets for Phase 4** (planner decides exact paths — colocated `*.test.ts` or `__tests__/` mirrored tree):

1. `src/services/http/client.test.ts` — interceptor request header injection; 403 response → ModerationError; loop-guard via `_skipModerationInterceptor`. Use `axios-mock-adapter` (if planner adds it — it's a dev dep choice) OR `jest.mock('axios')`.
2. `src/services/moderation/ModerationService.test.ts` — mock `apiClient` and assert the 7 methods call correct path + HTTP verb.
3. `src/hooks/useAppStateRefresh.test.ts` — mock `AppState.addEventListener`, fire background→active events, assert cooldown guard + null-refresh skip.
4. `src/context/AuthContext.test.tsx` — dedupe: two parallel `refreshUser()` calls share one promise; `setTokenProvider` wired on mount.

CONTEXT Discretion: planner picks between `axios-mock-adapter` (cleaner interceptor tests) and `jest.mock('axios')` (no new dep). The codebase's CLAUDE.md + CONTEXT anti-pattern line 225 forbids "new state-management or networking libs" — `axios-mock-adapter` is a test-only helper, arguably allowed, but planner should justify.

---

## Shared Patterns

### Object-Module Service Export
**Source:** `src/services/AuthService.ts:11, 376`
**Apply to:** `ModerationService.ts`
**Why:** CLAUDE.md Conventions §Module Design — "Services: object export with methods, e.g. `export const AuthService = { ... }`". Ship as-is; do NOT class-ify.

```typescript
export const ModerationService = {
  method: async () => { ... },
};
```

### Per-Method try/catch with console.error + throw
**Source:** `src/services/AuthService.ts:118-126` (any `requestXStatus` method)
**Apply to:** All `ModerationService` methods + all migrated AuthService methods
```typescript
try {
  const response = await apiClient.post(...);
  return response.data;
} catch (error) {
  console.error('Failed to <action>', error);
  throw error;
}
```
Note: the 403 response interceptor converts `account_suspended` to `ModerationError` BEFORE this catch runs. The `throw error` in method bodies re-surfaces whatever the interceptor passed along (either raw axios error or `ModerationError`). Screens `catch (err) if (err instanceof ModerationError) { ... }`.

### Context+Hook Pattern (for `useAuth` consumers)
**Source:** `src/context/AuthContext.tsx:152-158`
**Apply to:** `AppStateRefreshEffect` wrapper component in `App.tsx`
```typescript
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```
The wrapper component MUST be mounted inside `<AuthProvider>` — mounting it above throws at runtime (consistent with `useNetwork`/`useLanguage`/`useCart`).

### Listener Hook Pattern (subscribe on mount, unsubscribe on unmount)
**Source:** `src/hooks/useNetwork.ts:7-15`
**Apply to:** `useAppStateRefresh`
```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', handler); // or NetInfo.addEventListener
  return () => {
    subscription.remove(); // AppState; NetInfo returns the unsubscribe fn directly
  };
}, []);
```
One structural delta: `AppState.addEventListener` returns a subscription object with `.remove()`; `NetInfo.addEventListener` returns an unsubscribe function directly. Handle accordingly.

### Module-Level `let` for Cross-Call State (not React state)
**Source:** CONTEXT specifics line 244 — "Dedupe promise is STORED AT MODULE LEVEL inside AuthContext, not in React state."
**Apply to:** `http/client.ts` `tokenProvider` + `moderationRefreshListener` (both are module-level `let`), `AuthContext.refreshInFlightRef` (React ref — same synchronous-read property)
```typescript
// client.ts
let tokenProvider: (() => string | null) | null = null;
export function setTokenProvider(fn: () => string | null) { tokenProvider = fn; }
```
Rationale: React `useState` updates are batched/async; module-level `let` and `useRef` give synchronous reads which matter for interceptors (synchronous code path) and dedupe guards (must see in-flight promise immediately).

### i18n String Addition
**Source:** `src/components/OfflineNotice.tsx:13, 22` + `src/constants/translations.ts`
**Apply to:** Phase 4 does NOT add user-facing strings per D-12 (banner UI deferred to Phase 6). Skip. If the planner decides to add "Refreshing account status…" toast or similar, route through `useLanguage().t` with RU + EN parity.

### Inline StyleSheet.create at bottom of file
**Source:** `src/components/OfflineNotice.tsx:27-46`
**Apply to:** Only if any Phase 4 file renders UI. Current scope is plumbing-only (no UI per D-12), so this is N/A. If `AppStateRefreshEffect` is a wrapper component returning `null`, no styles needed.

---

## No Analog Found

Files with no close pre-existing match — use RESEARCH.md conventions and CONTEXT code blocks:

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `src/services/moderation/errors.ts` | utility (typed Error) | transform | No typed error class exists in this codebase yet | Copy verbatim from CONTEXT D-07 code block |
| `src/services/http/client.ts` *(partial)* | HTTP client with interceptors | request-response | No axios-instance pattern with interceptors exists yet | Follow CONTEXT D-04, D-09, D-11 code blocks verbatim; top-of-file imports from AuthService.ts analog |

Both are new primitives for this milestone. CONTEXT includes full copy-pasteable code blocks, so no external RESEARCH excerpt is needed — planner/executor copies directly from `04-CONTEXT.md` §decisions.

---

## Cross-Cutting Anti-Pattern Reminders (surface to planner)

From CONTEXT §Anti-Pattern Warnings — these constraints shape planner choices across every plan:

1. **Do NOT add methods to `AuthService`** (MOB-01 guardrail). Phase 4 diff MUST show zero new methods in AuthService — only `axios` → `apiClient` migrations.
2. **Do NOT attach Bearer to Identity Toolkit calls.** `signUp` / `signIn` / `sendPasswordResetEmail` / `deleteAccount`'s `${AUTH_URL}:delete` leg stay on plain `axios`. Firebase rejects Authorization header on those unauthenticated endpoints.
3. **Do NOT recurse the 403 interceptor.** `_skipModerationInterceptor: true` on `AuthContext.refreshUser()`'s axios config is MANDATORY — this is the single most likely bug class per CONTEXT line 227. Grep after implementation: exactly TWO occurrences of `_skipModerationInterceptor` in mobile source (interceptor declaration + refreshUser call site) per CONTEXT specifics line 238.
4. **Do NOT fire-and-forget `refreshUser()` in interceptor.** `await` per D-10 — screens catching `ModerationError` must see fresh `user.moderationStatus` synchronously.
5. **Do NOT navigate on 403.** Banner UI deferred to Phase 6 per D-12. Phase 4 only refreshes context state — no `navigation.navigate()` calls in the interceptor.
6. **Do NOT fire AppState refresh when logged out.** `user === null` guard per D-16 — pass `null` refresh callback into `useAppStateRefresh`.
7. **Do NOT drop the 30s cooldown.** Per D-14. Shared between AppState + 403 interceptor paths per specifics line 246.

---

## Metadata

**Analog search scope:** `src/services/`, `src/context/`, `src/hooks/`, `src/components/`, `src/constants/`, `App.tsx`, `__tests__/`
**Files scanned:** 8 primary + test harness + package.json
**Pattern extraction date:** 2026-04-17
**Phase:** 04-mobile-plumbing-mobile

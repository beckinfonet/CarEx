# Phase 4: Mobile Plumbing (Mobile) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 04-mobile-plumbing-mobile
**Areas discussed:** Shared axios scope, ModerationService surface, 403 interceptor UX, AppState foreground handler

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Shared axios scope | Which URLs get Bearer; identity-toolkit handling; stale-token policy | ✓ |
| ModerationService surface | Endpoints wrapped; split vs unified; error shape; AuthService migration | ✓ |
| 403 interceptor UX | Behavior, loop guard, banner surface | ✓ |
| Deprecated POST /api/orders cleanup | Checkout flow migration to confirm-booking | — (noted as deferred risk in CONTEXT) |
| AppState handler (added as follow-up area) | Location, cooldown, dedupe, logged-out guard | ✓ |

---

## Shared Axios Scope

### Q1: Which URLs should the shared `src/services/http/client.ts` own?

| Option | Description | Selected |
|--------|-------------|----------|
| Only `${API_URL}/*` | Carex backend via shared client; identity-toolkit stays on plain axios | ✓ |
| Everything in AuthService | Shared client handles both, interceptor branches on hostname | |

**User's choice:** Only `${API_URL}/*` (Recommended)

### Q2: Should the Bearer interceptor attach idToken to all API_URL requests, or only gated endpoints?

| Option | Description | Selected |
|--------|-------------|----------|
| Attach on all API_URL requests | Simplest; backend attachAuthIfPresent ignores when not needed | ✓ |
| Attach only on Phase 3's 5 gated routes | Surgical; duplicates the route list on mobile, drift risk | |
| Attach on writes only (POST/PUT/PATCH/DELETE) | Method-based; still duplicates backend gate logic | |

**User's choice:** Attach on all API_URL requests (Recommended)

### Q3: How does the client handle stale/expired idTokens?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — out of scope for Phase 4 | 401 → clear token + route to login; refresh lifecycle a follow-up | ✓ |
| Proactive refresh in request interceptor | Check expiry before each request; secureToken.googleapis.com | |
| Reactive refresh on 401 response | Response interceptor catches 401, refreshes, retries once | |

**User's choice:** Defer — treat as out-of-scope (Recommended)

### Q4: Where does the request interceptor read the current idToken from?

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level getter registered by AuthContext | `setTokenProvider(() => string \| null)` pattern | ✓ |
| AsyncStorage on every request | Current AuthService pattern; 1 AsyncStorage read per call | |
| In-memory singleton mutated by AuthContext | `let currentIdToken = null`; less flexible | |

**User's choice:** Module-level getter (Recommended)

---

## ModerationService Surface

### Q1: Which backend endpoints should `ModerationService.ts` wrap in Phase 4? (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 admin moderation writes | suspend, unsuspend, revoke-role, restore-role, edit-profile, delete-provider-profile, get-history | ✓ |
| Affected-user moderation reads | getMyModerationStatus wrapper for interceptor refresh | |
| Mute/dismiss endpoints for the banner | No backend support; scope creep | |
| Only read-side for Phase 4 | Admin writes stay in AuthService — violates MOB-01 | |

**User's choice:** All 7 admin moderation writes (Recommended). Affected-user refresh continues via existing `AuthService.getBackendUser` (no new method needed).

### Q2: Should admin-write and affected-user-read live in one ModerationService or be split?

| Option | Description | Selected |
|--------|-------------|----------|
| Single ModerationService with both | One module, section comments by role | ✓ |
| Split into AdminModerationService + UserModerationService | Two modules; clearer boundary; more files | |

**User's choice:** Single ModerationService (Recommended)

### Q3: How should ModerationService methods return errors?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw normalized `ModerationError` with D-15 shape | Typed error class mirroring backend response | ✓ |
| Throw raw axios error | Current AuthService pattern; fragile | |
| Return result-type tuple `[data, error]` | Go-style; breaks RN convention | |

**User's choice:** Throw normalized `ModerationError` (Recommended)

### Q4: Where does the migration of existing AuthService moderation methods happen?

| Option | Description | Selected |
|--------|-------------|----------|
| No methods today — no migration needed | Greenfield ModerationService; MOB-01 keeps it that way | ✓ |
| Move admin moderation methods out of AuthService | adminStatus/requestSeller stay (not moderation proper) | |

**User's choice:** No migration needed (Recommended)

---

## 403 Interceptor UX

### Q1: When interceptor catches `403 account_suspended`, what's the behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| refreshUser() + re-throw typed ModerationError | Screen sees error; context has fresh moderationStatus | ✓ |
| refreshUser() + swallow error (global banner handles it) | Simpler screens but masks legitimate write failures | |
| refreshUser() + navigate to SuspendedScreen | Rejected by success criterion #3 (no nav loop) | |

**User's choice:** refreshUser() + re-throw typed ModerationError (Recommended)

### Q2: Should the interceptor await `refreshUser()` before propagating, or fire-and-forget?

| Option | Description | Selected |
|--------|-------------|----------|
| Await refreshUser() then re-throw | Calling screen reads fresh user.moderationStatus synchronously | ✓ |
| Fire-and-forget, re-throw immediately | One-frame flicker; extra effect needed | |

**User's choice:** Await refreshUser() then re-throw (Recommended)

### Q3: How do we prevent an interceptor loop if `refreshUser()` itself returns 403?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag refresh request with `_skipModerationInterceptor: true` | Single-instance design; easy to test | ✓ |
| Use a separate bare axios instance for refresh | Clean isolation; two code paths | |
| In-flight dedupe — only one refreshUser at a time | Doesn't prevent recursive case alone | |

**User's choice:** Flag refresh request with config property (Recommended)

### Q4: Where should the suspension banner render once moderationStatus.state !== 'active'?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer banner UI to Phase 6 | Phase 4 is plumbing; Phase 6 owns AFF-* UX | ✓ |
| Root-mounted ModerationBanner in App.tsx | Scope creep beyond plumbing | |
| Toast via a transient notification library | New dep surface | |

**User's choice:** Defer banner UI to Phase 6 (Recommended)

---

## AppState Foreground Handler

### Q1: Where should the `AppState` listener live?

| Option | Description | Selected |
|--------|-------------|----------|
| In App.tsx, after AuthProvider | Matches success criterion #4 verbatim; mirrors OfflineNotice pattern | ✓ |
| Inside AuthContext itself | Slight coupling: context aware of AppState | |

**User's choice:** In App.tsx (Recommended)

### Q2: Should refresh fire on every background→active transition, or only after a cooldown?

| Option | Description | Selected |
|--------|-------------|----------|
| Cooldown: only if last refresh > 30s ago | Balances staleness vs battery/quota | ✓ |
| Fire every active transition | Simplest; wastes battery on every app-switch | |
| Fire only on first active transition per session | Misses subsequent suspensions | |

**User's choice:** 30s cooldown (Recommended)

### Q3: How does AppState refresh interact with in-flight 403-triggered refresh?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe via shared `refreshInFlight` promise in AuthContext | Single fetch; concurrent callers await same promise | ✓ |
| No coordination — fire both, last-write-wins | Slight waste, same result, simpler | |

**User's choice:** Dedupe via shared promise (Recommended)

### Q4: Should AppState skip refresh when user is logged out?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, skip when `user === null` | Avoid useless 404; protect mid-logout race | ✓ |
| Fire anyway, let refreshUser no-op | Guard inside refreshUser; obscures intent | |

**User's choice:** Yes, skip when `user === null` (Recommended)

---

## Claude's Discretion

Areas where user deferred to Claude during discussion:

- Test strategy (Jest + React Native Testing Library; axios-mock-adapter vs jest.mock — planner picks)
- Exact config flag naming (`_skipModerationInterceptor` is working name; planner may rename)
- Hook vs inline effect in App.tsx for AppState handler
- Whether `getHistory` ships as real method or stub (depends on Phase 5 merge order)
- Error normalization surface for non-moderation errors (`ApiError` wrapper or keep raw axios)

## Deferred Ideas

Noted during discussion, belongs in other phases or follow-ups:

- ModerationBanner UI component (Phase 6)
- Token refresh lifecycle (follow-up phase)
- Checkout flow migration from POST /api/orders → POST /api/payments/confirm-booking (risk-flagged in CONTEXT — needs a follow-up or Phase 4 scope expansion)
- AdminModerationService / UserModerationService split (rejected in D-06)
- Mute/dismiss banner backend endpoint (future enhancement)
- Proactive token-expiry check in request interceptor (deferred with lifecycle work)
- Separate bare axios instance for refreshUser (rejected in D-11)
- Identity-toolkit service extraction (AuthService modernization — future)
- Generated typed backend response interfaces (future quality-of-life)
- Removal of Phase 3's dual-accept body-uid fallback (Phase 6 QUAL-03)

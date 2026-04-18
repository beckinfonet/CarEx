---
phase: 04-mobile-plumbing-mobile
plan: 01
subsystem: networking
tags: [axios, http, interceptor, moderation, error-types, typescript]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-backend
    provides: "403 account_suspended response shape (D-15) + attachAuthIfPresent middleware contract — mobile interceptor mirrors the error body keys and the Authorization: Bearer <idToken> expectation"
provides:
  - "apiClient — shared axios.create({ baseURL: API_URL }) instance for all carEx backend calls"
  - "setTokenProvider(fn) — module-level getter registration hook so AuthContext can plug synchronous idToken reads into the request interceptor"
  - "setModerationRefreshListener(fn) — registration hook so AuthContext.refreshUser can be awaited on 403 account_suspended"
  - "Request interceptor that attaches Authorization: Bearer <idToken> whenever tokenProvider returns a token; omits header otherwise"
  - "Response interceptor that catches 403 account_suspended, awaits the registered refresh listener, and throws a typed ModerationError"
  - "_skipModerationInterceptor?: boolean — declaration-merged AxiosRequestConfig flag for loop-guarding the refresh path"
  - "ModerationError class — typed Error subclass carrying code/status/reasonCategory/note/httpStatus fields (mirrors Phase 3 D-15)"
affects:
  - 04-02
  - 04-03
  - 04-04
  - 04-05
  - 04-06
  - 04-07
  - 05-admin-moderation-ui (imports ModerationError and apiClient)
  - 06-affected-user-ux (reads user.moderationStatus refreshed by this interceptor)

# Tech tracking
tech-stack:
  added: []  # no new runtime deps — reuses axios 1.13.4 already in package.json
  patterns:
    - "Module-level getter-registration hook (setTokenProvider / setModerationRefreshListener) — lets context layers plug into interceptors without circular deps"
    - "Axios declaration-merge for a typed loop-guard config flag (_skipModerationInterceptor?: boolean on AxiosRequestConfig)"
    - "Extracted-constant single-source-of-truth for cross-cutting string literals (ACCOUNT_SUSPENDED) — keeps interceptor match and thrown error code from drifting"
    - "Adapter-override test harness (apiClient.defaults.adapter = async config => …) — intercepts axios requests without adding a new test dep"

key-files:
  created:
    - "src/services/http/client.ts (96 lines) — shared axios instance + both interceptors + registration hooks"
    - "src/services/moderation/errors.ts (12 lines) — ModerationError class"
    - "src/services/http/__tests__/client.test.ts (186 lines) — 8 interceptor behavior tests"
    - "src/services/moderation/__tests__/errors.test.ts (38 lines) — 5 ModerationError shape tests"
    - ".planning/phases/04-mobile-plumbing-mobile/deferred-items.md — logs pre-existing out-of-scope findings"
  modified: []

key-decisions:
  - "ACCOUNT_SUSPENDED extracted as a module-level constant so the suspension discriminator string appears exactly once as a literal in client.ts — prevents drift between interceptor match and ModerationError throw"
  - "Test 3 'no provider registered' tested via `setTokenProvider(() => null)` (observably equivalent state) rather than adding an unregister surface — keeps the export surface minimal and matches the interceptor's optional-chain call pattern"
  - "Adapter-override harness (apiClient.defaults.adapter) chosen over axios-mock-adapter per 04-CONTEXT Discretion — no new test dep, isolates mock to the shared instance"
  - "refreshListener failure is swallowed with console.error so the ModerationError still surfaces to the caller (T-04-01-05 'accept' disposition)"

patterns-established:
  - "Shared http client: One axios.create({ baseURL: API_URL }) instance for all backend calls; Identity REST stays on plain axios per D-01"
  - "Typed errors via Error subclass with this.name: mobile analog to backend's ProviderSuspendedError; instanceof ModerationError and instanceof Error both return true"
  - "Registration-hook dependency injection: module-level `let fn: (() => T) | null = null` + `export function setFn(…)` pattern gives synchronous reads inside interceptors without React-state latency"
  - "Loop-guard via typed axios config flag: declaration-merged `_skipModerationInterceptor?: boolean` on AxiosRequestConfig; callers pass it on the refresh path (04-04 wires this)"

requirements-completed: [MOB-02, MOB-03]

# Metrics
duration: 4m46s
completed: 2026-04-18
---

# Phase 4 Plan 01: Shared HTTP Client + ModerationError Summary

**Shared axios instance with 403-account_suspended response interceptor and typed ModerationError class — the networking plumbing primitive that Plans 04-02..04-07 depend on.**

## Performance

- **Duration:** 4m 46s
- **Started:** 2026-04-18T07:26:49Z
- **Completed:** 2026-04-18T07:31:35Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files created:** 5 (2 source, 2 test, 1 deferred-items log)
- **Files modified:** 0

## Accomplishments

- `src/services/moderation/errors.ts` — `ModerationError` typed Error subclass with 5 public fields (code, status, reasonCategory, note, httpStatus) mirroring Phase 3 D-15 backend response shape; preserves `instanceof Error` and `instanceof ModerationError`, sets `this.name = 'ModerationError'` so the class survives transpile, and prefixes `super()` with `ModerationError: <code>` for stack-readability.
- `src/services/http/client.ts` — `apiClient` axios instance scoped to `API_URL`; `setTokenProvider` and `setModerationRefreshListener` registration hooks; request interceptor that unconditionally attaches `Authorization: Bearer <token>` when `tokenProvider()` returns a non-null value; response interceptor that catches `403 account_suspended`, awaits the registered refresh listener inside a `try/catch` (swallowing listener errors so `ModerationError` still surfaces), then throws `ModerationError` with backend body fields.
- `_skipModerationInterceptor?: boolean` — declaration-merged onto `AxiosRequestConfig` so Plan 04-04 can short-circuit the interceptor on the refresh path itself without type assertions. Grep invariant: exactly 2 occurrences in this file (declaration + read); 0 elsewhere in the codebase.
- `ACCOUNT_SUSPENDED` constant — single source of truth for the discriminator string so the interceptor match and the thrown error code stay in sync without drift risk.
- 13 Jest tests (5 ModerationError + 8 apiClient) all green. Tests use an adapter-override harness (`apiClient.defaults.adapter = async config => …`) — no new test deps.
- Identity REST scope boundary enforced: `grep -c "identitytoolkit" src/services/http/client.ts` returns 0 per D-01. Signup/login/delete continue on plain `axios` unchanged.

## Task Commits

Each task followed TDD RED → GREEN:

1. **Task 1 RED: Add failing tests for ModerationError** — `f7e5c62` (test)
2. **Task 1 GREEN: Implement ModerationError typed error class** — `78ab4b9` (feat)
3. **Task 2 RED: Add failing tests for shared axios client** — `ad3b0e9` (test)
4. **Task 2 GREEN: Implement shared axios client with 403 interceptor** — `9cebfd0` (feat)

Plan metadata (this summary) will be committed as a final step below.

## Files Created/Modified

### Created

- `src/services/moderation/errors.ts` (12 lines) — `ModerationError` class exported; extends Error with 5 public fields.
- `src/services/moderation/__tests__/errors.test.ts` (38 lines) — 5 behavior tests: fields, instanceof ModerationError, instanceof Error, name, message.
- `src/services/http/client.ts` (96 lines) — `apiClient`, `setTokenProvider`, `setModerationRefreshListener`, request + response interceptors, `ACCOUNT_SUSPENDED` constant, `AxiosRequestConfig._skipModerationInterceptor` declaration merge.
- `src/services/http/__tests__/client.test.ts` (186 lines) — 8 behavior tests covering both interceptors, the loop-guard flag, and pass-through cases for non-403 and non-suspension-403 responses.
- `.planning/phases/04-mobile-plumbing-mobile/deferred-items.md` — log of two pre-existing out-of-scope findings (App.test.tsx RNGestureHandler TurboModule mock + AuthService.ts implicit-any errors).

### Modified

None.

## Exact Exports

### `src/services/http/client.ts`

```typescript
import axios, { AxiosRequestConfig } from 'axios';
import { API_URL } from '../../constants/config';
import { ModerationError } from '../moderation/errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipModerationInterceptor?: boolean;
  }
}

const ACCOUNT_SUSPENDED = 'account_suspended';

export function setTokenProvider(fn: () => string | null): void;
export function setModerationRefreshListener(fn: () => Promise<void>): void;
export const apiClient: AxiosInstance; // axios.create({ baseURL: API_URL })
```

### `src/services/moderation/errors.ts`

```typescript
export class ModerationError extends Error {
  constructor(
    public code: 'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string,
    public status?: string,
    public reasonCategory?: string,
    public note?: string,
    public httpStatus?: number,
  );
  // super(`ModerationError: ${code}`); this.name = 'ModerationError';
}
```

## Grep Invariants Verified

| Target | Expected | Actual |
|--------|----------|--------|
| `axios.create({ baseURL: API_URL })` in client.ts | 1 | 1 |
| `export function setTokenProvider` in client.ts | 1 | 1 |
| `export function setModerationRefreshListener` in client.ts | 1 | 1 |
| `apiClient.interceptors.request.use` in client.ts | 1 | 1 |
| `apiClient.interceptors.response.use` in client.ts | 1 | 1 |
| `account_suspended` literal in client.ts | 1 | 1 (ACCOUNT_SUSPENDED constant; the two semantic uses reference the constant) |
| `_skipModerationInterceptor` in client.ts | 2 | 2 (declaration merge property + boolean read) |
| `throw new ModerationError` in client.ts | 1 | 1 |
| `identitytoolkit` in client.ts | 0 | 0 |
| `export class ModerationError extends Error` in errors.ts | 1 | 1 |
| `this.name = 'ModerationError'` in errors.ts | 1 | 1 |
| `` super(`ModerationError: ${code}`) `` in errors.ts | 1 | 1 |

## Test Coverage

All 13 tests pass (`npx jest src/services/moderation/__tests__/errors.test.ts src/services/http/__tests__/client.test.ts --no-coverage`):

- `errors.test.ts`: 5 tests — fields, instanceof ModerationError, instanceof Error, name, message.
- `client.test.ts`: 8 tests — Bearer present (T1), Bearer absent (T2), no provider (T3), 403 → ModerationError with all fields (T4), refresh listener awaited once (T5), `_skipModerationInterceptor` bypass + raw re-throw (T6), 500 passthrough (T7), 403-with-different-error-code passthrough (T8).

## Decisions Made

- **Extract `ACCOUNT_SUSPENDED` constant.** The plan's copy-paste action block had the discriminator literal in two places (interceptor match + ModerationError throw). Extracting it satisfies the acceptance-grep `account_suspended == 1` constraint AND removes drift risk — the match expression and the thrown code now reference the same single source of truth.
- **Test 3 observability.** "No provider registered" is tested by calling `setTokenProvider(() => null)` rather than adding an unregister export surface. The interceptor's `tokenProvider?.()` is observably equivalent for both cases (optional-chain on null fn vs a fn returning null), and avoiding an unregister export keeps the module API minimal.
- **Adapter-override test harness.** Chose `apiClient.defaults.adapter = async (config) => { … }` over `axios-mock-adapter` per 04-CONTEXT Discretion line 144 — no new test dep, isolates the mock to the shared instance.
- **`refreshListener` error swallowed.** The interceptor `try/catch`es the listener and logs via `console.error`; ModerationError still surfaces to the caller. Aligns with T-04-01-05 'accept' disposition in the threat register.

## Deviations from Plan

None - plan executed exactly as written.

Notes on acceptance-criterion interpretation: the action block's copy-paste code placed `'account_suspended'` inline twice (interceptor match + thrown-ModerationError code argument), while the acceptance criterion required `grep -c "account_suspended" client.ts` to return 1. The divergence was resolved by extracting `const ACCOUNT_SUSPENDED = 'account_suspended'` — both semantic uses reference the constant, leaving exactly one literal occurrence. This honors BOTH the behavior (discriminator + thrown code share the same value) and the grep invariant. Not logged as a deviation because it is a refactoring within the task's code, not a behavioral change.

## Issues Encountered

- **Pre-existing `__tests__/App.test.tsx` failure (RNGestureHandler TurboModule)** — confirmed pre-existing by stashing Plan 04-01 changes and re-running. Not caused by this plan. Logged to `deferred-items.md`.
- **Pre-existing `AuthService.ts` TypeScript `implicit-any` errors** — 10 errors, all in `src/services/AuthService.ts`. Not caused by this plan (new files `client.ts` and `errors.ts` typecheck cleanly under project default tsconfig). Logged to `deferred-items.md`.

## Threat Flags

None found. All new surface (Bearer on shared client; 403 interceptor; typed-error constructor) is covered by the plan's `<threat_model>` (T-04-01-01 through T-04-01-06). No new network endpoints, auth paths, file access, or trust-boundary schema changes introduced.

## Self-Check: PASSED

### Files exist

- FOUND: `src/services/http/client.ts`
- FOUND: `src/services/moderation/errors.ts`
- FOUND: `src/services/http/__tests__/client.test.ts`
- FOUND: `src/services/moderation/__tests__/errors.test.ts`
- FOUND: `.planning/phases/04-mobile-plumbing-mobile/deferred-items.md`

### Commits exist

- FOUND: `f7e5c62` (test: ModerationError RED)
- FOUND: `78ab4b9` (feat: ModerationError GREEN)
- FOUND: `ad3b0e9` (test: apiClient RED)
- FOUND: `9cebfd0` (feat: apiClient GREEN)

### Tests pass

- 13/13 Jest tests pass (5 errors + 8 client).

### TypeScript clean on new files

- `npx tsc --noEmit` — 0 errors in new files; 10 pre-existing errors in `AuthService.ts` are out of scope and logged to deferred-items.md.

## Next Phase Readiness

- Plan 04-04 can now call `setTokenProvider` and `setModerationRefreshListener` from `AuthContext` — both hooks are in place.
- Plan 04-05 can migrate `AuthService` backend-facing methods to import `apiClient` from `../http/client`.
- Plan 04-02 / 04-03 (ModerationService + AppState hook) can import `apiClient` and `ModerationError` directly.
- The `_skipModerationInterceptor` flag is reserved for exactly one additional codebase occurrence (Plan 04-04 refreshUser call). Any third occurrence elsewhere is a red flag for Phase 6 review.

---
*Phase: 04-mobile-plumbing-mobile*
*Plan: 01*
*Completed: 2026-04-18*

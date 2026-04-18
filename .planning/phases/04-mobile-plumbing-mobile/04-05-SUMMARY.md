---
phase: 04-mobile-plumbing-mobile
plan: 05
subsystem: networking
tags: [auth-service, http-client, migration, apiclient, axios, identity-toolkit]

# Dependency graph
requires:
  - phase: 04-01
    provides: "apiClient shared axios instance with request/response interceptors + AxiosRequestConfig declaration-merged _skipModerationInterceptor flag"
provides:
  - "AuthService.ts routes all ~28 carEx backend calls through shared apiClient — Bearer interceptor now applies transparently to every backend read/write"
  - "AuthService.getBackendUser(uid, config?: AxiosRequestConfig) — optional second param forwards axios config so Plan 04-04 refreshUser can pass _skipModerationInterceptor: true"
  - "Identity Toolkit calls (signUp, signIn, sendPasswordResetEmail, deleteAccount's :delete leg) preserved on plain axios — different auth surface (Firebase Web API key in query string, not idToken in Authorization header)"
  - "MOB-01 guardrail evidence — grep -c 'suspend|revoke|moderation' src/services/AuthService.ts returns 0 at end of Phase 4 Wave 2"
affects:
  - 04-04  # AuthContext.refreshUser can now pass { _skipModerationInterceptor: true } to AuthService.getBackendUser
  - 04-06  # AppState refresh path calls AuthContext.refreshUser which calls this migrated getBackendUser
  - 04-07  # final integration test / verifier surface for MOB-01..MOB-04
  - 05-admin-moderation-ui  # AuthService admin methods now route through apiClient → Bearer header attached automatically
  - 06-affected-user-ux  # every backend call a suspended user makes now triggers the 403 interceptor → refreshUser → fresh moderationStatus

# Tech tracking
tech-stack:
  added: []  # surgical migration — no new runtime deps, no new files
  patterns:
    - "Mechanical axios.X(\`${API_URL}/path\`) → apiClient.X(\`/path\`) per-method transformation — body/config/params/headers/timeout all pass through unchanged"
    - "Optional-param signature widening (config?: AxiosRequestConfig) as the ONLY non-body change — preserves call-site compatibility for every existing caller that passes no second arg"
    - "Test-first mock strategy: jest.mock('axios') + jest.mock('../http/client') in the same suite — one harness proves the Identity-Toolkit/backend split mechanically per-method"
    - "Source-level grep tests as the MOB-01 tripwire — Test 8 (zero ${API_URL}/api/ templates) and Test 9 (zero suspend/revoke/moderation method names) run as actual Jest assertions, not just acceptance greps in CI"

key-files:
  created:
    - "src/services/__tests__/AuthService.test.ts (158 lines) — 9 tests covering apiClient routing, Identity Toolkit plain-axios preservation, optional-config-param forwarding, multipart-preservation, 30s-timeout preservation, dual-leg deleteAccount, source-level no-residual-API_URL-templates grep, MOB-01 method-name guardrail grep"
  modified:
    - "src/services/AuthService.ts — added 2 imports (apiClient named; AxiosRequestConfig type); migrated 28 method bodies from axios.X(\`${API_URL}/path\`) to apiClient.X(\`/path\`); widened getBackendUser signature with optional config?: AxiosRequestConfig second param; kept signUp/signIn/sendPasswordResetEmail/deleteAccount-toolkit-leg on plain axios; 35 methods before, 35 methods after"

# Decisions surfaced during execution
decisions:
  - "Test harness uses jest.mock('../http/client') factory returning a fresh object with jest.fn() for every verb — avoids the adapter-override pattern from Plan 04-01's client.test.ts because this plan tests AuthService (the caller) not the client itself; mocking the dependency entirely is cleaner than testing through the real instance"
  - "AsyncStorage mock via require('@react-native-async-storage/async-storage/jest/async-storage-mock') — official package-provided mock, zero maintenance; test suite would otherwise crash at import time because AuthService.ts imports AsyncStorage for token helpers that are untouched by this plan"
  - "Test 8 uses cwd-relative path ('src/services/AuthService.ts') not __dirname-joined path — tsconfig.json types array contains only 'jest', not 'node', so __dirname is not declared; jest always runs from repo root, so cwd-relative is safe and type-clean"
  - "deleteAccount's in-source comment expanded: added a one-line comment distinguishing 'Backend leg — migrated to apiClient' from 'Identity Toolkit leg — stays on plain axios' — future reader tripwire preventing accidental migration of the second leg"

# Execution metrics
metrics:
  duration: 8 min
  completed: 2026-04-18
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 04 Plan 05: AuthService apiClient Migration Summary

One-liner: Migrated 28 carEx backend calls in AuthService.ts from plain axios to the Wave-1 shared apiClient (Bearer interceptor + 403 moderation handler); kept 4 Identity Toolkit calls on plain axios with the Firebase Web API key; added optional config param to getBackendUser for Plan 04-04's refresh-loop guard.

## Migration Scope

**Methods migrated to apiClient (28 total):**

| Group | Methods | Count |
|-------|---------|-------|
| Backend user | createBackendUser, getBackendUser, updateBackendUser, uploadAvatar | 4 |
| Role requests | requestSellerStatus, requestBrokerStatus, requestLogisticsStatus | 3 |
| Provider profiles | getBrokerProfile, updateBrokerProfile, getLogisticsProfile, updateLogisticsProfile | 4 |
| OTP | sendOtp, verifyOtp | 2 |
| Account delete (backend leg only) | deleteAccount's `DELETE /api/users/:uid` call | 1 |
| Admin | getAdminStatus, getAdminRequests, approveRequest, rejectRequest, getAdminUsers, addAdminUser, removeAdminUser | 7 |
| Payments | createPaymentIntent, confirmBooking | 2 |
| Orders | createOrders, getBuyerOrders, getProviderOrders, updateOrderStatus, updateServiceStatus | 5 |

Total apiClient verb invocations in AuthService.ts: **28** (verified by `grep -cE 'apiClient\.(post|get|put|delete|patch)'`)

**Methods kept on plain axios (4 Identity Toolkit calls):**

| Method | URL surface | Auth surface |
|--------|-------------|--------------|
| signUp | `${AUTH_URL}:signUp?key=${API_KEY}` | Firebase Web API key in query string |
| signIn | `${AUTH_URL}:signInWithPassword?key=${API_KEY}` | Firebase Web API key in query string |
| sendPasswordResetEmail | `${AUTH_URL}:sendOobCode?key=${API_KEY}` | Firebase Web API key in query string |
| deleteAccount's `:delete` leg (second line of body) | `${AUTH_URL}:delete?key=${API_KEY}` | Firebase Web API key in query string |

Per D-01, these MUST NOT go through apiClient because the request interceptor would attach an `Authorization: Bearer <idToken>` header that Firebase Identity Toolkit rejects on its unauthenticated endpoints.

**Signature change (only one):**

```typescript
// BEFORE
getBackendUser: async (firebaseUid: string) => { ... }

// AFTER
getBackendUser: async (firebaseUid: string, config?: AxiosRequestConfig) => {
  ...
  const response = await apiClient.get(`/api/users/${firebaseUid}`, config);
  ...
}
```

Backward-compatible: every existing caller that passes no second arg (`AuthContext.loadStorageData`, `AuthContext.login`) continues to work unchanged. Only Plan 04-04's refreshUser will pass `{ _skipModerationInterceptor: true }` as the second arg.

## Grep Invariants Verified

| Invariant | Expected | Actual |
|-----------|----------|--------|
| `grep -c "import { apiClient } from './http/client'" src/services/AuthService.ts` | 1 | 1 |
| `grep -c "import type { AxiosRequestConfig } from 'axios'" src/services/AuthService.ts` | 1 | 1 |
| `grep -cE 'axios\.(post\|get\|put\|delete\|patch)' src/services/AuthService.ts` | EXACTLY 4 | 4 |
| `grep -c '\${API_URL}/api/' src/services/AuthService.ts` | 0 | 0 |
| `grep -cE 'apiClient\.(post\|get\|put\|delete\|patch)' src/services/AuthService.ts` | >= 25 | 28 |
| `grep -cE 'suspend\|revoke\|moderation' src/services/AuthService.ts` | 0 (MOB-01) | 0 |
| `grep -c "config?: AxiosRequestConfig" src/services/AuthService.ts` | >= 1 | 1 |
| `grep -c "identitytoolkit.googleapis.com" src/services/AuthService.ts` | 1 (AUTH_URL const only) | 1 |
| async method count in AuthService object (identity to baseline) | 35 | 35 |

All mechanical tripwires satisfied.

## Test Results

All 9 Plan 04-05 tests pass:

- Test 1: getBackendUser uses apiClient.get with path-only URL
- Test 2: getBackendUser forwards optional AxiosRequestConfig second param
- Test 3: signIn stays on plain axios and hits identitytoolkit.googleapis.com
- Test 4: createBackendUser migrates to apiClient.post with path-only URL
- Test 5: uploadAvatar preserves multipart Content-Type header on apiClient
- Test 6: deleteAccount calls apiClient.delete for backend AND axios.post for Identity Toolkit :delete
- Test 7: createPaymentIntent preserves 30s timeout option on apiClient.post
- Test 8: no backend method still uses `${API_URL}/api/` template (source-level grep)
- Test 9: MOB-01 guardrail — no moderation method names in AuthService export

Running the full services test surface together (Plan 04-01 client.test.ts + Plan 04-01 errors.test.ts + Plan 04-05 AuthService.test.ts):

```
Test Suites: 3 passed, 3 total
Tests:       22 passed, 22 total
```

TDD gate sequence:
- RED commit `3bec854` — `test(04-05): add failing tests for AuthService apiClient migration` — 7 of 9 tests failing because migration hadn't happened yet (Tests 3 and 9 passed at RED because signIn was already on plain axios and no moderation methods existed — those are pre-migration invariants the plan already assumed)
- GREEN commit `f4af919` — `feat(04-05): migrate AuthService backend calls to shared apiClient` — all 9 tests pass after surgical migration
- No REFACTOR commit needed — migration output already reads cleanly; no cleanup pass adds value

## Deviations from Plan

**None of the Rule 1-4 kinds.** Plan was executed exactly as written with two minor test-harness adjustments:

1. **AsyncStorage mock required in the Jest test file** — the plan's test harness skeleton showed `jest.mock('axios')` + `jest.mock('../http/client', ...)` but omitted AsyncStorage. AuthService.ts imports `@react-native-async-storage/async-storage` (for token helpers untouched by this plan). Without mocking it, the test file fails at import time with "NativeModule: AsyncStorage is null". Resolved by adding the official mock from `@react-native-async-storage/async-storage/jest/async-storage-mock` at the top of the test file. This is a test-infrastructure detail, not a plan deviation — the plan's tasks, acceptance criteria, and output spec are unaffected.

2. **Test 8 path resolution** — plan's snippet implied `path.join(__dirname, '..', 'AuthService.ts')`, but `tsconfig.json` `types` array contains only `["jest"]`, so `__dirname` is not declared and TypeScript emits `TS2304: Cannot find name '__dirname'`. Switched to `fs.readFileSync('src/services/AuthService.ts', 'utf8')` — jest always runs from repo root, so cwd-relative works. Zero behavior change.

Neither counts as a Rule 1-3 auto-fix because they're test-file ergonomics, not correctness issues in the shipped code.

## Pre-existing issues observed (NOT fixed — scope boundary)

Per SCOPE BOUNDARY, only issues DIRECTLY caused by this plan's changes are in scope. Pre-existing issues logged for visibility only:

- **App.test.tsx fails at import time** with `react-native-gesture-handler` native-module invariant ("new NativeEventEmitter() requires a non-null argument"). Verified this failure is identical before and after my changes (stashed, ran, confirmed, unstashed). This is a pre-existing test-infra issue unrelated to AuthService migration — out of scope for Plan 04-05.
- **10 pre-existing TypeScript `TS7006`/`TS18046` errors** in `signUp`, `signIn`, `saveToken` (lines 14-52) — all in methods the plan explicitly said NOT to touch (Step 4 — Identity Toolkit + AsyncStorage helpers). Count was 10 before my changes, 10 after. My changes introduced zero new TS errors in AuthService.ts or the test file.

## Known Risks Surfaced (from plan's `<deferred>` section — re-flagged to user)

- **createOrders endpoint is 410 Gone post-Phase-3** — Plan 04-05 migrated `createOrders` from `axios.post(\`${API_URL}/api/orders\`)` to `apiClient.post('/api/orders', ...)` as part of the mechanical migration, but the backend endpoint itself returns 410 Gone after Phase 3 ships. **The mobile checkout flow will fail on a live run against Phase 3 backend until a follow-up phase migrates the call shape from `createOrders` to `confirmBooking`.** This plan does NOT change that. The risk was acknowledged in the plan's `<deferred>` section; surfacing here in the summary as required.
- **Legacy `callerUid` body param in admin methods** — `approveRequest`, `rejectRequest`, `addAdminUser`, `removeAdminUser`, `getAdminUsers`, `getAdminRequests` still pass `callerUid` in body or as `{ params: { uid } }`. Phase 3 D-03 dual-accept fallback means these still work on the backend because the Bearer interceptor now also attaches the canonical `req.auth.uid`. Phase 6 QUAL-03 is slated to remove the fallback; at that point these signatures simplify (optionally). Not required by this plan.
- **Identity Toolkit service extraction deferred** — per 04-CONTEXT §deferred, "a future modernization pass may refactor identity-toolkit into its own service". Not scoped here; signUp/signIn/sendPasswordResetEmail stay in AuthService.

## Known Stubs

None. Migration is surgical: each method body's HTTP client swapped, no placeholder values or TODO markers introduced.

## Self-Check: PASSED

- src/services/AuthService.ts — FOUND (modified)
- src/services/__tests__/AuthService.test.ts — FOUND (created)
- Commit `3bec854` (RED) — FOUND in git log
- Commit `f4af919` (GREEN) — FOUND in git log
- All 9 Plan 04-05 tests pass
- All grep invariants satisfy plan acceptance criteria
- Method count byte-identical to pre-migration baseline (35 = 35)

## TDD Gate Compliance

Plan 04-05 frontmatter declares `type: execute` (not `type: tdd`), so plan-level gates are not required. However the single task was marked `tdd="true"` and executed with full RED/GREEN cycle:

1. RED gate `test(04-05): ...` at commit `3bec854` — 7 of 9 tests failing
2. GREEN gate `feat(04-05): ...` at commit `f4af919` — all 9 tests passing
3. No REFACTOR needed — migrated code requires no cleanup pass

Both mandatory gates satisfied.

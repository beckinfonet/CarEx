---
phase: 04
plan: 03
subsystem: mobile-hooks
tags:
  - hook
  - appstate
  - refresh
  - lifecycle
  - tdd
requires:
  - react-native AppState API
provides:
  - useAppStateRefresh hook — subscribes to AppState.change, fires a caller-provided refresh on background→active transitions
affects:
  - Plan 04-06 will consume this hook to wire AuthContext.refreshUser on app foreground
tech-stack:
  added: []
  patterns:
    - Sibling-of-useNetwork hook shape (module export, single useEffect, subscription cleanup)
    - Caller-owned side-effect callback (no context dependency inside the hook)
    - Module-level unused-option (`cooldownMs`) preserved for API forward-compat
key-files:
  created:
    - src/hooks/useAppStateRefresh.ts
    - src/hooks/__tests__/useAppStateRefresh.test.tsx
  modified: []
decisions:
  - "Cooldown ownership moved to AuthContext.refreshUser (Plan 04-04) per 04-PATTERNS cross-cutting guidance; hook is a dumb subscriber. `cooldownMs` option accepted-but-ignored preserves the public API shape advertised in 04-CONTEXT."
  - "Test file is .tsx (not .ts as the plan acceptance criterion states) because the test harness uses JSX. The literal .ts in the plan conflicts with the JSX in the plan's own harness skeleton — resolved by matching the existing __tests__/App.test.tsx pattern (Rule 3 deviation, blocking issue)."
  - "useRef (not useState) for appStateRef: synchronous reads of the previous AppState across rapid transitions; React state batching would race."
  - "refresh included in effect dep array so caller can swap callback (logged-out null ↔ logged-in refreshUser) and the listener re-registers accordingly."
metrics:
  duration: 2m34s
  completed: 2026-04-18
---

# Phase 04 Plan 03: useAppStateRefresh Hook Summary

AppState lifecycle hook (new file `src/hooks/useAppStateRefresh.ts`) that fires a caller-provided refresh callback on background→active / inactive→active transitions, implementing the foundation for MOB-04.

## Objective Delivered

- Created `src/hooks/useAppStateRefresh.ts` — 41 lines; mirrors the shape of `src/hooks/useNetwork.ts` but wraps `AppState.addEventListener` instead of `NetInfo.addEventListener`.
- Created `src/hooks/__tests__/useAppStateRefresh.test.tsx` — 191 lines; 8 Jest tests covering the full behavioral contract.
- Zero modifications to existing files. Zero new dependencies (uses existing `react-test-renderer` already in devDependencies).

## Files Created

| Path | Purpose | Lines |
|------|---------|-------|
| `src/hooks/useAppStateRefresh.ts` | Hook implementation — AppState subscription + transition predicate + caller callback invocation | 41 |
| `src/hooks/__tests__/useAppStateRefresh.test.tsx` | 8-case Jest behavioral test suite | 191 |

## Hook Signature & Intended Consumer

```typescript
type RefreshFn = () => Promise<unknown>;

export const useAppStateRefresh: (
  refresh: RefreshFn | null | undefined,
  options?: { cooldownMs?: number },
) => void;
```

- **Returns `void`** — side-effect hook, not a reactive value.
- **`refresh`** — callback to invoke on foreground transitions. Hook is a no-op when `null`/`undefined` (D-16 logged-out skip).
- **`cooldownMs`** — accepted-but-ignored here; real cooldown enforcement lives in `AuthContext.refreshUser` (Plan 04-04).

**Intended consumer:** Plan 04-06 will mount an `AppStateRefreshEffect` component inside the AuthProvider subtree in `App.tsx` that calls `useAppStateRefresh(user?.localId ? refreshUser : null, { cooldownMs: 30_000 })`.

## Behavior Covered by Tests (8/8 passing)

| # | Test | Assertion |
|---|------|-----------|
| 1 | background→active fires refresh | `refresh` called exactly once |
| 2 | inactive→active fires refresh | `refresh` called exactly once |
| 3 | active→background does NOT fire | `refresh` never called |
| 4 | active→inactive does NOT fire | `refresh` never called |
| 5 | `refresh = null` is a no-op | No crash, no `console.error` |
| 6 | `refresh = undefined` is a no-op | No crash, no `console.error` |
| 7 | subscription cleanup on unmount | `subscription.remove()` called exactly once |
| 8 | refresh rejection swallowed | `console.error` called with the rejected error; no unhandled promise rejection |

## Grep Count Verification (per plan's acceptance criteria)

| Pattern | Expected | Actual | File |
|---------|----------|--------|------|
| `export const useAppStateRefresh` | 1 | 1 | useAppStateRefresh.ts |
| `AppState.addEventListener('change'` | 1 | 1 | useAppStateRefresh.ts |
| `subscription.remove` | 1 | 1 | useAppStateRefresh.ts |
| `prev === 'background' \| prev === 'inactive'` | ≥1 | 1 | useAppStateRefresh.ts |
| `if (!refresh)` | 1 | 1 | useAppStateRefresh.ts |
| `refresh().catch` | 1 | 1 | useAppStateRefresh.ts |
| `cooldownMs` | ≥1 | 3 | useAppStateRefresh.ts (option name + signature + JSDoc ref) |

Cross-codebase `AppState.addEventListener` count before Plan 04-06 ships: 1 occurrence (the hook); zero other occurrences elsewhere.

## Cooldown Ownership Decision

The 30s cooldown for foreground refresh is NOT enforced in this hook. Per `04-CONTEXT.md` D-14/D-15 + `04-PATTERNS.md` cross-cutting note, the cooldown is owned by `AuthContext.refreshUser` (Plan 04-04) and shared between the AppState trigger path and the 403-interceptor trigger path. Keeping cooldown in a single place:

- Avoids double-bookkeeping across two callers.
- Matches the dedupe `refreshInFlight` promise that also lives in AuthContext.
- Makes this hook a dumb, easily testable subscriber.

The `cooldownMs` option is preserved in the hook's public API (accepted but unused) so Plan 04-06 can call `useAppStateRefresh(refreshUser, { cooldownMs: 30_000 })` — if a future refactor ever moves cooldown ownership back into the hook, consumers don't need to change.

## Jest Test Results

```
PASS src/hooks/__tests__/useAppStateRefresh.test.tsx
  useAppStateRefresh
    ✓ Test 1: background→active fires refresh once
    ✓ Test 2: inactive→active fires refresh once
    ✓ Test 3: active→background does NOT fire refresh
    ✓ Test 4: active→inactive does NOT fire refresh
    ✓ Test 5: null refresh is a no-op
    ✓ Test 6: undefined refresh is a no-op
    ✓ Test 7: subscription cleanup on unmount
    ✓ Test 8: refresh rejection is caught and logged (no unhandled rejection)

Tests: 8 passed, 8 total
```

## TypeScript Compilation

`npx tsc --noEmit -p tsconfig.json` reports zero errors for `src/hooks/useAppStateRefresh.ts` and the test file. (Pre-existing `node_modules`-level lib.dom vs. react-native globals conflicts are unrelated and unchanged.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test filename extension mismatch**
- **Found during:** Task 1 RED gate — first `jest` run.
- **Issue:** Plan acceptance criteria states the test file path as `src/hooks/__tests__/useAppStateRefresh.test.ts`, but the test harness skeleton inside the same plan uses JSX (`<HookHarness refresh={refresh} />`). Babel's TypeScript parser rejects JSX inside `.ts` files — the suite fails to parse before any test runs.
- **Fix:** Created the test file as `useAppStateRefresh.test.tsx`. This matches the existing `__tests__/App.test.tsx` convention already used by this codebase for test files that render JSX.
- **Files modified:** None (file was born as .tsx).
- **Rule rationale:** Without `.tsx`, the suite cannot parse — the plan cannot be executed at all. Classic Rule 3 blocking issue.

### Auth Gates

None — this is a pure unit-test plan with no runtime credentials or network.

## Deferred Issues

Logged to `.planning/phases/04-mobile-plumbing-mobile/deferred-items.md`:

- **Pre-existing:** `__tests__/App.test.tsx` fails at baseline due to un-mocked `react-native-gesture-handler` native module — confirmed fails at HEAD even without Plan 04-03 changes. Out of scope per executor deviation rules (not caused by this plan's changes). Assigned to a future mobile test-infra cleanup phase.

## Commits

| Commit | Type | Files | Message |
|--------|------|-------|---------|
| 2610dc2 | test | src/hooks/__tests__/useAppStateRefresh.test.tsx | test(04-03): add failing tests for useAppStateRefresh hook (RED gate — 8 tests unresolved module import) |
| 2217e75 | feat | src/hooks/useAppStateRefresh.ts | feat(04-03): implement useAppStateRefresh hook (MOB-04) — 8/8 tests pass (GREEN gate) |

TDD cycle complete: RED → GREEN. No REFACTOR commit — the implementation matches the PATTERNS template verbatim and is already minimal (41 lines).

## Defers To

- **Plan 04-04** — `AuthContext.refreshUser` enforces the 30s cooldown + dedupe promise that this hook delegates to.
- **Plan 04-06** — `App.tsx` mounts a component in the AuthProvider subtree that calls this hook with `refreshUser` (or `null` when logged out).

## Self-Check: PASSED

- **Files created exist:**
  - `src/hooks/useAppStateRefresh.ts` — FOUND
  - `src/hooks/__tests__/useAppStateRefresh.test.tsx` — FOUND
- **Commits exist:**
  - `2610dc2` (test RED) — FOUND in `git log`
  - `2217e75` (feat GREEN) — FOUND in `git log`
- **Jest:** 8/8 passing.
- **Grep counts:** All 7 acceptance-criteria grep assertions match.
- **TypeScript:** No errors for the new files.

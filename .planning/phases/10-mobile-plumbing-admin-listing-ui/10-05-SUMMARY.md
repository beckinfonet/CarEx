---
phase: 10
plan: 05
subsystem: mobile-http-plumbing-admin-listing-ui
tags: [LMOB-02, LUI-01, regression-tests, anti-pattern-guardrail, interceptor-invariant, deep-link-bearer-fix]
requires:
  - Phase 4 D-09..D-11 (existing 403 account_suspended interceptor in client.ts — read-only here)
  - Plan 10-01 (ModerationError + ListingModerationError sibling classes in errors.ts)
  - Phase 9 D-07/D-08 (backend status-aware listing GET that emits moderationBadge for admin viewers)
provides:
  - LMOB-02 regression suite (5 tests) locking the invariant that listing 409/403 errors never widen the 403 user-suspension interceptor
  - LOAD-BEARING migration of CarDetailsScreen deep-link fetch from bare axios.get → apiClient.get so the Bearer header flows on admin views
  - Anti-pattern guardrails: interceptor count == 2; discriminator string preserved verbatim
affects:
  - Plan 10-08 (CarDetails status banner — can now rely on fetchedCar.moderationBadge being populated for admin viewers)
  - Plan 10-10 (bottom-sheet wiring transitively unblocked)
tech-stack:
  added: []
  patterns: [filesystem-grep-anti-pattern-guard, canned-adapter-mock-pattern]
key-files:
  created:
    - src/services/http/__tests__/clientListing409.test.ts
    - .planning/phases/10-mobile-plumbing-admin-listing-ui/deferred-items.md
  modified:
    - src/screens/CarDetailsScreen.tsx
decisions:
  - "Task 1 RED/GREEN cycle collapses: regression tests assert EXISTING behavior of client.ts (no source changes to client.ts in this plan). Test file committed as a single `test(...)` commit because RED phase is impossible — adding the assertions IS the deliverable; client.ts is read-only here per the LMOB-02 invariant"
  - "Test 5 discriminator-string check accepts THREE equivalent canonical forms (`data.error === 'account_suspended'`, `data?.error === 'account_suspended'`, OR the `ACCOUNT_SUSPENDED` constant + optional-chain combo) — client.ts (Phase 4) factored the literal into a single source-of-truth constant; locking only one form would over-constrain future minor refactors while still blocking semantic drift"
  - "Anti-pattern guardrail (Test 4) uses `fs.readFileSync` of `client.ts` source rather than a runtime axios introspection — counts the literal `interceptors.response.use` registrations at source level, catching any future plan that adds a third interceptor regardless of whether the new interceptor would even fire at runtime"
  - "Task 2 retained the existing `import axios from 'axios'` line — sibling axios.* call sites at lines 152 (seller fetch) + 330 (PATCH status) remain in scope of follow-up debt cleanup, not this plan. Plan boundary explicitly forbids touching them; an inline rationale comment marks the migrated call site to prevent accidental rollback by future maintainers"
  - "Adapter-mock pattern (override `apiClient.defaults.adapter` with a canned-response `jest.fn`) reused verbatim from sibling `src/services/http/__tests__/client.test.ts` — `axios-mock-adapter` is NOT a project devDep and CLAUDE.md forbids new networking libs this milestone (re-confirmed in plan's `must_haves.forbidden`)"
metrics:
  duration: ~3m
  tasks_completed: 2
  files_changed: 3
  commits: 2
  tests_added: 5
  completed: 2026-05-29
---

# Phase 10 Plan 05: LMOB-02 Regression Lock + CarDetails apiClient Migration Summary

## One-Liner

Locks the invariant that listing 409/403 errors never touch the user-suspension interceptor (5 regression tests) and migrates the CarDetails deep-link fetch from bare `axios.get` to `apiClient.get` so the Bearer header attaches on admin views.

## What Shipped

**Task 1 — `src/services/http/__tests__/clientListing409.test.ts` (200 lines, 5 tests, all green on first run).** Five-test regression suite that locks `LMOB-02` at both behavior and source level:

1. **Test 1** (LMOB-02 — 409 listing_not_available): `POST /api/cars/anything` → 409 `{ error: 'listing_not_available', listingStatus: 'suspended', reasonCategory: 'spam' }` — asserts (a) rejection is NOT `instanceof ModerationError` and NOT `instanceof ListingModerationError`, (b) `moderationRefreshListener` was called 0 times, (c) `error.response.status === 409`.
2. **Test 2** (LMOB-02 — 403 cannot_moderate_own_listing): `PATCH /api/admin/moderation/listings/x/suspend` → 403 `{ error: 'cannot_moderate_own_listing' }` — same shape assertions, raw axios error reaches the caller.
3. **Test 3** (positive control — 403 account_suspended DOES trigger): `GET /protected` → 403 `{ error: 'account_suspended', status: 'permanently_banned' }` — asserts listener called exactly once AND rejection IS `instanceof ModerationError` with `code === 'account_suspended'`. Guards against the interceptor being made too narrow (silently breaking user-suspension) by any future maintainer fixing Tests 1+2.
4. **Test 4** (anti-pattern guard — interceptor count): `fs.readFileSync('client.ts').match(/interceptors\.response\.use/g).length === 2` exactly. Pitfall 1 lock — any plan that adds a third interceptor for listing errors trips this immediately.
5. **Test 5** (anti-pattern guard — discriminator preserved): `client.ts` source contains the literal `account_suspended` discriminator in one of three canonical equivalent forms (`data.error === 'account_suspended'` / `data?.error === 'account_suspended'` / `ACCOUNT_SUSPENDED` constant + optional-chain combo). Future widening (e.g., catching `'listing_not_available'`) breaks this.

Uses the canned-adapter mock pattern from the sibling `client.test.ts` — no new dev dependency.

**Task 2 — `src/screens/CarDetailsScreen.tsx` (one-line code change + import + rationale comment).** Migrated the deep-link listing detail fetch at line ~112:

```diff
- axios.get(`${API_URL}/api/cars/${carId}`)
+ apiClient.get(`/api/cars/${carId}`)
```

Added `import { apiClient } from '../services/http/client'` next to existing services imports. Existing `import axios from 'axios'` retained because lines 152 (seller fetch) + 330 (PATCH status) still reference `axios.*` — intentionally OUT OF SCOPE per Plan 05 boundary; debt cleanup deferred. Surrounding `.then(res => { ... }).catch(...).finally(...)` chain byte-identical. Inline rationale comment at the call site documents why the migration matters (Bearer header → admin payload → Plan 10-08 banner).

## Verification Evidence (PLAN `<verification>` block)

```
$ npx jest src/services/http/__tests__/clientListing409.test.ts --bail
PASS src/services/http/__tests__/clientListing409.test.ts
  apiClient interceptor — LMOB-02 invariant
    ✓ Test 1: 409 listing_not_available passes through raw …
    ✓ Test 2: 403 cannot_moderate_own_listing passes through raw …
    ✓ Test 3: positive control — 403 account_suspended DOES wrap into ModerationError + fires listener once
    ✓ Test 4: anti-pattern guard — exactly 2 response interceptors in client.ts (no third for listing errors per Pitfall 1)
    ✓ Test 5: anti-pattern guard — account_suspended discriminator string preserved in client.ts
Tests:       5 passed, 5 total

$ grep -cE 'axios\.get\(`\$\{API_URL\}/api/cars' src/screens/CarDetailsScreen.tsx
0                                              # old call site removed

$ grep -cE 'apiClient\.get\(`/api/cars' src/screens/CarDetailsScreen.tsx
1                                              # new call site present

$ grep -c "interceptors.response.use" src/services/http/client.ts
2                                              # anti-pattern guardrail held
```

Full http + moderation regression: `npx jest src/services/http src/services/moderation` → 8 suites / 73 tests green; zero new failures introduced by Plan 10-05.

## Commits

| Hash | Task | Message |
|------|------|---------|
| 0113017 | Task 1 | `test(10-05): add LMOB-02 regression suite for listing 409/403 non-widening` |
| 2dfd85e | Task 2 | `feat(10-05): migrate CarDetails deep-link fetch from axios.get to apiClient.get` |

## Threat Mitigations Closed

- **T-10-02** (Spoofing: admin session loss via wrong interceptor on listing error) — Tests 1+2 assert that listing 409/403 do NOT trigger `moderationRefreshListener`; Test 3 is a positive control proving the interceptor still fires on `account_suspended`; Tests 4+5 lock the interceptor count + discriminator string at the source level. Any future plan that widens the interceptor breaks these tests in CI.
- **T-10-A6** (Information Disclosure: admin path silently degraded to thin payload) — Task 2 migrates the call to `apiClient.get` so the Bearer header is attached; backend's status-aware GET (Phase 9 D-08) now returns the admin payload with `moderationBadge` for admin viewers, enabling Plan 10-08's status banner.
- **T-10-01** (Elevation: mobile-trust-isAdmin) — cross-plan, transport-only change in this plan. Backend `requireAdmin` (on admin endpoints) and the status-aware GET's role inspection remain the single source of truth. Mobile `isAdmin` still gates UI visibility only (Plan 10-08).

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed verbatim against the `<action>` blocks; all grep invariants green on first run; the `<done>` criteria for both tasks satisfied on first attempt.

## Deferred Issues

**DEF-10-05-01:** `__tests__/moderation.e2e.integration.test.tsx` Test 1.2 fails on `main` BEFORE Plan 10-05 changes (verified via `git stash`). Root cause: Plan 10-04 added 6 listing methods to `ModerationService` (`adminEditListing`, `archiveListing`, `deleteListing`, `restoreListing`, `searchListings`, `suspendListing`) but the Phase 4 integration test's `expect(keys).toEqual([...8 names...])` was not extended. Out of scope for Plan 10-05 (single-line `CarDetailsScreen.tsx` change cannot affect `ModerationService` method count). Logged to `.planning/phases/10-mobile-plumbing-admin-listing-ui/deferred-items.md` for Plan 10-04 owner / Phase 10 verifier.

## Requirements Status

- **LMOB-02** (listing 409/403 errors NEVER trigger the existing 403 user-suspension interceptor) → **regression suite locks the invariant** at behavior + source level. Plan 10-05 ships the test substrate that future plans cannot regress against; the runtime guarantee was already true in `client.ts` since Phase 4 D-11.
- **LUI-01** (CarDetails admin viewers see the Phase 9 D-07 moderationBadge payload on deep-link entry) → **transport unblocked** by the `apiClient` migration. Plan 10-08 will render the banner; the Bearer-header attachment is the prerequisite that this plan closes.

Both requirements move from "blocked on plumbing" → "ready for Plan 10-08 wiring". The roadmap-level tick-off for LUI-01 belongs to Plan 10-08 (which renders the banner end-to-end); LMOB-02 ticks off at this plan since the invariant-lock is the deliverable.

## Threat Flags

None — Task 1 adds a test file with no new network or trust-boundary surface; Task 2 narrows transport from anonymous axios to Bearer-authenticated apiClient, which is a defense-in-depth tightening, not a new surface.

## Self-Check: PASSED

- `src/services/http/__tests__/clientListing409.test.ts` — FOUND
- `src/screens/CarDetailsScreen.tsx` (modified) — FOUND, apiClient.get call site present, axios.get call site removed
- `.planning/phases/10-mobile-plumbing-admin-listing-ui/deferred-items.md` — FOUND
- Commit `0113017` — FOUND (Task 1)
- Commit `2dfd85e` — FOUND (Task 2)

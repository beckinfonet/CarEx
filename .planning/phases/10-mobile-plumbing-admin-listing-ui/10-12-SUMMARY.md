---
phase: 10
plan: 12
type: execute
gap_closure: true
closes_gaps:
  - "SC #1 — admin sees Moderate badge → opens bottom sheet with 4 actions + status banner reflecting current state"
  - "SC #3 — Re-opening sheet on non-active listing replaces 4 actions with Restore + reason category"
requirements: [LUI-01, LUI-03]
subsystem: mobile/admin-listing-moderation
tags: [cr-04, gap-closure, fetch-gate, listing-moderation, single-source-of-truth]
dependency_graph:
  requires:
    - 10-05-SUMMARY.md (apiClient shared instance + status-aware listing GET wiring)
    - 10-08-SUMMARY.md (CarDetailsScreen admin moderation surface: badge, sheet, banner, optimistic flip)
  provides:
    - "src/screens/CarDetailsScreen.tsx: always-fetch-when-admin gate at the deep-link fetch useEffect"
    - "src/screens/__tests__/CarDetailsScreen.admin.test.tsx: T14 (CR-04 fix regression test) + T15 (non-admin fast-path lock)"
  affects:
    - 10-VERIFICATION.md (CR-04 BLOCKER → closes; SC #1 + SC #3 partial → verified; LUI-01 BLOCKED → SATISFIED; LUI-03 PARTIAL → SATISFIED)
tech_stack:
  added: []
  patterns:
    - "Always-fetch-when-admin predicate widening (preserves single source of truth without introducing a parallel useState)"
    - "Stable-hook dep array extension (isAdmin from useAuth is stable across re-renders for a given session, so no re-fetch storm)"
key_files:
  created: []
  modified:
    - "src/screens/CarDetailsScreen.tsx (3-line comment + 1-char predicate + 1 dep-array entry; 5 insertions, 3 deletions)"
    - "src/screens/__tests__/CarDetailsScreen.admin.test.tsx (+59 lines: T14 ~50 lines + T15 ~9 lines)"
decisions:
  - "Chose always-fetch-when-admin (executor honored planner's choice) over the alternative parallel moderationOverride useState — keeps fetchedCar.moderationBadge as the single source of truth for the moderation surface; no drift risk between two parallel state channels."
  - "Added isAdmin to the useEffect dep array. Rationale: useAuth() returns a stable isAdmin across re-renders for a given session, so this does NOT cause a re-fetch storm. Verified empirically — 15/15 tests pass, no act() loops or update-after-update warnings beyond pre-existing seller-profile setSellerName noise."
  - "Added T15 (optional second test from the plan) — locks the non-admin fast-path explicitly. Performance regression guard for >99% of app traffic that is non-admin viewers from list surfaces."
metrics:
  duration: ~3m
  completed_date: 2026-05-29
  tasks_completed: 2
  files_modified: 2
  files_created: 0
  commits: 2
---

# Phase 10 Plan 12: CR-04 fetchedCar Gate Fix — Summary

CR-04 BLOCKER from 10-VERIFICATION.md closed. The deep-link fetch useEffect at `CarDetailsScreen.tsx:122-161` now fires whenever `isAdmin` is true — even when `route.params.carData` is prefilled (the 6 list-surface paths: HomeScreen, HomeScreenV2, MyListingsScreen, SearchResultsV2, FavoritesScreen, SellerListingsScreen). This guarantees the Phase 9 D-07 `moderationBadge` payload reaches `fetchedCar`, which downstream populates: (a) the `ListingModerationBottomSheet` `moderationBadge` prop, (b) the admin status banner conditional, and (c) gives `handleListingActionSubmit`'s optimistic flip + rollback a real non-null object to operate on. The non-admin fast-path is preserved verbatim — non-admin viewers with prefilled carData still skip the network round-trip. The single-source-of-truth invariant on `fetchedCar.moderationBadge` is preserved (no parallel `moderationOverride` useState introduced).

Total of ~64 LOC across 2 files, 2 atomic commits, full mobile moderation regression suite at 119/119 green (up from 117 — T14 and T15 are net-additive).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Change fetch gate predicate + dep array + comment | `06082db` | src/screens/CarDetailsScreen.tsx |
| 2 | Add T14 (CR-04 regression test) + T15 (non-admin fast-path lock) | `d0beb77` | src/screens/__tests__/CarDetailsScreen.admin.test.tsx |

## Exact Final Form of the Predicate Change

**Before** (CarDetailsScreen.tsx:125):
```ts
if (carId && !existingCar) {
```

**After** (CarDetailsScreen.tsx:127):
```ts
if (carId && (!existingCar || isAdmin)) {
```

**Full diff hunk:**

```diff
@@ -119,10 +119,12 @@ export const CarDetailsScreen = () => {
     checkFavoriteStatus();
   }, [carId]);

-  // Fetch car from API when opened via deep link (no carData)
+  // Fetch car from API when opened via deep link (no carData) OR when viewer is admin
+  // (admin always needs the Phase 9 D-07 `moderationBadge` payload — see Plan 10-12 CR-04 fix).
+  // Non-admin viewers with prefilled carData skip the fetch (existing fast-path preserved).
   useEffect(() => {
     const existingCar = CARS.find(c => c.id === carId) || (route.params as any).carData;
-    if (carId && !existingCar) {
+    if (carId && (!existingCar || isAdmin)) {
       setCarLoading(true);
       ...
@@ -157,7 +159,7 @@ export const CarDetailsScreen = () => {
         .catch(() => setFetchedCar(null))
         .finally(() => setCarLoading(false));
     }
-  }, [carId]);
+  }, [carId, isAdmin]);

   // Fetch seller profile (name, avatar) when car has sellerId
```

## isAdmin Dependency Array Observation

`isAdmin` was added to the `useEffect` dependency array (`[carId]` → `[carId, isAdmin]`). The plan flagged this as a potential re-fetch storm risk if `isAdmin` rotated on every render — but `useAuth()` returns a stable `isAdmin` for a given user session (only flips on login / logout / admin-role granted mid-session, which are intentional re-fetch trigger points).

**Empirical confirmation:** All 15 tests in `CarDetailsScreen.admin.test.tsx` pass; the suite's existing `mockApiGet` call-count assertions (T6, T7, T8, T9, T10, T11 all call `mockApiGet` exactly once per mount) remain green. No additional act() noise was observed beyond the pre-existing seller-profile `setSellerName` / `setSellerAvatarUrl` warnings from `CarDetailsScreen.tsx:172-173` (DEF-10-08-noise, unrelated to this plan).

If a future refactor changes `useAuth` to rotate `isAdmin` per render, the existing T6 fixture (which asserts `ModerationService.suspendListing` was called exactly once) would fail — providing a tripwire.

## Test Count After This Plan

`CarDetailsScreen.admin.test.tsx`: **15 tests** (T1 through T13 unchanged + T14 new + T15 new).

| Test | Purpose | Status |
|------|---------|--------|
| T1-T13 | Pre-Plan-10-12 admin moderation surface tests (Plan 10-08 + Plan 10-11 extensions) | ✅ 13/13 PASS — unchanged |
| T14 | CR-04 fix regression — admin from list surface (carData prefilled) still fetches moderationBadge + renders non-active branch + status banner | ✅ NEW PASS |
| T15 | Non-admin fast-path lock — buyer with prefilled carData does NOT fire mockApiGet | ✅ NEW PASS |

Full mobile moderation suite: **119/119 green** (was 117 — T14 + T15 are net-additive; no other suite touched).

Phase 4 e2e moderation integration: **18/18 green** — no regressions from the gate widening.

## Non-Admin Fast-Path Preservation

Confirmed BOTH by code review of the new predicate AND by T15:

**Code review:** The new predicate `if (carId && (!existingCar || isAdmin))` evaluates to:

| existingCar | isAdmin | gate fires? | behavior |
|-------------|---------|-------------|----------|
| undefined | true  | ✅ yes | fetch (admin from deep link, same as before) |
| undefined | false | ✅ yes | fetch (non-admin from deep link, same as before) |
| defined   | true  | ✅ yes | fetch (**new — admin from list surface**, CR-04 fix) |
| defined   | false | ❌ no  | **fast-path preserved** (non-admin from list surface — unchanged from pre-Plan-10-12) |

**T15 test:** `mockApiGet.mockClear()` + mount with `carData: FIXTURE_ACTIVE_CAR` and `isAdmin: false` + assert `mockApiGet` was not called. The test would fail if a future refactor weakened the non-admin fast-path.

## Single-Source-of-Truth Invariant Preserved

No parallel `moderationOverride` useState (or any second source of truth for the moderation surface) was introduced.

**Grep evidence:**
- `grep -c "moderationOverride" src/screens/CarDetailsScreen.tsx` returns 0
- `grep -c "useState.*moderation" src/screens/CarDetailsScreen.tsx` returns 0 (existing moderation-adjacent useStates — `bottomSheetVisible`, `reasonModalAction`, `restoreModalVisible`, `typedConfirmVisible`, `pendingDeletePayload`, `errorBanner` — are all UI-state, not moderationBadge mirrors)

`fetchedCar.moderationBadge` remains the only source for:
1. `ListingModerationBottomSheet`'s `moderationBadge` prop (CarDetailsScreen.tsx:1139, unchanged)
2. The admin status banner conditional `isAdmin && fetchedCar?.moderationBadge` (CarDetailsScreen.tsx:658, unchanged)
3. The optimistic flip + rollback handlers in `handleListingActionSubmit` (CarDetailsScreen.tsx:489-499, 517 — unchanged; now operates on a non-null `fetchedCar` on all 7 nav paths)

## Verification

### Plan-Level Verification Grep Block

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c 'carId && (!existingCar \|\| isAdmin)' src/screens/CarDetailsScreen.tsx` | 1 | 1 | ✅ PASS |
| `grep -c 'carId && !existingCar' src/screens/CarDetailsScreen.tsx` | 0 | 0 | ✅ PASS |
| `grep -c '\[carId, isAdmin\]' src/screens/CarDetailsScreen.tsx` | ≥1 | 1 | ✅ PASS |
| `grep -c "moderationOverride" src/screens/CarDetailsScreen.tsx` | 0 | 0 | ✅ PASS |
| `grep -c 'T14 CR-04' src/screens/__tests__/CarDetailsScreen.admin.test.tsx` | ≥1 | 1 | ✅ PASS |
| `grep -c 'Plan 10-12' src/screens/CarDetailsScreen.tsx` | ≥1 | 1 | ✅ PASS |

### Task-Level Acceptance Criteria

**Task 1:**

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| New predicate present | 1 | 1 | ✅ PASS |
| Old predicate removed | 0 | 0 | ✅ PASS |
| Dep array updated | ≥1 | 1 | ✅ PASS |
| Plan 10-12 comment present | ≥1 | 1 | ✅ PASS |
| 13 existing admin tests still pass | 13 | 13 | ✅ PASS |
| Diff scope: only comment + predicate + dep-array | yes | yes | ✅ PASS |

**Task 2:**

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c 'T14 CR-04'` in test file | ≥1 | 1 | ✅ PASS |
| `grep -c "setMockRouteParams.*carData: FIXTURE_ACTIVE_CAR"` | ≥1 | 2 (T14 + T15) | ✅ PASS |
| `grep -c "moderationBadge: FIXTURE_SUSPENDED_BADGE"` | ≥2 (T4 + T14) | 2 | ✅ PASS |
| `grep -c "expect(mockApiGet).toHaveBeenCalledWith.*car_abc"` | ≥1 | 1 | ✅ PASS |
| `npx jest CarDetailsScreen.admin.test.tsx` exit 0 with ≥14 tests | ≥14 | 15 | ✅ PASS |

### Behavioral Test Suite Results

| Suite | Tests | Status |
|-------|-------|--------|
| `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` | 15/15 | ✅ PASS (was 13, +T14 +T15) |
| `src/components/moderation/__tests__/` + `CarDetailsScreen.admin` + `AdminModerationScreen.tabs` + `SellCarScreen.adminEdit` | 119/119 | ✅ PASS (was 117) |
| `__tests__/moderation.e2e.integration.test.tsx` (Phase 4 regression) | 18/18 | ✅ PASS — no regression |

## Closes ROADMAP / Requirement Gaps

- **VERIFICATION gap `SC #1 — admin sees Moderate badge → opens bottom sheet with 4 actions + status banner reflecting current state`**: `partial` → expected `verified` on re-verification.
- **VERIFICATION gap `SC #3 — Re-opening sheet on non-active listing replaces 4 actions with Restore + reason category`**: `partial` → expected `verified` on re-verification.
- **Phase 10 LUI-01**: `BLOCKED` → expected `SATISFIED` on re-verification.
- **Phase 10 LUI-03**: `PARTIAL` → expected `SATISFIED` on re-verification.
- **CR-04 (BLOCKER)**: closed.

Combined with Plan 10-11 (CR-01 closure), all Phase 10 VERIFICATION blockers are now addressed.

## Deviations from Plan

### None — plan executed as written.

**Notes:**
- T15 (optional second test) was added per the plan's Step 3 recommendation — locks the non-admin fast-path. This makes the future regression guard explicit instead of relying on the predicate-shape grep alone.
- Both files modified are the exact files listed in the plan frontmatter `files_modified` array.
- Zero auto-fix deviations (Rules 1-3). Zero architectural decisions raised (Rule 4).

## Authentication Gates

None — autonomous mobile code change, no backend or auth interaction.

## Out-of-Scope Findings (Logged, Not Fixed)

These existed on the codebase baseline before this plan and are independent of this plan's changes. None are regressions:

- **Pre-existing `act(...)` test-harness noise** from `CarDetailsScreen.tsx:170-173` (`setSellerName` / `setSellerAvatarUrl` async state updates inside `axios.get('/api/users/...')`) — pre-existing CarDetails test pattern; tests still pass. Noted in Plan 10-11 SUMMARY's Out-of-Scope section as well.
- **WR-06 silent failure** on `.catch(() => setFetchedCar(null))` (line 157) — explicitly out of scope per plan's `forbidden` list and the 10-VERIFICATION.md deferred-to-Phase-11 note.

Scope discipline preserved per execute-plan.md's SCOPE BOUNDARY rule.

## Known Stubs

None. The fetch gate widening is the actual data wiring — `fetchedCar.moderationBadge` now flows through to the bottom sheet, status banner, and optimistic-flip handler on all 7 nav surfaces. No placeholder values, no hardcoded empty arrays, no UI rendering an unwired prop.

## TDD Gate Compliance

N/A — this plan is `type: execute`, not `type: tdd`. Tasks are non-TDD `type="auto"`. Commit 1 is `fix(...)` (code change), Commit 2 is `test(...)` (test-only addition for the same change) — both correct for non-TDD gap-closure execution.

## Self-Check: PASSED

**Files exist:**
- `src/screens/CarDetailsScreen.tsx` FOUND
- `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` FOUND

**Commits exist (on `main`):**
- `06082db` FOUND (Task 1 — fetch gate predicate + dep array + comment)
- `d0beb77` FOUND (Task 2 — T14 + T15 regression tests)

**Grep evidence (independently re-verified at SUMMARY-write time):**
- 1/0/1/0/1/1 acceptance grep counts all match exact expected values (new predicate / old predicate / dep array / moderationOverride / T14 CR-04 / Plan 10-12)
- 15/15 CarDetailsScreen.admin tests green
- 119/119 mobile moderation regression suite green
- 18/18 Phase 4 e2e moderation integration green

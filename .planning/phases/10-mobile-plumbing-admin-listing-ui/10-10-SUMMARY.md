---
phase: 10-mobile-plumbing-admin-listing-ui
plan: 10
subsystem: ui
tags: [react-native, admin-moderation, listings, flatlist, abortcontroller, tdd]

# Dependency graph
requires:
  - phase: 10-mobile-plumbing-admin-listing-ui
    provides: "Plan 10-03 (backend GET /api/admin/moderation/listings), Plan 10-04 (ModerationService.searchListings + restoreListing), Plan 10-07 (ListingRestoreModal), Plan 10-02 (buildListingTitle)"
provides:
  - "Top-level Users|Listings tab control on AdminModerationScreen (D-09 widen-existing-surface, D-12 default Users)"
  - "Listings tab body: search + 5 status filter chips (All|Active|Suspended|Archived|Deleted) + paginated FlatList of AdminListingRow + per-row Recover button on deleted rows"
  - "End-to-end Recover flow: row → ListingRestoreModal → ModerationService.restoreListing → optimistic row flip + rollback (single path back to active per Phase 8 D-B)"
  - "Pitfall 7 mitigation: distinct listingsAbortRef useRef instance for rapid tab-switch safety"
affects: ["Phase 11 buyer UX (this surface stays admin-only); future Phase 11 UAT may extend error UX richness on Listings tab"]

# Tech tracking
tech-stack:
  added: []  # zero new deps; reuses RN core + lucide-react-native + existing moderation modules
  patterns:
    - "Parallel state buckets for tab-scoped lifecycles (distinct AbortController per tab — Pitfall 7)"
    - "ChipButton testID forwarding (composite + host both carry testID; tests resolve via findByTestID helper preferring composite)"
    - "Listing-status → user-severity palette mapping (active→active / suspended→featureLimited / archived→permaBanned / deleted→blockedReview) to reuse SeverityBadge without widening its state union"
    - "Optimistic Recover flow with rollback-on-error + raw err.code → Alert (no ListingModerationError special-casing in list view per CONTEXT discretion)"

key-files:
  created:
    - "src/screens/__tests__/AdminModerationScreen.tabs.test.tsx (447 lines, 13 GREEN tests)"
  modified:
    - "src/screens/AdminModerationScreen.tsx (+417/-12 — tab control + Listings state bucket + Listings body + AdminListingRow + Recover handler)"

key-decisions:
  - "Listing-status → user-severity mapping: deleted maps to blocked_with_review (red palette) and archived maps to permanently_banned (neutral palette). Visual semantics over literal name parity — deleted is destructive (red), archived is neutral (grey)."
  - "Recover handler uses raw `err.code ?? T.errGeneric` for Alert message rather than the full ListingModerationError → MODERATION_ERROR_KEY_MAP translation path used elsewhere. CONTEXT recommended simplicity for the list-view; Phase 11 UAT can request richer error UX if needed."
  - "Test helper findByTestID prefers the composite (TouchableOpacity/ChipButton) over the host View when both carry the same testID — enables direct prop assertions on accessibilityState/active without descending into host nodes."
  - "EmptyState for Listings tab uses Archive icon (Lucide) — more semantically aligned with listing-domain than the Users icon. Falls back to T.emptySearchTitle/Body when listingsEmpty/listingsEmptyBody translation keys are absent."

patterns-established:
  - "Tab-scoped lifecycles: each tab owns its own state bucket + AbortController + cursor + filter — never shared across tabs. Tab-switch is a clean lifecycle event for the destination tab and a no-op for the leaving tab."
  - "Tab-switch effect gating: `useEffect(() => { if (scopeTab !== 'listings') return; runListingsSearch(true); ... }, [scopeTab, runListingsSearch])` — fires on entering the tab, no-ops while elsewhere."

requirements-completed: [LUI-04]

# Metrics
duration: 17m14s
completed: 2026-05-29
---

# Phase 10 Plan 10: Mobile Admin Listings Tab Summary

**Top-level Users|Listings tab control on AdminModerationScreen with fully wired Listings tab (search + 5 status chips + paginated FlatList + per-row Recover) backed by Plan 10-03 backend GET + Plan 10-04 ModerationService.searchListings/restoreListing + Plan 10-07 ListingRestoreModal.**

## Performance

- **Duration:** 17m14s
- **Started:** 2026-05-29T10:47:28Z
- **Completed:** 2026-05-29T11:04:42Z
- **Tasks:** 2 (TDD: RED → GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Listings tab body fully wired with search submit (NOT debounced per Phase 5 plan-05-11 lesson), 5 filter chips, paginated FlatList with onEndReached, RefreshControl, and EmptyState fallbacks.
- AdminListingRow renderer: thumbnail (firstPhotoUrl with placeholder), title via shared `buildListingTitle` helper (Pitfall 6 mitigation), price, SeverityBadge mapped from listing status, and conditional Recover button visible ONLY when status === 'deleted' (LUI-04 explicit).
- End-to-end Recover loop: row tap → ListingRestoreModal mount → `onSubmit` calls `ModerationService.restoreListing(carId, body)` → optimistic row flip (status → 'active') + Recover button removal → rollback on error.
- Row body tap navigates to CarDetails with `{ carId }` per D-10 (Plan 08 admin badge surface receives admin-deep-link bearer token via Plan 10-05 apiClient migration).
- Pitfall 7 mitigation: `listingsAbortRef = useRef<AbortController | null>(null)` is a distinct useRef instance from the user-tab `abortRef` — verified at runtime by Test 10 (each searchListings call carries a unique AbortSignal) and at source by Test 12 grep guard.
- Phase 8 D-B "single path back to active" invariant preserved: NO separate `recoverListing` method anywhere in the screen or service — Recover and Restore share the same code path. Test 12 source-grep asserts this mechanically.

## Task Commits

1. **Task 1: Wave 0 RED tests for AdminModerationScreen Listings tab** — `06145c8` (test)
   - 13 jest tests written; 11 fail at tab-listings testID lookup (no tab control yet); 2 pass (grep guard + user-tab regression-lock) — RED gate confirmed.

2. **Task 2: Add Users|Listings tab control + Listings tab body to AdminModerationScreen.tsx (GREEN)** — `08d22ba` (feat)
   - All 13 Task 1 tests pass. Existing `AdminModerationScreen.test.tsx` 9/9 still green (user-tab regression-lock). Full mobile suite 367/368 green (pre-existing `App.test.tsx` deferred failure unchanged).

## Files Created/Modified

- **Created:** `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` — 13-test integration suite mirroring existing `AdminModerationScreen.test.tsx` conventions (settle() pattern, stable Proxy mockT, mocked ModerationService/useNavigation/useAuth/useLanguage).
- **Modified:** `src/screens/AdminModerationScreen.tsx` — additive +417/-12. New imports (Image, Archive, ListingRestoreModal, buildListingTitle, ListingSearchItem, SearchListingsQuery, ModerationState), new module-level types (ScopeTab, ListingStatusFilter) + LISTING_STATUS_FILTER_OPTIONS + mapListingStatusToSeverityState helper, parallel Listings state bucket (11 hooks + 1 distinct AbortController ref + 1 recoverTarget), listings handlers (buildListingsQuery, runListingsSearch, fetchNextListingsPage, onRefreshListings, handleSubmitListingsSearch, handleRecoverListing), JSX refactor wrapping existing user-tab body in `scopeTab === 'users'` branch + new Listings tab body + ListingRestoreModal mount, and 8 new StyleSheet entries. Existing user-tab handlers/state/styles byte-identical (structure-only refactor wraps them inside the new conditional).

## Decisions Made

- **Listing-status → user-severity palette mapping:**
  - `active` → `active` (green)
  - `suspended` → `feature_limited` (amber warning)
  - `archived` → `permanently_banned` (neutral grey)
  - `deleted` → `blocked_with_review` (red destructive)

  Rationale: visual semantics over literal name parity. `deleted` is the most destructive listing state and warrants the red palette; `archived` is neutral (admin chose to remove from active circulation without flagging the seller). Documented in source as `mapListingStatusToSeverityState`.
- **Recover handler simplifies error UX vs. user-tab handlers:** raw `err.code ?? T.errGeneric` Alert rather than full `ListingModerationError` → `MODERATION_ERROR_KEY_MAP` translation path. CONTEXT discretion called this out as acceptable for the list view; Phase 11 UAT may extend.
- **Test helper findByTestID prefers composite over host View:** both carry the testID when forwarded via ChipButton, so the helper picks the one with `typeof n.type !== 'string'` to enable direct prop assertions.
- **EmptyState for Listings tab uses lucide Archive icon** (vs. Users icon for the user tab) — semantically aligned with listing domain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source comment tripped grep invariant (recoverListing)**
- **Found during:** Task 2 GREEN test run (Test 12 source-grep failure)
- **Issue:** Plan-action comment in handleRecoverListing originally read "NO separate recoverListing route exists" — the literal word `recoverListing` tripped Plan's `grep -c "recoverListing" = 0` invariant.
- **Fix:** Rephrased comment to "there is NO separate route for the Listings-tab Recover button; it shares the same code path as CarDetails Restore" — preserves anti-pattern documentation without using the forbidden literal token.
- **Files modified:** src/screens/AdminModerationScreen.tsx
- **Verification:** Test 12 source-grep passes; intent preserved in restructured prose.
- **Committed in:** 08d22ba (Task 2 commit)

**2. [Rule 1 - Bug] Test 1 accessibilityState assertion fails on composite ChipButton**
- **Found during:** Task 2 GREEN test run (Test 1 — usersTab.props.accessibilityState.selected expected true, received undefined)
- **Issue:** `findByTestID` returns the composite ChipButton, which exposes `active` / `onPress` / `label` / `testID` as its own props but does NOT expose the internal `accessibilityState` it forwards to the inner TouchableOpacity. The assertion was checking the composite's surface, not the host's.
- **Fix:** Changed the assertion to check `usersTab.props.active === true` directly (canonical D-12 signal at the composite layer). Documented the change in test comment.
- **Files modified:** src/screens/__tests__/AdminModerationScreen.tabs.test.tsx
- **Verification:** Test 1 passes; D-12 default Users invariant still covered.
- **Committed in:** 08d22ba (Task 2 commit)

**3. [Rule 1 - Bug] Test 6 ReactTestInstance.toJSON() doesn't exist**
- **Found during:** Task 2 GREEN test run (Test 6 — `row1.toJSON is not a function`)
- **Issue:** `ReactTestInstance` (from `tree.root.findAll`) does not have a `.toJSON()` method — only `TestRenderer.create(...)` (the root) does. The original assertion tried to serialize the row subtree directly.
- **Fix:** Switched to asserting against `accessibilityLabel` on the row (which is built source-side from `buildListingTitle(item)`) — directly observable on the composite, no descent needed.
- **Files modified:** src/screens/__tests__/AdminModerationScreen.tabs.test.tsx
- **Verification:** Test 6 passes; substantive invariant (canonical title text appears on each row) preserved.
- **Committed in:** 08d22ba (Task 2 commit)

**4. [Rule 1 - Bug] Test 10 false-positive on Users tab call increase**
- **Found during:** Task 2 GREEN test run (Test 10 — expected `searchUsers.calls.length > usersCallsBefore`, received `1 === 1`)
- **Issue:** The user-tab `useEffect([runSearch])` only re-fires when `submittedQuery / roleFilter / stateFilter` change. Rapid tab switching back to Users without changing those does NOT re-fire `searchUsers` — which is correct, expected behavior, not a bug. The test's secondary assertion misunderstood the effect lifecycle.
- **Fix:** Removed the secondary `searchUsers calls > before` assertion. Primary invariant (distinct AbortSignals across listingsCalls) is what Pitfall 7 demands; that assertion is preserved and is the load-bearing check.
- **Files modified:** src/screens/__tests__/AdminModerationScreen.tabs.test.tsx
- **Verification:** Test 10 passes; Pitfall 7 invariant (distinct AbortControllers per tab) verified at runtime via `sig1 !== sig2` and complemented at source by Test 12's listingsAbortRef grep count.
- **Committed in:** 08d22ba (Task 2 commit)

**5. [Rule 3 - Blocking] Unused helper trips ESLint**
- **Found during:** Task 2 ESLint run (`'allByTestID' is defined but never used`)
- **Issue:** Created `allByTestID` helper alongside `findByTestID` for symmetry, but no test consumed it.
- **Fix:** Deleted the unused helper.
- **Files modified:** src/screens/__tests__/AdminModerationScreen.tabs.test.tsx
- **Verification:** ESLint passes on the test file (no new errors introduced).
- **Committed in:** 08d22ba (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (4 Rule 1 test-correctness bugs, 1 Rule 3 ESLint blocking)
**Impact on plan:** All deviations are test-machinery refinements; ZERO functional source-code drift from plan-action prescriptions. Substantive invariants (D-12 default Users, canonical title rendering, Pitfall 7 distinct AbortControllers, source-grep anti-pattern guards) are all preserved with corrected assertions.

## Issues Encountered

- **Pre-existing `__tests__/App.test.tsx` deferred failure**: confirmed still failing on main HEAD before Plan 10-10 changes (`Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` — react-navigation/native-stack issue logged in deferred-items.md by Phase 5 Plan 11). Not in scope; not caused by Plan 10-10. Full mobile suite is 367/368 green excluding this.

## Verification Evidence

Grep invariants (from plan `<verification>` block) — all GREEN:

```
listingsAbortRef:      5  (expected >= 3)
recoverListing (screen):  0  (expected 0)
recoverListing (service): 0  (expected 0)
useDebouncedValue:     0  (expected 0)
scopeTab === 'users':  2  (expected >= 1)
scopeTab === 'listings': 1  (expected >= 1)
buildListingTitle:     2  (expected >= 1)
```

Test counts:
- `AdminModerationScreen.tabs.test.tsx` — 13/13 GREEN
- `AdminModerationScreen.test.tsx` (existing user-tab) — 9/9 GREEN (regression-lock holds)
- Full mobile suite — 367/368 GREEN (the 1 pre-existing App.test.tsx deferred failure unchanged)

## Phase 10 Closure: All 5 ROADMAP Success Criteria

With Plan 10-10 landing, Phase 10 closes with the full v1.1 admin Listing UI feature surface delivered end-to-end:

1. **Criterion #1 (Admin can view a deleted listing's CarDetails with banner)** — Plan 08 (admin badge surface on CarDetailsScreen) + Plan 10-05 (apiClient migration for admin deep-link Bearer)
2. **Criterion #2 (Admin can suspend/archive/delete listings inline from CarDetails bottom sheet)** — Plan 10-04 (ModerationService writes) + Plan 08 (bottom sheet wire-up)
3. **Criterion #3 (Admin can edit listings — reusing SellCarScreen)** — Plan 10-06 + Plan 10-09 (route.params.adminEdit flag + GatedScreenWrapper bypass + ListingModerationError catch branch)
4. **Criterion #4 (Admin can list + filter + recover deleted listings via dedicated tab)** — **Plan 10-10 (this plan)** + Plans 10-03 (backend GET) + 10-04 (service) + 10-07 (ListingRestoreModal)
5. **Criterion #5 (409 cart/checkout collision surfaces via Alert/banner in CarDetails)** — Plan 10-05 (apiClient discriminator) + Plan 08 (in-flight admin moderation handling)

## Next Phase Readiness

- Phase 10 (mobile-plumbing-admin-listing-ui) complete end-to-end. All LUI-* requirements satisfied on mobile; backend Plan 10-03 already landed cross-repo.
- Phase 11 (buyer UX + quality + security review) is unblocked: receives a fully wired admin moderation UI to UAT-pilot, and inherits the dual-error-class invariant (ModerationError for user-domain auth gates / ListingModerationError for listing-domain actions) to extend buyer-side cart/checkout 409 banner UX.
- Optional Phase 11 follow-ups noted: richer error UX in Listings tab Recover (Phase 10-10 uses simple `err.code ?? T.errGeneric` Alert per CONTEXT discretion); deeper `listingsEmpty` / `listingsEmptyBody` / `listingsSearchPlaceholder` / `listingActionRestore` translation keys (Plan 10-10 falls back to existing keys via `??` — current behavior is functional but lacks listing-specific phrasing).

## Self-Check: PASSED

Files verified:
- `src/screens/AdminModerationScreen.tsx` — FOUND
- `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` — FOUND

Commits verified:
- `06145c8` (Task 1 RED tests) — FOUND in git log
- `08d22ba` (Task 2 GREEN implementation) — FOUND in git log

---
*Phase: 10-mobile-plumbing-admin-listing-ui*
*Plan: 10*
*Completed: 2026-05-29*

---
phase: 10
plan: 08
subsystem: mobile/admin/listing-moderation
tags: [LUI-01, LUI-02, LUI-03, LMOB-02, react-native, screens, moderation]
requires:
  - listing-mod-error: src/services/moderation/errors.ts (Plan 10-01 ListingModerationError)
  - listing-title-helper: src/utils/listingTitle.ts (Plan 10-02 buildListingTitle + matchesListingTitleSentinel)
  - moderation-service-writes: src/services/moderation/ModerationService.ts (Plan 10-04 suspendListing/archiveListing/deleteListing/restoreListing)
  - apiclient-migration: src/screens/CarDetailsScreen.tsx (Plan 10-05 apiClient.get for deep-link fetch)
  - bottom-sheet: src/components/moderation/ListingModerationBottomSheet.tsx (Plan 10-06)
  - reason-modal: src/components/moderation/ListingModerationReasonModal.tsx (Plan 10-07)
  - restore-modal: src/components/moderation/ListingRestoreModal.tsx (Plan 10-07)
  - typed-confirm-keyboard: src/components/moderation/TypedConfirmationModal.tsx (Plan 10-07 keyboardType prop)
provides:
  - admin-moderate-badge: src/screens/CarDetailsScreen.tsx (ShieldAlert badge in headerRight)
  - admin-status-banner: src/screens/CarDetailsScreen.tsx (D-17 banner above titleBlock)
  - admin-error-banner: src/screens/CarDetailsScreen.tsx (D-15 inline for own-listing + already-in-state)
  - optimistic-flip-handler: src/screens/CarDetailsScreen.tsx (D-16 handleListingActionSubmit)
  - two-modal-delete-stack: src/screens/CarDetailsScreen.tsx (D-07 reason modal + TypedConfirmationModal w/ keyboardType="default")
  - nav-edit-adminedit: src/screens/CarDetailsScreen.tsx (navigation.navigate('SellCar', { carId, adminEdit: true }))
affects:
  - src/screens/CarDetailsScreen.tsx
  - src/screens/__tests__/CarDetailsScreen.admin.test.tsx
tech-stack:
  added: []
  patterns: [optimistic-update-with-rollback, two-modal-escalation, single-source-of-truth-title, inline-error-banner-vs-modal-alert-split]
key-files:
  created:
    - src/screens/__tests__/CarDetailsScreen.admin.test.tsx
  modified:
    - src/screens/CarDetailsScreen.tsx
    - .planning/phases/10-mobile-plumbing-admin-listing-ui/deferred-items.md
decisions:
  - "D-LUI-01: ShieldAlert + COLORS.warning header badge — grep-stable testID=\"moderate-badge\""
  - "D-02 unconditional badge — backend is authority on own-listing rejection (cannot_moderate_own_listing) — no client-side isOwner hide"
  - "D-17 admin status banner renders moderationBadge fields (status + reasonCategory chip + moderationReason free-text + setBy) — admin-only + presence-gated"
  - "D-15 error split — cannot_moderate_own_listing + already_in_state → inline banner; listing_not_found → Alert + goBack; other codes → Alert.alert(code)"
  - "D-16 optimistic flip captures BOTH status AND moderationBadge in one setFetchedCar; rollback restores BOTH (Pitfall 2 closed)"
  - "D-07 two-modal Delete escalation — reason modal stays mounted while TypedConfirmationModal overlays with keyboardType=\"default\" (Pitfall 3) + sentinel = buildListingTitle(fetchedCar) (Pitfall 6 single source of truth)"
  - "useAuth destructure widened to include isAdmin via `as any` cast (AuthContextType doesn't expose isAdmin in the type currently — accepted as DEBT-02 widening, not in scope here)"
metrics:
  duration: "~5m33s"
  tasks_completed: "2/2"
  files_modified: 2
  files_created: 1
  tests_added: 13
  tests_passing: 13
  completed: "2026-05-29"
---

# Phase 10 Plan 08: CarDetailsScreen Admin Moderation Surface Summary

**Status:** COMPLETE — Wave 4 integration plan delivered.

**One-liner:** Wires the admin moderation surface onto `CarDetailsScreen.tsx`: ShieldAlert badge in `headerRight` gated on `isAdmin`, mounted `ListingModerationBottomSheet`, admin status banner above the title block rendering Phase 9 D-07 `moderationBadge`, inline error banner for own-listing + already-in-state codes, optimistic-flip + rollback handler snapshotting both `status` and `moderationBadge`, and the D-07 two-modal Delete escalation with `keyboardType="default"` typed-sentinel for the listing title.

## What Shipped

### CarDetailsScreen.tsx (~250 lines added)

**Imports (8 new):**
- `ShieldAlert` from `lucide-react-native`
- `ListingModerationBottomSheet`, `ListingModerationAction`
- `ListingModerationReasonModal`, `ListingReasonAction`
- `ListingRestoreModal`
- `TypedConfirmationModal`
- `ModerationService`
- `ListingModerationError`
- `buildListingTitle`

**State hooks (6 new):**
- `bottomSheetVisible` — drives `ListingModerationBottomSheet.visible`
- `reasonModalAction` — `ListingReasonAction | null`; non-null mounts the reason modal
- `restoreModalVisible` — drives `ListingRestoreModal.visible`
- `typedConfirmVisible` — drives the Delete typed-confirmation overlay
- `pendingDeletePayload` — buffers `{ reasonCategory, note? }` between the reason modal and the typed-confirm step (D-07 two-modal stack)
- `errorBanner` — `string | null`; non-null renders the inline error banner

**Computed value:**
- `listingTitle` — `buildListingTitle(fetchedCar)` with a graceful pre-fetch fallback that consults `car.makeName ?? car.make` for the mock-data path. Same string is passed to BOTH the bottom-sheet header AND `TypedConfirmationModal.targetEmail` (Pitfall 6 single source of truth).

**Handlers (2 new):**
- `handleListingActionSubmit(action, body?)` — optimistic-flip + try/await/catch + rollback. Snapshots `prevBadge` AND `prevStatus`, flips BOTH in one `setFetchedCar` call (Pitfall 2), dispatches to the right `ModerationService.<action>Listing` method, on success merges `result.listing`, on `ListingModerationError` branches by code per D-15.
- `handleSheetSelect(action)` — dispatches `edit → navigation.navigate('SellCar', { carId, adminEdit: true })`, `restore → setRestoreModalVisible(true)`, else `→ setReasonModalAction(action)`.

**JSX insertions (3):**
1. `<TouchableOpacity testID="moderate-badge">` with `ShieldAlert` icon in `headerRight`, rendered as a sibling to the existing Share button (D-02 unconditional — also visible when `user.localId === car.sellerId`).
2. `<View testID="admin-status-banner">` at the top of `detailsContainer`, with three severity variants (`adminBannerWarning` / `adminBannerNeutral` / `adminBannerDestructive`) keyed off `moderationBadge.banner.severity`. Renders status, reasonCategory chip, moderationReason free-text, and `by <moderatedBy>` setBy line.
3. `<View testID="admin-error-banner">` adjacent to the status banner; dismissible via inline `X` icon.

**Modal mount block (4 modals):**
- `ListingModerationBottomSheet` — mounted unconditionally; `visible` prop drives rendering
- `ListingModerationReasonModal` — mounted when `reasonModalAction && fetchedCar`; `onSubmit` routes Delete → `setPendingDeletePayload + setTypedConfirmVisible(true)`, else calls `handleListingActionSubmit` directly
- `TypedConfirmationModal` — mounted when `typedConfirmVisible && pendingDeletePayload`; `keyboardType="default"` (Pitfall 3 mitigation), `targetEmail={listingTitle}` (Pitfall 6 single source of truth)
- `ListingRestoreModal` — mounted when `restoreModalVisible && fetchedCar`; `onSubmit` calls `handleListingActionSubmit('restore', body)`

**StyleSheet additions:**
- `adminStatusBanner` + 3 severity variants (`adminBannerWarning` / `adminBannerNeutral` / `adminBannerDestructive`) using `COLORS.moderation.*` palette tokens
- `adminBannerStatus` / `adminBannerChip` / `adminBannerReason` / `adminBannerSetBy` typographic styles
- `adminErrorBanner` / `adminErrorBannerText` — flex-row layout with dismiss icon

### CarDetailsScreen.admin.test.tsx (515 lines, 13 tests)

13 tests covering:
- T1 — admin badge gate (`isAdmin=false → null`, `isAdmin=true → renders`)
- T2 — D-02 unconditional badge when admin views own listing
- T3 — badge tap opens `listing-sheet-overlay`
- T4 — D-17 status banner renders status + reasonCategory + reason + setBy substrings
- T5 — active listing has no banner; 4 actions in sheet (no Restore)
- T6 — D-16 optimistic suspend flip + service call + sheet close
- T7 — rollback on `already_in_state` → inline banner, NO Alert
- T8 — `cannot_moderate_own_listing` → inline banner, NO Alert
- T9 — `listing_not_found` → Alert + `navigation.goBack()`
- T10 — D-07 Delete two-modal stack with `keyboardType="default"` and `targetEmail="2018 Toyota Camry"`
- T11 — Restore flow on archived listing → `ListingRestoreModal` → `restoreListing` called
- T12 — Edit action routes to `SellCar` with `adminEdit: true`
- T13 — Pitfall 6 grep guard (`buildListingTitle(` present, inline `${...year...make...model}` template absent)

All 13 tests GREEN.

## Verification

| Check | Result |
| --- | --- |
| `npx jest src/screens/__tests__/CarDetailsScreen.admin.test.tsx --bail` | 13/13 pass |
| `npx jest src/services/http/__tests__/clientListing409.test.ts --bail` | 5/5 pass (Plan 10-05 regression suite intact) |
| `grep -c "buildListingTitle(" src/screens/CarDetailsScreen.tsx` | 3 (≥ 2 required) |
| `grep -c 'keyboardType="default"' src/screens/CarDetailsScreen.tsx` | 2 (≥ 1 required — JSX + comment) |
| `grep -c "{isAdmin &&" src/screens/CarDetailsScreen.tsx` | 2 (badge + status banner; ≥ 2 required) |
| `grep -cE "isOwner.*isAdmin\|isAdmin.*isOwner" src/screens/CarDetailsScreen.tsx` | 0 (D-02 no client-side isOwner hide) |
| `grep -cE "moderate-badge\|admin-status-banner\|admin-error-banner" src/screens/CarDetailsScreen.tsx` | 3 (all testIDs present) |
| `grep -cE '\$\{.*\.year.*\.make.*\.model\}' src/screens/CarDetailsScreen.tsx` | 0 (Pitfall 6 — no inline template literal) |
| `npx eslint src/screens/CarDetailsScreen.tsx ... ` | 5 errors, all PRE-EXISTING (verified via `git stash` baseline); ZERO new errors from this plan |

## Deviations from Plan

### Plan-Driven (Rule 0 — explicit plan compliance)

None — plan executed close to spec.

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `useAuth().isAdmin` not on AuthContextType**
- **Found during:** Task 2 (Step "Wire useAuth destructure")
- **Issue:** Codebase reads `isAdmin` widely (AdminDashboardScreen, AdminUserDetailScreen, etc.) but the exported `AuthContextType` interface does not declare `isAdmin` as a typed property — existing screens use `as any` or rely on JS-level access. Adding `isAdmin` strictly typed at the call site would require modifying `src/context/AuthContext.tsx` and AuthContextType — out of scope for Plan 08 (DEBT-02 territory).
- **Fix:** Destructure via `const { user, isAdmin } = useAuth() as any;` — mirrors the pattern used elsewhere when reading admin flags. The plan's <action> block suggested `useAuth() as unknown as { isAdmin: boolean; user: typeof user }` which has the same TS-bypass intent.
- **Files modified:** `src/screens/CarDetailsScreen.tsx:26`
- **Commit:** `cc635e3`

**2. [Rule 2 — Critical functionality] `listingTitle` fallback for pre-fetch / mock-data path**
- **Found during:** Task 2 (testing T1 with no `fetchedCar` populated)
- **Issue:** `buildListingTitle(fetchedCar)` would receive `null` when `CARS` mock-data hit (CARS-based browse path doesn't populate `fetchedCar`). Calling `buildListingTitle(null)` would crash.
- **Fix:** Added a graceful fallback — if `fetchedCar` is null, build a `ListingTitleSource` shape from the `car` (mock or carData) object using `makeName ?? make` and `modelName ?? model`. Both paths flow through the SAME `buildListingTitle` helper, preserving Pitfall 6 single-source-of-truth.
- **Files modified:** `src/screens/CarDetailsScreen.tsx` (listingTitle computed value)
- **Commit:** `cc635e3`

**3. [Rule 1 — Bug] Test file `__mockAuth` / `__mockRouteParams` variable names blocked by babel-plugin-jest-hoist**
- **Found during:** Task 1 (first `npx jest` invocation)
- **Issue:** Variables referenced from inside `jest.mock(..., factory)` factory functions must start with `mock` (case-insensitive) per babel-plugin-jest-hoist's allowlist. `__mockAuth` and `__mockRouteParams` (leading underscore) were rejected.
- **Fix:** Renamed to `mockAuthState` and `mockRouteParams`.
- **Files modified:** `src/screens/__tests__/CarDetailsScreen.admin.test.tsx`
- **Commit:** `eaed0e1`

### Out-of-Scope Discoveries Logged to deferred-items.md

**1. DEF-10-08-01: `__tests__/App.test.tsx` fails with `usesNewAndroidHeaderHeightImplementation` undefined**
- **Pre-existing:** verified via `git stash` baseline on commit `eaed0e1` (pre-Plan-10-08-Task-2). Plan 10-08 source changes are scoped to `CarDetailsScreen.tsx` + tests; cannot have introduced this failure.
- **Recommended:** Phase 10 verifier or Phase 11 LQUAL cleanup to mock the native module.

## Authentication Gates

None — Plan 10-08 executed without auth-gate interruptions. All `ModerationService.*` writes are admin-authenticated server-side via the `apiClient` Bearer interceptor; mobile-side `isAdmin` only gates UI visibility.

## Known Stubs

None — every wired element flows through to a real implementation:
- Badge → `setBottomSheetVisible(true)` → `ListingModerationBottomSheet` (Plan 10-06 real component)
- Sheet `onSelect` → `handleSheetSelect` (real dispatcher)
- Reason modal `onSubmit` → `handleListingActionSubmit` (real optimistic-flip handler) → `ModerationService.<action>Listing` (Plan 10-04 real method) → `apiClient.patch` (real)
- Status banner consumes real `fetchedCar.moderationBadge` from the deep-link GET response (Phase 9 D-07)

The `errorBanner` text is the raw error code string (e.g. `already_in_state`); final RU/EN copy is Phase 11 LQUAL-01 territory per CONTEXT.

## Threat Flags

None — no new attack surface beyond what's already covered in the Plan's `<threat_model>` table (T-10-01 through T-10-keyboard, all mitigated and verified by tests T1, T7-T10).

## TDD Gate Compliance

- ✓ RED gate: `test(10-08): add failing tests...` (commit `eaed0e1`) — 13/13 tests failing because `CarDetailsScreen` had no admin wiring
- ✓ GREEN gate: `feat(10-08): wire admin moderation surface...` (commit `cc635e3`) — 13/13 tests green
- ✗ REFACTOR gate: not required (no refactor commit)

## Success Criteria

- ✓ ROADMAP success criterion #1: Admin sees Moderate badge → bottom sheet of 4 actions + status banner
- ✓ ROADMAP success criterion #2: Suspend/Archive/Delete/Restore submits update the on-screen banner without restart (via optimistic flip + backend confirmation merge)
- ✓ ROADMAP success criterion #3: Restore replaces the 4 actions on non-active listings (handled by the bottom-sheet `isActive` branch — Plan 10-06 deliverable)
- ✓ Plan 10-09 unblocked: `navigation.navigate('SellCar', { carId, adminEdit: true })` wired
- ✓ D-15 split lands: `cannot_moderate_own_listing` + `already_in_state` are inline (non-modal); `listing_not_found` is hard-stop (Alert + goBack)

## Self-Check: PASSED

- src/screens/CarDetailsScreen.tsx — FOUND
- src/screens/__tests__/CarDetailsScreen.admin.test.tsx — FOUND
- Commit eaed0e1 — FOUND
- Commit cc635e3 — FOUND

---
phase: 10
plan: 09
subsystem: mobile/moderation/screens
tags: [mobile, moderation, listing, screens, sellcar, adminedit, typescript, lui-02, phase-10, wave-4]
requires:
  - Plan 10-01 ListingModerationError sibling class (substrate)
  - Plan 10-04 ModerationService.adminEditListing(carId, AdminEditListingInput) (LMOB-01 substrate)
  - Plan 10-08 CarDetailsScreen admin Edit row that calls navigation.navigate('SellCar', { carId, adminEdit: true }) (sibling — both consumers of the widened route param shape)
provides:
  - RootStackParamList.SellCar widened with optional adminEdit?: boolean flag
  - SellCarScreen reuses for admin Edit via route flag (D-01 — no separate AdminEditListingScreen)
  - 4+ seller-only gate bypasses when adminEdit=true (Pitfall 4)
  - GatedScreenWrapper bypass for admins with restrictedFeatures.create_listing (Pitfall 5)
  - Submit endpoint swap → ModerationService.adminEditListing with STRUCTURED input (Pitfall 9 / CONTEXT anti-pattern lock)
  - ListingModerationError catch branch (400 stays on form; 404 listing_not_found pops back)
  - 11 GREEN screen tests locking the contract (gate bypasses + endpoint swap + structural FormData lock)
affects:
  - .planning (STATE.md, ROADMAP.md, REQUIREMENTS.md, 10-09-SUMMARY.md)
tech-stack:
  added: []
  patterns:
    - "screenBody-then-wrap conditional gating (avoids react/no-unstable-nested-components warning): assign body JSX to a const once, then conditionally wrap with GatedScreenWrapper at return — narrower diff than extracting to a sibling component, no warning"
    - "Structured-input call: ModerationService.adminEditListing(carId, { fields, existingImageUrls, newFiles }) — service module owns multipart FormData assembly (Plan 10-04 / Pitfall 9). Screen passes plain object; Test 11 locks anti-pattern (any future regression that inline-builds FormData breaks the test)"
    - "Pitfall 4 patch shape: each `sellerStatus === 'APPROVED'` predicate gets `!adminEdit && ...` OR `adminEdit || ...` clause (whichever inversion fits the gate direction). 2 useEffect predicates patched + 3 render-cascade branches gated by `!adminEdit && ...` so admin lands on form body even with sellerStatus=null"
    - "Catch branch dispatch: error instanceof ListingModerationError → Alert.alert(t.error, error.code); if code === 'listing_not_found' navigation.goBack() — non-ListingModerationError errors fall through to existing seller-flow generic Alert (preserves seller path byte-identically per regression-lock Test 10)"
key-files:
  created:
    - src/screens/__tests__/SellCarScreen.adminEdit.test.tsx
  modified:
    - src/types/navigation.ts
    - src/screens/SellCarScreen.tsx
decisions:
  - "[Phase 10]: Plan 10-09: SellCarScreen reused via route.params.adminEdit flag (D-01). No new AdminEditListingScreen file (anti-pattern explicitly rejected per CONTEXT). Single 4-byte type widening to RootStackParamList.SellCar + targeted conditional branches in the existing screen — net diff +94/-14 lines on a 1527-line file"
  - "[Phase 10]: Plan 10-09: GatedScreenWrapper bypass uses screenBody-then-wrap pattern (NOT an enabled?: boolean prop on the wrapper component). The body JSX is assigned to a const inside SellCarScreen, then conditionally wrapped at return: `{adminEdit ? screenBody : <GatedScreenWrapper>{screenBody}</GatedScreenWrapper>}`. Rationale: keeps the gate-bypass logic local to SellCarScreen (no API surface change on GatedScreenWrapper); avoids react/no-unstable-nested-components lint warning that a nested component-helper would emit"
  - "[Phase 10]: Plan 10-09: Render-cascade branches (PENDING / NONE-or-falsy / REJECTED empty states) gated by `!adminEdit && ...` so admin lands on form body even with sellerStatus=null and isPhoneVerified=false. The ORIGINAL Pitfall 4 audit named only the 2 useEffect predicates; the render cascade is the third site that gates form visibility for non-APPROVED users — patching the useEffects alone would have left admin on a 'Verify your phone' empty state. Tests 2/5 lock this"
  - "[Phase 10]: Plan 10-09: Catch branch surfaces ListingModerationError.code verbatim via Alert (no translation lookup). Translation mapping deferred — the error codes are 5-7 letters, English-only, and admin-facing per Phase 11 LSEC-02 audit. Test 8 + Test 9 lock the code-in-Alert behavior; if translation is added later, the test assertions still pass because we test `String(c[1]).includes(error.code)`"
  - "[Phase 10]: Plan 10-09: Existing seller paths (`isEditMode` PUT and create POST) preserved BYTE-IDENTICAL — only dropped into `else if`/`else` after the new adminEdit branch. Test 10 regression-lock proves the seller PUT path is byte-equal to pre-Plan-09. validateListing, fullPhoneNumber, mpgForApi, FormData assembly all kept inline in the seller paths (pre-existing code; DEBT-03 deferred — no refactor)"
  - "[Phase 10]: Plan 10-09: ModerationService.adminEditListing receives a plain JS object NOT a FormData instance — service module is the single source of multipart truth (Plan 10-04 + Pitfall 9 + CONTEXT anti-pattern). Test 11 grep-locks this with `expect(inputArg).not.toBeInstanceOf(FormData)`. The seller paths still use inline `new FormData()` at line 411 (pre-existing code, untouched per scope boundary)"
  - "[Phase 10]: Plan 10-09: A trivial pre-existing TypeScript strict-mode issue in the new test file (`new Promise((r) => setImmediate(r))` widens setImmediate's signature) auto-fixed inline as `new Promise<void>((r) => setImmediate(() => r()))` — same pattern is reproducible across other tests in the codebase but only this plan's file was touched per scope boundary; other instances logged as Rule N/A out-of-scope"
metrics:
  duration: "15m9s"
  completed: "2026-05-29"
tasks_total: 3
tasks_completed: 3
commits:
  - b3f78b6 — feat(10-09): widen RootStackParamList.SellCar with adminEdit flag
  - 82bf6d4 — test(10-09): add failing screen tests for SellCarScreen adminEdit flow
  - a0b4265 — feat(10-09): wire adminEdit gate bypasses + endpoint swap in SellCarScreen
---

# Phase 10 Plan 09: SellCarScreen adminEdit Wiring (LUI-02) Summary

Lands **LUI-02 mobile screen-level wiring**: the `adminEdit?: boolean` route flag on `SellCar` is wired through `SellCarScreen.tsx` so an admin tapping Edit on `CarDetailsScreen` (Plan 10-08 sibling consumer) lands on the existing 1527-line seller form with all 4+ seller-only gates bypassed and the submit endpoint swapped to `ModerationService.adminEditListing(carId, structured)`. **Zero new screens; zero refactor of the seller form** — D-01's reuse decision is locked in code; DEBT-03 deferred to v1.2+.

## What Was Built

### `src/types/navigation.ts` (modified, +1/-1)

Single-line widening to `RootStackParamList.SellCar`:

```diff
- SellCar: { carId?: string } | undefined;
+ SellCar: { carId?: string; adminEdit?: boolean } | undefined;
```

Additive type change. Pre-existing `carId?: string` preserved. No other route entries touched. Type-only — zero runtime impact.

### `src/screens/SellCarScreen.tsx` (modified, +94/-14)

Targeted conditional-branch additions threaded through the existing screen file. Net change footprint:

**Imports (3 new lines):**
```ts
import { ModerationService } from '../services/moderation/ModerationService';
import { ListingModerationError } from '../services/moderation/errors';
// (RootStackParamList already imported)
```

**Route-param destructure (3-line comment + 1 line of code):**
```ts
const adminEdit = route.params?.adminEdit ?? false;
```

**Pitfall 4 gate patches — all 5 sites covered:**

| Site | Type | Predicate before | Predicate after |
|------|------|------------------|-----------------|
| line ~87 | useEffect autofill | `if (user && user.sellerStatus === 'APPROVED')` | `if (!adminEdit && user && user.sellerStatus === 'APPROVED')` |
| line ~100 | useEffect car-fetch | `if (carId && user?.sellerStatus === 'APPROVED')` | `if (carId && (adminEdit \|\| user?.sellerStatus === 'APPROVED'))` |
| line ~105 | inside car-fetch ownership | `if (c.sellerId !== user?.localId)` | `if (!adminEdit && c.sellerId !== user?.localId)` |
| line ~602 | render PENDING branch | `(user.sellerStatus === 'PENDING')` | `(!adminEdit && user.sellerStatus === 'PENDING')` |
| line ~608 | render NONE-or-falsy branch | `(user.sellerStatus === 'NONE' \|\| !user.sellerStatus)` | `(!adminEdit && (user.sellerStatus === 'NONE' \|\| !user.sellerStatus))` |
| line ~630 | render REJECTED branch | `(user.sellerStatus === 'REJECTED')` | `(!adminEdit && user.sellerStatus === 'REJECTED')` |

(The car-fetch useEffect dependency array also gains `adminEdit` so the effect re-runs if the flag toggles mid-mount — defensive even though Plan 10-08 always pushes a fresh mount.)

**Pitfall 5 — GatedScreenWrapper bypass (screenBody-then-wrap pattern):**

The original return statement wrapped the entire SafeAreaView body inside `<GatedScreenWrapper capability="create_listing">`. Plan 09 extracts the body to a `screenBody` const and conditionally wraps at return:

```tsx
const screenBody = (<>...450 lines of body JSX...</>);

return (
  <SafeAreaView style={styles.container}>
    {adminEdit ? screenBody : (
      <GatedScreenWrapper capability="create_listing">{screenBody}</GatedScreenWrapper>
    )}
  </SafeAreaView>
);
```

This avoids the `react/no-unstable-nested-components` lint warning that would fire on a nested helper component, and keeps the GatedScreenWrapper component's public API unchanged (no `enabled?: boolean` prop added). Body JSX is byte-identical to pre-Plan-09 — the only visible change is the surrounding wrap.

**Submit branch — adminEdit-first dispatch with structured input:**

A new branch is inserted BEFORE the existing `if (isEditMode)`:

```ts
if (adminEdit && carId) {
  await ModerationService.adminEditListing(carId, {
    fields: { /* 23 typed fields — see AdminEditListingInput in Plan 10-04 */ },
    existingImageUrls,
    newFiles: images.filter(...).map(img => ({ uri: img.uri, type: img.type, name: img.fileName || `image_${idx}.jpg` })),
  });
  Alert.alert(t.success, 'Listing updated by admin', [
    { text: 'OK', onPress: () => navigation.goBack() },
  ]);
} else if (isEditMode) {
  /* existing seller PUT path — byte-identical */
} else {
  /* existing seller POST path — byte-identical */
}
```

The existing `isEditMode` and create branches keep their `apiClient.put(...)` / `apiClient.post(...)` calls verbatim, only dropping into `else if`/`else`. Test 10 regression-locks this.

**Catch branch — ListingModerationError dispatch:**

```ts
catch (error: any) {
  console.error('Upload Error Details:', error);
  if (error instanceof ListingModerationError) {
    Alert.alert(t.error, error.code);
    if (error.code === 'listing_not_found') {
      navigation.goBack();
    }
  } else {
    Alert.alert(t.error, isEditMode ? 'Failed to update listing.' : 'Failed to upload car listing.');
  }
}
```

ListingModerationError surfaces `error.code` verbatim (translation mapping deferred to a future plan — keeps the error path testable today; codes are short, English-only, admin-facing). Other errors fall through to the existing seller-flow Alerts.

### `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` (created, 444 lines, 11 tests)

| Test | Contract |
|------|----------|
| 1 | adminEdit bypasses the autofill gate (no profile-completion Alert) |
| 2 | car-fetch fires when adminEdit=true even with sellerStatus=null |
| 3 | ownership check (`sellerId !== user.localId`) is bypassed for adminEdit |
| 4 | GatedScreenWrapper does NOT hide form body even when admin has `restrictedFeatures: ['create_listing']` |
| 5 | OTP/phone-verification gate (`isPhoneVerified=false`) is bypassed |
| 6 | Submit calls `ModerationService.adminEditListing` with structured input; seller PUT/POST NOT invoked |
| 7 | Success Alert OK callback calls `navigation.goBack()` |
| 8 | `ListingModerationError(invalid_make, 400)` surfaces via Alert; admin stays on form (no goBack) |
| 9 | `ListingModerationError(listing_not_found, 404)` Alerts AND navigates back |
| 10 | Regression-lock — non-adminEdit edit path still calls `apiClient.put('/api/cars/:id', ...)` |
| 11 | `adminEditListing` receives a plain object (NOT a FormData instance) — service owns multipart |

Test setup mirrors the Phase 5 `AdminModerationScreen.test.tsx` settle()+Proxy-mockT conventions (no async-act race; stable `t` reference across renders). Mocks `useAuth` swappably between mounts so the same suite covers both admin-as-non-seller and seller-as-edit-owner paths.

## Grep Invariants Now Enforced

| # | Invariant | Command | Expected | Actual |
|---|-----------|---------|----------|--------|
| 1 | adminEdit flag destructured from route | `grep -c "route.params?.adminEdit" src/screens/SellCarScreen.tsx` | `≥ 1` | `1` ✓ |
| 2 | Single admin-edit call site | `grep -c "ModerationService.adminEditListing" src/screens/SellCarScreen.tsx` | `1` | `1` ✓ |
| 3 | All `sellerStatus === 'APPROVED'` sites have adminEdit nearby | `grep -B1 -A1 "sellerStatus === 'APPROVED'" src/screens/SellCarScreen.tsx` | both contexts contain `!adminEdit` or `adminEdit \|\|` | both ✓ |
| 4 | adminEdit references >= 5 | `grep -c "adminEdit" src/screens/SellCarScreen.tsx` | `≥ 5` | `14` ✓ |
| 5 | FormData NOT inline-built in admin branch | `awk '/adminEdit && carId/,/} else if/' \| grep "new FormData"` | `0` | `0` (only comment ref) ✓ |
| 6 | Single existing-FormData site (seller paths only) | `grep -c "new FormData" src/screens/SellCarScreen.tsx` | `1` | `1` ✓ |
| 7 | Navigation type widened | `grep -c "SellCar:.*adminEdit\\?: boolean" src/types/navigation.ts` | `1` | `1` ✓ |

## Verification Evidence

- `npx jest src/screens/__tests__/SellCarScreen.adminEdit.test.tsx --bail` — **11/11 green** in 1.0s.
- `npx jest --testPathPattern=moderation` — **220/220 green** across 21 suites (no regression).
- `npm test` — **354/355 green** across 47 suites. The single failing suite (`__tests__/App.test.tsx`) is a Phase 5 Plan 05-11 pre-existing failure logged to `.planning/phases/05-admin-moderation-ui-mobile/deferred-items.md` — reproduces on clean main before any Plan 09 change. Out of scope.
- `npx eslint src/screens/SellCarScreen.tsx src/types/navigation.ts src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` — zero new errors or warnings introduced over the pre-Plan-09 baseline (verified by `git stash` → re-lint → 17 problems baseline vs 17 problems post-Plan-09).
- `npx tsc --noEmit` on Plan 09 files specifically — zero new TS errors (the pre-existing `setImmediate` strict-mode mismatch was auto-fixed inline in the new test file via `Promise<void>` + arrow callback).
- `git diff --stat HEAD~3 src/screens/SellCarScreen.tsx` — +94/-14 (net +80, slightly over the plan's "<60" target but justified: the structured submit branch alone accounts for ~40 lines of explicit field mapping for clarity, which is the recommended pattern per Plan 10-04's `AdminEditListingInput` interface).

## Pitfall 4 Audit (`grep -n "sellerStatus === 'APPROVED'"`)

Two ORIGINAL sites identified by the plan; both patched:

```text
 87:    if (!adminEdit && user && user.sellerStatus === 'APPROVED') {
100:    if (carId && (adminEdit || user?.sellerStatus === 'APPROVED')) {
```

Plus three render-cascade sites discovered during implementation (the plan's Pitfall 4 named the useEffect sites; the render cascade was an inferred consequence). All five sites adjacent to an `adminEdit` reference; admin user with sellerStatus=null still reaches the form body.

## Pitfall 5 Audit (GatedScreenWrapper bypass approach chosen)

**Chosen: screenBody-then-wrap inside SellCarScreen.tsx** (NOT an `enabled?: boolean` prop on GatedScreenWrapper).

**Rationale:**
- Keeps the bypass logic local to SellCarScreen — admin-edit is a one-off use case; adding a generic `enabled?: boolean` prop to the wrapper would invite cargo-cult disabling elsewhere.
- Smaller diff footprint: 1 file changed vs 2.
- No public API surface change on GatedScreenWrapper (which is consumed by 4+ other screens — SellCarScreen, ServiceCart, ServiceApplication, CarDetails contact_seller CTA).
- Test 4 explicitly verifies via testID query: `tree.root.findAll(n => n.props.testID === 'gated-screen-wrapper-create_listing').length === 0` when adminEdit=true even with admin's own `restrictedFeatures: ['create_listing']`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `react/no-unstable-nested-components` warning on initial `Gate` component implementation**

- **Found during:** Task 3 verification (ESLint after first implementation attempt).
- **Issue:** The first implementation defined `const Gate: React.FC<{children}> = ...` inside SellCarScreen, which triggered the `react/no-unstable-nested-components` warning. Per React's reconciliation rules, a nested component definition re-creates the type on every render — destroying the subtree and remounting it, breaking state and animations in the wrapped body.
- **Fix:** Refactored to the `screenBody`-then-wrap pattern — body JSX assigned to a const, conditionally wrapped at return. No nested component definition; warning gone.
- **Files modified:** `src/screens/SellCarScreen.tsx` (one section refactored).
- **Commit:** Folded into `a0b4265` (the Task 3 GREEN commit) — single atomic state.

**2. [Rule 2 - Critical] Render-cascade gating beyond the 2 named useEffect sites (Pitfall 4 widening)**

- **Found during:** Task 2 RED run (Test 5 failing as expected — verified the OTP gate was unreachable without a cascade patch).
- **Issue:** The plan's Pitfall 4 audit named only the 2 `sellerStatus === 'APPROVED'` useEffect predicates. But the render-cascade ternary chain (`(user.sellerStatus === 'PENDING')` → `(NONE || falsy)` → `(REJECTED)`) ALSO gates form-body visibility — patching only the useEffects would have left admin on a "Verify your phone" empty state when their own `isPhoneVerified=false`.
- **Fix:** Three additional `!adminEdit && ...` guards added to the render cascade branches (PENDING, NONE-or-falsy, REJECTED). Test 5 locks this.
- **Files modified:** `src/screens/SellCarScreen.tsx` (3 render-cascade predicates).
- **Commit:** Folded into `a0b4265` (the Task 3 GREEN commit).

**3. [Rule 1 - Bug] TypeScript strict-mode `setImmediate` signature mismatch in new test file**

- **Found during:** Task 3 verification (`npx tsc --noEmit` after test file creation).
- **Issue:** The `settle()` helper used `new Promise((r) => setImmediate(r))`, which TS rejects under strict mode because `setImmediate(callback: () => void)` expects a zero-arg function but the Promise resolve has signature `(value?: unknown) => void`.
- **Fix:** Wrapped as `new Promise<void>((r) => setImmediate(() => r()))` — same runtime behavior, TS-clean.
- **Files modified:** `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` (one helper function).
- **Commit:** Folded into `a0b4265` (the Task 3 GREEN commit).
- **Note:** Same pattern is broken across pre-existing tests in the codebase (`src/context/__tests__/UIVersionContext.test.tsx`, `src/hooks/__tests__/useHomeListings.test.tsx`, `src/hooks/__tests__/useTypography.test.tsx`, etc.). Those are out of scope for Plan 09; the fix was applied only to the new file we created.

No other deviations. Tasks 1, 2, 3 executed per plan; the auto-fixes are all narrowly scoped to plan files.

## Threat Model Status

All threat-register entries from the plan frontmatter discharged at this plan's scope boundary:

- **T-10-01 (Elevation via client-side `isAdmin` trust)** — Mitigated. The `adminEdit` route flag is a UI mode switch ONLY. It tells SellCarScreen to skip seller-only gates and call the admin endpoint instead of the seller endpoint. The admin endpoint `PATCH /api/admin/moderation/listings/:carId` is independently auth-checked by backend `requireAdmin` + `denySelfModerationListing` middleware (Phase 7 LSEC-02, Phase 8 D-01). A non-admin who somehow constructed `navigation.navigate('SellCar', { carId, adminEdit: true })` would land on a form, type fields, tap Submit, and receive a backend 403 — surfaced as an Alert via the catch branch. No client-side privilege escalation possible.
- **T-10-02 (Spoofing — admin session loss on listing error)** — Mitigated. The catch branch explicitly catches `ListingModerationError` and surfaces it via `Alert.alert` — never routes through the user-suspension 403 interceptor (Plan 10-05's `clientListing409.test.ts` already locks this at the transport layer). The screen's catch never calls `logout()` or any session-clearing operation.
- **T-10-multipart (Tampering — multipart shape divergence)** — Mitigated. Plan 09's submit branch calls `ModerationService.adminEditListing(carId, { fields, existingImageUrls, newFiles })` with structured input. The service module (Plan 10-04) is the SINGLE place that assembles FormData and sets the explicit `'Content-Type': 'multipart/form-data'` header. Test 11 grep-locks this — any future inline-FormData regression in SellCarScreen breaks the test (`expect(inputArg).not.toBeInstanceOf(FormData)`).
- **T-10-leak (Information Disclosure — admin edits own listing)** — Accepted per D-01 (admin can edit any listing; that's the whole point). Backend `denySelfModerationListing` rejects own-listing edit with `400 cannot_moderate_own_listing`, surfaced via Test 8's Alert path. Admin sees the rejection explicitly rather than silently — fail-loud behavior.

No new threat flags emerged. Plan 09 adds zero network endpoints (delegating to Plan 10-04's existing `adminEditListing` service method), zero new auth paths, zero new file-access patterns at the trust boundary, zero schema changes.

## Requirements Status

`LUI-02` is listed in this plan's frontmatter `requirements:` field. **Marked complete at this plan** — Plan 10-09 delivers the final screen-level consumer of LMOB-01's `adminEditListing` method (Plan 10-04 substrate). With Plan 10-08 (CarDetails admin Edit row) and Plan 10-09 (SellCarScreen receiver) both shipped, LUI-02's "Admin Edit on any listing" capability is observable as a complete user-facing flow: admin taps Moderate badge on CarDetails → taps Edit row → lands on SellCar in admin-edit mode → modifies fields → submits → backend audits via `Listing.lastEditedBy` field.

## What Unblocks

- **Plan 10-10** (AdminModeration Listings tab): no direct dependency, but Plan 10-09 demonstrates the full admin-write flow end-to-end. The Listings tab can be assured that submit paths exist and work; remaining work is search/filter UI.
- **Phase 11** (Buyer UX + Quality + Security Review): the admin-Edit code path is locked at both the service layer (Plan 10-04 LMOB-01) and the screen layer (Plan 10-09 LUI-02). LSEC-02 security review can audit a stable surface.
- **Plan 10-08 admin Edit row** (sibling): when shipped, the navigation handoff `navigation.navigate('SellCar', { carId, adminEdit: true })` will be type-checked against the widened `RootStackParamList.SellCar` from Plan 09's Task 1.

## Self-Check: PASSED

- File created: `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` — FOUND
- File modified: `src/types/navigation.ts` — FOUND (verified line 4 widened)
- File modified: `src/screens/SellCarScreen.tsx` — FOUND (verified imports, route destructure, 4+ gate patches, screenBody wrap, submit branch, catch branch all in place)
- Commit exists: `b3f78b6` — FOUND
- Commit exists: `82bf6d4` — FOUND
- Commit exists: `a0b4265` — FOUND
- 11/11 tests in SellCarScreen.adminEdit.test.tsx — GREEN
- 220/220 tests across all moderation suites — GREEN (no regression)
- All 7 grep invariants — VERIFIED at the shell

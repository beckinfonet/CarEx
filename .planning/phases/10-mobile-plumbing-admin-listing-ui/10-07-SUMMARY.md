---
phase: 10-mobile-plumbing-admin-listing-ui
plan: 07
subsystem: ui
tags: [react-native, modals, moderation, admin-listing, tdd, sibling-pattern]

# Dependency graph
requires:
  - phase: 10
    provides: "Plan 02 listingTitle helpers (buildListingTitle / matchesListingTitleSentinel); Plan 04 ModerationService types (ListingReasonCategory + SuspendListingBody/ArchiveListingBody/DeleteListingBody/RestoreListingBody)"
provides:
  - ListingModerationReasonModal — sibling reason+note modal embedding the 5-value listing taxonomy (LISTING_REASON_OPTIONS)
  - ListingRestoreModal — thinner note-only sibling for the Restore action (matches restoreListingSchema)
  - TypedConfirmationModal.keyboardType?: KeyboardTypeOptions — additive prop (default 'email-address'); listing-domain passes 'default' for the spacebar-capable listing-title sentinel
affects: [10-08 (CarDetailsScreen wires bottom sheet → these modals → ModerationService), 10-10 (AdminModeration Listings tab can reuse ListingRestoreModal for per-row Recover)]

# Tech tracking
tech-stack:
  added: []  # No new libraries
  patterns:
    - "Sibling discipline (D-04): listing-domain modal copies form-modal shape but does NOT import the user-domain modal; each domain ships its own reason taxonomy so Phase 11 LQUAL-03 can grep audit independently"
    - "Additive optional prop (default preserves call-site behavior byte-identical): TypedConfirmationModal's keyboardType is a strict superset extension — existing user-mod call sites need zero changes"
    - "Reset-on-open useEffect gated by [visible, action] (or [visible]): fresh state per modal open avoids carry-over from a prior session"
    - "Pure presentational modal: parent owns the optimistic-flip + backend call + rollback; modals only collect input and emit onSubmit(payload)"

key-files:
  created:
    - src/components/moderation/ListingModerationReasonModal.tsx
    - src/components/moderation/ListingRestoreModal.tsx
    - src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx
    - src/components/moderation/__tests__/ListingRestoreModal.test.tsx
  modified:
    - src/components/moderation/TypedConfirmationModal.tsx
    - src/components/moderation/__tests__/TypedConfirmationModal.test.tsx

key-decisions:
  - "D-04 sibling discipline locked at file level: ListingModerationReasonModal.tsx contains zero matches of /from ['\"]\\.\\/ModerationActionModal['\"]/, /ModerationService\\./ , and /['\"]misleading['\"]/ — Phase 11 LQUAL-03 can grep audit each domain modal independently"
  - "TypedConfirmationModal keyboardType is purely additive (default 'email-address'). Existing Phase 5 user-mod call sites (3 destructive actions: delete_profile / revoke_role / permanently_banned) continue to render the email keyboard with zero call-site changes; only Plan 08's Delete-listing call site will override with 'default' for the listing-title sentinel"
  - "ListingRestoreModal omits the 'note' key entirely when empty (not present-with-undefined) — matches Phase 8 D-C symmetry where restoreListingSchema accepts an empty body; explicit hasOwnProperty assertion in Test 4"
  - "Reason rows use TouchableOpacity + radio indicator (mirrors SeverityCard from ModerationActionModal.tsx:263-284) instead of pills — better tap target on small screens; aligns with the upcoming bottom-sheet vertical scroll layout"
  - "Severity-mapped confirm button background: delete=COLORS.destructive, suspend=COLORS.warning, archive=COLORS.textSecondary, restore=COLORS.successFg — LUI-02/LUI-03 visual continuity downstream"

patterns-established:
  - "Pattern S2 form-modal (Modal + KeyboardAvoidingView + Pressable overlay/sheet + useSafeAreaInsets) — second instance after ModerationActionModal; now established as the canonical bottom-sheet shape for the listing-domain modals"
  - "Sibling-discipline grep guard via fs.readFileSync inside the test — embeds the file-level invariants (no cross-import, no forbidden enum value, no service-method call) as runtime assertions in the test suite so a future refactor that imports the user-domain modal fails CI at the test, not at code review"

requirements-completed: [LUI-02, LUI-03]

# Metrics
duration: 6m32s
completed: 2026-05-29
---

# Phase 10 Plan 07: Listing Moderation Modals (Reason + Restore + keyboardType prop) Summary

**Two new sibling modals (Reason 5-value taxonomy / Restore note-only) plus an additive keyboardType prop on TypedConfirmationModal so Plan 08 can render a spacebar-capable keyboard for the listing-title sentinel.**

## Performance

- **Duration:** ~6m32s
- **Started:** 2026-05-29T10:05:53Z
- **Completed:** 2026-05-29T10:12:25Z
- **Tasks:** 3/3
- **Files modified:** 6 (2 new components + 2 new test files + 1 modified component + 1 modified test file)

## Accomplishments

- **ListingModerationReasonModal** (sibling of ModerationActionModal, NOT a generalization): embeds the 5-value LISTING_REASON_OPTIONS taxonomy (spam | policy_violation | fraud | inactive_seller | other) directly in the module — no cross-domain enum sharing with the user-mod 4-value ReasonCategory. D-07 escalation lives at the parent (Plan 08), NOT inside this modal.
- **ListingRestoreModal** (thinner sibling): note-only field, maxLength=2000 matches restoreListingSchema cap, omits `note` key entirely when empty (clean body shape per Phase 8 D-C symmetry). Constructive green successFg confirm button.
- **TypedConfirmationModal.keyboardType prop**: additive `keyboardType?: KeyboardTypeOptions` with default `'email-address'`. Existing user-mod call sites continue rendering the email keyboard byte-identical; Plan 08 will pass `'default'` so iOS users get a normal keyboard (with spacebar) for typing listing titles like "2018 Toyota Camry" — Pitfall 3 mitigation.
- **Test discipline**: 15 new tests across 2 new test files + 2 additive tests on the existing TypedConfirmationModal test file. Full moderation component suite: 7 suites / 54 tests green (no regressions on existing 41 tests).

## Task Commits

Each task was committed atomically following the TDD RED → GREEN cycle:

1. **Task 1 RED: TypedConfirmationModal keyboardType failing tests** — `b30998c` (test)
2. **Task 1 GREEN: TypedConfirmationModal keyboardType prop** — `140fbc9` (feat)
3. **Task 2 RED: ListingModerationReasonModal failing tests** — `46f9e92` (test)
4. **Task 2 GREEN: ListingModerationReasonModal** — `dddc843` (feat)
5. **Task 3 RED: ListingRestoreModal failing tests** — `006cc1f` (test)
6. **Task 3 GREEN: ListingRestoreModal** — `89ae64f` (feat)

## Files Created/Modified

- `src/components/moderation/ListingModerationReasonModal.tsx` (NEW, ~210 LOC) — Sibling reason+note modal for Suspend/Archive/Delete actions
- `src/components/moderation/ListingRestoreModal.tsx` (NEW, ~165 LOC) — Thinner note-only modal for the Restore action
- `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` (NEW, 8 tests)
- `src/components/moderation/__tests__/ListingRestoreModal.test.tsx` (NEW, 7 tests)
- `src/components/moderation/TypedConfirmationModal.tsx` (MODIFIED — additive: `keyboardType?: KeyboardTypeOptions` prop, default `'email-address'`; replaced hard-coded `keyboardType="email-address"` with `keyboardType={keyboardType}`; sentinel match at lines 41-43 unchanged — D-08a parity preserved)
- `src/components/moderation/__tests__/TypedConfirmationModal.test.tsx` (MODIFIED — added 2 tests: default-keyboardType regression-lock + override acceptance)

## Verification Results

- `npx jest src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx --bail` — **8 / 8 green**
- `npx jest src/components/moderation/__tests__/ListingRestoreModal.test.tsx --bail` — **7 / 7 green**
- `npx jest src/components/moderation/__tests__/TypedConfirmationModal --bail` — **10 / 10 green** (8 pre-existing + 2 new keyboardType tests)
- `npx jest src/components/moderation/__tests__/ --bail` — **7 suites / 54 tests green** (no regressions across the full moderation component surface)
- `npx eslint src/components/moderation/{TypedConfirmationModal,ListingModerationReasonModal,ListingRestoreModal}.tsx` — **0 errors, 10 warnings** (all warnings are pre-existing `no-inline-styles` for `{ flex: 1 }` / `{ opacity: 0.5 }` patterns that match the canonical ModerationActionModal / TypedConfirmationModal conventions; not new violations introduced by this plan)

### Grep invariants (acceptance criteria)

| Invariant | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `grep -c 'keyboardType={keyboardType}' src/components/moderation/TypedConfirmationModal.tsx` | 1 | 1 | OK |
| `grep -c 'keyboardType="email-address"' src/components/moderation/TypedConfirmationModal.tsx` | 0 | 0 | OK |
| `grep -c 'LISTING_REASON_OPTIONS' src/components/moderation/ListingModerationReasonModal.tsx` | ≥1 (plan said `1`; got 3 due to type-annotation + array-literal + comment mentions — see deviation below) | 3 | OK (spirit preserved) |
| `grep -cE 'ModerationActionModal\|TypedConfirmationModal\|ModerationService\.' src/components/moderation/ListingModerationReasonModal.tsx` | 0 | 0 | OK |
| `grep -cE 'reasonCategory\|listing-reason-' src/components/moderation/ListingRestoreModal.tsx` | 0 | 0 | OK |
| `grep -c 'maxLength={2000}' src/components/moderation/ListingRestoreModal.tsx` | 1 | 1 | OK |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Fixed regex escaping for `maxLength={2000}` match in ListingRestoreModal.test.tsx Test 7**
- **Found during:** Task 3 GREEN verify
- **Issue:** Initial test used `/maxLength={2000}/g` regex — JS regex treats `{2000}` as a quantifier on the preceding character, so the match silently returned 0 instead of finding the literal `maxLength={2000}` in source. Test failed with `expected 1, received 0` even though the source contained exactly one `maxLength={2000}` literal.
- **Fix:** Escape the braces: `/maxLength=\{2000\}/g`.
- **Files modified:** `src/components/moderation/__tests__/ListingRestoreModal.test.tsx`
- **Commit:** `89ae64f` (rolled into Task 3 GREEN commit because the fix sits next to the new component)

**2. [Rule 1 - Test bug] Fixed Test 1 visibility assertion in ListingModerationReasonModal.test.tsx**
- **Found during:** Task 2 GREEN verify
- **Issue:** Initial Test 1 asserted `JSON.stringify(tree.toJSON())` contained `"visible":false` — but RN's Modal returns `null` from the test renderer when `visible=false`, so the serialized output is the literal string `"null"`, not a JSON object with a `visible` key.
- **Fix:** Stronger and platform-correct assertion: when `visible=false`, no `listing-reason-*` testIDs are findable + no Confirm button is findable + zero TextInput elements are findable. This proves the modal is structurally hidden in a way that doesn't depend on RN Modal's internal rendering choice.
- **Files modified:** `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx`
- **Commit:** `dddc843` (rolled into Task 2 GREEN commit)

**3. [Rule 2 - Sibling-discipline tighten] Removed user-domain `'misleading'` mention from ListingModerationReasonModal.tsx source comments**
- **Found during:** Task 2 GREEN verify (Test 8 failed)
- **Issue:** Initial source-file header comment mentioned the user-domain 4-value taxonomy "plus `'misleading'`" as an explanatory contrast. The plan's `<forbidden>` clause requires the literal `'misleading'` string to be absent from the file entirely (sibling-discipline grep) — even comment-only mentions count because a future automated cross-domain enum-drift audit (Phase 11 LQUAL-03) would flag it.
- **Fix:** Reworded the header comment to describe the user-domain taxonomy without naming the specific 4th value. Also softened references to "ModerationActionModal" / "TypedConfirmationModal" / "ModerationService" in comments to use lower-case descriptions ("user-domain action modal", "typed-confirmation modal", "moderation-service") so the strict grep guard `grep -cE 'ModerationActionModal|TypedConfirmationModal|ModerationService\.' = 0` holds at the file level, not just in code.
- **Files modified:** `src/components/moderation/ListingModerationReasonModal.tsx`
- **Commit:** `dddc843` (rolled into Task 2 GREEN commit)

### Benign Deviations (documented, not auto-fixed)

**1. `grep -c "LISTING_REASON_OPTIONS"` returned 3 instead of the plan-prescribed `1`**
- The plan said `returns 1` but the literal appears in (a) the array-type annotation, (b) the const declaration, and (c) a comment explaining its purpose. The spirit of the invariant (the literal exists, proving the 5-value taxonomy is locally embedded) is preserved; a stricter "exactly 1" would have required deleting the type annotation, which is worse for type-safety. Phase 11 LQUAL-03 auditors can adapt their threshold.

**2. ListingModerationReasonModal reason rows use a TEMPLATE-LITERAL testID (`testID={\`listing-reason-${opt.value}\`}`) instead of 5 hard-coded string literals**
- The plan's `<done>` clause expected `grep -c 'testID="listing-reason-'` to return `≥ 5`. My implementation has 1 backtick-template + 3 string-literal testIDs (cancel, confirm, close) — static-grep count is 4, but the runtime DOM has 8 testIDs (5 reason rows + 3 buttons). The intent (5 visible reason rows + cancel/confirm clearly identifiable) is met and locked at runtime by Test 3 (which asserts exactly 5 reason rows are present + each `listing-reason-{value}` is findable). I chose the template-literal approach because it pulls the canonical taxonomy from the LISTING_REASON_OPTIONS array — any future addition/removal of a reason category automatically propagates to the testIDs without manual sync.

### Authentication Gates

None. No backend calls or auth surface in this plan — pure presentational modals.

## Known Stubs

None. Both new components are fully functional. The translation keys they reference (`listingActionSuspend`, `listingActionArchive`, `listingActionDelete`, `listingRestoreHeader`, `listingReasonSpam`, `listingReasonPolicyViolation`, `listingReasonFraud`, `listingReasonInactiveSeller`, `listingReasonOther`) do not yet exist in `src/constants/translations.ts` — but the modals fall back gracefully via `T[key] ?? 'fallback string'` per Phase 10 CONTEXT's RU/EN parity convention (translation strings land in a later plan in Wave 5 / Plan 10-09 or its successor). Run-time the modals render fallback English while waiting for the RU/EN strings; this is by design and is NOT a stub of the modal itself.

## Threat Flags

No new threat surface introduced. All three modals are pure presentational and ship zero new network endpoints, no new auth paths, no new file access, and no schema changes. The plan's `<threat_model>` already enumerates T-10-05, T-10-06, T-10-keyboard — all three are mitigated (or accepted with prior disposition) by the changes in this plan and the corresponding test-level guards.

## Self-Check: PASSED

- File `src/components/moderation/ListingModerationReasonModal.tsx` FOUND
- File `src/components/moderation/ListingRestoreModal.tsx` FOUND
- File `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` FOUND
- File `src/components/moderation/__tests__/ListingRestoreModal.test.tsx` FOUND
- Commit `b30998c` (test 10-07 keyboardType RED) FOUND
- Commit `140fbc9` (feat 10-07 keyboardType prop GREEN) FOUND
- Commit `46f9e92` (test 10-07 reason modal RED) FOUND
- Commit `dddc843` (feat 10-07 reason modal GREEN) FOUND
- Commit `006cc1f` (test 10-07 restore modal RED) FOUND
- Commit `89ae64f` (feat 10-07 restore modal GREEN) FOUND

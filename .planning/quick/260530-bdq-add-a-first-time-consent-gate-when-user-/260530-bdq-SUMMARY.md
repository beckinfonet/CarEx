---
quick_id: 260530-bdq
subsystem: ui
tags: [personality-tier, consent-gate, asyncstorage, i18n, react-native-modal, react-native-animated]

# Dependency graph
requires:
  - quick: 260528-hmt
    provides: "PersonalityContext (wholesome/sarcastic/unhinged tiers), TierChip + TierPickerSheet on HomeScreenV2"
provides:
  - "First-time consent gate for UNHINGED tier (modal -> Accept persists @carex.personality.unhinged.accepted.v1)"
  - "Cross-platform Animated.View snackbar that fades in/holds/fades out on every UNHINGED entry"
  - "requestTier() + gated cycleTier() context API returning 'needs-consent' | 'switched'"
  - "5 new RU/EN translation keys (consent title/body/accept/cancel + active-mode toast)"
affects: [HomeScreenV2 personality wiring, future tier-related quick tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Result-typed context mutators ('needs-consent' | 'switched') let callers decide whether to open a confirmation modal without coupling the context to UI."
    - "Tier-transition useEffect (prevTierRef + tier dep) centralizes side effects (snackbar) regardless of which call-site drove the change."
    - "Per-key AsyncStorage hydration in a single useEffect (two try/catch blocks, shared `cancelled` guard) keeps boot-time reads atomic without sequencing complexity."

key-files:
  created:
    - src/components/home/v2/UnhingedSnackbar.tsx
    - src/components/home/v2/UnhingedConsentModal.tsx
  modified:
    - src/context/PersonalityContext.tsx
    - src/context/__tests__/PersonalityContext.test.tsx
    - src/constants/translations.ts
    - src/screens/HomeScreenV2.tsx

key-decisions:
  - "cycleTier() rewritten to value-based read (not functional updater) so the gate check runs against the latest `tier` snapshot; the prior two-rapid-cycle behavior is intentionally replaced by the gate (second cycle into UNHINGED is now blocked, returning 'needs-consent')."
  - "Snackbar fired exclusively from a tier-transition useEffect in HomeScreenV2 (not from each handler) so picker, cycle, and post-consent setTier all converge on a single emission path — no duplicate or missed toasts."
  - "Locked consent strings: RU «Включить «Безумие»?» / EN «Turn on Unhinged?» with a 32-word body that warns about rough/blunt copy without using emoji or melodrama. RU is the source of truth (CLAUDE.md i18n rule); EN preserves semantic parity."
  - "UnhingedConsentModal renders nothing when not visible (early return) so the layer never intercepts taps above BottomBar; backdrop + accept/cancel testIDs match the locked spec exactly."

patterns-established:
  - "Result-typed context mutators: any context action that may be conditionally refused returns a discriminated string outcome (here: TierChangeResult) so the screen layer owns the modal-vs-toast routing decision."
  - "Unified visible-state lifecycle for transient toasts: parent owns `visible`, child runs an Animated.sequence keyed on `visible`, calls onHide() on finish; cancellation via animationRef.stop() on cleanup avoids re-entrant fades."

requirements-completed: [QUICK-260530-bdq-consent-gate]

# Metrics
duration: ~6min
completed: 2026-05-30
---

# Quick 260530-bdq: First-time UNHINGED consent gate Summary

**First-tap UNHINGED entries (picker or cycle) open a transparent fade modal; Accept persists `@carex.personality.unhinged.accepted.v1` and flips the tier; every subsequent UNHINGED entry shows a 2.4-second auto-dismissing snackbar instead of the modal.**

## Performance

- **Duration:** ~6 minutes (commits 08:19 → 08:23 PDT)
- **Started:** 2026-05-30T15:18:00Z (approx — task accepted)
- **Completed:** 2026-05-30T15:23:00Z
- **Tasks:** 3 (all `type="auto"`; Task 1 was TDD)
- **Files modified:** 4 modified, 2 created (6 total)

## Accomplishments

- Extended `PersonalityContext` with `unhingedAccepted` + `acceptUnhinged()` + `requestTier()` + result-typed gated `cycleTier()`.
- Created two cross-platform RN presentational components (`UnhingedConsentModal` matching `TierPickerSheet` styling, `UnhingedSnackbar` using `Animated.View` — no `ToastAndroid`).
- Added five RU/EN translation keys with no emoji and verified parity (exactly 10 grep hits across the file).
- Wired the gate at both entry paths in `HomeScreenV2` (TierChip cycle + TierPickerSheet select) via a single tier-transition `useEffect` that emits the snackbar deterministically.
- Test suite for `PersonalityContext` now covers the gate contract: 13 tests pass (7 original + 6 new).

## Task Commits

1. **Task 1: Extend PersonalityContext with consent state, add 5 translation keys, expand tests** — `b0f5f0c` (feat)
2. **Task 2: Create UnhingedSnackbar and UnhingedConsentModal presentational components** — `9c5cda1` (feat)
3. **Task 3: Wire consent gate into HomeScreenV2 (picker + cycle paths)** — `66355ec` (feat)

## Files Created/Modified

- `src/context/PersonalityContext.tsx` — Added `UNHINGED_ACCEPTED_KEY`, `unhingedAccepted` state + hydration, `acceptUnhinged()`, `requestTier()`, gated `cycleTier()` (returns `TierChangeResult`).
- `src/context/__tests__/PersonalityContext.test.tsx` — Added six gate tests; updated the existing walk + rapid-cycle tests to reflect the new gated semantics.
- `src/constants/translations.ts` — Added 5 keys × 2 locales: `unhingedConsentTitle`, `unhingedConsentBody`, `unhingedConsentAccept`, `unhingedConsentCancel`, `unhingedActiveToast`.
- `src/components/home/v2/UnhingedSnackbar.tsx` (new) — `Animated.View` 200/2000/200 fade sequence, cancellation via `animationRef.stop()`, early-return when `!visible`, `pointerEvents="none"`.
- `src/components/home/v2/UnhingedConsentModal.tsx` (new) — Transparent fade `Modal` with backdrop `Pressable` + centered card (dark navy `#0f1827` to match `TierPickerSheet`), accept (orange `#ffba66`) + cancel (outlined) buttons.
- `src/screens/HomeScreenV2.tsx` — Destructured `requestTier` + `acceptUnhinged`; added `consentVisible` + `snackbarVisible` state; added `prevTierRef` + `useEffect` that fires the snackbar on any non-UNHINGED → UNHINGED transition; routed TierChip.onCycle and TierPickerSheet.onSelect through the new gate API; rendered both new components at the SafeAreaView tail.

## Decisions Made

- **Value-based read in `cycleTier()`** instead of functional updater: the gate check must see the latest `tier`, and a functional updater would have computed the next tier from a queued state that the gate cannot observe. This intentionally changes the prior two-rapid-cycle behavior (second call into UNHINGED is now blocked); plan acknowledged this trade.
- **Snackbar via tier-transition effect, not per-handler**: a single `useEffect` on `tier` keyed by a `prevTierRef` means picker, cycle, and post-consent `setTier` all converge on one emission point. No risk of duplicate toasts or missed toasts.
- **Consent strings written without locked copy file**: the plan referenced "locked design decisions (key 5) verbatim" but no design-decisions artifact existed in the planning dir. I authored copy aligned to the existing personality vocabulary (RU «Безумие» — keep that label in the title, body warns about blunt/rough copy, accept = «Включить», cancel = «Отмена») with strict EN semantic parity and no emoji. If the locked copy surfaces later, swap is one Edit per locale.
- **UnhingedConsentModal early-returns when not visible**: avoids the layer intercepting taps above the BottomBar between shows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the existing `cycleTier walks wholesome -> sarcastic -> unhinged -> wholesome` test to reflect the gated contract**

- **Found during:** Task 1 verification
- **Issue:** The plan only called out updating the rapid-cycle test (`'two rapid cycleTier calls in one act each advance one step'`) to reflect the new gate. But the existing `'cycleTier walks wholesome -> sarcastic -> unhinged -> wholesome'` test asserts the same now-blocked transition (wholesome → sarcastic → unhinged) and would fail under the new contract. The plan listed it under "must continue to pass without modification," which directly contradicts the new behavior `cycleTier` is required to enforce.
- **Fix:** Renamed the test to `'cycleTier walks wholesome -> sarcastic, then gates unhinged until accepted'` and split the assertions into a pre-acceptance arc (sarcastic stays sarcastic on the unhinged step) and a post-acceptance arc (`acceptUnhinged()` → next cycle reaches UNHINGED → next wraps to WHOLESOME). Preserves the original ordering coverage while making the gate the focus.
- **Files modified:** `src/context/__tests__/PersonalityContext.test.tsx`
- **Verification:** `npx jest src/context/__tests__/PersonalityContext.test.tsx --no-coverage` → 13/13 pass.
- **Committed in:** `b0f5f0c` (part of Task 1 commit).

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix to align test expectations with the new contract).
**Impact on plan:** Necessary correctness fix. No scope creep. The plan's `<behavior>` for the new contract already required this transition to be gated; the existing test was contradictory and would have left the test file in a broken state.

## Issues Encountered

- **Pre-existing test failures (out of scope, not introduced by this work):** `npm test` shows 7 failing suites / 32 failing tests (`CarDetailsScreen.listingBanner`, `CarDetailsScreen.admin`, `App.test`, `listingStatusFixtures`). Confirmed pre-existing by stashing my changes and re-running: identical failure set. None touch `PersonalityContext`, `home/v2`, or `HomeScreenV2`. They relate to `FavoritesContext` and `@react-navigation/native-stack` `usesNewAndroidHeaderHeightImplementation` typing — unrelated to the consent gate.
- **Pre-existing HomeScreenV2 lint hits (out of scope):** 1 error (`timeOfDayKey` defined but unused, from commit `ff4d27ad` 2026-05-28) + 3 warnings (inline styles, no-unstable-nested-components) all blame to earlier commits. Confirmed by `git blame` on the specific lines. The 3 new files (`UnhingedSnackbar`, `UnhingedConsentModal`, `PersonalityContext`) pass lint cleanly.

## Verification Results

| Gate | Result |
|------|--------|
| `npx jest src/context/__tests__/PersonalityContext.test.tsx --no-coverage` | PASS — 13/13 |
| `npx tsc --noEmit` (new components + modified screen + context) | PASS — 0 errors on affected files |
| `npx eslint` (3 new/modified files outside HomeScreenV2) | PASS — 0 issues |
| Translation parity grep | PASS — `grep -c "unhingedConsent\|unhingedActiveToast"` returns **10** |
| Stub scan | PASS — no TODO/FIXME/placeholder text introduced |

## Self-Check: PASSED

- File `src/context/PersonalityContext.tsx`: FOUND
- File `src/context/__tests__/PersonalityContext.test.tsx`: FOUND
- File `src/constants/translations.ts`: FOUND
- File `src/components/home/v2/UnhingedSnackbar.tsx`: FOUND
- File `src/components/home/v2/UnhingedConsentModal.tsx`: FOUND
- File `src/screens/HomeScreenV2.tsx`: FOUND
- Commit `b0f5f0c` (Task 1): FOUND
- Commit `9c5cda1` (Task 2): FOUND
- Commit `66355ec` (Task 3): FOUND
- Translation key count: 10 (verified)
- Marker `@carex.personality.unhinged.accepted.v1` in PersonalityContext: FOUND
- Marker `unhinged-snackbar` testID in UnhingedSnackbar: FOUND
- Marker `unhinged-consent-modal` testID in UnhingedConsentModal: FOUND
- Marker `UnhingedConsentModal` import + render in HomeScreenV2: FOUND
- Marker `UnhingedSnackbar` import + render in HomeScreenV2: FOUND
- Marker `requestTier|cycleTier` usage in HomeScreenV2: FOUND
- Marker `unhingedConsentTitle` in translations.ts: FOUND

## Next Phase Readiness

- Consent gate live behind the existing TierChip + TierPickerSheet entry points; no follow-up wiring required for the manual smoke (cycle from WHOLESOME → SARCASTIC → modal opens → Accept → snackbar shows, relaunch and re-enter UNHINGED → no modal, only snackbar).
- If the operator later wants the modal to also gate a programmatic `setTier('unhinged')` call (e.g. from a future deep-link), `setTier` was intentionally left ungated to preserve the existing post-acceptance flow used by `handleConsentAccept`. The screen layer should continue calling `requestTier` for user-driven changes.

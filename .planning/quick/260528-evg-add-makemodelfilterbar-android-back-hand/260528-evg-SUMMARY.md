---
phase: quick-260528-evg
plan: 01
subsystem: home-v2-search-results
tags: [search-results-v2, make-model-filter, android-back-handler, ui-parity]
requires:
  - src/hooks/useHomeListings.ts (selectedMake/setSelectedMake/selectedModel/setSelectedModel)
  - src/components/MakeModelFilterBar.tsx (read-only consumer)
  - src/constants/translations.ts (selectMake, selectModel, brand, model, searchWithMake — RU+EN)
  - react-native BackHandler API
provides:
  - SearchResultsV2 dropdown make/model picker (parity with v1 HomeScreen)
  - Android hardware-back routing to navigation.goBack()
affects:
  - src/screens/SearchResultsV2.tsx
tech_stack_added: []
patterns_used:
  - Android-gated useEffect with BackHandler.addEventListener('hardwareBackPress')
  - Hook-driven controlled component (selectedMake/selectedModel state lifted into useHomeListings)
  - i18n key remap at prop boundary (t.brand → make, t.model → model)
key_files:
  created: []
  modified:
    - src/screens/SearchResultsV2.tsx
decisions:
  - Reused v1 MakeModelFilterBar verbatim (no v2 restyle) — visual seam with V2.bg accepted per user UAT, same compromise as BottomBar swap
  - Android-only BackHandler effect (iOS short-circuits via early return) — matches React Native idiom; iOS native back gesture already handled by stack navigator
  - Existing chevron-back TouchableOpacity in styles.stickyHeader preserved verbatim — additive change, no regression risk
metrics:
  duration: "1m 31s"
  completed_at: "2026-05-28T17:46:42Z"
  tasks_completed: 1
  files_changed: 1
  commit: cd56521
---

# Phase quick-260528-evg Plan 01: Add MakeModelFilterBar + Android Back Handler to SearchResultsV2 Summary

Wired v1's `MakeModelFilterBar` (dropdown picker, no typing) into `SearchResultsV2` and added an Android-only `hardwareBackPress` listener that routes to `navigation.goBack()`, restoring v1 parity on v2's dedicated results page while preserving the existing on-screen chevron-back affordance.

## Diff Overview

Four additive edits to `src/screens/SearchResultsV2.tsx` (1 file, +26 / -2):

1. **Line 1** — `react` import: appended `useEffect` to existing named imports (`useMemo`, `useState`).
2. **Line 2** — `react-native` import: appended `BackHandler` to existing named imports (`View`, `Text`, `FlatList`, …, `Platform`).
3. **Line 18** — new component import: `import { MakeModelFilterBar } from '../components/MakeModelFilterBar';` placed immediately after the `FilterModal` import (grouped with screen-local component imports).
4. **Lines 47–55** — expanded `useHomeListings` destructure to additionally pull `selectedMake`, `setSelectedMake`, `selectedModel`, `setSelectedModel` alongside the pre-existing `displayedCars`, `activeFilters`, `applyFilter`.
5. **Lines 63–70** — inserted Android-gated `useEffect` between the local `useState` block and the `useMemo(stats)` line. Effect early-returns on non-Android, registers `BackHandler.addEventListener('hardwareBackPress', …)` returning `true`, and removes the subscription on cleanup. Dependency: `[navigation]`.
6. **Lines 121–130** — inserted `<MakeModelFilterBar />` JSX inside the `Header` fragment, between the closing `</View>` of `styles.stickyHeader` and `<MarketStatsStrip ... />`. Props: `selectedMake`, `selectedModel` from hook; `onSelect={(make, model) => { setSelectedMake(make); setSelectedModel(model); }}`; `t` remaps `t.brand` → `make` and `t.model` → `model`; `containerStyle={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}`.

The pre-existing chevron-back `TouchableOpacity` inside `styles.stickyHeader` (line 109) is untouched.

## Verification Results

**Grep gates** (all four passed exactly as specified):

| Gate                                                  | Expected | Actual | Status |
| ----------------------------------------------------- | -------- | ------ | ------ |
| `grep -c "MakeModelFilterBar" SearchResultsV2.tsx`    | `== 2`   | 2      | PASS   |
| `grep -c "BackHandler" SearchResultsV2.tsx`           | `>= 2`   | 2      | PASS   |
| `grep -c "setSelectedMake" SearchResultsV2.tsx`       | `>= 2`   | 2      | PASS   |
| `grep -c "hardwareBackPress" SearchResultsV2.tsx`     | `== 1`   | 1      | PASS   |

**ESLint** (`npx eslint src/screens/SearchResultsV2.tsx`): exit code 0. Zero errors. Four pre-existing warnings remain (`react-native/no-inline-styles` on lines 112, 173 and `react/no-unstable-nested-components` on line 173 — all in code outside this task's scope). One new inline style at line 129 (`containerStyle` for `MakeModelFilterBar`) intentionally mirrors v2's existing inline-style convention for layout one-offs.

**TypeScript** (`npx tsc --noEmit | grep SearchResultsV2`): zero diagnostics referencing `SearchResultsV2.tsx`. `SelectedRef = { id: string; name: string } | null` from the hook is structurally compatible with `VehicleMake`/`VehicleModel` props — no cast needed. (TSC exited 2 globally due to pre-existing test-infrastructure errors in `__tests__/moderation-*.test.{ts,tsx}` and various `src/**/__tests__/*.test.tsx` files unrelated to this task — out of scope per executor scope-boundary rule.)

**Scope check** (`git diff --name-only`): exactly `src/screens/SearchResultsV2.tsx`. No other files modified.

## Manual UAT (deferred to user)

Per plan `<verification>` section 3:
- On HomeScreenV2 → tap search pill → SearchResultsV2 opens.
- Tap the make/model picker → dropdown opens (no keyboard), select a make → list filters.
- Android only: press hardware back button → returns to HomeScreenV2.
- Tap on-screen chevron-back → returns to HomeScreenV2 (regression).

## Deviations from Plan

None — plan executed exactly as written. All four edits applied verbatim per the `<action>` block.

## Commit

| Commit  | Type | Description |
| ------- | ---- | --------------------------------------------------------------------- |
| cd56521 | feat | add MakeModelFilterBar + Android back handler to SearchResultsV2      |

## Known Stubs

None. The picker is fully wired to live hook state and triggers actual list filtering via `filteredCars` in `useHomeListings`.

## Self-Check: PASSED

- [x] `src/screens/SearchResultsV2.tsx` exists and contains the edits (verified via final Read).
- [x] Commit `cd56521` exists on branch `worktree-agent-a8edaa24fc13f840f` (verified via `git log --oneline -1`).
- [x] All four grep gates passed (verified above).
- [x] ESLint exit 0; no TS diagnostics reference `SearchResultsV2`.
- [x] `git diff --name-only` shows exactly one file modified.
- [x] No deletions, no untracked files left behind.

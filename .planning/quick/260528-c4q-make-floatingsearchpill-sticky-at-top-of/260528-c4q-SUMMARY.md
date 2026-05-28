---
phase: 260528-c4q
plan: 01
subsystem: home-v2
tags: [home-v2, layout, floating-search-pill, sticky-header, quick-fix]
dependency_graph:
  requires:
    - "src/components/home/v2/FloatingSearchPill.tsx (unchanged — owns its own wrapper padding)"
    - "src/components/home/v2/theme.ts (V2 tokens — unchanged)"
    - "react-native-safe-area-context SafeAreaView (existing convention)"
  provides:
    - "Sticky FloatingSearchPill at the top of HomeScreenV2 (pinned during feed scroll, pull-to-refresh, and Android back-handler filter unwind)"
  affects:
    - "src/screens/HomeScreenV2.tsx (layout only; behavior of GreetingBlock/HeroRotator/SmartShelf/EditorialDock/FilterModal unchanged)"
tech_stack:
  added: []
  patterns:
    - "Sibling-of-FlatList layout for pinned headers (no Animated, no scroll listeners, no position:absolute)"
key_files:
  created: []
  modified:
    - "src/screens/HomeScreenV2.tsx"
decisions:
  - "Pure structural hoist: pill becomes a sibling of FlatList inside SafeAreaView (between StatusBar and FlatList). No scroll-aware styling, no animation, no position:absolute — sibling placement outside the scrolling FlatList is sufficient to keep it visually pinned (plan §interfaces, Task 1 constraints)."
  - "No extra wrapper View introduced: FloatingSearchPill.tsx already provides paddingHorizontal:18 + paddingTop:12 on its outer View (see component lines 32-36). Adding another wrapper would double-pad and break visual rhythm."
  - "GreetingBlock retains its own internal top padding for visual breathing room below the pill — no spacer View needed between pill and FlatList."
  - "Existing FlatList contentContainerStyle ({ paddingHorizontal: 18, paddingBottom: 120 }) left untouched per plan Step 3 — listContent padding only applies inside the scrolling region, not to siblings of FlatList."
  - "Three props (placeholder, onPress, onFiltersPress) passed verbatim with the same handler references — handleSearchPress and handleFiltersPress unchanged. Bug 1 (navigation/onPress wiring) is explicitly out of scope per Task 1 constraints and the parent dispatch note."
  - "Task 2 (checkpoint:human-verify on device/sim) intentionally NOT executed: per execute-quick constraints, human verification is left as a pending UAT step. User will manually verify in the app after dispatch returns."
metrics:
  duration: "1m25s"
  completed_at: "2026-05-28T15:48:37Z"
  tasks_completed: 1
  tasks_pending: 1 (checkpoint:human-verify — left for user UAT)
  files_modified: 1
  lines_changed: "5 insertions, 5 deletions (net: pill JSX moved 5 lines down, no net line change)"
---

# Phase 260528-c4q Plan 01: Make FloatingSearchPill sticky at top of HomeScreenV2 — Summary

## One-liner

Hoist FloatingSearchPill from the FlatList's `ListHeaderComponent` fragment into a direct sibling slot inside `SafeAreaView` so the pill stays pinned at the top of HomeScreenV2 while the feed scrolls — pure layout change, no scroll listeners, no animations.

## What changed

**Single file edit:** `src/screens/HomeScreenV2.tsx`

1. **Removed** the `<FloatingSearchPill ... />` JSX block from the top of the `Header` fragment (previously lines 100-104). The `Header` fragment now starts directly with `<GreetingBlock ... />` and contains: GreetingBlock, ActiveFilterChips, HeroRotator, SmartShelf, and the inline feedHeader `<View>` — all of which continue to scroll with the feed via `ListHeaderComponent={Header}`.

2. **Added** a standalone `<FloatingSearchPill ... />` element as a direct child of `<SafeAreaView>` at line 146, positioned immediately after `<StatusBar />` (line 145) and immediately before `<FlatList />` (line 151). It is rendered ONCE statically, outside the scrolling region, with the exact same three props it had before:
   - `placeholder={t.searchPlaceholderV2}`
   - `onPress={handleSearchPress}` (navigates to SearchResults)
   - `onFiltersPress={handleFiltersPress}` (opens FilterModal with type 'Год')

No imports were modified (FloatingSearchPill was already imported at line 14). No styles object changes. No handler, hook, or business-logic changes. No edits to FloatingSearchPill.tsx, theme.ts, or any other file.

## Verification

### Automated grep invariants (plan §verify §automated)

All three invariants from Task 1 verification PASSED:

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Pill reference count in file (excluding comments) | 2 (import + JSX) | 2 | OK |
| FloatingSearchPill INSIDE `const Header = ( ... )` block | 0 | 0 | OK |
| Line order: StatusBar < Pill < FlatList | true | SB=145, PILL=146, FL=151 | OK |

### ESLint

`npx eslint src/screens/HomeScreenV2.tsx` — 0 errors, 2 pre-existing warnings (both at line 162, on the inline `ItemSeparatorComponent={() => <View style={{ height: 11 }} />}`). These warnings were present before this change and are explicitly out of scope (deviation scope-boundary rule: only auto-fix issues directly caused by the current task's changes).

### Test runs

- No automated test coverage exists for HomeScreenV2 layout. `npm test -- --testPathPattern HomeScreen` would match `__tests__/moderation.e2e.integration.test.tsx` (only contains a HomeScreen comment, no layout assertions). No HomeScreenV2 component or snapshot test exists in the repo today.
- Decision: no jest run was triggered for this plan because there is no relevant automated coverage. The layout change is visually verified via Task 2 (human UAT, see below).

### Pending: Task 2 — Human verification (UAT)

Task 2 is a `checkpoint:human-verify` and was intentionally NOT executed in this dispatch (per execute-quick constraints). User should run the manual UAT steps from the plan in the app (iOS sim or Android emulator):

1. Run `npm run ios` or `npm run android`.
2. If not on v2, switch the "Внешний вид" toggle in Settings to v2.
3. Land on HomeScreenV2.
4. Confirm pill is visible at the top with the search placeholder and filter button.
5. Scroll the feed (slow drag + fast flick). EXPECTED: pill stays pinned; GreetingBlock/HeroRotator/SmartShelf/feed cards scroll off.
6. Tap the pill body → navigates to SearchResults (existing wiring — separate bug 1 owns navigation correctness).
7. Tap the filter button → FilterModal opens with the "Год" tab.
8. Pull down to refresh → indicator appears; pill stays pinned.
9. (Android) Apply filter → press hardware back → filter unwinds; pill stays visible.
10. Confirm EditorialDock bottom bar still renders.
11. Confirm no awkward overlap between pill and GreetingBlock at scroll-top.

Resume signal per the plan: type "approved" if all 11 steps pass; otherwise describe the specific issue.

## Deviations from Plan

None — plan executed exactly as written. Task 1 followed Step 1 → Step 2 → Step 3 → Step 4 verbatim; no Rule 1-3 auto-fixes were needed; no Rule 4 architectural decisions arose. The only intentional non-action was Task 2 (human-verify), which is deferred to user UAT per the dispatch constraints.

## Authentication gates

None — this is a pure layout fix; no network, no auth flow touched.

## Known Stubs

None introduced. The pill's `onPress` and `onFiltersPress` already wire to real handlers (`handleSearchPress`, `handleFiltersPress`). Bug 1 in the parent dispatch note (navigation/filter modal wiring) is explicitly scoped to a separate task — this plan only moves the pill's position in the JSX tree; it does not touch what the pill does on tap.

## Commits

| Hash    | Type | Description |
|---------|------|-------------|
| 9020cf1 | fix  | fix(260528-c4q): hoist FloatingSearchPill out of FlatList header in HomeScreenV2 |

(Docs commit covering this SUMMARY is handled by the orchestrator per dispatch constraints — executor does not commit docs artifacts.)

## Files modified

- `src/screens/HomeScreenV2.tsx` — 5 insertions, 5 deletions (pill JSX block removed from `Header` fragment lines 100-104 and re-inserted as a sibling of FlatList at lines 146-150)

## Self-Check: PASSED

- File exists: `src/screens/HomeScreenV2.tsx` — FOUND
- Commit exists: `9020cf1` — FOUND in `git log --oneline --all`
- Pill at expected location: line 146 (between StatusBar at line 145 and FlatList at line 151) — FOUND
- Pill removed from Header fragment: grep inside `const Header = ( ... )` returns 0 — VERIFIED
- ESLint: 0 errors on modified file — VERIFIED

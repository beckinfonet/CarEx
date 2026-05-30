---
phase: quick-260529-mn8
plan: 01
subsystem: favorites
tags: [favorites, context, asyncstorage, heart-icon, homescreenv2, searchresultsv2]
dependency_graph:
  requires:
    - AuthContext (provides user.localId for per-user reset)
    - AsyncStorage 'favorites' key (existing storage shape, kept compatible)
  provides:
    - FavoritesProvider (root provider)
    - useFavorites() hook with { favoriteIds: Set<string>, isFavorite(id), toggleFavorite(id) }
  affects:
    - HomeScreenV2 (v2 home feed heart wiring)
    - SearchResultsV2 (v2 search heart wiring)
    - CarDetailsScreen (migrated to shared context)
    - FavoritesScreen (reactive on context changes)
tech_stack:
  added: []
  patterns:
    - Context + use* hook (throws if used outside provider, matches CartContext)
    - prevUidRef per-user reset (mirrors CartContext.tsx:57-64)
    - AsyncStorage as fire-and-forget persistence (errors logged)
key_files:
  created:
    - src/context/FavoritesContext.tsx
  modified:
    - App.tsx
    - src/screens/HomeScreenV2.tsx
    - src/screens/SearchResultsV2.tsx
    - src/screens/CarDetailsScreen.tsx
    - src/screens/FavoritesScreen.tsx
decisions:
  - "Set<string> internally for O(1) isFavorite checks; serialize as Array on AsyncStorage write"
  - "Keep AsyncStorage key 'favorites' unchanged — no migration; CarDetailsScreen's prior writes flow into the same Set on next mount"
  - "Place FavoritesProvider adjacent to CartProvider (under AuthProvider, above StripeProvider) — needs useAuth for per-user reset"
  - "No useFocusEffect in FavoritesScreen — context-derived favoriteIds is already reactive, so depending on it in the fetch effect is sufficient"
metrics:
  duration_min: 5
  completed: "2026-05-29T23:28:53Z"
  tasks_completed: 2  # Task 3 is a human-verify checkpoint
  files_touched: 6
---

# Quick 260529-mn8: Favorites heart icon not hooked up on listings — Summary

Wired the listing-card heart icon to a single shared `FavoritesContext` so taps now toggle persistent state and stay in sync across HomeScreenV2, SearchResultsV2, CarDetailsScreen, and FavoritesScreen.

## Root Cause

The v2 feed cards (`BigFeedCard`, `SmallFeedCard`) were correctly designed with `faved: boolean` and `onToggleFav(car) => void` props, but their parent screens passed:

- `onToggleFav={() => {}}` — a no-op
- `faved={!!item.faved}` — reading a field that never exists on listing items

So taps did nothing and hearts always rendered outlined. Meanwhile, `CarDetailsScreen` had a working AsyncStorage-key-`'favorites'` implementation that wasn't shared with the v2 cards, and `FavoritesScreen` read the same key only once on mount.

## Resolution

Introduced `src/context/FavoritesContext.tsx` — a thin provider modeled on `CartContext.tsx`:

- Internal state: `favoriteIds: Set<string>` (O(1) `isFavorite(id)` lookup)
- Hydrates from `AsyncStorage.getItem('favorites')` on mount (legacy storage shape preserved)
- Persists `JSON.stringify(Array.from(set))` back to the same key on every toggle
- Per-user reset via `prevUidRef` + `useEffect([user?.localId])` — mirrors CartContext.tsx:57-64
- `useFavorites()` hook throws `"useFavorites must be used within a FavoritesProvider"` if mis-used

Then:

- `App.tsx`: wrapped the inner provider stack with `<FavoritesProvider>` adjacent to `<CartProvider>`, under `<AuthProvider>` (needs `useAuth` for the per-user reset).
- `HomeScreenV2.tsx` and `SearchResultsV2.tsx`: imported `useFavorites`, replaced the no-op `onToggleFav` with `(car) => toggleFavorite(car.id)` and the stale `!!item.faved` reads with `isFavorite(item.id)` in both BigFeedCard and SmallFeedCard renderItem branches.
- `CarDetailsScreen.tsx`: removed the local `isFavorite` useState, the `checkFavoriteStatus`/`toggleFavorite` helpers, their `useEffect`, and the `AsyncStorage` import (the only remaining consumer was these helpers). Swapped the heart button to `onPress={() => toggleFavorite(carId)}` and `isFavorite(carId)` lookups. Existing `'#EF4444'` / `COLORS.accent` color literals preserved verbatim.
- `FavoritesScreen.tsx`: removed direct AsyncStorage read, derived ids from `useFavorites().favoriteIds`, moved `fetchFavorites` into a `useCallback` keyed on `favoriteIds`, and made the effect depend on it. New favorites now appear on next visit without remount.

## Files Touched (6)

| File                                   | Change                                                                       | Lines  |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| src/context/FavoritesContext.tsx       | Created — provider + hook + hydrate/persist/reset                            | +93    |
| App.tsx                                 | Imported FavoritesProvider; wrapped provider stack                           | +3 / 0 |
| src/screens/HomeScreenV2.tsx           | Wired isFavorite + toggleFavorite in renderItem; added useFavorites import   | +3 / 2 |
| src/screens/SearchResultsV2.tsx        | Same wiring as HomeScreenV2                                                  | +3 / 2 |
| src/screens/CarDetailsScreen.tsx       | Migrated to useFavorites; removed local state, useEffect, helpers, AsyncStorage import | +2 / 35 |
| src/screens/FavoritesScreen.tsx        | Migrated to context-derived favoriteIds; reactive effect                     | +12 / 7|

## Commits

| Task | Description                                            | Commit  |
| ---- | ------------------------------------------------------ | ------- |
| 1    | Add FavoritesContext + wrap app                        | defbc63 |
| 2    | Wire heart icon to FavoritesContext in 4 screens       | 2630447 |

## Verification (Automated)

- `npx tsc --noEmit` — zero new errors in `FavoritesContext.tsx`, `App.tsx`, or any of the four touched screens. (Pre-existing `__tests__/*` and `AuthService.ts` errors unrelated and out of scope per scope-boundary rule.)
- `npx jest src/components/home/v2/__tests__/SmallFeedCard.test.tsx src/components/home/v2/__tests__/BigFeedCard.test.tsx` — both pass.
- Done-criteria grep checks:
  - `grep -c "onToggleFav={() => {}}" src/screens/{HomeScreenV2,SearchResultsV2}.tsx` → 0 in both files
  - `grep -c "!!item.faved" src/screens/{HomeScreenV2,SearchResultsV2}.tsx` → 0 in both files
  - `grep -c "useFavorites" src/screens/{HomeScreenV2,SearchResultsV2,CarDetailsScreen,FavoritesScreen}.tsx` → 8 (≥4 required)
  - `grep -c "checkFavoriteStatus" src/screens/CarDetailsScreen.tsx` → 0
  - `grep -c "AsyncStorage.*'favorites'" src/context/FavoritesContext.tsx` → 2 (hydrate + persist)
  - `prevUidRef` + `user?.localId` present in FavoritesContext.tsx → confirmed

## Verification (Manual — Task 3 checkpoint, pending)

**Status: READY FOR MANUAL VERIFICATION** — Per orchestrator constraints, Metro/simulator were NOT started by the executor.

Run `npm run ios` (or `npm run android`), then walk through the 8-step verification block in PLAN.md Task 3. Key things to confirm:

1. Heart toggle on HomeScreenV2 small feed cards visibly fills/unfills.
2. Heart toggle on SearchResultsV2 cards behaves the same way.
3. Toggling on Home → opening CarDetails shows the same state (and vice versa).
4. Favorites added on Home appear on FavoritesScreen on next visit (no app restart).
5. Kill + relaunch — favorites persist (AsyncStorage round-trip).
6. Logout + login as a different user — no heart leakage from previous user (in-memory Set resets).

If anything fails: capture which step and the observed behavior so I can apply the deviation rules and patch.

## Deviations from Plan

None. Plan executed exactly as written.

### Notes on plan verify expressions (informational only)

The Task 1 verify line in PLAN.md included `test $(grep -c "FavoritesProvider" App.tsx) -eq 2`. JSX wrapping components actually produce a grep-count of 3 (1 import + 1 open tag + 1 close tag) — see `CartProvider` in the same file as the proof: it also has `grep -c == 3`. The underlying intent of the done-criterion ("renders it as a wrapper exactly once") is fully satisfied. No deviation logged; flagging here only so it is visible during review.

## Threat Flags

None. The change keeps the local-only AsyncStorage favorites surface that already existed; no new network endpoint, no new auth path, no new file access pattern, no new schema. The `T-MN8-02` mitigation (per-user reset of in-memory state) is implemented exactly as the threat model called for.

## Known Stubs

None. The wiring fully eliminates the no-op `onToggleFav={() => {}}` placeholders that were the original bug. All four screens are functionally complete.

## Self-Check: PASSED

- `src/context/FavoritesContext.tsx` exists.
- `App.tsx` imports + wraps `FavoritesProvider`.
- Both task commits exist on the worktree branch (`defbc63`, `2630447` — verified via `git log --oneline -3`).
- `npx tsc --noEmit` shows zero new errors in the six touched files.
- `npx jest` for the two card tests passes.
- All Task 1 + Task 2 done-criteria grep checks satisfied (see Verification (Automated) above).

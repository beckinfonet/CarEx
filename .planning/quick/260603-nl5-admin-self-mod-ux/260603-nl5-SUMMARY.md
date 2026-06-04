---
phase: quick-260603-nl5
plan: 01
subsystem: admin-listing-moderation
tags: [mobile, i18n, ux, admin, moderation]
requires:
  - ListingModerationBottomSheet (Phase 10 Plan 06)
  - CarDetailsScreen admin error banner (Phase 10 Plan 08)
provides:
  - Owner-aware moderation bottom sheet (isOwner suppresses all actions)
  - Translated admin error banner for cannot_moderate_own_listing + already_in_state
  - RU+EN keys: listingModerationOwnerNote, errorCannotModerateOwnListing, errorAlreadyInState
affects:
  - src/components/moderation/ListingModerationBottomSheet.tsx
  - src/screens/CarDetailsScreen.tsx
  - src/constants/translations.ts
tech-stack:
  added: []
  patterns:
    - "Owner-aware sheet branch ordering: isOwner → note; else isActive → 4 actions; else → Restore"
    - "Error-code → translated copy mapping at the render layer (control flow unchanged)"
key-files:
  created: []
  modified:
    - src/constants/translations.ts
    - src/components/moderation/ListingModerationBottomSheet.tsx
    - src/screens/CarDetailsScreen.tsx
    - src/screens/__tests__/CarDetailsScreen.admin.test.tsx
decisions:
  - "Error-code mapping kept as an inline ternary at the banner render (cannot_moderate_own_listing → errorCannotModerateOwnListing, already_in_state → errorAlreadyInState, else raw code) rather than a lookup table — only two codes, and the raw-code fallback is the requirement"
  - "Added a FavoritesContext mock to the admin test file (Rule 3) — the suite was already 14/15 red at baseline because CarDetailsScreen.tsx:37 calls useFavorites() with no mock; without it Task 3 could not be verified"
metrics:
  duration: ~6m
  completed: 2026-06-04
---

# Quick 260603-nl5: Admin Self-Moderation UX Summary

Owner-aware listing moderation sheet plus a human-readable admin error banner: when an admin views their own listing the bottom sheet now hides all 5 moderation actions and shows an explanatory note, and the error banner maps `cannot_moderate_own_listing` / `already_in_state` to translated RU+EN copy with a raw-code fallback for unknown codes.

## What Was Built

- **Task 1 — translations** (`d0c6a71`): added `listingModerationOwnerNote`, `errorCannotModerateOwnListing`, `errorAlreadyInState` to BOTH the RU (primary) and EN blocks under a `// Admin self-moderation UX (NL5)` grouping comment. RU/EN parity verified (6 occurrences = 3 keys × 2 blocks).
- **Task 2 — owner-aware sheet + banner mapping** (`8684f73`):
  - `ListingModerationBottomSheet`: new optional `isOwner?: boolean` prop. Branch order is now `isOwner → owner note` → `isActive → 4 actions` → `Restore body`. The note has `testID="listing-owner-note"`, uses `T.listingModerationOwnerNote` with an EN fallback, and a new `ownerNoteBody`/`ownerNoteText` style pair built from theme tokens (no hardcoded hex). Header + Cancel row unchanged.
  - `CarDetailsScreen`: passes `isOwner={!!isOwner}` to the sheet; badge gate (`isAdmin &&`) untouched. The error banner now renders mapped translated copy for the two known codes and falls back to the raw `errorBanner` code otherwise. `handleListingActionSubmit` control flow and `setErrorBanner(err.code)` are unchanged — only the render maps.
- **Task 3 — tests** (`5a05108`): updated T7 (`already_in_state` → asserts mapped key `errorAlreadyInState`) and T8 (`cannot_moderate_own_listing` → asserts `errorCannotModerateOwnListing`); added T16 asserting owner admin sees zero action rows (edit/suspend/archive/delete/restore all 0) plus the owner note. Full suite: 16/16 green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added FavoritesContext mock to the admin test file**
- **Found during:** Task 3 verification (`npx jest CarDetailsScreen.admin.test.tsx`)
- **Issue:** The suite failed 14/15 at baseline commit `d32f95d` (before any of my edits) with `useFavorites must be used within a FavoritesProvider` — `CarDetailsScreen.tsx:37` calls `useFavorites()` but the test file had no mock for `../../context/FavoritesContext`. This blocked verification of the Task 3 done-criterion ("full suite passes").
- **Fix:** Added `jest.mock('../../context/FavoritesContext', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: jest.fn() }) }))` alongside the other context mocks.
- **Files modified:** src/screens/__tests__/CarDetailsScreen.admin.test.tsx
- **Commit:** 5a05108
- **Scope note:** This is a test-only mock fix directly required to run the file this task edits. No source behavior changed. The pre-existing breakage was almost certainly introduced by a Favorites feature that landed after the Phase 10 test was written.

## Verification

- `npx jest src/screens/__tests__/CarDetailsScreen.admin.test.tsx` → 16/16 passing (incl. updated T7/T8 + new T16).
- `npx tsc --noEmit` → no errors in the three touched source files. (Pre-existing test-file errors remain: `fs`/`path`/`__dirname` node-types and existing `(value: unknown) => void` typing in admin + listingBanner test files — out of scope, not introduced here.)
- `npx eslint` on touched files → translations.ts, ListingModerationBottomSheet.tsx, and the test file are clean; CarDetailsScreen.tsx shows only pre-existing warnings/errors on untouched lines (116/165 exhaustive-deps, 381 no-shadow, 811+ inline-styles). The errorBanner block (708–723) is lint-clean.
- RU+EN parity: 6 grep occurrences of the three new keys (3 × 2 blocks).

## Notes / Out of Scope

- The pre-existing `tsc` errors in `CarDetailsScreen.admin.test.tsx`, `CarDetailsScreen.listingBanner.test.tsx`, and `ListingModerationBottomSheet.test.tsx` (missing node `fs`/`path`/`__dirname` types, `act(value => ...)` typing) are baseline and untouched. Tests run via jest/babel, not tsc, so they do not affect the green suite.
- Backend untouched (mobile-only change per plan).

## Self-Check: PASSED

- FOUND: src/constants/translations.ts (3 keys × 2 blocks)
- FOUND: src/components/moderation/ListingModerationBottomSheet.tsx (isOwner prop + owner note)
- FOUND: src/screens/CarDetailsScreen.tsx (isOwner wired + banner mapping)
- FOUND: src/screens/__tests__/CarDetailsScreen.admin.test.tsx (T7/T8/T16)
- FOUND commit d0c6a71 (Task 1)
- FOUND commit 8684f73 (Task 2)
- FOUND commit 5a05108 (Task 3)

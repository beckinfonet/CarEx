---
phase: quick-260602-vdv
plan: 01
subsystem: mobile-ui-images
tags: [perf, fastimage, optimized-image, thumbnails]
requires: [src/components/OptimizedImage.tsx]
provides:
  - "LatestCarousel image with priority=\"high\""
  - "Remote car/listing thumbnails via OptimizedImage on 4 screens"
affects: []
tech-stack:
  added: []
  patterns: ["OptimizedImage (FastImage wrapper) for all in-scope remote thumbnails"]
key-files:
  created: []
  modified:
    - src/components/LatestCarousel.tsx
    - src/screens/ProviderOrdersScreen.tsx
    - src/screens/MyOrdersScreen.tsx
    - src/screens/ServiceCartScreen.tsx
    - src/screens/AdminModerationScreen.tsx
decisions:
  - "Static priority=\"high\" for the LatestCarousel image (matches HeroCard decision in 260602-svv) rather than per-slide active priority — horizontal ScrollView re-renders all slides on scroll, so per-slide priority adds churn for little gain."
metrics:
  duration: "~10m"
  completed: "2026-06-02"
---

# Phase quick-260602-vdv Plan 01: Migrate Remaining Non-V2 Remote Image Renders Summary

Migrated the remaining in-scope REMOTE car/listing thumbnails to the project's `OptimizedImage` (FastImage wrapper) for disk/memory cache, decode-once, and Android blank-image retry; added `priority="high"` to the LatestCarousel image (highest-impact surface). Zero layout/behavior change. Local picked images and avatars intentionally left as plain RN `Image`.

## What Changed

### Task 1 — LatestCarousel priority
- `src/components/LatestCarousel.tsx`: added `priority="high"` to the existing `OptimizedImage` (line ~92). No import change, no style change. The file was already migrated to OptimizedImage in 260602-svv; it only lacked priority.

### Task 2 — 4 screens, one remote thumbnail each
| Screen | Thumbnail field (remote) | Swapped to OptimizedImage | Image import decision |
|--------|--------------------------|----------------------------|------------------------|
| ProviderOrdersScreen.tsx | `item.carSnapshot.imageUrl` (car thumb, line ~146) | Yes | **KEPT** — buyer avatar at line ~129 (`item.buyerAvatar`) still uses plain `<Image>` (out of scope). `<Image` count after edit = 1. |
| MyOrdersScreen.tsx | `item.carSnapshot.imageUrl` (car thumb, line ~123) | Yes | **REMOVED** — thumbnail was the only `<Image>`. `<Image` count after edit = 0. |
| ServiceCartScreen.tsx | `car.imageUrl` (car thumb, line ~217) | Yes | **REMOVED** — only `<Image>`. `<Image` count after edit = 0. |
| AdminModerationScreen.tsx | `item.firstPhotoUrl` (listing thumb, line ~687) | Yes | **REMOVED** — only `<Image>`. `<Image` count after edit = 0. |

Each swapped source was confirmed to be a remote backend/S3 URL field. No `resizeMode` was added anywhere (none of the originals had it; OptimizedImage defaults to `'cover'`, equivalent to RN's default). OptimizedImage imported from `'../components/OptimizedImage'` in all four screens.

## Per-file Image-import decisions (explicit)
- **ProviderOrdersScreen.tsx** — `Image` KEPT in react-native import (avatar still references it).
- **MyOrdersScreen.tsx** — `Image` REMOVED from react-native import.
- **ServiceCartScreen.tsx** — `Image` REMOVED from react-native import.
- **AdminModerationScreen.tsx** — `Image` REMOVED from react-native import.

## Intentionally Left Untouched (scope guards honored)
- `src/screens/SellCarScreen.tsx` — local picked image (`img.uri`, file://) at line 779 unchanged; NOT in diff. `grep img.uri` still present (lines 440, 442, 489, 491, 779).
- `src/screens/CarDetailsScreen.tsx` — already migrated in a prior task; only remaining plain Image is the seller avatar (line ~776, out of scope). NOT in diff.
- `src/screens/ProviderOrdersScreen.tsx:129` buyer avatar — plain `Image`, intentionally not migrated.
- `android/version.properties` and `ios/carEx.xcodeproj/project.pbxproj` — pre-existing unstaged working-tree changes; NOT staged, NOT included in either commit.

## Verification Results
- **Task 1 verify block:** OK (`priority="high"` count = 1, OptimizedImage present).
- **Task 2 verify block:** ALL_OK (all OptimizedImage/`<Image`/import-line counts match the per-file rule).
- **Lint:** No NEW errors/warnings for the swaps. No unused-`Image` warnings (confirms import removals correct). The only lint output for changed files is 2 pre-existing `no-unstable-nested-components` warnings in AdminModerationScreen at lines 843/876 — unrelated to the line 687 swap.
- **Type-check (`npx tsc --noEmit`):** No NEW errors in the 5 changed source files. Remaining errors are all pre-existing baseline errors in `__tests__/*.test.tsx` (missing `fs`/`path`/`__dirname` Node types, test-mock typing) — the affected test file was last modified in commit de51b41 (Phase 11), predating this work.
- **Scope guards:** SellCarScreen and CarDetailsScreen absent from diff; native version files not staged.

## Deviations from Plan
None — plan executed exactly as written. Working-tree native-file changes were pre-existing (release-script artifacts) and were left unstaged per scope guard 6.

## Commits
- `24872ec` perf(quick-260602-vdv): add priority="high" to LatestCarousel image
- `f375371` perf(quick-260602-vdv): swap remote car/listing thumbnails to OptimizedImage

## Self-Check: PASSED
- All 5 modified files exist and contain the expected changes.
- Both commits exist in git log and contain ONLY the 5 source files (4 files / 8 insertions / 7 deletions for Task 2; 1 insertion for Task 1).

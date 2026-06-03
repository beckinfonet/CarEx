---
phase: quick-260602-svv
plan: 01
subsystem: home-v2
tags: [performance, images, fastimage, react-native]
requires: [src/components/OptimizedImage.tsx]
provides: [V2 home cards rendering via FastImage caching path]
affects:
  - src/components/home/v2/SmallFeedCard.tsx
  - src/components/home/v2/HeroCard.tsx
  - src/components/home/v2/ShelfCard.tsx
  - src/components/home/v2/BigFeedCard.tsx
  - src/components/home/v2/ProfileAvatarButton.tsx
tech-stack:
  added: []
  patterns: [OptimizedImage drop-in for remote <Image source={{uri}}>]
key-files:
  created:
    - .planning/quick/260602-svv-fix-v2-redesign-photo-lag-swap-plain-ima/260602-svv-SUMMARY.md
  modified:
    - src/components/home/v2/SmallFeedCard.tsx
    - src/components/home/v2/HeroCard.tsx
    - src/components/home/v2/ShelfCard.tsx
    - src/components/home/v2/BigFeedCard.tsx
    - src/components/home/v2/ProfileAvatarButton.tsx
decisions:
  - Static priority="high" on the hero image (HeroRotator passes shared pageIndex, not per-card list index, so a card cannot tell if it is the active slide without new prop plumbing — out of scope)
metrics:
  duration: ~5m
  completed: 2026-06-02
requirements: [V2-PERF-IMG-01]
---

# Phase quick-260602-svv Plan 01: Swap plain Image -> OptimizedImage in V2 cards Summary

Swapped plain React Native `<Image source={{ uri }}>` for the FastImage-backed `OptimizedImage` wrapper across all 5 V2 Home card components, gaining disk/memory caching (decode-once), Android blank-image retry, and the fetch-priority queue — fixing V2 Home scroll stutter and slow photo loads without any layout, style, or structural change.

## What Was Done

- **Task 1 (commit `ddda1ea`):** SmallFeedCard, ShelfCard, BigFeedCard, HeroCard — replaced the car-photo `<Image>` with `<OptimizedImage>`, added `import { OptimizedImage } from '../../OptimizedImage';`, and removed the now-unused `Image` from each `react-native` import. HeroCard's image gets `priority="high"`; the other three use the `normal` default. `style={styles.photo}` and `resizeMode="cover"` preserved exactly.
- **Task 2 (commit `c91a3b3`):** ProfileAvatarButton — replaced the header avatar `<Image source={{ uri: user.avatarUrl }}>` with `<OptimizedImage>`, keeping the inline style object and `resizeMode="cover"`. No priority prop (single avatar). Removed unused `Image` import.
- **Task 3 (verification only, no edits):** Ran `npm run lint` and `npx tsc --noEmit`. The 5 changed files have zero new lint errors and zero TypeScript errors.

## Verification Results

- **OptimizedImage import present in all 5 files:** confirmed (`from '../../OptimizedImage'`).
- **No plain `<Image>` JSX element remains in the 5 files:** confirmed via `grep -rnE '<Image[[:space:]]'` → NONE_FOUND.
- **HeroCard `priority="high"`:** confirmed (line 54).
- **`npm run lint`:** No new errors in the 5 changed files. SmallFeedCard shows one pre-existing warning (`Inline style: { flex: 1, minWidth: 0 }`, line 36) that predates this change (line shifted +1 from the import add); not introduced here.
- **`npx tsc --noEmit`:** Zero errors for the 5 changed files (`TYPECHECK_CLEAN_FOR_CHANGED_FILES`).

## Deviations from Plan

None functionally. One note on the verify commands:

- The plan's Task 1/Task 2 automated grep checks for "no plain Image remaining" are substring-flawed: the pattern `Image source={{ uri: ... }}` matches `OptimizedImage source={{ ... }}` as a substring, and the `grep -v OptimizedImage` filter operates on `grep -rl` filenames (which never contain "OptimizedImage"), producing a false positive. Verified correctly instead with `grep -rnE '<Image[[:space:]]'` (matches only the plain JSX element, not `<OptimizedImage`), which returned NONE_FOUND across all 5 files. The actual done criteria are met.

## Pre-existing Issues (NOT fixed — out of scope)

`npx tsc --noEmit` reports 89 pre-existing errors across unrelated files (e.g. `src/services/AuthService.ts` implicit-any/unknown-error, multiple `__tests__/*.ts` files missing node type config: `Cannot find module 'fs'/'path'`, `Cannot find name '__dirname'/'global'`). `npm run lint` reports 177 errors / 376 warnings repo-wide, all in unrelated files (ServiceProfileScreen, AuthService, test files, SmartShelf, etc.). None touch the 5 changed files and none were introduced by this change. Left untouched per scope.

## Other Notes

- Version files `android/version.properties` and `ios/carEx.xcodeproj/project.pbxproj` had pre-existing working-tree modifications; left unstaged and excluded from all commits as instructed.
- Follow-up (out of scope, not implemented): backend serves full-resolution S3 originals; a resized/CDN thumbnail variant for the small 124px cards would be a further perf win but requires carEx-services backend work.
- Device-level scroll smoothness / photo-load speed is to be verified manually by the user (no automated perf test exists).

## Self-Check: PASSED

- src/components/home/v2/SmallFeedCard.tsx — FOUND
- src/components/home/v2/HeroCard.tsx — FOUND
- src/components/home/v2/ShelfCard.tsx — FOUND
- src/components/home/v2/BigFeedCard.tsx — FOUND
- src/components/home/v2/ProfileAvatarButton.tsx — FOUND
- Commit ddda1ea — FOUND
- Commit c91a3b3 — FOUND

---
phase: quick-260603-i4w
plan: 01
subsystem: home-feed-v2
tags: [v2, feed-card, listing-status, i18n, presentational]
requires:
  - src/components/home/v2/theme.ts (V2 tokens)
  - src/context/LanguageContext.tsx (t.booked / t.sold)
  - src/hooks/useTypography.ts (display family)
provides:
  - ListingStatusBadge V2 presentational status pill
  - listingStatus rendering in SmallFeedCard and BigFeedCard
affects:
  - SearchResultsV2 / HomeScreenV2 feeds (no edits; listingStatus already flows via spread)
tech-stack:
  added: []
  patterns:
    - V2 presentational pill (dark text on solid fill) over feed-card photos
key-files:
  created:
    - src/components/home/v2/ListingStatusBadge.tsx
  modified:
    - src/components/home/v2/SmallFeedCard.tsx
    - src/components/home/v2/BigFeedCard.tsx
decisions:
  - Badge placed immediately after OptimizedImage in BigFeedCard so it sits above the gradient at top-left, clear of the top-right heart and bottom block
  - Reused existing t.booked / t.sold keys (RU+EN already present); no new translation keys
metrics:
  duration: ~6m
  tasks: 2
  files: 3
  completed: 2026-06-03
---

# Phase quick-260603-i4w Plan 01: V2 Feed-Card Status Badge Summary

V2 feed cards (`SmallFeedCard`, `BigFeedCard`) now render a top-left "Booked"/"Sold" pill over the photo, matching v1 `CarCard` semantics — booked/sold listings in `SearchResultsV2` and the `HomeScreenV2` feed are no longer indistinguishable from active ones.

## What Was Built

- **`ListingStatusBadge.tsx`** (new): presentational pill with prop `status?: string`. Returns `null` unless `status === 'booked' || 'sold'` (treats `'active'`/undefined as no-badge). Absolute top-left (`top: 8, left: 8`), `borderRadius: V2.radius.pill`, dark text (`V2.bg`) on a solid fill — `V2.ember` + `V2.emberBd` border for booked, `V2.green` for sold. Label via `useLanguage()` (`t.sold` when sold, else `t.booked`), font family from `useTypography().display`, fontSize 10 / weight 800 / letterSpacing -0.2.
- **`SmallFeedCard.tsx`**: imports the badge, adds `listingStatus?: string` to `SmallFeedCardCar`, renders `<ListingStatusBadge status={car.listingStatus} />` inside `photoWrap` after `OptimizedImage`.
- **`BigFeedCard.tsx`**: imports the badge, adds `listingStatus?: string` to `BigFeedCardCar`, renders the badge immediately after `OptimizedImage` (above the gradient, top-left, clear of the top-right heart and bottom block).

No screen, hook, backend, translation, v1 `CarCard`, `HeroCard`, or `ShelfCard` changes — `listingStatus` already flows to both cards via the `...car` spread from `useHomeListings`.

## Verification

- `npx tsc --noEmit -p tsconfig.json`: zero errors referencing any of the three touched files (`home/v2` absent from the error file list). Pre-existing `__tests__` errors are out of scope.
- Render assertion: `grep -c 'ListingStatusBadge status={car.listingStatus}'` = 1 in each card.
- Interface assertion: `grep -c 'listingStatus?: string'` = 1 in each card.
- `npx eslint` on the three files: 0 errors. One pre-existing inline-style warning on `SmallFeedCard.tsx:39` (a line not touched by this plan).

## Deviations from Plan

None - plan executed exactly as written.

## Follow-ups (out of scope)

- `HeroCard` / `ShelfCard` still render no status badge — noted in the plan as a possible follow-up for full V2 coverage.

## Commits

- `9fcdc5a` feat(quick-260603-i4w): add V2 ListingStatusBadge component
- `f1bb67e` feat(quick-260603-i4w): render ListingStatusBadge in V2 feed cards

## Self-Check: PASSED

All three source files and the SUMMARY exist on disk; both task commits (`9fcdc5a`, `f1bb67e`) present in git log.

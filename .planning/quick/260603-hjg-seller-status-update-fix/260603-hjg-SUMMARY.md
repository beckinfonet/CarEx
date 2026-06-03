---
phase: quick-260603-hjg
plan: 01
subsystem: car-listing
tags: [bugfix, seller, listing-status, optimistic-update]
requires: []
provides:
  - "Reliable seller listing-status PATCH on all navigation paths"
affects:
  - src/screens/CarDetailsScreen.tsx
tech-stack:
  added: []
  patterns:
    - "Resilient document id resolution (_id || id || route param)"
    - "Optimistic UI update with rollback on failure"
key-files:
  created: []
  modified:
    - src/screens/CarDetailsScreen.tsx
decisions:
  - "Mirror buyer-flow id resolution (car._id || car.id || carId) for the seller status PATCH"
  - "Surface HTTP status + backend message in the failure Alert rather than swallowing in console.error"
metrics:
  duration: ~6m
  completed: 2026-06-03
requirements:
  - SELLER-STATUS-FIX
---

# Phase quick-260603-hjg Plan 01: Seller Status Update Fix Summary

Fixed the seller "Mark as booked / sold / available" controls silently doing nothing on prod by resolving the car document id resiliently (`car?._id || car?.id || carId`), adding an optimistic status write with rollback, and surfacing failures with HTTP status + backend message.

## What Changed

Single function `updateListingStatus` in `src/screens/CarDetailsScreen.tsx` (commit `54a4ca2`):

1. **Root cause — resilient id resolution.** The function previously guarded on `car?.id` and used `car.id` in the PATCH URL. On navigation paths where the car object carries `_id` but not `id` (e.g. SellerListings / deep link / `carData` nav param), the guard `if (!user?.localId || !car?.id) return;` aborted before any request fired — no error, never persisted. Now it computes `const docId = car?._id || car?.id || carId;` (mirroring the buyer flow at ~line 371; `carId` is the route param from line 42), guards on `docId`, and PATCHes `/api/cars/${docId}/status`.

2. **Optimistic update with rollback.** Captures `const previousStatus = listingStatus;` as the rollback baseline, then immediately `setLocalListingStatus(newStatus)` for instant visual feedback. On failure (`catch`), reverts with `setLocalListingStatus(previousStatus)`. `setStatusUpdating(true)` stays before the try; `setStatusUpdating(false)` stays in `finally`.

3. **Visible error with detail.** The swallowed `console.error` failure path is replaced. The `catch` reads `err?.response?.status` and `err?.response?.data?.message` and surfaces them through `Alert.alert(t.error || 'Error', ...)`, appending `(status: message)` when a status is present. No new translation keys added — reuses the existing `t.error || 'Error'` pattern with an English fallback base string, consistent with the file.

The status buttons (lines 719-751), the backend, and all other functions were left untouched.

## Verification

**Automated (passed):**
- `npx tsc --noEmit -p tsconfig.json` shows no errors in `src/screens/CarDetailsScreen.tsx`. (Pre-existing type errors exist only in `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` and `CarDetailsScreen.listingBanner.test.tsx` — Node `fs`/`path`/`__dirname` and jest-mock typing — unrelated to this change and out of scope.)
- Grep assertions (all matched):
  - `car?._id || car?.id || carId` → line 327
  - `api/cars/${docId}/status` → line 333
  - `setLocalListingStatus(previousStatus)` → line 338

**Manual (human-verify checkpoint — NOT yet performed; requires the installed app):**
1. Sign in as a seller who owns a listing. Open the listing from a path that previously failed (e.g. via SellerListings, a deep link, or the `carData` nav param) so the car object carries `_id` but not `id`.
2. Tap "Mark as booked". The button/badge should change immediately (optimistic). Pull-to-refresh or re-open the listing to confirm it persisted (status stays booked — proves the PATCH reached the backend).
3. Tap "Mark as available", then "Mark as sold" to confirm each transition persists.
4. (Optional failure check) Reproduce a 403 (an account that isn't the seller) and confirm an Alert appears with the HTTP status / message and the button reverts to its prior state instead of sticking on the new value.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/screens/CarDetailsScreen.tsx` — FOUND (modified, 3 load-bearing edits verified via grep)
- Commit `54a4ca2` — FOUND on branch `worktree-agent-ad082012613536380`
- No file deletions in the commit; single file changed (16 insertions, 6 deletions)

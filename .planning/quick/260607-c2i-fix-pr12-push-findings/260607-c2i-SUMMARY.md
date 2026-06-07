---
quick_id: 260607-c2i
description: Fix 5 ultrareview findings on PR #12 (Phase 13 push notifications)
status: complete
date: 2026-06-07
tasks_total: 5
tasks_complete: 5
---

# Quick Task 260607-c2i — Summary

Fixes for the 5 cloud code-review (ultrareview) findings on PR #12
(`feature/notifications-system` → `main`), Phase 13 push notifications.

## Tasks

| # | Finding (sev) | File(s) | Commit |
|---|---------------|---------|--------|
| 1 | App.tsx routeDeeplink broken (normal, highest blast radius) | `App.tsx` | `df74a6d` |
| 2 | Android `carex_default` channel never created (normal) | `android/.../MainApplication.kt` | `4b838ce` |
| 3 | WatchButton duplicate subscriptions / WR-03 (normal) | `WatchButton.tsx` + test | `f24e2b0` |
| 4 | bodyType dropped on saved-search deeplink (normal) | `useHomeListings.ts` + test | `2f33852` |
| 5 | iOS aps-environment hardcoded to development (nit, doc-only) | deferred-items.md | `87effa2` |

## What changed

**Task 1 — App.tsx `routeDeeplink`.** Replaced the segment-slicing parser (which
collapsed `carex://listing/abc` to `segments[0]='abc'` → no-op, and JSON-parsed a
non-existent `initialFilters` param → filters dropped) with a faithful mirror of the
already-correct `routeNotification` in `NotificationsScreen.tsx`. Extracted shared
`PUSH_STRING_FILTER_KEYS` / `PUSH_NUMERIC_FILTER_KEYS` constants. Uses regex
`/^carex:\/\/listing\/([^/?#]+)/` for the watch/listing case and discrete
URLSearchParams (`makeId`,`modelId`,`bodyType` / `priceMin`,`priceMax`,`yearMin`,`yearMax`)
for search. Wrapping `routeNotification` directly was not viable because it does not
cover the `https://www.carexmarket.com/...` web-URL branch, which is preserved here.
Unknown-deeplink → no-op whitelist behavior and the `navigationRef.isReady()` guard
are preserved.

**Task 2 — Android notification channel.** Added idempotent native channel creation in
`MainApplication.onCreate()` before `loadReactNative(this)`, guarded by
`Build.VERSION.SDK_INT >= Build.VERSION_CODES.O`. Channel id `carex_default`
(matching the manifest `default_notification_channel_id`), name "CarEx: Marketplace",
`IMPORTANCE_DEFAULT`. Package `com.carex.market`.

**Task 3 — WatchButton hydration.** On mount, hydrate `watching` by calling
`NotificationService.listSubscriptions()` (actual path:
`src/services/notifications/NotificationService.ts`) and matching an active `watch`
subscription for this car's watchKey; seed `setWatching(true)` and cache the
subscription id for unwatch. Mounted-guard prevents setState-after-unmount. Existing
`WatchButton.test.tsx` mock extended to stub `listSubscriptions`/`deleteSubscription`
so prior tests stay green; new tests assert hydration + no duplicate POST on remount.

**Task 4 — bodyType saved-search filter.** Plan option (a): in
`normalizeInitialFilters`, reverse-lookup `CATEGORIES` by name when `src.bodyType` is
present and seed `selectedCategory`, so `filteredCars`' existing tested category
substring-match applies. The no-canonical-keys path stays byte-equal (CR-03 guarantee
preserved).

**Task 5 — iOS aps-environment (doc-only).** Entitlements value **left at
`development`** (correct for dev/TestFlight; both Debug+Release pbxproj configs share
one entitlements file, so a per-config split is non-trivial). Documented the required
development→production swap before App Store archive in
`260607-c2i-deferred-items.md`, paralleling the existing Stripe `pk_live` release-prep
item.

## Verification

- **Tests:** 28/28 pass (NotificationsScreen, WatchButton, useHomeListings) — confirmed
  again post-merge on `feature/notifications-system`.
- **Lint:** eslint 0 errors on all touched source files.
- **No new deps / keys:** `package.json` + `package-lock.json` unchanged; no new
  hardcoded keys; no user-facing strings added (no RU/EN parity work needed).
- **Greps:** `CHANNEL_OK` (channel registration present) and `DEFERRED_OK`
  (deferred-items recorded) pass.

## Deviations

None. Only non-clean signal: `tsc --noEmit` reports pre-existing typing errors in the
two **test files** (`fs`/`path`/`__dirname`/`setImmediate`) — verified present at base
`ab565bf`, out of scope (Jest runs via babel, not tsc).

## Notes / not addressed

- Finding 5 is intentionally deferred (release-prep), not coded — see deferred-items.md.
- Server-side defense-in-depth for Finding 3 (partial-unique index on
  `{uid, kind:'watch', carId, active:true}`) lives in the backend repo, out of scope
  for this mobile PR; the mobile hydration fix prevents the duplicate-POST trigger.

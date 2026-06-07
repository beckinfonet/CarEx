---
phase: 12-notification-domain-in-app-center
plan: 09
subsystem: notifications (subscription-creation controls)
tags: [mobile, notifications, subscriptions, watch, saved-search, ui, wave-5, tdd]
requires:
  - "12-06: NotificationService.createSubscription / deleteSubscription + watch/save-search i18n strings"
  - "12-02: Wave-0 WatchButton test scaffold (filled here)"
  - "12-UI-SPEC: D-01..D-04 WatchButton, D-08/D-09 SaveSearchBar, Copywriting contract"
provides:
  - "[MOB] WatchButton — labeled bell pill on CarDetails; one-tap all-4-events instant watch keyed on car._id||car.id||carId"
  - "[MOB] SaveSearchBar — sticky save-search bar on SearchResultsV2; RU-label→canonical ObjectId criteria mapping + toast-with-Undo"
  - "[MOB] WATCH_EVENTS canonical four-event constant (price_drop/booked/sold/back_available)"
  - "[MOB] buildCriteria() — exported RU-label→canonical criteria mapper (Pitfall 4/5)"
affects:
  - "12-10 NotificationSettingsScreen (lists/edits the subscriptions these controls create)"
  - "Backend matcher (12-04) consumes the canonical criteria + watch carId these controls POST"
tech-stack:
  added: []
  patterns:
    - "Sibling-component discipline: WatchButton is its own Bell pill, never a Heart variant (3 disambiguators: icon/color/shape)"
    - "Watch-key fallback car._id || car.id || carId (NSUB-04/D-04, car_id_field_unreliable memory)"
    - "RU-label activeFilters → canonical English criteria with ObjectId ids before POST (Pitfall 4/5)"
    - "Toast-with-Undo: optimistic create, ~4s auto-dismiss timer, Undo deletes by returned id, non-blocking"
key-files:
  created:
    - "src/components/notifications/WatchButton.tsx"
    - "src/components/notifications/SaveSearchBar.tsx"
    - "src/components/notifications/__tests__/SaveSearchBar.test.tsx"
  modified:
    - "src/components/notifications/__tests__/WatchButton.test.tsx (filled from 12-02 scaffold)"
    - "src/screens/CarDetailsScreen.tsx (WatchButton mount below hero)"
    - "src/screens/SearchResultsV2.tsx (SaveSearchBar mount in header)"
    - "src/services/notifications/NotificationService.ts (NotificationEvent union aligned to canonical watch events)"
decisions:
  - "NotificationEvent union extended with the canonical watch events 'booked' + 'back_available' (CTX D-03) alongside the legacy 'back_in_stock'/'new_photos' — 12-08's NotificationFeedItem already cast these spellings defensively; aligning the type removes the casts' need without breaking in-flight rows."
  - "SaveSearchBar takes a resolved bodyType string prop (not selectedCategory id) — selectedCategory is a CATEGORIES numeric id, so the screen resolves it to the RU category name before passing; keeps the Pitfall-4 mapping fully unit-testable in the component."
  - "WatchButton mounts only for non-owners (!isOwner) on CarDetails — owners get the status controls instead of a watch affordance; placed as the first child of detailsContainer (below the hero carousel, above the title/spec blocks per D-02)."
  - "SaveSearchBar self-hides via an internal hasActiveFilters guard (make/model/bodyType OR any non-sort activeFilters key) so the mount in the header needs no external visibility wiring (D-08)."
metrics:
  duration: ~12m
  tasks: 2
  files: 7
  completed: 2026-06-06
---

# Phase 12 Plan 09: Subscription-Creation Controls (WatchButton + SaveSearchBar) Summary

Shipped the two Phase-12 conversion moments (NCEN-06): the labeled **WatchButton** bell pill on `CarDetailsScreen` (one-tap, all-4-events, instant watch keyed on the safe car-id fallback) and the sticky **SaveSearchBar** on `SearchResultsV2` (one-tap saved search from the current filters with the load-bearing RU-label→canonical-ObjectId criteria mapping and a toast-with-Undo). Filled the Wave-0 WatchButton test scaffold and added a new SaveSearchBar test.

## What Was Built

**Task 1 — WatchButton + CarDetails mount** (commit `e275ed3`)
- `src/components/notifications/WatchButton.tsx`: its OWN component (not a Heart variant — D-01 sibling discipline via three disambiguators: `Bell` icon, accent blue, labeled pill). One tap calls `NotificationService.createSubscription({ kind:'watch', carId: car._id || car.id || carId, events: WATCH_EVENTS, cadence:'instant' })` and flips to the active "Watching" state. Exports `WATCH_EVENTS` (the canonical four: `price_drop`/`booked`/`sold`/`back_available`). Watch key resolves `car._id || car.id || carId` — NEVER bare `car.id` (D-04/NSUB-04). Styling mirrors `BottomBar`'s pill (accent border/icon, active fill `rgba(59,130,246,0.1)`), 44px tap floor.
- `src/screens/CarDetailsScreen.tsx`: `WatchButton` mounted as the first child of `detailsContainer` (below the hero carousel, above the title/spec blocks — D-02), non-owner only, separate from the favorite heart and the buyer CTA stack.
- `src/services/notifications/NotificationService.ts`: `NotificationEvent` union extended to carry the canonical `booked` + `back_available` watch events (alongside the legacy `back_in_stock`/`new_photos`).
- `src/components/notifications/__tests__/WatchButton.test.tsx`: filled from the 12-02 scaffold — 8 assertions (Bell-not-Heart render + no-Heart-import source check; all-4-events + instant create; the car-id fallback order across `_id`/`id`/`carId` including the `car._id` undefined → uses `carId` case; grep-visible fallback contract).

**Task 2 — SaveSearchBar + SearchResultsV2 mount** (commit `61ea4e4`)
- `src/components/notifications/SaveSearchBar.tsx`: sticky accent bar, self-hiding via an internal `hasActiveFilters` guard (D-08). Exported `buildCriteria()` maps the RU-label `activeFilters` (`'Цена'`/`'Год'` `{min,max}`) to canonical `priceMin/priceMax/yearMin/yearMax`, `makeId`/`modelId` as ObjectId strings from `selectedMake.id`/`selectedModel.id`, and `bodyType` (Pitfall 4/5; undefined keys stripped). One tap → `createSubscription({ kind:'saved_search', criteria, cadence:'instant' })` (D-09), then a toast-with-Undo (success + Undo strings via `t`; ~4s auto-dismiss; Undo calls `deleteSubscription` with the returned id; bottom-anchored, non-blocking). Create failure logs + rolls back the optimistic toast.
- `src/screens/SearchResultsV2.tsx`: destructures `selectedCategory` from `useHomeListings`, resolves it to the RU category name (`bodyType`), and mounts `SaveSearchBar` in the header after `FilterChipRow` (D-08).
- `src/components/notifications/__tests__/SaveSearchBar.test.tsx`: 4 assertions — the CTA tap POSTs `saved_search`/`instant`/the exact canonical criteria object mapped from RU labels (Pitfall 4/5, asserting names do NOT leak); Undo calls `deleteSubscription('saved_1')`; the bar renders nothing with no filters and with sort-only keys. Uses fake timers + unmount in afterEach to keep the toast timer from firing post-teardown.

## Verification Results

- `npx jest src/components/notifications/__tests__/WatchButton.test.tsx src/components/notifications/__tests__/SaveSearchBar.test.tsx` → **2 suites, 12 passed**.
- `npx jest src/components/notifications/ src/services/notifications/` → **4 suites, 31 passed** (no regressions in NotificationBadge / NotificationService).
- `npx tsc --noEmit` → no errors in the touched non-test source files (WatchButton.tsx, SaveSearchBar.tsx, CarDetailsScreen.tsx, SearchResultsV2.tsx, NotificationService.ts).
- `grep -n "car._id || car.id || carId" src/components/notifications/WatchButton.tsx` → matches (D-04).
- `grep -n "Bell" WatchButton.tsx` matches; no `import {...Heart...} from 'lucide-react-native'` → sibling discipline (D-01).
- `grep -n "WatchButton" src/screens/CarDetailsScreen.tsx` → mount confirmed.
- `grep -n "activeFilters['Цена']" SaveSearchBar.tsx` → RU-label mapping (Pitfall 4).
- `grep -n "makeId" SaveSearchBar.tsx` → ObjectId passthrough (Pitfall 5).
- `grep -n "cadence: 'instant'" SaveSearchBar.tsx` → instant default (NSUB-03/D-09).
- `grep -n "deleteSubscription|Undo|Отменить" SaveSearchBar.tsx` → Undo affordance.
- `grep -n "SaveSearchBar" src/screens/SearchResultsV2.tsx` → mount confirmed.

## Success Criteria

- NSUB-01: SaveSearchBar creates a Saved Search from filter criteria, default instant.
- NSUB-02: WatchButton watches a car with all 4 events.
- NSUB-03: both controls create at instant cadence.
- NSUB-04: watch keys on `car._id || car.id || carId` (test-proven across all three fallback cases).
- NCEN-06: Watch control on CarDetails + "Notify me about new matches" on results.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NotificationEvent union missing the plan's canonical watch events**
- **Found during:** Task 1 (tsc on WatchButton.tsx)
- **Issue:** The plan's load-bearing D-03 contract requires watch events `['price_drop','booked','sold','back_available']`, but the 12-06 `NotificationEvent` union was `'price_drop'|'sold'|'back_in_stock'|'new_photos'` — `'booked'` and `'back_available'` were not assignable, so the component (and its test) would not typecheck. (12-08's NotificationFeedItem had already worked around this by casting `'booked' as ...` / `'back_available' as ...` and handling both `back_available` AND `back_in_stock`, confirming the plan names are the real wire values.)
- **Fix:** Extended the union to include `'booked'` and `'back_available'` alongside the existing members (kept for in-flight rows + the feed renderer).
- **Files modified:** src/services/notifications/NotificationService.ts
- **Commit:** e275ed3

**2. [Rule 3 - Blocking] criteria type mismatch on createSubscription**
- **Found during:** Task 2 (tsc on SaveSearchBar.tsx)
- **Issue:** `CreateSubscriptionBody.criteria` is `Record<string, unknown>`; the typed `SaveSearchCriteria` interface lacks an implicit index signature and is not assignable.
- **Fix:** Cast `criteria as Record<string, unknown>` at the single call site (the typed interface stays the source of truth for the mapper).
- **Files modified:** src/components/notifications/SaveSearchBar.tsx
- **Commit:** 61ea4e4

## Authentication Gates

None.

## Known Stubs

None — both controls are fully wired to live `NotificationService` create/delete calls.

## TDD Gate Compliance

Both tasks are `tdd="true"`. `tdd_mode` is `false` in config (gate inactive for this phase), so RED/GREEN were not split into separate commits — the Wave-0 WatchButton scaffold (12-02) was the RED layer; this plan shipped the implementation and filled the scaffold (plus added the SaveSearchBar test) atomically per task, with the suites proving GREEN. Both commits are `feat(...)`.

## Self-Check: PASSED

- FOUND: src/components/notifications/WatchButton.tsx
- FOUND: src/components/notifications/SaveSearchBar.tsx
- FOUND: src/components/notifications/__tests__/SaveSearchBar.test.tsx
- FOUND: commit e275ed3
- FOUND: commit 61ea4e4

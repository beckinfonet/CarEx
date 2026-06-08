---
phase: 14-daily-digest-scheduling
plan: 05
subsystem: ui
tags: [react-navigation, deeplink, push, notifications, digest]

# Dependency graph
requires:
  - phase: 12-notification-domain
    provides: NotificationsScreen registered in navigator + Notifications:undefined in RootStackParamList; listing/search linking whitelist precedent
  - phase: 13-fcm-push-transport
    provides: routeDeeplink + PushTapRoutingEffect (3-state tap routing reading remoteMessage.data.deeplink)
  - phase: 14-daily-digest-scheduling
    provides: backend digest (Plan 03) sets data.deeplink = carex://notifications
provides:
  - "routeDeeplink consumes carex://notifications (and https form) → in-app Notification Center"
  - "Notifications registered in linking.config.screens (OS cold-start path agrees with in-app routeDeeplink)"
  - "routeDeeplink exported for unit testing"
affects: [digest-uat, push-tap-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist widened by exactly one param-free route; unknown-target ignore branch preserved (open-redirect closed, T-14-05-01)"

key-files:
  created:
    - "__tests__/digestDeeplink.test.tsx"
  modified:
    - "App.tsx"

key-decisions:
  - "Digest deeplink targets the Notification Center (param-free), NOT listing/:carId — natural destination for a multi-item bundle (D-03)"
  - "routeDeeplink changed from module-private to a named export so the new route is unit-testable without a real device; signature + existing branches unchanged"
  - "notifications branch accepts a trailing slash / sub-path defensively (normalizedPath === 'notifications' || startsWith('notifications/'))"

patterns-established:
  - "Notification deeplink whitelist now has exactly 3 routes (CarDetails, SearchResults, Notifications); the unknown-target ignore branch stays closed"

requirements-completed: [NDIG-03]

# Metrics
duration: ~6min
completed: 2026-06-07
---

# Phase 14 Plan 05: Digest Notification-Center Deeplink Summary

**`routeDeeplink` now routes `carex://notifications` (and its https form) to the in-app Notification Center, widening the deeplink whitelist by exactly one param-free route while leaving listing/search routing and the unknown-target ignore branch untouched.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-07T23:02:27Z
- **Tasks:** 1 (TDD: RED + GREEN, no refactor needed)
- **Files modified:** 2 (App.tsx, __tests__/digestDeeplink.test.tsx)

## Accomplishments
- Added a `notifications` branch to `App.tsx` `routeDeeplink` → `navigationRef.navigate('Notifications')` (no params), placed after the listing/search branches and before the unknown-target ignore.
- Registered `Notifications: 'notifications'` in `linking.config.screens` so the OS cold-start linking layer and the in-app `routeDeeplink` agree on the path token (matching the listing/search precedent).
- Exported `routeDeeplink` (module-private → named export) for device-free unit testing; signature and existing branches unchanged.
- Added `__tests__/digestDeeplink.test.tsx` covering all five behavior cases plus the trailing-slash defensive path — 6/6 green.

## Task Commits

1. **Task 1 (RED): failing digest-deeplink test** - `c6780ae` (test)
2. **Task 1 (GREEN): notifications route + linking config + export** - `9b933c4` (feat)

_No REFACTOR commit — the GREEN implementation was already minimal and clean._

## Files Created/Modified
- `App.tsx` - `routeDeeplink` gains a `notifications` branch + named export; `linking.config.screens.Notifications: 'notifications'` registered.
- `__tests__/digestDeeplink.test.tsx` - Unit test: stubs `navigationRef.isReady()`/`navigate()`, asserts carex:// + https notifications route to `Notifications` (no params), trailing-slash tolerance, listing/search unchanged, unknown path still ignored.

## Decisions Made
- Digest deeplink → Notification Center (param-free), not a single listing (D-03 — bundle destination).
- Exported `routeDeeplink` rather than constructing a real navigation tree in the test (faster, isolates the routing logic).
- Notifications branch tolerates a trailing slash / sub-path defensively (no behavior beyond navigating to the param-free screen).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `__tests__/App.test.tsx` ("renders correctly") fails with `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` in `@react-navigation/native-stack` NativeStackView. **Confirmed pre-existing** via `git stash` (fails identically without the 14-05 change) — a native-stack/react-native-screens test-harness gap, unrelated to the deeplink/linking-config edit. Logged to `deferred-items.md` per the SCOPE BOUNDARY rule; not fixed. The 14-05 unit test (`digestDeeplink.test.tsx`) is green.

## Threat Model Compliance

- **T-14-05-01 (open-redirect / EoP):** mitigated — whitelist widened by exactly one route; the new route is param-free and lands on the already-registered authenticated `Notifications` screen; the unknown-target ignore branch is preserved and asserted (`carex://unknownroute` → not navigated).
- **T-14-05-02 (info disclosure):** accepted — the notifications route carries no params; the feed is uid-scoped by NotificationContext.

No new threat surface introduced beyond the planned single route.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Mobile-side digest deeplink consumer is complete; tapping the daily digest now opens the Notification Center across all three push states (PushTapRoutingEffect already calls routeDeeplink, unchanged).
- This is the only mobile change in Phase 14. Real-device 3-state digest-tap behavior is verified in the phase UAT.

## Self-Check: PASSED

- App.tsx — FOUND
- __tests__/digestDeeplink.test.tsx — FOUND
- .planning/phases/14-daily-digest-scheduling/14-05-SUMMARY.md — FOUND
- Commit c6780ae (test/RED) — FOUND
- Commit 9b933c4 (feat/GREEN) — FOUND

---
*Phase: 14-daily-digest-scheduling*
*Completed: 2026-06-07*

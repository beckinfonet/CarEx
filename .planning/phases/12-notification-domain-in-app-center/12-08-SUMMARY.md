---
phase: 12-notification-domain-in-app-center
plan: 08
subsystem: notifications (mobile in-app center UI)
tags: [mobile, notifications, ui, feed, badge, deeplink, navigation, wave-5]
requires:
  - "12-06: NotificationContext (unreadCount/feed/loading/refresh/loadMore/markRead/markAllRead) + NotificationItem type + Notifications/SearchResults routes + linking.config whitelist + RU/EN strings"
provides:
  - "[MOB] NotificationsScreen — real cursor feed (reverse-chron, pull-to-refresh, onEndReached→loadMore), tap→markRead THEN whitelist deeplink routing, mark-all-read, BellOff empty state (overwrites the 12-06 placeholder)"
  - "[MOB] routeNotification — two-prefix deeplink resolver (carex://listing/:carId→CarDetails, carex://search?<crit>→SearchResults(parsed filters)); exported for direct unit reuse"
  - "[MOB] NotificationFeedItem — per-category lucide icon + read/unread styling row"
  - "[MOB] NotificationBadge — dot mode (BottomBar red dot) + count mode (MoreMenu 9+ bubble) + formatBadgeCount helper"
  - "[MOB] badge surfaces on BottomBar (More red dot) and MoreMenu (Notifications grid item + 9+ count)"
affects:
  - "12-10 NotificationSettingsScreen (sibling Wave-5 screen; independent)"
  - "Phase 13 FCM tap routing reuses the routeNotification whitelist resolver"
tech-stack:
  added: []
  patterns:
    - "Two-prefix deeplink whitelist resolver (T-12-08-01): server-built carex:// string → typed navigation.navigate; never evals arbitrary targets; unknown prefix no-ops"
    - "Manual query-string parser instead of URLSearchParams (RN lib typing gap)"
    - "Badge overlay via absolute-positioned NotificationBadge with a style prop on the parent surface"
    - "markRead BEFORE navigate on feed-row tap (NCEN-04)"
key-files:
  created:
    - "src/components/notifications/NotificationBadge.tsx"
    - "src/components/notifications/NotificationFeedItem.tsx"
    - "src/components/notifications/__tests__/NotificationBadge.test.tsx"
    - "src/screens/__tests__/NotificationsScreen.test.tsx"
  modified:
    - "src/screens/NotificationsScreen.tsx (overwrote 12-06 placeholder)"
    - "src/components/MoreMenu.tsx"
    - "src/components/BottomBar.tsx"
decisions:
  - "routeNotification exported from NotificationsScreen as a pure resolver — keeps the tamper-boundary (T-12-08-01) test-visible and reusable by Phase 13 FCM tap routing."
  - "Saved-search criteria parsed via a hand-rolled parseQueryString (split on &/=, URI-decode) rather than URLSearchParams — RN's URLSearchParams shim lacks .get() in the lib typings (TS2339) and is environment-flaky; the manual parser is deterministic and typecheck-clean."
  - "NotificationFeedItem t prop typed `any` to match the project-wide `t: any` convention (BottomBar/MoreMenu) and avoid the full translations literal-type mismatch."
  - "NotificationFeedItem icon map accepts BOTH event vocabularies (UI-SPEC booked/back_available AND the NotificationItem.event union price_drop/sold/back_in_stock/new_photos) plus kind==='saved_search'→Search, with a Bell/CircleCheck fallback so an unknown event never crashes."
  - "No bottom-tab navigator introduced — badges reuse the existing BottomBar More + MoreMenu surfaces (D-05; global tab nav explicitly deferred). App.tsx untouched."
metrics:
  duration: ~5m
  tasks: 3
  files: 7
  completed: 2026-06-06
---

# Phase 12 Plan 08: In-App Notification Center Feed + Badges Summary

Shipped the user-facing notification center: the real `NotificationsScreen` (reverse-chron cursor feed, pull-to-refresh, `onEndReached`→loadMore, tap→markRead-then-deeplink-routing, mark-all-read, `BellOff` onboarding empty state) replacing the 12-06 placeholder; `NotificationFeedItem` (per-category lucide icon + read/unread styling); `NotificationBadge` (BottomBar red dot + MoreMenu "9+" count); and the two badge surfaces wired into `BottomBar` and `MoreMenu` — all deriving from `useNotifications().unreadCount`. A new_match (saved-search) tap lands on FILTERED `SearchResults`, a watch tap on `CarDetails`, via a two-prefix whitelist resolver that never evals arbitrary navigation targets.

## What Was Built

**Task 1 — NotificationBadge + NotificationFeedItem** (commit `e790f3e`)
- `src/components/notifications/NotificationBadge.tsx`: two render modes — `dot` (`COLORS.destructive` red, renders null at 0) for BottomBar, `count` (`COLORS.accent`, `radiusPill`, "9+"-capped) for MoreMenu. Exported `formatBadgeCount` helper. Theme tokens only, no raw hex.
- `src/components/notifications/NotificationFeedItem.tsx`: maps kind/event → lucide icon (saved_search→`Search`, price_drop→`TrendingDown`, booked→`Lock`, sold→`BadgeCheck`, back_available/back_in_stock→`RotateCcw`, fallback `CircleCheck`/`Bell`). Unread = accent left indicator + 600-weight `textPrimary` title; read = `textSecondary`. 44px tap target. Title/body via titleKey/bodyKey→t with literal fallback.
- `NotificationBadge.test.tsx`: 7 assertions — 9+ cap (count mode), exact 1-9, dot-hidden-at-zero (both modes render null), formatBadgeCount unit.

**Task 2 — Real NotificationsScreen feed** (commit `833482b`, with type fixes folded into `180e2b9`)
- `src/screens/NotificationsScreen.tsx` (overwrites placeholder): `FlatList` of `NotificationFeedItem` from `context.feed`, `RefreshControl`→`refresh`, `onEndReached`→`loadMore` (cursor pagination, NCEN-02), tap→`markRead(id)` THEN `routeNotification`. Header "Mark all read" (disabled at 0 unread). `BellOff` empty state with UI-SPEC copy (NCEN-05).
- `routeNotification` (exported): two-prefix whitelist — `carex://listing/:carId`→`navigate('CarDetails',{carId})`; `carex://search?<crit>`→parse (makeId/modelId/bodyType strings + priceMin/priceMax/yearMin/yearMax coerced to Number + optional initialQuery)→`navigate('SearchResults',{initialQuery, initialFilters})`. Legacy bare `data.carId` fallback. Unknown prefix no-ops (T-12-08-01).
- `NotificationsScreen.test.tsx`: 4 assertions — watch tap→markRead+CarDetails; new_match tap→markRead+SearchResults(parsed filters) and NOT CarDetails; markRead-before-navigate ordering; BellOff empty state when feed is [].

**Task 3 — Wire badges into MoreMenu + BottomBar** (commit `180e2b9`)
- `src/components/MoreMenu.tsx`: added `{ id: 11, name: t.notificationsMenuLabel, route: 'Notifications' }` grid item, `Bell` case in `getIcon`, count-mode `NotificationBadge` overlaid on that item from `useNotifications().unreadCount` (D-06/D-07).
- `src/components/BottomBar.tsx`: dot-mode `NotificationBadge` overlaid on the More `TouchableOpacity` from `useNotifications().unreadCount` (D-07). No nav restructure — App.tsx untouched (D-05).

## Verification Results

- `npx jest src/components/notifications/__tests__/NotificationBadge.test.tsx` → **7 passed**.
- `npx jest src/screens/__tests__/NotificationsScreen.test.tsx` → **4 passed** (watch→CarDetails, new_match→SearchResults(filters), markRead-before-navigate, BellOff empty state).
- `npx tsc --noEmit -p tsconfig.json` → **no errors in any touched file** (MoreMenu, BottomBar, NotificationsScreen, NotificationBadge, NotificationFeedItem).
- `grep -c "#" NotificationFeedItem.tsx` → no raw hex (theme tokens only).
- Per-category icons present in FeedItem; `COLORS.destructive` (dot) + `COLORS.accent` (count) both present in NotificationBadge.
- MoreMenu `route: 'Notifications'` + `NotificationBadge` present; BottomBar `NotificationBadge` + `useNotifications` present.
- `git diff App.tsx` empty for this plan (no bottom-tab navigator introduced).

## Success Criteria

- NCEN-01: BottomBar red dot + MoreMenu 9+ count, both from context `unreadCount` (test-proven via badge unit + wiring greps).
- NCEN-02: reverse-chron cursor feed (`onEndReached`→`loadMore`, `RefreshControl`→`refresh`).
- NCEN-03: watch tap→CarDetails AND new_match tap→SearchResults(parsed saved-search filters) — both routing families proven by the render test (Success Criterion #1).
- NCEN-04: markRead on open + mark-all-read header action + read/unread visually distinct (accent indicator + 600 title vs textSecondary).
- NCEN-05: BellOff onboarding empty state.
- NPRF-07: feed works over pure REST; feed-load error is non-blocking (context logs + screen stays mounted, pull-to-refresh to retry) — never dead-ends.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced URLSearchParams with a manual query-string parser + fixed FeedItem t prop type**
- **Found during:** Task 3 (the `npx tsc` verification gate surfaced TS errors in the Task-2 file)
- **Issue:** `URLSearchParams.get()` is absent from the RN lib typings (TS2339 at 3 call sites) and the RN runtime URLSearchParams shim is environment-flaky; separately, `NotificationFeedItem`'s `t: Record<string,string>` prop did not accept the concrete translations literal type (TS2322).
- **Fix:** Added a deterministic `parseQueryString` (split on `&`/`=`, URI-decode, skip empties) inside NotificationsScreen and switched the resolver to it; changed the FeedItem `t` prop to `any` (matching the project-wide `t: any` convention used by BottomBar/MoreMenu).
- **Files modified:** `src/screens/NotificationsScreen.tsx`, `src/components/notifications/NotificationFeedItem.tsx`
- **Commit:** `180e2b9` (folded into the Task-3 commit since it made the wiring typecheck-clean)
- **Note:** tests were already green before and after the fix — the manual parser produces identical parsing to the URLSearchParams path the test exercised.

## Authentication Gates

None.

## Known Stubs

None — `NotificationsScreen` is now the real screen (the 12-06 placeholder was overwritten). It is wired to live `useNotifications` data (no mock/empty hardcoded feed); the empty state is an intentional onboarding surface, not a stub. The sibling `NotificationSettingsScreen` placeholder is owned by 12-10 (out of scope here).

## Threat Flags

None — no new security surface beyond the threat_model's deeplink boundary, which is mitigated exactly as specified (two-prefix whitelist resolver `routeNotification`; unknown prefixes no-op; no arbitrary navigation eval). Feed contents remain token-scoped by the backend; pagination is cursor-bounded server-side.

## Self-Check: PASSED

- FOUND: src/components/notifications/NotificationBadge.tsx
- FOUND: src/components/notifications/NotificationFeedItem.tsx
- FOUND: src/components/notifications/__tests__/NotificationBadge.test.tsx
- FOUND: src/screens/NotificationsScreen.tsx
- FOUND: src/screens/__tests__/NotificationsScreen.test.tsx
- FOUND: commit e790f3e
- FOUND: commit 833482b
- FOUND: commit 180e2b9

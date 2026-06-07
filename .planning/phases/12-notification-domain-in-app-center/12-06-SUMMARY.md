---
phase: 12-notification-domain-in-app-center
plan: 06
subsystem: notifications (mobile foundation)
tags: [mobile, notifications, service, context, navigation, linking, i18n, wave-4, tdd]
requires:
  - "12-02: Wave-0 NotificationService + NotificationContext test scaffolds (filled here)"
  - "12-04: backend /api/notifications/* REST surface this service calls"
  - "ModerationService split precedent (apiClient verb+path wrappers, isAbortError)"
  - "FavoritesContext prevUidRef auto-clear pattern"
provides:
  - "[MOB] NotificationService — thin apiClient wrappers for the notification API (feed, unread-count, read-state, subscription CRUD)"
  - "[MOB] NotificationProvider + useNotifications — context surface consumed by Wave-4/Wave-5 screens, badges, controls"
  - "[MOB] Notifications + NotificationSettings routes on RootStackParamList + registered in the navigator"
  - "[MOB] SearchResults deeplink path in App.tsx linking.config (saved-search/new_match target)"
  - "[MOB] all RU/EN notification strings (parity-clean)"
affects:
  - "12-07 WatchButton / save-search bar (consume createSubscription)"
  - "12-08 NotificationsScreen (real feed; overwrites the placeholder; resolves new_match→SearchResults / watch→CarDetails taps)"
  - "12-10 NotificationSettingsScreen (real settings; overwrites the placeholder)"
tech-stack:
  added: []
  patterns:
    - "Domain HTTP module mirrors ModerationService split (MOB-01 guardrail: notification HTTP off AuthService)"
    - "prevUidRef skip-on-mount sentinel clears per-user cache on uid change (FavoritesContext pattern)"
    - "Optimistic markRead/markAllRead (flip row + decrement badge, then sync server)"
    - "React Navigation linking.config whitelist as deeplink routing allowlist (only CarDetails + SearchResults)"
key-files:
  created:
    - "src/services/notifications/NotificationService.ts"
    - "src/context/NotificationContext.tsx"
    - "src/screens/NotificationsScreen.tsx (PLACEHOLDER)"
    - "src/screens/NotificationSettingsScreen.tsx (PLACEHOLDER)"
  modified:
    - "src/types/navigation.ts"
    - "App.tsx"
    - "src/constants/translations.ts"
    - "src/services/notifications/__tests__/NotificationService.test.ts (filled from scaffold)"
    - "src/context/__tests__/NotificationContext.test.tsx (filled from scaffold)"
decisions:
  - "NotificationService.getFeed returns { items, nextCursor } (matches backend 12-04 envelope) — the context maps items→feed; consumers read context.feed."
  - "NotificationProvider placed innermost (after FavoritesProvider, immediately wrapping NavigationContainer) so it sits inside AuthProvider for useAuth AND wraps all screens/badges that read it."
  - "Placeholder screens are minimal default-exports that render only the localized title — just enough to register the routes and keep App.tsx compiling; real screens land in 12-08 / 12-10 (Wave 5)."
  - "MOB-01 guardrail enforced as a runtime test (reads AuthService.ts source, asserts zero notification/subscription/watch matches) in addition to the acceptance grep — regression-proof."
  - "Notification placeholder token {amount} kept identical across RU/EN in notificationPriceDropTitle so the parity scanner's placeholder-equality check passes; RU uses 'сом', EN uses 'KGS som'."
metrics:
  duration: ~6m
  tasks: 2
  files: 9
  completed: 2026-06-06
---

# Phase 12 Plan 06: Mobile Notification Foundation Summary

Built the mobile notification substrate: `NotificationService` (apiClient verb+path wrappers, sibling of ModerationService — NOT AuthService), `NotificationContext` (provider + hook with prevUidRef per-user auto-clear), the two new navigator routes, the provider + screen wiring in `App.tsx`, the `SearchResults` deep-link entry that lets saved-search/new_match notifications land on filtered results, and every new RU/EN string. The two Wave-0 scaffolds (NotificationService, NotificationContext) were filled with real assertions.

## What Was Built

**Task 1 — NotificationService + translations + route types** (commit `53daa2f`)
- `src/services/notifications/NotificationService.ts`: object export of 8 thin `apiClient` wrappers — `getFeed` (cursor param + AbortSignal passthrough, `isAbortError` suppression on cancel), `getUnreadCount`, `markRead`, `markAllRead`, `createSubscription`, `listSubscriptions`, `updateSubscription`, `deleteSubscription`. Mirrors ModerationService exactly (try/catch → console.error + re-throw). The client never sends a uid (backend derives it from the verified token — T-12-06-03 accept).
- `src/types/navigation.ts`: `Notifications: undefined` + `NotificationSettings: undefined` added to `RootStackParamList`.
- `src/constants/translations.ts`: 30 notification keys added to BOTH RU and EN blocks (watch/save-search CTAs, toast/undo, screen titles, mark-all-read, mute-all, category toggles, cadence instant/daily-coming-soon, list headers, empty-state heading/body, feed/subscription error lines, daily-disabled hint, delete-confirm copy, `notificationPriceDropTitle` carrying `сом` / `KGS som`).
- `NotificationService.test.ts`: 16 assertions — verb/path/params/body per method, getFeed cursor + AbortSignal forward, abort re-throw without logging, plus the MOB-01 guardrail (reads AuthService.ts source, asserts zero notification/subscription/watch matches).

**Task 2 — NotificationContext + App.tsx wiring + SearchResults deeplink** (commit `673db79`)
- `src/context/NotificationContext.tsx`: `NotificationProvider` `useAuth`s, fetches unreadCount + first feed page in `refresh`, appends pages in `loadMore`, exposes optimistic `markRead`/`markAllRead` + subscription CRUD passthroughs. `prevUidRef` sentinel clears unreadCount/feed on `user.localId` transition (skip-on-mount). `useNotifications` throws the standard out-of-provider error.
- `App.tsx`: `<NotificationProvider>` inserted AFTER `<FavoritesProvider>`, immediately wrapping `<NavigationContainer>`; `Notifications` + `NotificationSettings` screens registered; `SearchResults: 'search'` added to `linking.config.screens` alongside the untouched `CarDetails: 'listing/:carId'` — the two whitelisted notification routing targets (T-12-06-04).
- `src/screens/NotificationsScreen.tsx` + `src/screens/NotificationSettingsScreen.tsx`: minimal placeholder default-exports (localized title only).
- `NotificationContext.test.tsx`: 4 assertions — NCEN-01 unreadCount drives badge, markRead decrement (NCEN-04), auto-clear on uid change, hook-outside-provider throw.

## Verification Results

- `npx jest src/services/notifications/ src/context/__tests__/NotificationContext.test.tsx __tests__/translation-parity.test.ts` → **3 suites, 20 passed**.
- `grep -c "notification\|subscription\|watch" src/services/AuthService.ts` → **0** (MOB-01 held).
- `grep -c "apiClient\." src/services/notifications/NotificationService.ts` → **8** (≥6).
- Both routes present in `navigation.ts`; both screen registrations in `App.tsx` (count == 2).
- `SearchResults: 'search'` in linking.config; `CarDetails: 'listing/:carId'` untouched.
- `prevUidRef` present in NotificationContext.tsx; `NotificationProvider` after FavoritesProvider wrapping NavigationContainer.
- KGS som confirmed in a notification string (RU `сом` line, EN `KGS som`).
- `npx tsc --noEmit` reports no errors in the non-test source files (App.tsx, NotificationContext.tsx, NotificationService.ts, both screens).

## Success Criteria

- NCEN-01: badge derives from context `unreadCount` (test-proven).
- NCEN-02/04: feed + read-state passthroughs exposed (refresh/loadMore/markRead/markAllRead).
- NCEN-03: linking config carries the SearchResults (saved-search/new_match) deeplink AND the CarDetails (watch) deeplink.
- NPRF-07: context works over pure REST regardless of push; feed-load failure is non-blocking.
- NI18N-03: all new strings RU/EN parity-clean, KGS som.

## Deviations from Plan

None — plan executed exactly as written (Rules 1-4 not triggered).

## Authentication Gates

None.

## Known Stubs

- `src/screens/NotificationsScreen.tsx` and `src/screens/NotificationSettingsScreen.tsx` are intentional PLACEHOLDER default-exports (render only the localized title). They exist solely to register the `Notifications` / `NotificationSettings` routes so App.tsx compiles. The real screens land in **12-08** (NotificationsScreen: feed, pull-to-refresh, mark-all-read, deep-link tap resolution) and **12-10** (NotificationSettingsScreen: mute/category/cadence controls, subscription management) — both Wave 5 — which overwrite these files. Documented per the plan's explicit instruction; not blocking work.

## TDD Gate Compliance

Both tasks are `tdd="true"`. `tdd_mode` is `false` in config (gate inactive for this phase), so RED/GREEN were not split into separate commits — the Wave-0 scaffolds (12-02) were the RED layer; this plan shipped the implementation and filled the scaffolds with real assertions atomically per task, with the suites proving GREEN. Both commits are `feat(...)`.

## Self-Check: PASSED

- FOUND: src/services/notifications/NotificationService.ts
- FOUND: src/context/NotificationContext.tsx
- FOUND: src/screens/NotificationsScreen.tsx
- FOUND: src/screens/NotificationSettingsScreen.tsx
- FOUND: commit 53daa2f
- FOUND: commit 673db79

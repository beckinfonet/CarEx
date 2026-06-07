---
phase: 12-notification-domain-in-app-center
plan: 10
subsystem: notifications (mobile preferences + subscription management)
tags: [mobile, notifications, settings, subscriptions, preferences, i18n, wave-5]
requires:
  - "12-06: NotificationContext subscription CRUD passthroughs (listSubscriptions/updateSubscription/deleteSubscription) + all RU/EN notification strings + NotificationSettings route"
  - "AuthService.updateBackendUser (PUT /api/users/:uid) for notificationPrefs profile persistence"
  - "AuthContext refreshUser (re-merges canonical backend user after a prefs write)"
provides:
  - "[MOB] NotificationSettingsScreen — master mute + per-category toggles, quiet-hours + daily-cap plumbing, My-saved-searches list (Instant selected / Daily disabled), My-watched-cars list, inline Alert.alert delete confirms"
  - "[MOB] ProfileScreen 'Notification settings' menu row → NotificationSettings (D-12, distinct from the MoreMenu feed entry)"
affects:
  - "Phase 14: quiet-hours + daily-cap values persisted here become the inputs the digest/scheduling enforcement reads"
  - "Phase 14: the Daily cadence becomes selectable once daily delivery ships (currently shown-but-disabled per D-10)"
tech-stack:
  added: []
  patterns:
    - "notificationPrefs persisted via the user-profile update path (updateBackendUser) — NOT the notification router (MOB-01 only forbids notification ROUTER calls on AuthService)"
    - "Optimistic local pref/subscription mutation with refreshUser/loadSubs rollback on failure"
    - "Daily-disabled guard: the Daily cadence chip is a disabled TouchableOpacity whose onPress surfaces the coming-soon hint and NEVER calls updateSubscription with cadence 'daily' (D-10/NSUB-03)"
key-files:
  created:
    - "src/screens/__tests__/NotificationSettingsScreen.test.tsx"
  modified:
    - "src/screens/NotificationSettingsScreen.tsx (overwrote 12-06 placeholder)"
    - "src/screens/ProfileScreen.tsx"
decisions:
  - "notificationPrefs (muteAll / savedSearchEnabled / watchEnabled / quietHours / dailyCap) persist through AuthService.updateBackendUser as User profile fields, then refreshUser() re-merges the canonical backend user into context — AuthContext exposes refreshUser (not setUser), so the screen reuses the existing re-fetch path rather than mutating context state directly."
  - "Daily cadence is a disabled TouchableOpacity (disabled prop + accessibilityState.disabled) whose onPress fires Alert.alert(t.dailyDisabledHint) — it can never set cadence 'daily'. Test proves both the disabled flag AND that pressing it does not call updateSubscription({cadence:'daily'}) (the load-bearing D-10/NSUB-03 invariant)."
  - "Quiet-hours (22:00-08:00) and daily-cap (default 3, chip selector 1/3/5/10) are PLUMBING ONLY in Phase 12 — present + persisted to notificationPrefs, NOT enforced (enforcement is Phase 14, D-16)."
  - "ProfileScreen row uses t.notificationSettings ('Настройки уведомлений'/'Notification settings'), deliberately distinct from the MoreMenu feed label t.notificationsMenuLabel ('Уведомления'/'Notifications') per D-12 — placed after the myOrders settings row, admin rows untouched."
metrics:
  duration: ~3m
  tasks: 2
  files: 3
  completed: 2026-06-07
---

# Phase 12 Plan 10: Notification Settings + Subscription Management Summary

Shipped the real `NotificationSettingsScreen` (overwriting the 12-06 placeholder): master mute + per-category toggles, quiet-hours and daily-cap plumbing persisted to `User.notificationPrefs`, a "My saved searches" list with the cadence selector (Instant selected accent / Daily disabled with the coming-soon hint per D-10), a "My watched cars" list with per-event summaries, and inline `Alert.alert` destructive delete confirms on both lists (D-11). Added the "Notification settings" row to `ProfileScreen` (Bell + ChevronRight → `NotificationSettings`), labeled distinctly from the MoreMenu feed entry (D-12).

## What Was Built

**Task 1 — NotificationSettingsScreen + test** (commit `16e70d4`)
- `src/screens/NotificationSettingsScreen.tsx`: full screen in D-11 order —
  1. Master-mute `Switch` (NPRF-01, reversible, no confirm).
  2. Per-category `Switch`es: saved-search + watch (NPRF-01, disabled when muted).
  3. Quiet-hours control (default 22:00–08:00, D-16) — plumbing only, persisted to `notificationPrefs.quietHours`, NOT enforced (NPRF-03).
  4. Daily-cap chip selector (1/3/5/10, default 3, D-16) — plumbing only, persisted to `notificationPrefs.dailyCap`, NOT enforced (NPRF-04).
  5. "My saved searches" list — criteria summary + cadence selector (Instant accent-selected / Daily disabled `cadenceDailyComingSoon` with `dailyDisabledHint` Alert on tap, D-10/NSUB-03) + inline `Trash2` delete via `Alert.alert` destructive confirm (`deleteSavedSearch*` copy, D-11).
  6. "My watched cars" list — car ref + per-event summary (price_drop/booked/sold/back_available, D-03) + inline delete via `Alert.alert` (`deleteWatchedCar*` copy, D-11).
  - Persistence: mute/category/quiet-hours/daily-cap → `AuthService.updateBackendUser(localId, { notificationPrefs })` then `refreshUser()`; subscription list/delete → `useNotifications` (`listSubscriptions`/`deleteSubscription`). All strings via `useLanguage().t`; theme tokens (`COLORS`/`SIZES`/`TYPOGRAPHY`); 44px (`SIZES.minTapTarget`) on every control.
- `src/screens/__tests__/NotificationSettingsScreen.test.tsx`: 5 react-test-renderer assertions — ≥3 `Switch`es (master + 2 categories, NPRF-01); Daily cadence rendered disabled/non-interactive; pressing Daily does NOT call `updateSubscription({cadence:'daily'})` (D-10 invariant); Instant option present-and-selected; delete affordance present for the seeded saved_search. Mocks `useNotifications` (seeds one saved_search), the user-profile update path, `useAuth`, navigation, and language.

**Task 2 — ProfileScreen "Notification settings" row** (commit `9fb4b81`)
- `src/screens/ProfileScreen.tsx`: added `Bell` to the lucide imports and a new menu item (`Bell` + `ChevronRight`) with `t.notificationSettings`, navigating to `NotificationSettings`. Placed after `myOrders`, before the conditional seller/broker rows; admin rows untouched. Label deliberately distinct from the MoreMenu feed entry (D-12).

## Verification Results

- `npx jest src/screens/__tests__/NotificationSettingsScreen.test.tsx` → **1 suite, 5 passed**.
- `npx jest ... __tests__/translation-parity.test.ts` → **2 suites, 9 passed** (RU/EN parity intact; no new strings added — all consumed keys shipped in 12-06).
- `grep -c "Switch" src/screens/NotificationSettingsScreen.tsx` → **6** (≥3: master mute + 2 categories).
- `grep "Alert.alert" src/screens/NotificationSettingsScreen.tsx` → delete-confirm flows + the daily-disabled hint present (NPRF-02, D-11).
- `grep "скоро|coming soon|disabled" …` → Daily cadence shown-but-disabled (`disabled` prop + `accessibilityState.disabled`, D-10).
- `grep "quietHours|22:00|dailyCap" …` → quiet-hours + daily-cap plumbing present (NPRF-03/04).
- `grep "useNotifications" …` → subscription list/edit/delete wiring present.
- `npx tsc --noEmit` → no errors in `NotificationSettingsScreen.tsx` or `ProfileScreen.tsx`.
- `grep "NotificationSettings" / "Bell" / "t.notificationSettings" src/screens/ProfileScreen.tsx` → navigate target + icon + distinct label confirmed (D-12).

## Success Criteria

- NPRF-01: master mute + per-category (saved-search/watch) toggles — present, test-proven (≥3 Switches).
- NPRF-02: subscription list + delete via `useNotifications`; cadence-edit selector rendered (edit limited to Instant since Daily is disabled per D-10).
- NPRF-03: quiet-hours control present + persisted (plumbing, not enforced).
- NPRF-04: daily-cap control present + persisted (plumbing, not enforced).
- NSUB-03 / D-10: cadence selector — Instant selected (accent), Daily disabled (coming-soon), Daily not selectable — test-proven.
- D-11: inline `Alert.alert` destructive confirms on both lists.
- D-12: ProfileScreen row reaches NotificationSettings, labeled distinctly from the feed entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AuthContext exposes `refreshUser`, not `setUser`**
- **Found during:** Task 1 (tsc gate)
- **Issue:** The plan's interface note suggested persisting prefs then updating context; the initial implementation used `setUser` which is not on `AuthContextType` (TS2339).
- **Fix:** Switched the post-persist context update to `refreshUser()` (the public re-fetch path that re-merges the canonical backend user incl. the new `notificationPrefs`), and updated the test's `useAuth` mock to expose `refreshUser`. Also tightened the test's `AuthService.updateBackendUser` mock signature to a fixed `(uid, data)` arity to clear a TS2556 spread-argument error.
- **Files modified:** src/screens/NotificationSettingsScreen.tsx, src/screens/__tests__/NotificationSettingsScreen.test.tsx
- **Commit:** 16e70d4

## Authentication Gates

None.

## Known Stubs

- Quiet-hours and daily-cap are **intentional plumbing-only** controls: the values persist to `User.notificationPrefs` but are NOT enforced in Phase 12 (enforcement is Phase 14, per D-16 and the milestone roadmap). The quiet-hours control renders the persisted window read-only (default 22:00–08:00) rather than a full time-picker, since no delivery path consumes it yet. The Daily cadence is shown-but-disabled (D-10) until daily delivery ships in Phase 14. All three are documented as intentional and resolved by Phase 14 — not blocking the plan's goal (the preferences/subscription-management surface is fully functional for the live behaviors: mute, category toggles, instant saved-search subscriptions, watch subscriptions, and delete).

## TDD Gate Compliance

Task 1 is `tdd="true"`. `tdd_mode` is `false` in config (gate inactive for this phase), so RED/GREEN were not split into separate commits — the test and implementation shipped atomically in `16e70d4` (`feat`), with the 5-assertion suite proving GREEN (including the load-bearing D-10 Daily-disabled invariant).

## Self-Check: PASSED

- FOUND: src/screens/NotificationSettingsScreen.tsx
- FOUND: src/screens/__tests__/NotificationSettingsScreen.test.tsx
- FOUND: src/screens/ProfileScreen.tsx (Notification settings row)
- FOUND: commit 16e70d4
- FOUND: commit 9fb4b81

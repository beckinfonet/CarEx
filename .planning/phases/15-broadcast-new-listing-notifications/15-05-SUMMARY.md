---
phase: 15
plan: 05
subsystem: mobile-notifications
tags: [notifications, preferences, i18n, react-native, toggle]
repo: mobile
repo_path: /Users/beckmaldinVL/development/mobileApps/carEx
requires:
  - "15-02 backend newListingEnabled pref + PUT /api/users/:uid persistence (allowlist)"
provides:
  - "New Listings notification toggle on NotificationSettingsScreen (default ON, opt-out)"
  - "categoryNewListings RU/EN label"
affects:
  - "src/screens/NotificationSettingsScreen.tsx"
  - "src/constants/translations.ts"
tech-stack:
  added: []
  patterns:
    - "Mirror existing per-category toggle (state + useCallback handler + persistPrefs) — no new networking method (MOB-01 / milestone constraint)"
    - "?? true default = D-11 never-touched=enabled (legacy absent field renders ON)"
key-files:
  created: []
  modified:
    - "src/screens/NotificationSettingsScreen.tsx"
    - "src/constants/translations.ts"
    - "src/screens/__tests__/NotificationSettingsScreen.test.tsx"
decisions:
  - "Reused persistPrefs → AuthService.updateBackendUser path (no new AuthService method); milestone forbids new networking libs/methods"
  - "Toggle defaults ON via prefs.newListingEnabled ?? true so a legacy user doc with the field absent renders enabled (D-11)"
  - "Disabled under muteAll, mirroring the watch toggle exactly"
metrics:
  duration: ~2min
  completed: 2026-06-10
  tasks: 2
  files: 3
  commits: 2
---

# Phase 15 Plan 05: New Listings Notification Toggle Summary

Adds a third "New Listings" per-category toggle to `NotificationSettingsScreen`, defaulting ON (opt-out per Req 5 / D-11), persisting `notificationPrefs.newListingEnabled` through the existing `persistPrefs → AuthService.updateBackendUser` path — the only mobile work in phase 15.

## What Was Built

- **NotificationPrefs interface** extended with `newListingEnabled?: boolean` (sibling of `watchEnabled`).
- **State** `const [newListingEnabled, setNewListingEnabled] = useState(prefs.newListingEnabled ?? true)` — the `?? true` is the D-11 never-touched=enabled default, so a legacy user doc with the field absent renders the toggle ON.
- **Handler** `onToggleNewListing` — sets local state and calls `persistPrefs({ newListingEnabled: value })`, reusing the existing optimistic-merge persistence (no new AuthService method).
- **Render row** added after the Watched-cars row in the per-category group, using `t.categoryNewListings`, `value={newListingEnabled}`, `disabled={muteAll}`, `onValueChange={onToggleNewListing}`, same trackColor. (Added `rowDivider` to the now-middle Watched-cars row.)
- **i18n** `categoryNewListings` added to both blocks: RU `'Новые объявления'`, EN `'New listings'` (RU-first, generic label — safe for the KGS/Kyrgyzstan audience, no Russia-specific terms).
- **Tests** two new cases extend the existing screen test (reusing its mocks): default-ON render for a never-set user, and persist `newListingEnabled:false` on toggle-off. A `findSwitchByLabel` helper locates a toggle's `Switch` by its own row label (matching the immediate toggleRow only, to avoid colliding with sibling rows in the shared `.group`).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add New Listings toggle + categoryNewListings label | `9318741` | NotificationSettingsScreen.tsx, translations.ts |
| 2 | Extend screen test — default-ON render + persist-on-toggle | `7c90bb8` | NotificationSettingsScreen.test.tsx |

This work is committed in the **mobile (carEx) repo** on branch `main` — distinct from the backend SHAs in 15-01..15-04.

## Verification

- `npx jest src/screens/__tests__/NotificationSettingsScreen.test.tsx` → **9/9 GREEN** (7 pre-existing + 2 new).
- `npx tsc --noEmit -p tsconfig.json` filtered to the edited files → **TS-CLEAN** (no new type errors).
- `npm run lint` on the edited files → only the **3 pre-existing, documented/deferred** errors remain (`updateSubscription` unused + `prefs` useMemo in the screen; `TouchableOpacity` unused import in the test — all present at HEAD before this plan). **No new lint errors introduced.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test helper initially matched the wrong Switch**
- **Found during:** Task 2 (first `npx jest` run RED)
- **Issue:** The first `findSwitchByLabel` implementation walked up the component tree into the shared `.group` View, so it matched the Saved-searches Switch (asserted `savedSearchEnabled:false` instead of `newListingEnabled:false`).
- **Fix:** Constrained the match to the Switch's **immediate** toggleRow parent's `Text` children only (no ascent into the group), so each toggle resolves to its own label row.
- **Files modified:** src/screens/__tests__/NotificationSettingsScreen.test.tsx
- **Commit:** `7c90bb8` (caught and fixed before the Task 2 commit; not a separate commit)

## TDD Gate Compliance

Both tasks are `tdd="true"`. This plan is two tightly-coupled UI+test tasks where the implementation (Task 1) precedes its dedicated screen test (Task 2) — the verification gate is Task 2's test turning GREEN against Task 1's implementation, which it does (9/9). The persist-on-toggle test exercised a real defect (wrong-Switch match) before passing, satisfying the RED→GREEN intent.

## Notes

- The toggle is **inert end-to-end** until the backend PUT persistence fix (15-02 R-02, already landed) is deployed to Railway — but the mobile change is independent and committable now (confirmed by the plan).
- No images involved → OptimizedImage convention N/A.

## Self-Check: PASSED

- FOUND: src/screens/NotificationSettingsScreen.tsx (contains `newListingEnabled`)
- FOUND: src/constants/translations.ts (contains `categoryNewListings` in RU + EN)
- FOUND: src/screens/__tests__/NotificationSettingsScreen.test.tsx (2 new tests)
- FOUND commit: `9318741`
- FOUND commit: `7c90bb8`

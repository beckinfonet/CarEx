---
phase: 13-fcm-push-transport-native
plan: 05
subsystem: notifications (mobile push permission UX)
tags: [push, permissions, i18n, uat, npfr-06, nprf-07]
requires:
  - 13-04 (PushService.registerToken, pushPermission.ts isolation seam)
  - 13-02 (backend generic PII-safe push copy)
provides:
  - contextual fire-once push permission pre-prompt (D-04/D-05/D-06)
  - denied-permission recovery row on NotificationSettingsScreen (D-09/D-10/D-11)
  - 13-HUMAN-UAT.md real-device checklist (NPUSH-01/03/06/07)
affects:
  - src/components/notifications/WatchButton.tsx
  - src/components/notifications/SaveSearchBar.tsx
  - src/screens/NotificationSettingsScreen.tsx
tech-stack:
  added: []
  patterns:
    - shared fire-once AsyncStorage flag (push_preprompt_seen) across two controls
    - RNFB messaging() calls confined to prePrompt.ts + pushPermission.ts
    - live OS status refresh on AppState 'active' + navigation focus
key-files:
  created:
    - src/components/notifications/prePrompt.ts
    - src/components/notifications/PushPrePromptModal.tsx
    - src/components/notifications/__tests__/prePrompt.test.tsx
    - .planning/phases/13-fcm-push-transport-native/13-HUMAN-UAT.md
  modified:
    - src/constants/translations.ts
    - src/components/notifications/WatchButton.tsx
    - src/components/notifications/SaveSearchBar.tsx
    - src/screens/NotificationSettingsScreen.tsx
    - src/screens/__tests__/NotificationSettingsScreen.test.tsx
decisions:
  - "Pre-prompt rendered by a shared PushPrePromptModal so Watch + Save-search show identical copy"
  - "Fire-once flag set on ANY resolution (accept/decline/OS-deny) so it fires exactly once"
  - "Recovery row hidden until live status is read (pushEnabled !== null) to avoid a flash"
requirements: [NPRF-06]
metrics:
  duration: ~8m
  completed: 2026-06-07
  tasks_completed: 3
  tasks_total: 4
---

# Phase 13 Plan 05: Contextual Push Permission Pre-Prompt + Denied-Recovery UX + Real-Device UAT Summary

Fire-once soft push-permission pre-prompt (never on launch, single ask across Watch + Save-search), a live-status denied-permission recovery row on NotificationSettings that deep-links to OS Settings, and the real-device HUMAN-UAT checklist that gates the phase.

## What shipped (Tasks 1-3 of 4)

**Task 1 (TDD) — Contextual fire-once pre-prompt (NPRF-06, D-04/D-05/D-06).**
- New `src/components/notifications/prePrompt.ts`: shared helper owning the `push_preprompt_seen` AsyncStorage flag and the request/register flow. `shouldShowPrePrompt()` / `markPrePromptSeen()` / `acceptPrePrompt()` / `declinePrePrompt()`.
  - `acceptPrePrompt` ("Включить") → Android `POST_NOTIFICATIONS` (API 33+) → `messaging().requestPermission()` → on grant (AUTHORIZED|PROVISIONAL) → `messaging().getToken()` → `PushService.registerToken`. Sets the seen flag on ANY resolution (grant/deny) in `finally`.
  - `declinePrePrompt` ("Не сейчас") → persists the seen flag only, never touches OS permission, never auto-re-asks (D-05).
- New `src/components/notifications/PushPrePromptModal.tsx`: shared soft modal with plain RU-first copy (D-06) — NOT the UNHINGED voice. Reuses existing `notNow` key.
- Wired into both `WatchButton.handlePress` and `SaveSearchBar.handleSave`: on the FIRST successful `createSubscription`, if `shouldShowPrePrompt()` is true, the modal appears. The shared flag makes the single ask cover BOTH controls (Watch-then-Save and vice versa).
- `src/constants/translations.ts`: added `pushPrePromptTitle`, `pushPrePromptBody`, `pushEnable`, `pushStatusOn`, `pushStatusOff`, `pushEnableInSettings` — all with RU+EN parity (verified: 2 occurrences each). `notNow` reused, not duplicated.
- `prePrompt.test.tsx` (9 tests, mocks RNFB + AsyncStorage via jest.setup): fire-once, single-ask-covers-both, "Не сейчас" persists, "Включить" → requestPermission → register on grant, PROVISIONAL=granted, DENIED does not register, NEVER requested at mount.
- TDD gates: RED `fcfd42b` (test fails — module missing), GREEN `81a2c9d` (implementation).

**Task 2 — Denied-permission recovery row (NPRF-07, D-09/D-10/D-11).**
- `NotificationSettingsScreen.tsx`: new top row reads live OS status via `messaging().hasPermission()` (AUTHORIZED|PROVISIONAL = on, D-11). When OFF, the row is tappable and calls `Linking.openSettings()` (D-10 — app can't re-trigger the native dialog post-deny). Re-reads live status on `AppState` 'active' AND navigation `focus` so returning from OS Settings refreshes the row. Row is hidden until first read (`pushEnabled !== null`) to avoid a flash.
- Recovery surface lives ONLY here (D-09 — no feed banner). The Phase-12 in-app center is untouched → no dead-end (NPRF-07).
- Added 2 tests (off → tappable → openSettings; on → disabled, no openSettings). All 7 NotificationSettings tests green.

**Task 3 — Real-device HUMAN-UAT checklist.**
- `.planning/phases/13-fcm-push-transport-native/13-HUMAN-UAT.md` (164 lines): one signed-off item each for NPUSH-01 (static-frameworks Release archive runs + Stripe checkout, cross-ref 13-SPIKE-RESULT.md ✅), NPUSH-03/08 (push arrives with PII-safe lock-screen body — explicit no make/model/price/seller/location, D-08b), NPUSH-06 (foreground/background/quit), NPUSH-07 (cold-start tap → correct CarDetails), plus NPRF-06/07 (pre-prompt timing + recovery). Phase-gate note: both Jest suites green + checklist signed before `/gsd-verify-work`.

## Test results (actual)

- `npx jest .../prePrompt.test.tsx` → **9 passed**.
- `npx jest .../NotificationSettingsScreen.test.tsx` → **7 passed**.
- HUMAN-UAT verify → file exists + NPUSH-07 present → PASS.
- Full `npm test` → **537 passed, 17 failed, 554 total** (5 failing suites). The 17 failures are the known pre-existing baseline (moderation.e2e, CarDetailsScreen.listingBanner, App.test "renders correctly", coverage-manifest.audit self-audit, _fixtures empty-suite) — none push-related. Passing count rose 526 → 537 (+11 = 9 prePrompt + 2 recovery).
- RU/EN parity: all 6 new keys present in both blocks (verified programmatically).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Removed pre-existing unused `View` import in WatchButton.tsx**
- **Found during:** Task 1 (linting a file I was editing)
- **Issue:** `View` was imported but never used (pre-existing, but in a file I modified — would fail `npm run lint`).
- **Fix:** Removed it from the import.
- **Commit:** `81a2c9d`

### Out-of-scope (logged, not fixed)

Three pre-existing lint errors remain in files I touched but were present at HEAD and are unrelated to this plan (executor scope boundary): `NotificationSettingsScreen.tsx` line 95 `updateSubscription` unused + line 99 `prefs` exhaustive-deps; `NotificationSettingsScreen.test.tsx` line 3 `TouchableOpacity` unused. Logged to `deferred-items.md`.

## Known Stubs

None that block the plan goal. `APP_VERSION = 'unknown'` in prePrompt.ts is intentional (RN exposes no marketing version without a native module; CLAUDE.md forbids new libs — matches the 13-04 pushPermission.ts precedent; backend treats appVersion as opaque metadata).

## Status: PENDING UAT GATE

Tasks 1-3 complete and committed. Task 4 is a `checkpoint:human-verify` blocking gate — the operator must run 13-HUMAN-UAT.md on a real device and sign off. The plan completes only after the human UAT resolves (resume signal: "uat passed").

## Self-Check: PASSED

All created files present (prePrompt.ts, PushPrePromptModal.tsx, prePrompt.test.tsx, 13-HUMAN-UAT.md, 13-05-SUMMARY.md). All commits present (fcfd42b RED, 81a2c9d GREEN, fa5fde4 Task 2, 65030b2 Task 3).

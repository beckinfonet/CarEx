---
phase: 12-notification-domain-in-app-center
plan: 02
subsystem: notifications (mobile test scaffolds)
tags: [test-scaffold, wave-0, notifications, i18n-parity]
requires:
  - "Phase 5 Wave-0 scaffold pattern (Plan 05-01) as the import-the-target template"
  - "Existing __tests__/translation-parity.test.ts harness (set-equality)"
provides:
  - "Runnable <automated> verify targets for Wave-2/Wave-3 mobile plans (compile-time wiring checks)"
  - "Locked car._id || car.id || carId watch-key contract at the scaffold layer (NSUB-04)"
  - "Confirmed-green parity harness that auto-covers future notification keys (NI18N-02/03)"
affects:
  - "src/services/notifications/* (Wave 2 — NotificationService)"
  - "src/context/NotificationContext.tsx (Wave 2)"
  - "src/components/notifications/WatchButton.tsx (Wave 3)"
tech-stack:
  added: []
  patterns:
    - "Wave-0 collectible scaffold: import the not-yet-built module + test.todo bodies"
    - "Parity via set-equality (no hardcoded key count) auto-covers new keys"
key-files:
  created:
    - "src/services/notifications/__tests__/NotificationService.test.ts"
    - "src/context/__tests__/NotificationContext.test.tsx"
    - "src/components/notifications/__tests__/WatchButton.test.tsx"
  modified: []
decisions:
  - "translation-parity.test.ts left byte-unmodified — its existing green state + set-equality auto-covers Wave-2 notification keys; no whitespace touch needed"
  - "Watch-key fallback order written verbatim into a test.todo string so the NSUB-04/D-04 contract is grep-visible before any implementation (T-12-02-01 mitigation)"
  - "MOB-01 guardrail locked as a NotificationService test.todo so notification HTTP cannot regress onto AuthService (T-12-02-02 mitigation)"
metrics:
  duration: ~5m
  tasks: 2
  files: 3
  completed: 2026-06-06
---

# Phase 12 Plan 02: Mobile Wave-0 Notification Test Scaffolds Summary

Created three mobile Wave-0 jest scaffolds (NotificationService, NotificationContext, WatchButton) that import their not-yet-built target modules as compile-time wiring checks and enumerate VALIDATION behaviors as `test.todo`, and confirmed the existing RU/EN translation-parity harness is green so future notification keys are auto-covered by set-equality.

## What Was Built

**Task 1 — NotificationService + NotificationContext scaffolds** (commit `5c51359`)
- `src/services/notifications/__tests__/NotificationService.test.ts`: `import { NotificationService } from '../NotificationService'` wiring check + 7 `test.todo` — getFeed (cursor passthrough), getUnreadCount, markRead, markAllRead, createSubscription, deleteSubscription, plus the MOB-01 guardrail intent (notification HTTP stays off AuthService).
- `src/context/__tests__/NotificationContext.test.tsx`: imports `NotificationProvider` + `useNotifications` + 4 `test.todo` — NCEN-01 unread-count-derives-badge, NPRF-07 stub-functional feed, prevUidRef auto-clear on `user.localId` transition (mirrors FavoritesContext.tsx:55-63), hook-outside-provider guard.

**Task 2 — WatchButton scaffold + parity baseline** (commit `abee451`)
- `src/components/notifications/__tests__/WatchButton.test.tsx`: `import WatchButton from '../WatchButton'` wiring check + 4 `test.todo` — Bell-not-Heart (D-01), one-tap-all-4-events (D-03), and the load-bearing `car._id || car.id || carId` watch-key contract (NSUB-04 / D-04) written verbatim so it is grep-visible.
- `__tests__/translation-parity.test.ts`: confirmed green as the baseline (left unmodified). Set-equality means new notification keys added in Wave 2 (Plan 12-06) are auto-covered.

## Verification Results

- `npx jest --listTests` discovers all 3 new scaffolds (confirmed — full paths listed for NotificationService, NotificationContext, WatchButton).
- `npx jest __tests__/translation-parity.test.ts` → 4 passed / exit 0 (baseline green, run twice: pre-work and at Task 2).
- Each scaffold imports its target module (grep-confirmed) and locks its contract as `test.todo` (counts: 7 / 4 / 4, all >= plan thresholds).
- `grep -n "car._id"` in WatchButton.test.tsx confirms the NSUB-04 watch-key lock is scaffolded.

Note: the scaffold `import`s of the not-yet-built modules are intentionally red at run time at this wave — that is the wiring check. They turn green when Wave 2/Wave 3 ship the target modules. `--listTests` (used by the plan's verify commands) does not execute imports, so discovery passes now.

## Success Criteria

- NCEN-01: context-derived unread badge behavior scaffolded (NotificationContext.test.tsx todo).
- NSUB-04: watch-key fallback contract locked at scaffold layer (WatchButton.test.tsx todo, grep-visible).
- NPRF-07: in-app-functional-with-stub behavior scaffolded (NotificationContext.test.tsx todo).
- NI18N-02/03: parity harness confirmed green, auto-covers new keys via set-equality.

## Deviations from Plan

None — plan executed exactly as written. The plan's optional whitespace touch on `translation-parity.test.ts` was not needed; the file was left byte-unmodified per the plan's preferred path (rely on existing green state).

## Requirements Completed

NCEN-01, NPRF-07, NSUB-04, NI18N-02, NI18N-03 (scaffold-layer coverage; full implementation lands in Wave 2/Wave 3 plans).

## Self-Check: PASSED

- FOUND: src/services/notifications/__tests__/NotificationService.test.ts
- FOUND: src/context/__tests__/NotificationContext.test.tsx
- FOUND: src/components/notifications/__tests__/WatchButton.test.tsx
- FOUND: commit 5c51359
- FOUND: commit abee451

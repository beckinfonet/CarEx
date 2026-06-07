---
phase: 12-notification-domain-in-app-center
plan: 01
subsystem: notification-domain
tags: [backend, models, mongoose, test-scaffold, i18n, wave-0]
requires: []
provides:
  - "Notification/Subscription/DeviceToken Mongoose models"
  - "User.language + User.notificationPrefs schema fields"
  - "9 Wave-0 backend jest scaffolds (runnable verify targets for 12-03/04/05)"
affects:
  - "[BE] src/models/User.js"
  - "[BE] src/notifications/ (new dir)"
tech-stack:
  added: []
  patterns:
    - "Phase 5 Wave-0 scaffold pattern (guarded require of not-yet-built module + test.todo)"
    - "User.js inline subdoc convention (moderationStatus analog) for notificationPrefs"
key-files:
  created:
    - "[BE] src/models/Notification.js"
    - "[BE] src/models/Subscription.js"
    - "[BE] src/models/DeviceToken.js"
    - "[BE] src/notifications/__tests__/guards.test.js"
    - "[BE] src/notifications/__tests__/actorExclusion.test.js"
    - "[BE] src/notifications/__tests__/dedup.test.js"
    - "[BE] src/notifications/__tests__/matchSavedSearches.test.js"
    - "[BE] src/notifications/__tests__/priceDirection.test.js"
    - "[BE] src/notifications/__tests__/router.test.js"
    - "[BE] src/notifications/__tests__/feedCursor.test.js"
    - "[BE] __tests__/notification-translations-parity.test.js"
    - "[BE] __tests__/userLanguage.test.js"
  modified:
    - "[BE] src/models/User.js"
decisions:
  - "NOTIFICATION_RETENTION_DAYS exported as a named property on the Notification model export (module.exports = model; model.NOTIFICATION_RETENTION_DAYS = 90) — keeps a single require surface; grep + node both confirm the 90-day NDOM-06 constant."
  - "Wave-0 scaffolds guard the target-module require with try/catch on MODULE_NOT_FOUND so files stay jest-collectible (report test.todo, never crash collection) while still recording the load-bearing wiring import for Wave 1."
  - "userLanguage.test.js imports the real User model (exists after Task 2) and ships a GREEN wiring assertion on the language enum, plus test.todo for the PUT handler behavior that lands in a later plan."
metrics:
  duration: "~6m"
  completed: "2026-06-06"
  tasks: 3
  files: 12
---

# Phase 12 Plan 01: Notification Domain Foundation Summary

Backend data contracts + Wave-0 test targets for Phase 12: three notification-domain Mongoose models, additive `User.language` + `notificationPrefs` fields, and nine runnable jest scaffolds that downstream backend plans (12-03/04/05) will fill in.

## What Was Built

**Task 1 — Three notification-domain models** (`cee8335`)
- `Notification.js`: fields uid/kind/titleKey/bodyKey/params/data{deeplink,carId,searchId}/read/channels(`['in_app']`)/digestPending/dedupeKey/createdAt. Four indexes: `{uid,createdAt:-1}` (feed + 90-day prune scan), `{uid,read}` (unread count), `{digestPending}` (Phase 14 worker), `{dedupeKey}` (NDOM-03 dedup). Exports `NOTIFICATION_RETENTION_DAYS = 90` (NDOM-06 policy defined; prune cron runs Phase 14).
- `Subscription.js`: `criteria.makeId`/`criteria.modelId` typed `Schema.Types.ObjectId` (Pitfall 5 guard — matches `Car.makeId/modelId`); `kind` enum lockstep with schemas.js; `cadence` default `'instant'`; `events:[String]`; `active` default true. Three indexes: match `{kind,active,'criteria.makeId','criteria.modelId'}`, watch lookup `{kind,carId,active}`, manage `{uid,active}`.
- `DeviceToken.js`: defined now, populated Phase 13; `token` globally unique; `{uid}` index.

**Task 2 — User model additions** (`16b61ce`)
- `language: { enum:['RU','EN'], default:'RU' }` (NI18N-01).
- `notificationPrefs` subdoc mirroring the inline `moderationStatus` shape: muteAll(false), savedSearchEnabled(true), watchEnabled(true), quietHours{start:'22:00',end:'08:00'}, dailyCap(3) — D-16 defaults (NPRF-03/04 plumbing; enforcement is Phase 14).
- Diff is 16 insertions / 0 deletions — strictly additive; no existing field touched.

**Task 3 — Nine Wave-0 backend test scaffolds** (`d51364e`)
- 7 in `src/notifications/__tests__/` (guards, actorExclusion, dedup, matchSavedSearches, priceDirection, router, feedCursor) + 2 root (`notification-translations-parity`, `userLanguage`).
- Each imports its target module (guarded require); 31 `test.todo` entries enumerate the VALIDATION behaviors. Suite runs green: 9 passed (wiring checks) + 31 todo, no collection crashes.

## Verification

- `node -e require` on all three models: `models load OK`; `NOTIFICATION_RETENTION_DAYS = 90`.
- `User.schema.path('language')`: `language OK` (enum RU,EN; default RU). quietHours defaults count = 2; dailyCap default 3 present.
- `npx jest --listTests`: all 9 scaffolds discovered. Full Wave-0 run: `9 passed, 31 todo`.

## Deviations from Plan

None — plan executed exactly as written. (The `NOTIFICATION_RETENTION_DAYS` export approach — property on the model export — is the implementation detail the plan left to the executor; it satisfies both the grep and node acceptance checks.)

## Authentication Gates

None.

## Known Stubs

- `DeviceToken` model is intentionally defined-but-unpopulated in Phase 12 (RESEARCH OQ#1 / NDOM-01). No write/read path exists until Phase 13 FCM transport. Documented in-file; not a blocking stub.
- The 31 `test.todo` placeholders are intentional Wave-0 RED targets, filled in by plans 12-03/04/05. Their target modules (`notificationService`, `matchSavedSearches`, `router`, `translations`) do not yet exist — the guarded require records the wiring import.

## Self-Check: PASSED

- Files: all 12 created/modified files confirmed present in `carEx-services`.
- Commits: `cee8335`, `16b61ce`, `d51364e` all found in backend repo git log.

---
phase: 15-broadcast-new-listing-notifications
plan: 03
subsystem: backend-i18n
tags: [notifications, broadcast, i18n, translations, push-copy, pii-safe, backend, ru-en-parity]

# Dependency graph
requires:
  - phase: 15-broadcast-new-listing-notifications
    plan: 01
    provides: "push-copy-parity.test.js + notification-translations-parity.test.js parity guards (auto-cover the new push_ key)"
  - phase: 13-fcm-push-transport
    provides: "renderGenericPush(key, lang) push_ auto-prefix resolver; push_* generic copy pattern"
provides:
  - "RU+EN push_new_listing broadcast push copy (category title + canonical param-free body) — Req 7 / D-08"
  - "RU+EN in-app new_listing copy distinct from saved-search new_match — Req 7"
affects: [15-04, translations.js, fcm-broadcast-branch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive push_* + in-app key pair mirroring the existing push_new_match shape (PII-free, zero {param} tokens)"
    - "Broadcast keys named literally 'new_listing' / 'push_new_listing' — NOT routed through KEYS_BY_EVENT.new_listing (that stays mapped to new_match for the saved-search fan-out)"

key-files:
  created: []
  modified:
    - "carEx-services/src/notifications/translations.js"

key-decisions:
  - "Broadcast copy is generic/informational (D-09 — not personality-tier-aware; server push carries no tier signal). RU 'Новые объявления / Появились новые авто. Откройте, чтобы посмотреть.'; EN 'New listings / New cars just landed. Open to take a look.'"
  - "Both the in-app new_listing and push_new_listing bodies are identical generic copy with ZERO interpolation tokens — no make/model/price/seller/location (D-08 / T-15-06 lock-screen PII mitigation)"
  - "Russia-neutral / KGS-audience wording naturally satisfied — copy is generic so no geo/regulatory terms (ПТС/ЦБ/etc.) arise"
  - "Purely additive: existing new_match copy and the notificationService KEYS_BY_EVENT.new_listing→new_match mapping left untouched"

requirements-completed: ["Req 7"]

# Metrics
metrics:
  duration: ~4min
  tasks: 1
  files: 1
  completed: 2026-06-10
---

# Phase 15 Plan 03: Broadcast New-Listing Copy (RU/EN) Summary

Added the generic, PII-free broadcast copy that 15-04's broadcast branch will render: a `push_new_listing` lock-screen push category (title + canonical param-free body) plus an in-app `new_listing` entry distinct from the saved-search `new_match` copy — both at strict RU/EN parity with zero interpolation tokens. Single-file, backend-repo-only (carEx-services).

## Backend Repo Commit (carEx-services, branch `main`)

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | `2ede0fd` | feat(15-03): add push_new_listing + in-app new_listing copy (RU+EN, PII-free) |

The code commit lives in `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (not carEx). Only this SUMMARY + STATE/ROADMAP are committed in carEx.

## What Was Built

### Task 1 — `push_new_listing` + in-app `new_listing` copy (translations.js)

Four additive entries (two keys × RU/EN), no existing copy touched:

- **In-app `new_listing`** (after `back_available` in each block):
  - RU: `{ title: 'Новые объявления', body: 'Появились новые авто. Откройте, чтобы посмотреть.' }`
  - EN: `{ title: 'New listings', body: 'New cars just landed. Open to take a look.' }`
- **Push `push_new_listing`** (after `push_back_available` in each block):
  - RU: `{ title: 'Новые объявления', body: 'Появились новые авто. Откройте, чтобы посмотреть.' }`
  - EN: `{ title: 'New listings', body: 'New cars just landed. Open to take a look.' }`

15-04 will resolve the push via `fcm.send({ titleKey:'new_listing' })` → `renderGenericPush('new_listing')` (the `push_` prefix is auto-applied), and write in-app rows keyed `new_listing`. Tone is neutral/informational (D-09); copy is Russia-neutral and generic so no geo/regulatory or KGS-currency wording was needed.

## Verification Results

| Check | Result |
| ----- | ------ |
| `npx jest __tests__/push-copy-parity.test.js __tests__/notification-translations-parity.test.js` | GREEN — 17/17 passed (2 suites) |
| grep `push_new_listing` in translations.js | present in BOTH RU (line 73) and EN (line 130) blocks |
| grep in-app `new_listing:` in translations.js | present in BOTH RU (line 53) and EN (line 118) blocks |
| PII-token scan (make/model/price/seller) in new copy | none — only a code-comment match, no copy match |
| `new_match` / `KEYS_BY_EVENT.new_listing` mapping | untouched (purely additive) |

The `push-copy-parity.test.js` guard scans all `push_*` keys and fails on key drift or any `{param}` token — it auto-covered the new `push_new_listing` key (no new test file needed), satisfying T-15-06 (lock-screen PII mitigation).

## Threat Mitigation

- **T-15-06 (PII on lock screen):** Mitigated. `push_new_listing` copy carries zero `{param}` tokens and no make/model/price/seller/location; the parity test bans `{param}` tokens in push copy — verified GREEN.

## Deviations from Plan

None - plan executed exactly as written. The exact RU/EN copy strings, key names, and placement all matched the plan's `<action>` block verbatim.

## Self-Check: PASSED
- SUMMARY file: FOUND (.planning/phases/15-broadcast-new-listing-notifications/15-03-SUMMARY.md)
- Backend commit `2ede0fd`: FOUND

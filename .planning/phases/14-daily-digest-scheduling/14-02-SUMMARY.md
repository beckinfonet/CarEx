---
phase: 14-daily-digest-scheduling
plan: 02
subsystem: backend-notifications
tags: [fcm, push, digest, i18n, pluralization, jest, backend, pii]

# Dependency graph
requires:
  - phase: 13-fcm-push-transport-native
    provides: "fcm.send() real fan-out (sendEachForMulticast loop, PRUNE_CODES/pruneToken, bounded jittered backoff, never-throw) that sendDigest reuses"
  - phase: 14-daily-digest-scheduling
    plan: 01
    provides: "translations.renderDigest(lang, count) + pluralizeRu — the count-only PII-safe digest copy surface"
provides:
  - "fcm.sendDigest({ uid, count, lang, data }) — sibling to send(); renders count-bearing digest_title and fans out ONE push per user"
  - "shared fanOut() core in fcm.js (token fetch + bounded retry/backoff + prune + never-throw) reused by both send() and sendDigest()"
  - "deeplinkOnly() payload-sanitizer shared by both send paths (deeplink-only PII guarantee)"
  - "digest.test.js NDIG-03 row converted from test.todo into real sendDigest assertions"
affects: [14-03, daily-digest-send-path, digest-flush]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling send-path fork: a deliberately param-free send() (PII-safe, NPUSH-08) and a count-bearing sendDigest() share a fanOut() core but own their own copy/PII policy — the core renders NO copy and sanitizes NO data, callers do"
    - "deeplinkOnly(data) centralizes the `data.deeplink ? { deeplink } : {}` strip so both paths cannot diverge on the PII guarantee"

key-files:
  created: []
  modified:
    - "carEx-services/src/notifications/push/fcm.js"
    - "carEx-services/src/notifications/__tests__/digest.test.js"

key-decisions:
  - "Extracted a shared fanOut(uid, notification, payloadData) helper rather than copy-pasting the retry/prune loop — send() now delegates to it with identical behavior (existing fcm.test.js stays green untouched), and sendDigest() delegates with count-bearing copy"
  - "fanOut() owns NO copy and NO PII policy: each caller renders its own { title, body } and passes its own sanitized payloadData, so send() keeps renderGenericPush (param-free) while sendDigest() uses renderDigest (count only)"
  - "deeplinkOnly() shared helper keeps the deeplink-only strip identical across both paths (T-14-02-01)"
  - "digest.test.js mocks firebase-admin + DeviceToken file-wide (mirrors fcm.test.js harness); the existing real-translations pluralize/renderDigest tests are unaffected because they never touch those mocked modules"

patterns-established:
  - "Count is a non-PII integer and is the ONLY value interpolated into digest copy; data payload stays deeplink-only — same lock-screen guarantee as NPUSH-08"

requirements-completed: [NDIG-03]

# Metrics
duration: 4min
completed: 2026-06-07
---

# Phase 14 Plan 02: fcm.sendDigest count-bearing digest send-path Summary

**Added `fcm.sendDigest({ uid, count, lang, data })` — a sibling to the param-free `send()` that renders the count-bearing localized `digest_title` via `renderDigest` and fans out exactly ONE push per user, resolving RESEARCH Pitfall 1 (the existing `send()` strips all params and cannot interpolate `{count}`).**

## Performance

- **Duration:** ~4 min
- **Tasks:** 1 (TDD: RED + GREEN, no REFACTOR needed)
- **Files modified:** 2 — both in the backend repo (`carEx-services`)

## Accomplishments
- `sendDigest({ uid, count, lang = 'RU', data = {} })` added to `fcm.js`, exported as `module.exports = { send, sendDigest }`.
- Renders the title/body via the Plan-01 `renderDigest(lang, count)` so the integer count is interpolated into the localized copy (RU машин-form for 5: "5 новых машин"); the count is the only value rendered — no make/model/price/seller/location.
- Fans out ONE `sendEachForMulticast` call carrying all of the uid's tokens; zero tokens → `{ ok: true, delivered: 0 }` without touching firebase-admin (mirrors `send()`).
- Forwards ONLY `data.deeplink` into the payload (T-14-02-01 PII guarantee), reusing a shared `deeplinkOnly()` helper.
- Reuses the bounded jittered-backoff retry loop, `PRUNE_CODES → pruneToken`, one-bad-token isolation, and never-throw contract via an extracted shared `fanOut()` core — `send()` now delegates to it with identical behavior.
- Converted the NDIG-03 `test.todo` in `digest.test.js` into real assertions (one push, RU машин-form title for count 5, deeplink-only payload, zero-token short-circuit, PRUNE_CODES prune).

## Task Commits

All committed atomically to the **backend** repo (`carEx-services`, on `main`, no push):

1. **Task 1 (TDD RED): failing sendDigest unit tests (NDIG-03)** — `e25af81` (test)
2. **Task 1 (TDD GREEN): fcm.sendDigest + shared fanOut() core** — `95cc28a` (feat)

No REFACTOR commit needed — the shared-helper extraction was part of the GREEN change and was clean on first green.

**Plan metadata** (this SUMMARY + STATE/ROADMAP): committed to the **mobile** repo.

## Files Created/Modified
- `carEx-services/src/notifications/push/fcm.js` (modified) — added `sendDigest`, extracted shared `fanOut()` + `deeplinkOnly()`, imported `renderDigest`; `send()` delegates to `fanOut()` (behavior unchanged); export shape now `{ send, sendDigest }`.
- `carEx-services/src/notifications/__tests__/digest.test.js` (modified) — firebase-admin + DeviceToken mock harness; NDIG-03 todo → 4 real `sendDigest` assertions.

## Decisions Made
- **Shared `fanOut()` core over copy-paste:** rather than duplicate the retry/backoff/prune loop, both `send()` and `sendDigest()` delegate to one `fanOut(uid, notification, payloadData)` helper. The helper owns no copy and no PII policy — each caller renders its own `{ title, body }` and passes its own sanitized payload. This keeps `send()` param-free (NPUSH-08) while `sendDigest()` carries the count, with zero risk of regressing `send()` (existing `fcm.test.js` stays green untouched).
- **`deeplinkOnly()` centralizes the strip** so the two paths cannot diverge on the deeplink-only guarantee.
- **File-wide mocks in digest.test.js are safe:** the firebase-admin/DeviceToken mocks only affect the new `sendDigest` block; the real-translations pluralize/renderDigest boundary tests never touch those modules.

## Deviations from Plan

None — plan executed exactly as written. The shared `fanOut()` extraction is the plan's explicitly-suggested option ("extract a shared internal helper if needed rather than copy-pasting the loop").

## Threat Surface
- **T-14-02-01 (information disclosure) — mitigated:** test asserts forwarded `data` keys === `['deeplink']` and serialized payload contains no `uid`/`count`/`carId`; title carries only the integer count.
- **T-14-02-02 (DoS fan-out) — mitigated:** reuses `send()`'s bounded `MAX_ATTEMPTS` + jittered backoff + never-throw via `fanOut()`.
- No new security-relevant surface beyond the plan's threat model — `sendDigest` is in-process only, no public route.

## Issues Encountered
- **Full backend suite shows 2 pre-existing failures** in `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` (the only failing suite). Confirmed pre-existing (documented since Phase 13, also noted in 14-01-SUMMARY) — out of scope per the SCOPE BOUNDARY rule, left untouched. Targeted `fcm.test.js` + `digest.test.js` are green; full suite is 452 passed / 7 todo / 2 pre-existing fails (up from 448 passed in Plan 01 — the 4 new digest tests).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `fcm.sendDigest(lang, count)` is the call surface Plan 03's per-uid digest flush will invoke (one call per claimed uid; clear ids only on `{ ok: true }`).
- The bounded/never-throw contract means one user's send failure does not abort the flush loop (T-14-02-02).
- `digest.test.js` remains the phase-wide file; Plans 03/04 convert the remaining todos (crash-safe flush, snapshot bound, 90-day + stale-token prune, hide-hook re-check).

## Self-Check: PASSED

- `carEx-services/src/notifications/push/fcm.js` — FOUND (`sendDigest` + `send` both exported, verified)
- `carEx-services/src/notifications/__tests__/digest.test.js` — FOUND (NDIG-03 real assertions)
- Commits `e25af81`, `95cc28a` — FOUND in backend `main`
- `fcm.test.js` + `digest.test.js` — both green; full suite no new failures (only the 2 documented pre-existing)

---
*Phase: 14-daily-digest-scheduling*
*Completed: 2026-06-07*

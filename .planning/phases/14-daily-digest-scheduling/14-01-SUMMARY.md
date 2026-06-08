---
phase: 14-daily-digest-scheduling
plan: 01
subsystem: testing
tags: [node-cron, i18n, pluralization, jest, notifications, backend]

# Dependency graph
requires:
  - phase: 12-notification-domain-in-app-center
    provides: "translations.js RU/EN parity pattern + parity test; Notification.digestPending flag; notificationService.emit"
  - phase: 13-fcm-push-transport-native
    provides: "fcm.send() localized push path (titleKey/lang/data) the digest reuses; renderGenericPush push_* register"
provides:
  - "node-cron@^4.2.1 installed as a backend dependency (the digest scheduler's library)"
  - "pluralizeRu(n,[one,few,many]) exported from translations.js (standard Russian 3-form rule incl. teen exception)"
  - "digest_title / digest_body translation keys (RU+EN, parity-safe) + renderDigest(lang,count)"
  - "src/notifications/__tests__/digest.test.js Wave-0 scaffold — one entry per Phase-14 VALIDATION row (todo) + a green D-04 boundary table"
affects: [14-02, 14-03, 14-04, 14-05, daily-digest-send-path, digest-flush, retention-prune]

# Tech tracking
tech-stack:
  added: ["node-cron@^4.2.1"]
  patterns:
    - "Parity-safe count copy: ONE {count}-token title template per language + a non-brace #NOUN# sentinel resolved at render time (keeps RU/EN {param} token sets identical so the parity test stays green)"
    - "render-time word-form selection via pluralizeRu over a [one,few,many] forms array stored as digest_noun_forms"
    - "single phase-wide test file (digest.test.js) seeded with test.todo per VALIDATION row; downstream tasks convert todos to assertions"

key-files:
  created:
    - "carEx-services/src/notifications/__tests__/digest.test.js"
  modified:
    - "carEx-services/package.json"
    - "carEx-services/package-lock.json"
    - "carEx-services/src/notifications/translations.js"

key-decisions:
  - "digest_title stored with one {count} token + a #NOUN# sentinel (NOT a {param} token) so RU/EN placeholder sets stay identical and the parity set-equality holds — three separate RU keys were rejected per RESEARCH Pitfall 2"
  - "RU noun phrase folds full adjective+noun agreement into each of the 3 forms (новая машина / новые машины / новых машин) so the rendered title reads grammatically at every boundary"
  - "EN form selection uses simple n===1 singular vs plural (not the Russian rule) so e.g. 21 → '21 new matches' stays correct"
  - "digest.test.js wires MongoMemoryReplSet beforeAll/afterAll for the downstream integration todos to adopt; no withTransaction added (per-id flush is sufficient, D-locked)"

patterns-established:
  - "Sentinel-substitution pluralization: keep parity-scanned templates token-symmetric, do word-form selection in a render helper"
  - "Wave-0 test scaffold owns the full VALIDATION row list as todos"

requirements-completed: [NDIG-04, NDIG-03]

# Metrics
duration: 3min
completed: 2026-06-07
---

# Phase 14 Plan 01: Daily-Digest Wave-0 Foundation Summary

**node-cron@4.2.1 installed in the backend, a parity-safe `digest_title`/`digest_body` with a correct Russian 3-form `pluralizeRu` helper + `renderDigest`, and the phase-wide `digest.test.js` scaffold (8 VALIDATION todos + a green D-04 boundary table).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-07T22:55:02Z
- **Completed:** 2026-06-07T22:57:56Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified) — all in the backend repo

## Accomplishments
- Installed `node-cron@^4.2.1` (verified latest; `require('node-cron')` resolves) — the scheduler library for Plans 02–04.
- Added `pluralizeRu(n, [one, few, many])` implementing the standard Russian rule including the 11–14 teen exception, exported from `translations.js`.
- Added `digest_title` + `digest_body` (RU+EN) plus `renderDigest(lang, count)` — RU renders grammatically agreeing forms (1 → "1 новая машина", 3 → "3 новые машины", 5/0/11 → "новых машин"), EN simple singular/plural; only the integer `{count}` is ever interpolated (T-14-01-01).
- Created `src/notifications/__tests__/digest.test.js` — the single file the whole phase extends: 8 `test.todo` rows (one per VALIDATION.md row) + a real green D-04 pluralization boundary table.
- Existing `notification-translations-parity.test.js` stays green with the new `digest_*` keys.

## Task Commits

All committed atomically to the **backend** repo (`carEx-services`, on `main`, no push):

1. **Task 1: Install node-cron + scaffold digest.test.js** — `5455d56` (chore)
2. **Task 2 (TDD RED): failing pluralizeRu + digest_title boundary table** — `44a8ea2` (test)
3. **Task 2 (TDD GREEN): pluralizeRu + digest_title/digest_body** — `4b35a47` (feat)

No REFACTOR commit was needed (implementation was clean on first green).

**Plan metadata** (this SUMMARY + STATE/ROADMAP): committed to the **mobile** repo.

## Files Created/Modified
- `carEx-services/src/notifications/__tests__/digest.test.js` (created) — Wave-0 scaffold: replset harness + 8 VALIDATION todos + green D-04 boundary table.
- `carEx-services/src/notifications/translations.js` (modified) — `pluralizeRu`, `renderDigest`, `digest_title`/`digest_body`/`digest_noun_forms` RU+EN, new exports.
- `carEx-services/package.json` (modified) — `node-cron: ^4.2.1` dependency.
- `carEx-services/package-lock.json` (modified) — locked `node-cron@4.2.1`.

## Decisions Made
- **#NOUN# sentinel over three RU keys:** storing one `{count}`-token title per language plus a non-`{param}` sentinel keeps the RU/EN placeholder token sets identical, so the parity set-equality test passes without special-casing. Three separate RU title keys would have broken parity (RESEARCH Pitfall 2 / A5).
- **Full agreement folded per form:** each RU form carries the agreeing adjective+noun ("новая машина" / "новые машины" / "новых машин") so the rendered sentence is grammatical at every count, not just the noun.
- **EN selection by n===1:** EN does not follow the Russian rule, so `renderDigest` picks EN singular/plural by `count === 1`, keeping 21 → "21 new matches" correct.

## Deviations from Plan

None — plan executed exactly as written. (node-cron version, the parity-safe single-`{count}` template approach, the render helper, and the boundary table were all specified by the plan.)

## Issues Encountered
- **Full backend suite shows 2 pre-existing failures** in `__tests__/moderation/ServiceOrder.providerSnapshot.test.js`. Confirmed pre-existing (documented in STATE.md from Phase 13; last touched by unrelated moderation commit `889b831`; my commits only touched package files + digest.test.js + translations.js). Out of scope per the SCOPE BOUNDARY rule — left untouched and logged to `14-daily-digest-scheduling/deferred-items.md`. The targeted plan tests (digest.test.js + parity) and the other 448 tests are green.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- node-cron is available for Plan 02's scheduler (`require.main === module` gate + `DIGEST_HOUR = 8` Asia/Bishkek cron expression).
- `renderDigest(lang, count)` is the call surface Plan 02's `sendDigest` will use (count-only, PII-safe).
- `digest.test.js` is ready for Plans 02/03/04 to convert each `test.todo` into a real assertion (cron gate, one-push-count, crash-safe flush, snapshot bound, 90-day + stale-token prune, hide-hook re-check).

## Self-Check: PASSED

- `carEx-services/src/notifications/__tests__/digest.test.js` — FOUND
- `carEx-services/src/notifications/translations.js` — FOUND (pluralizeRu + renderDigest exported, verified)
- node-cron — `require('node-cron')` resolves; `^4.2.1` in package.json + package-lock.json
- Commits `5455d56`, `44a8ea2`, `4b35a47` — FOUND in backend `main`
- digest.test.js + notification-translations-parity.test.js — both green

---
*Phase: 14-daily-digest-scheduling*
*Completed: 2026-06-07*

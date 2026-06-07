---
phase: 14-daily-digest-scheduling
plan: 03
subsystem: backend-notifications
tags: [digest, crash-safe, flush, hide-hook, toctou, claim, jest, backend, cron]

# Dependency graph
requires:
  - phase: 14-daily-digest-scheduling
    plan: 01
    provides: "node-cron; renderDigest/pluralizeRu; digest.test.js scaffold + replset harness"
  - phase: 14-daily-digest-scheduling
    plan: 02
    provides: "fcm.sendDigest({ uid, count, lang, data }) — never-throw, bounded, returns { ok }"
  - phase: 12-notification-domain-in-app-center
    provides: "Notification.digestPending flag; notificationService.emit hide-hook precedent (plain Car.findById, no bypass)"
provides:
  - "src/notifications/digest.js — pure, directly-callable runDigest({ now, deps }) crash-safe flush"
  - "DIGEST_HOUR = 8 constant (D-01 single fire-time retune point; consumed by Plan 04's cron)"
  - "Notification.digestRunId claim field (crash-safe per-id claim marker, NOT a digestSent marker)"
  - "digest.test.js NDIG-02 (crash + snapshot bound) + SC4 (hide-hook) todos converted to real integration tests"
affects: [14-04, daily-digest-cron, retention-prune]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot+claim flush: one atomic updateMany stamps digestRunId on { digestPending:true, createdAt:$lte runStart }, read back claimed set, group by uid, clear only sent ids — no withTransaction (per-doc updateMany atomicity is the design, RESEARCH A1)"
    - "Re-runnable claim: a later runStart re-stamps leftover rows from a crashed prior run (digestRunId is re-stampable, not a one-shot lock) — guarantees no drop"
    - "Hide-hook re-check mirrors notificationService.emit: PLAIN Car.findById (zero bypass flags) per carId-bearing row; grep gate over non-comment lines asserts no includeAllListingStatuses/includeAllUsers/setOptions"
    - "Per-uid iteration wrapped in try/catch so one user's send failure leaves that user's rows pending for the next run without aborting the loop (defense-in-depth over Plan 02's never-throw contract)"

key-files:
  created:
    - "carEx-services/src/notifications/digest.js"
  modified:
    - "carEx-services/src/models/Notification.js"
    - "carEx-services/src/notifications/__tests__/digest.test.js"

key-decisions:
  - "Adopted the LOCKED minimal NDIG-02 contract: guarantee NO DROP, accept the rare post-send/pre-clear duplicate. No separate digestSent marker — single-instance Railway, the duplicate window is the narrow gap between sendDigest resolving and the clear updateMany; a once-in-a-blue-moon repeat morning digest after a crash at exactly 08:00 is strictly better UX than a missed digest. Strict zero-duplicate deferred (pairs with NOTF2-06)."
  - "digestRunId is a re-stampable claim marker (sibling to digestPending), cleared via $unset only on a successful send. A non-null value on a still-pending row signals a crashed prior run; the next run re-stamps and re-sends it."
  - "Snapshot bound is createdAt <= runStart (the injected `now`): rows created after runStart belong to tomorrow and are excluded — the claim updateMany filters on it, so they are never claimed/sent/cleared."
  - "No withTransaction / advisory lock (RESEARCH A1) — per-doc updateMany atomicity + clear-only-sent-ids is sufficient for the no-drop guarantee on a single instance."
  - "Hide-hook re-check drops carId-bearing rows whose Car is null or status !== 'active'; rows with carId === null (saved-search) skip the per-car re-check. Dropped rows stay digestPending:true (not sent, not lost)."

patterns-established:
  - "runDigest is invoked DIRECTLY (no cron) — Plan 04 only registers the schedule and consumes DIGEST_HOUR; integration tests call runDigest with an injected mock fcm"

requirements-completed: [NDIG-02, NDIG-03]

# Metrics
duration: 5min
completed: 2026-06-07
---

# Phase 14 Plan 03: Crash-safe runDigest flush Summary

**Built `src/notifications/digest.js` — a pure, directly-callable `runDigest({ now, deps })` that snapshots `digestPending` rows by `createdAt <= runStart`, claims them with a re-stampable `digestRunId`, groups by uid, re-checks the hide-hook per car-bearing row via a plain `Car.findById`, sends exactly ONE `fcm.sendDigest` per user with the surviving count, and clears `digestPending` only for successfully-sent ids — proving no drop and no double-send for cleared users across a simulated mid-run crash.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 (Task 2 = TDD RED + GREEN, no REFACTOR needed)
- **Files modified:** 3 — all in the backend repo (`carEx-services`)

## Accomplishments
- Added `digestRunId: { type: String, default: null }` to the `Notification` schema — a re-stampable per-id claim marker (NOT a `digestSent` marker; double-send hardening intentionally out). Existing indexes + `NOTIFICATION_RETENTION_DAYS = 90` unchanged.
- Created `digest.js` exporting `runDigest({ now, deps })` + `DIGEST_HOUR = 8` (D-01 single retune point; Plan 04 consumes it). Deps `{ Notification, Car, User, fcm }` default to the mongoose models / fcm module so tests inject mocks.
- **Snapshot + claim:** one atomic `updateMany` stamps `digestRunId = runStart.toISOString()` on `{ digestPending:true, createdAt:{ $lte: runStart } }`; the claimed set is read back with `.lean()`. Re-runnable — a later `runStart` re-stamps leftover rows from a crashed run.
- **Group + resolve + hide-hook:** plain JS reduce by uid; `User.language` resolved (default `'RU'`); per car-bearing row a **plain `Car.findById`** (zero bypass flags, mirroring `notificationService.emit`) drops null / non-active listings. `carId === null` rows skip the per-car re-check.
- **One push per user:** `fcm.sendDigest({ uid, count: survivingIds.length, lang, data: { deeplink: 'carex://notifications' } })` called once per uid.
- **Clear-only-sent-ids:** on `{ ok:true }` → `updateMany($set digestPending:false, $unset digestRunId)` for only that uid's surviving ids; on `!ok` → rows stay `digestPending:true` (next morning re-picks, no drop). Each per-uid iteration is wrapped so one user's failure never aborts the loop.
- Converted the NDIG-02 (crash + snapshot bound) and SC4 (hide-hook) `test.todo` rows into real `MongoMemoryReplSet` integration tests using real `Notification`/`Car`/`User` models and an injected mock `fcm.sendDigest`, plus added one-push-count, re-claimable-leftover, language-resolution, and `!ok`-retention cases.

## Task Commits

All committed atomically to the **backend** repo (`carEx-services`, on `main`, no push):

1. **Task 1: add digestRunId claim field to Notification model** — `e7740b7` (feat)
2. **Task 2 (TDD RED): failing runDigest integration tests** — `385917f` (test)
3. **Task 2 (TDD GREEN): implement crash-safe runDigest flush + hide-hook re-check** — `6238f11` (feat)

No REFACTOR commit needed — the implementation was clean on first green.

**Plan metadata** (this SUMMARY + STATE/ROADMAP): committed to the **mobile** repo on `feature/notifications-system`.

## Files Created/Modified
- `carEx-services/src/notifications/digest.js` (created) — `runDigest` + `DIGEST_HOUR`; snapshot/claim/group/hide-hook/send/clear flush.
- `carEx-services/src/models/Notification.js` (modified) — `digestRunId` claim field (sibling to `digestPending`); indexes + retention constant unchanged.
- `carEx-services/src/notifications/__tests__/digest.test.js` (modified) — `mongoose` import + 8 real `runDigest` integration tests (replacing 3 todos: 2× NDIG-02 + 1× SC4).

## Decisions Made
- **Locked minimal NDIG-02 contract (no `digestSent` marker):** guarantee no drop, accept the rare post-send/pre-clear duplicate. Single-instance Railway; the duplicate window is the narrow gap between `sendDigest` resolving and the clear `updateMany`. A once-in-a-blue-moon repeat morning digest after a crash at exactly 08:00 is strictly better than a missed digest, and avoids a second durable marker's complexity. **Strict zero-duplicate is deferred (pairs naturally with NOTF2-06).**
- **`digestRunId` is re-stampable, not a one-shot lock:** a non-null value on a still-`digestPending` row means a prior run claimed but crashed; the next run re-claims and re-sends it (verified by the re-claimable test).
- **No `withTransaction` / advisory lock (RESEARCH A1):** per-doc `updateMany` atomicity + clear-only-sent-ids is sufficient for the no-drop guarantee on a single instance.
- **Hide-hook drops keep rows pending:** a row whose Car is now non-active is excluded from the count and left `digestPending:true` (not sent, not lost) — consistent with the no-drop policy; it will be re-evaluated next morning.

## Deviations from Plan

None — plan executed exactly as written. (The flush shape, snapshot bound, claim/clear semantics, hide-hook discipline, deps injection, and the no-transaction design were all specified by the plan; the no-`digestSent`-marker double-send tradeoff was the plan's explicit locked decision.)

## Threat Surface
- **T-14-03-01 (information disclosure / hide-hook) — mitigated:** plain `Car.findById` with ZERO bypass flags; the grep gate over non-comment lines of `digest.js` returns 0; the SC4 test proves a non-active listing is excluded from the count and not pushed.
- **T-14-03-02 (data integrity / claim-clear) — mitigated:** snapshot bound `createdAt <= runStart` + per-id `digestRunId` claim + clear-only-sent-ids; the crash-sim test proves cleared users are not re-sent and unsent users are retained.
- **T-14-03-03 (double-send) — accepted (documented):** locked no-drop-only contract; rare post-send/pre-clear duplicate accepted, no `digestSent` marker. See Decisions Made.
- **T-14-03-04 (DoS / per-user loop) — mitigated:** each per-uid iteration is try-wrapped; `sendDigest` never throws (Plan 02) and one user's failure leaves their rows pending for the next run without aborting the loop.
- No new public route or external surface — `runDigest` is in-process only (the cron registration is Plan 04).

## Issues Encountered
- **Full backend suite shows 2 pre-existing failures** in `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` — confirmed pre-existing (documented since Phase 13 and in 14-01/14-02 SUMMARYs), out of scope per the SCOPE BOUNDARY rule, left untouched. Full suite after this plan: **460 passed / 4 todo / 2 pre-existing fails** (up from 452 in Plan 02 — the new `runDigest` integration tests). Targeted `digest.test.js` is 44 passed / 4 todo.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `runDigest({ now, deps })` + `DIGEST_HOUR` are the call surface Plan 04's cron consumes — Plan 04 registers `0 8 * * *` (Asia/Bishkek) under a `require.main === module` gate and invokes `runDigest` on fire.
- The remaining `digest.test.js` todos (NDIG-05 90-day notification prune + stale-token prune) are Plan 04's to convert.

## Self-Check: PASSED

- `carEx-services/src/notifications/digest.js` — FOUND (`runDigest` is a function, `DIGEST_HOUR === 8`, verified via `node -e`)
- `carEx-services/src/models/Notification.js` — FOUND (`digestRunId` path present, retention 90, verified via `node -e`)
- `carEx-services/src/notifications/__tests__/digest.test.js` — FOUND (8 real `runDigest` integration tests green)
- Commits `e7740b7`, `385917f`, `6238f11` — FOUND in backend `main`
- `digest.test.js` green (44 passed / 4 todo); bypass-flag grep gate over `digest.js` returns 0; full suite no new failures (only the 2 documented pre-existing)

---
*Phase: 14-daily-digest-scheduling*
*Completed: 2026-06-07*

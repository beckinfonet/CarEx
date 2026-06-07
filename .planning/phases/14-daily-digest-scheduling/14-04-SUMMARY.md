---
phase: 14-daily-digest-scheduling
plan: 04
subsystem: backend-notifications
tags: [digest, cron, retention, prune, node-cron, scheduling, backend, jest]

# Dependency graph
requires:
  - phase: 14-daily-digest-scheduling
    plan: 01
    provides: "node-cron v4 (installed); digest.test.js scaffold + replset harness"
  - phase: 14-daily-digest-scheduling
    plan: 03
    provides: "src/notifications/digest.js — pure runDigest({ now, deps }) + DIGEST_HOUR=8"
  - phase: 12-notification-domain-in-app-center
    provides: "Notification.NOTIFICATION_RETENTION_DAYS=90; DeviceToken.lastSeenAt"
provides:
  - "digest.js prune() — same-run 90-day notification + stale-token retention prune (date-bounded, non-fatal)"
  - "server.js daily-digest node-cron registered inside require.main === module gate (0 8 * * * Asia/Bishkek, noOverlap)"
  - "digest.test.js — NDIG-05/NDOM-06 prune + NDIG-01/NDIG-04 cron-gate todos converted to real tests (0 todos remain)"
affects: [phase-14-complete, daily-digest-cron, retention-prune]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-run prune: runDigest calls prune() at the END of the flush (and on idle runs) — the morning cron does flush + retention in one fire; both deleteMany calls are date-bounded ($lt cutoff), never unconditional"
    - "Stale-token prune is the EXTRA layer: keyed on DeviceToken.lastSeenAt age (refreshed on every register, router.js:315), non-duplicative with fcm.send's send-time pruneToken (which only removes FCM-rejected tokens)"
    - "Non-fatal prune: wrapped end-to-end so a prune error is logged but never thrown out of runDigest (never blocks or re-fires the flush)"
    - "Entrypoint-gated cron: cron.schedule lives STRICTLY inside server.js's require.main === module block so require('./server') under Jest starts no scheduler (Pitfall 4); v4 auto-start, no recoverMissedExecutions = no catch-up (D-02, zero code)"

key-files:
  created: []
  modified:
    - "carEx-services/src/notifications/digest.js"
    - "carEx-services/server.js"
    - "carEx-services/src/notifications/__tests__/digest.test.js"

key-decisions:
  - "TOKEN_STALE_DAYS = 90 (same as NOTIFICATION_RETENTION_DAYS): a token unseen ~3 months is abandoned and FCM would reject it on the next real send anyway; one tunable threshold keeps the policy simple."
  - "prune runs on idle digest mornings too (the early-return-when-no-claimed path also calls prune) — retention must not depend on there being a flush to do."
  - "Cron expression is built from DIGEST_HOUR (`0 ${DIGEST_HOUR} * * *`) so digest.js stays the single fire-time retune point (D-01); the cron's only job is scheduling + timezone."
  - "node-cron v4 signature only: cron.schedule(expr, asyncTask, { name, timezone, noOverlap }) — NO { scheduled:false }+.start(), NO recoverMissedExecutions (removed in v4; absence of catch-up satisfies D-02 with zero code)."
  - "Cron-gate tests assert the server.js SOURCE contract (schedule call is after the require.main gate and before module.exports; expression/timezone/noOverlap present) — a unit test cannot run server.js as a CLI entrypoint; the require('./server')-starts-no-scheduler behavior is proven by the plan's node -e verify (process exits clean, no open handle)."

patterns-established:
  - "Phase 14 backend worker complete: runDigest = snapshot/claim/flush/hide-hook/send/clear (Plan 03) + same-run retention prune (Plan 04); server.js entrypoint registers the only cron, gated against Jest."

requirements-completed: [NDIG-01, NDIG-04, NDIG-05, NDOM-06]

# Metrics
duration: ~4min
completed: 2026-06-07
---

# Phase 14 Plan 04: Retention Prune + Daily-Digest Cron Summary

**Closed Phase 14 in the backend repo: added a date-bounded, non-fatal same-run retention `prune()` to `runDigest` (deletes notifications older than 90 days by `createdAt` and device tokens whose `lastSeenAt` has gone stale — the EXTRA layer beyond fcm's send-time token prune), and registered the in-process `daily-digest` `node-cron` job strictly inside `server.js`'s `require.main === module` gate (`0 8 * * *`, timezone `Asia/Bishkek`, `noOverlap`) so the morning fire does flush + retention while `require('./server')` under Jest starts no scheduler.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 2 (Task 1 = TDD RED + GREEN; Task 2 = implementation + cron-gate tests)
- **Files modified:** 3 — all in the backend repo (`carEx-services`)

## Accomplishments

- **prune() (Task 1):** added to `digest.js` and invoked at the END of `runDigest` (and on the idle early-return path). Two date-bounded deletes:
  - `Notification.deleteMany({ createdAt: { $lt: cutoff } })` where `cutoff = now − NOTIFICATION_RETENTION_DAYS (90) days`.
  - `DeviceToken.deleteMany({ lastSeenAt: { $lt: cutoff } })` where `cutoff = now − TOKEN_STALE_DAYS (90) days`.
  - A source comment cites `router.js:315` (lastSeenAt refreshed on every register/refresh → age is a valid liveness signal, RESEARCH A2) and states this is the EXTRA/stale layer, non-duplicative with `fcm.send`'s `pruneToken`.
  - The whole prune is wrapped: a prune error is logged via `console.error` and NEVER thrown out of `runDigest`.
  - Uses injected `deps.Notification` / `deps.DeviceToken` so tests run against the in-memory models. New exports: `prune`, `TOKEN_STALE_DAYS`.
- **node-cron (Task 2):** registered inside the EXISTING `if (require.main === module)` block in `server.js`, alongside `app.listen`. `cron.schedule(\`0 \${DIGEST_HOUR} * * *\`, asyncTask, { name: 'daily-digest', timezone: 'Asia/Bishkek', noOverlap: true })`. The task wraps `await runDigest({ now: new Date() })` in try/catch so a digest failure can never crash the process. Imports added at the top: `require('node-cron')` and `{ runDigest, DIGEST_HOUR }` from `./src/notifications/digest`. No router mounted, no public route added — this is an in-process worker.
- **Tests:** converted all 4 remaining `test.todo` rows into real assertions (digest.test.js now has 0 todos):
  - NDIG-05/NDOM-06 90-day prune (91d deleted, 89d kept) — real `MongoMemoryReplSet` + real `Notification` model.
  - NDIG-05 stale-token prune (200d-stale deleted, 1d-fresh kept) — uses `jest.requireActual('../../models/DeviceToken')` because the file mocks that module for the fcm unit tests above.
  - T-14-04-01 — spies on both `deleteMany` and asserts each call carries a `$lt` date filter (proves no unconditional delete).
  - prune-failure-non-fatal — a `DeviceToken.deleteMany` that rejects does not reject `runDigest`.
  - NDIG-01 cron gate + NDIG-04 expression/timezone — assert the `server.js` source contract (schedule after the `require.main` gate, before `module.exports`; `0 ${DIGEST_HOUR} * * *`, `timezone: 'Asia/Bishkek'`, `noOverlap`).

## Task Commits

All committed atomically to the **backend** repo (`carEx-services`, on `main`, no push):

1. **Task 1 (TDD RED): failing prune tests** — `20772ed` (test)
2. **Task 1 (TDD GREEN): same-run retention prune in runDigest** — `ff9a8e5` (feat)
3. **Task 2: entrypoint-gated daily-digest node-cron in server.js** (+ cron-gate tests) — `5e35e15` (feat)

No REFACTOR commit needed — clean on first green.

**Plan metadata** (this SUMMARY + STATE/ROADMAP): committed to the **mobile** repo on `feature/notifications-system`.

## Files Created/Modified

- `carEx-services/src/notifications/digest.js` (modified) — `prune(now, deps)` (90-day notifications + stale tokens, date-bounded, non-fatal); invoked at end of `runDigest` and on the idle path; `TOKEN_STALE_DAYS` constant; new exports `prune`, `TOKEN_STALE_DAYS`.
- `carEx-services/server.js` (modified) — `require('node-cron')` + `{ runDigest, DIGEST_HOUR }` imports; `cron.schedule` registered inside the `require.main === module` gate (Asia/Bishkek, noOverlap, try/catch task).
- `carEx-services/src/notifications/__tests__/digest.test.js` (modified) — 6 new real tests (4 prune + 2 cron-gate) replacing the 4 final todos; file now 50 passing / 0 todo.

## Decisions Made

- **`TOKEN_STALE_DAYS = 90`** (same value as notification retention): a token unseen ~3 months is effectively abandoned and FCM would reject it on the next real send anyway. One tunable threshold; non-duplicative with the send-time reject prune.
- **Prune runs on idle mornings too:** the no-claimed-rows early-return path calls `prune` before returning, so retention never depends on there being flush work.
- **Expression built from `DIGEST_HOUR`** so `digest.js` stays the single fire-time retune point (D-01); the cron only owns scheduling + timezone.
- **node-cron v4 idioms only** — no `{ scheduled:false }`+`.start()`, no `recoverMissedExecutions` (removed in v4; the absence of catch-up satisfies D-02 with zero code, so a slept-through fire rolls to the next morning instead of stampeding on boot).
- **Cron-gate tests assert the server.js source contract** (plus the plan's `node -e` require-no-listener check) rather than executing server.js as a CLI entrypoint inside Jest.

## Deviations from Plan

None — plan executed exactly as written. The prune shape (two date-bounded deletes, non-fatal wrap, deps injection, stale-token EXTRA layer), the `TOKEN_STALE_DAYS=90` choice, the entrypoint-gated v4 cron with Asia/Bishkek + noOverlap, and the no-public-route constraint were all specified by the plan.

## Threat Surface

- **T-14-04-01 (tampering / data integrity, prune deleteMany) — mitigated:** both deletes carry a precise `$lt` date cutoff (`createdAt` for the 90-day notifications, `lastSeenAt` for stale tokens); tests assert a fresh/recent row is KEPT, proving the query is bounded and never deletes live data. prune is wrapped so a failure cannot cascade.
- **T-14-04-02 (cron under Jest) — mitigated:** `cron.schedule` is strictly inside `require.main === module`; the source-contract test asserts the schedule call sits after the gate and before `module.exports`, and the plan's `node -e` require check exits cleanly with no open handle (the full Jest suite also completes without a dangling timer).
- **T-14-04-03 (new endpoint / auth surface) — accept (confirmed nil):** no `router.mount`, no `app.use`, no public route added; the worker is in-process only.
- **T-14-04-04 (DoS / cron overlap or failure) — mitigated:** `noOverlap` skips a fire still running; the task try/catch prevents a digest error from crashing the process; v4 no-catch-up means a slept-through fire rolls forward (D-02) rather than stampeding on boot.
- No new threat flags — no new network endpoints, auth paths, or trust-boundary schema changes introduced.

## Issues Encountered

- **Full backend suite: 2 pre-existing failures** in `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` (documented since Phase 13 and in every Phase 14 SUMMARY) — out of scope per the SCOPE BOUNDARY rule, left untouched. Full suite after this plan: **466 passed / 0 todo / 2 pre-existing fails** (up from 460 — the 6 new prune + cron tests). Targeted `digest.test.js`: **50 passed / 0 todo**.

## User Setup Required

None — no external service configuration required. The cron runs in-process on the single Railway instance; it auto-starts when the backend boots via `node server.js`.

## Next Phase Readiness

- **Phase 14 backend is COMPLETE.** `runDigest` now does flush (Plan 03) + retention prune (this plan); `server.js` registers the only cron, gated against Jest. NDIG-01..05 + NDOM-06 satisfied on the backend.
- This is the FINAL plan of Phase 14 (the mobile-side daily-cadence selector / Plan 05 work lands separately on the mobile branch). On backend deploy to Railway main, the 08:00 Asia/Bishkek digest + 90-day prune go live.

## Self-Check: PASSED

- `carEx-services/src/notifications/digest.js` — FOUND (`prune` exported, `TOKEN_STALE_DAYS === 90`, prune called from runDigest; verified by green tests)
- `carEx-services/server.js` — FOUND (`cron.schedule` at line ~1524 inside the require.main gate; `require('./server')` exits clean with the app exported)
- `carEx-services/src/notifications/__tests__/digest.test.js` — FOUND (50 passed / 0 todo)
- Commits `20772ed`, `ff9a8e5`, `5e35e15` — FOUND in backend `main`
- Full backend suite: 466 passed, only the 2 documented pre-existing `ServiceOrder.providerSnapshot` failures (no new failures); no unexpected deletions across the task commits

---
*Phase: 14-daily-digest-scheduling*
*Completed: 2026-06-07*

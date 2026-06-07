---
phase: 13-fcm-push-transport-native
plan: 02
subsystem: api
tags: [fcm, firebase-admin, push, device-tokens, i18n, zod, jest, backend]

# Dependency graph
requires:
  - phase: 12 (notification center, backend sibling repo)
    provides: "notificationService.emit() instant-cadence caller contract (fcm.send), DeviceToken model, notifications router + zod schemas, translations.js render/parity scaffold, firebaseAdmin.ensureInitialized cached-OAuth"
provides:
  - "Generic PII-safe push_* copy set (5 categories) + param-free renderGenericPush(key, lang) with RU/EN parity"
  - "Real firebase-admin sendEachForMulticast fan-out replacing the fcm.send no-op stub: prune dead tokens, bounded backoff on transient/429, per-token isolation"
  - "POST/DELETE device-token routes (uid from verified Bearer, IDOR-safe) + registerDeviceTokenSchema"
  - "Wave-0 backend test coverage for all three (push-copy-parity, fcm, deviceTokens)"
affects: [13-01-spike, 13-03-mobile-pushservice, 13-mobile-authcontext-token-lifecycle, phase-14-digest]

# Tech tracking
tech-stack:
  added: []  # firebase-admin already installed (Phase 12); no new deps. NO google-auth-library.
  patterns:
    - "renderGenericPush: SEPARATE param-free render path distinct from render()/interpolate()"
    - "sendEachForMulticast per-token isolation: prune PRUNE_CODES, bounded jittered backoff on TRANSIENT_CODES, swallow everything else"
    - "Device-token routes mirror the subscription IDOR pattern (uid = req.auth.uid, never body/params)"
    - "jest.mock('../push/fcm') in DB-less emit unit tests"

key-files:
  created:
    - "[backend] __tests__/push-copy-parity.test.js"
    - "[backend] src/notifications/push/fcm.test.js"
    - "[backend] src/notifications/__tests__/deviceTokens.test.js"
  modified:
    - "[backend] src/notifications/translations.js"
    - "[backend] src/notifications/push/fcm.js"
    - "[backend] src/notifications/router.js"
    - "[backend] src/notifications/schemas.js"
    - "[backend] package.json (jest testMatch)"
    - "[backend] src/notifications/__tests__/{actorExclusion,dedup,guards,priceDirection}.test.js (fcm stub)"

key-decisions:
  - "push_* bodies are ONE canonical generic line per language ('Откройте, чтобы посмотреть.' / 'Open to take a look.'), category-specific titles only — D-07/D-08, D-08b hard-ban asserted by test"
  - "renderGenericPush is a separate param-free function, NOT an overload of render() (which leaves empty {} slots)"
  - "Backoff: 1 send + up to 2 retries (MAX_ATTEMPTS=3), jittered exponential, base 100ms; prune only on registration errors"
  - "Device-token body uid handled via .strict() REJECTION (400), matching the codebase subscription IDOR convention — stronger than silent-ignore, same security outcome"
  - "Broadened jest testMatch to discover colocated *.test.js so the plan's named path src/notifications/push/fcm.test.js runs under npm test"

patterns-established:
  - "Generic PII-safe push copy: render category title + one generic body, routing only in data.deeplink"
  - "Isolating FCM fan-out: prune/backoff/swallow taxonomy keyed by messaging/* error codes"

requirements-completed: [NPUSH-05, NPUSH-08, NPUSH-04]

# Metrics
duration: ~35min
completed: 2026-06-06
---

# Phase 13 Plan 02: Backend FCM Send Transport + Device-Token Routes Summary

**Replaced the Phase-12 fcm.send no-op with a real firebase-admin sendEachForMulticast fan-out (prune + bounded backoff + per-token isolation), added IDOR-safe device-token register/unregister routes, and a SEPARATE generic PII-safe push copy set — all TDD, all in the sibling backend repo on `feat/fcm-push-transport`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-06
- **Completed:** 2026-06-06
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified/created:** 12 (4 prod, 3 new Wave-0 tests, 4 regression-fixed unit tests, 1 config)

## Accomplishments

- **Task 1 — generic PII-safe push copy:** Added a SEPARATE `push_*` set (new_match, price_drop, booked, sold, back_available) to `translations.js` with category-specific titles + one canonical generic body per language, RU/EN parity, and a new param-free `renderGenericPush(key, lang)`. The Wave-0 parity test asserts RU/EN parity AND the **absence of every `{...}` interpolation token** plus no KGS/seller/location strings (NPUSH-08 / D-08b hard-ban).
- **Task 2 — real fcm.send fan-out:** Replaced the stub with `DeviceToken.find({uid})` → `sendEachForMulticast`. Prunes `registration-token-not-registered` / `invalid-argument` tokens; bounded jittered exponential backoff (≤3 attempts) on transient/429 only; one bad token never aborts the fan-out or throws (prune failures swallowed too). Renders generic copy and carries ONLY `{ deeplink }` in `data`. Reuses the cached-OAuth `ensureInitialized()`; **no google-auth-library** (NPUSH-05).
- **Task 3 — device-token routes:** `POST /device-tokens` (zod `registerDeviceTokenSchema`, upsert on unique token) and `DELETE /device-tokens/:token`, both deriving `uid` exclusively from `req.auth.uid`. DELETE is scoped to the caller uid so another user's token deletes 0 rows (IDOR-safe). Mounted under `verifyIdToken`, not admin-gated. Backend half of NPUSH-04.

## Task Commits

1. **Task 1: generic PII-safe push_* copy + renderGenericPush** — `c34d16d` (feat)
2. **Task 2: real firebase-admin fcm.send fan-out** — `11e8068` (feat)
3. **Task 3: device-token register/unregister routes** — `a30c5df` (feat)
4. **Regression fix: stub fcm.send in DB-less emit unit tests** — `34f4155` (fix)

_All commits on backend branch `feat/fcm-push-transport`. Not pushed._

## Files Created/Modified

**Created (backend, all in carEx-services):**
- `__tests__/push-copy-parity.test.js` — RU/EN parity + no-PII-token assertions for push_* (12 tests)
- `src/notifications/push/fcm.test.js` — fan-out prune/isolation/backoff/no-PII coverage (8 tests, firebase-admin + DeviceToken mocked)
- `src/notifications/__tests__/deviceTokens.test.js` — register/unregister upsert/dedup/reassign + IDOR + validation (11 tests, real replset)

**Modified (backend):**
- `src/notifications/translations.js` — push_* set (RU+EN) + `renderGenericPush` export
- `src/notifications/push/fcm.js` — real send loop (PRUNE_CODES / TRANSIENT_CODES taxonomy, MAX_ATTEMPTS=3, jittered backoff)
- `src/notifications/router.js` — POST/DELETE device-token routes (uid from Bearer)
- `src/notifications/schemas.js` — `registerDeviceTokenSchema` + `platformEnum`
- `package.json` — jest `testMatch` broadened to discover colocated `*.test.js` (+ explicit `testPathIgnorePatterns`)
- `src/notifications/__tests__/{actorExclusion,dedup,guards,priceDirection}.test.js` — `jest.mock('../push/fcm')` stub

## Test Results (actual)

| Wave-0 file | Result |
|-------------|--------|
| `__tests__/push-copy-parity.test.js` | PASS — 12/12 |
| `src/notifications/push/fcm.test.js` | PASS — 8/8 |
| `src/notifications/__tests__/deviceTokens.test.js` | PASS — 11/11 |

**Full backend suite (`npm test`):** 416 passed / 418, 53 of 54 suites green. The only failure is the **pre-existing** `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` (2 tests, HTTP 410), verified failing identically at the plan base commit `89a6e2d` before any 13-02 work — out of scope, logged to `deferred-items.md`.

## Decisions Made

- **One generic body per language** (not per category) — D-07 says "one canonical line per category"; here all five share the same generic open-to-view body, which satisfies "no PII" and is the simplest D-07-compliant form. Titles are category-specific (D-08).
- **`.strict()` rejection over silent-ignore** for a body-supplied `uid` on register — matches the existing subscription IDOR test convention and is the stronger guarantee. Security outcome is identical (no row ever created under another uid).
- **Backoff tuning** (Claude's discretion per CONTEXT): 3 total attempts, jittered exponential from 100ms; a whole-batch `sendEachForMulticast` throw is also treated as transient and retried (bounded), never propagated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jest testMatch did not discover the plan's named test path**
- **Found during:** Task 2 (before writing fcm.test.js)
- **Issue:** `package.json` jest `testMatch` was `["**/__tests__/**/*.test.js"]`. The plan (and its verify command) names the test at `src/notifications/push/fcm.test.js` — OUTSIDE any `__tests__/` dir — so `npx jest src/notifications/push/fcm.test.js` reported "No tests found" and `npm test` would never run it.
- **Fix:** Added `"**/?(*.)+(spec|test).js"` to `testMatch` and an explicit `testPathIgnorePatterns: ["/node_modules/"]`. Verified: colocated tests now discovered, zero node_modules pulled in.
- **Files modified:** `package.json`
- **Verification:** `npx jest --listTests` shows the colocated file, 0 node_modules; `npx jest src/notifications/push/fcm.test.js` runs.
- **Committed in:** `11e8068` (Task 2 commit)

**2. [Rule 1 - Bug] Real fcm.send broke DB-less notification unit tests (regression)**
- **Found during:** post-Task-3 full-suite run
- **Issue:** Task 2 made `emit()`'s instant path call the REAL `fcm.send`, which calls `DeviceToken.find()` against Mongo. Four Phase-12 notification UNIT suites (actorExclusion/dedup/guards/priceDirection) run with no DB connection and relied on the no-op stub → `devicetokens.find() buffering timed out` (11 test failures).
- **Fix:** `jest.mock('../push/fcm')` to a success-shaped no-op at the top of each of the four files. No production code changed; real transport coverage lives in `push/fcm.test.js`.
- **Files modified:** `src/notifications/__tests__/{actorExclusion,dedup,guards,priceDirection}.test.js`
- **Verification:** all four suites green; full suite back to only the pre-existing ServiceOrder failure.
- **Committed in:** `34f4155`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** Both necessary; no scope creep — one made the plan's own test runnable, one repaired a regression caused directly by Task 2's wiring.

## Issues Encountered

- **Pre-existing ServiceOrder test failure (NOT this plan):** `ServiceOrder.providerSnapshot.test.js` returns 410 on two order-creation tests, reproduced at base commit `89a6e2d`. Logged to `deferred-items.md`; recommend triaging under Phase 12 moderation.

## Cross-repo / Deployment Notes (IMPORTANT)

- **(a)** All 13-02 code is on the **sibling backend repo** `carEx-services`, branch **`feat/fcm-push-transport`** — NOT pushed and NOT merged. Railway deploys backend **`main`** ([[backend_deploy_gotcha]]), so these changes do **not** take effect in prod until this branch is merged to backend `main`.
- **(b)** **Phase 12 backend is also unmerged** and rides on this branch's base — the base commit is `89a6e2d feat(12-05) ...`. The merge to `main` will carry the full Phase-12 + Phase-13-backend stack together (9 Phase-12 commits + 4 here).
- **(c)** **Human verification still pending (user_setup A1):** confirm the existing `FIREBASE_SERVICE_ACCOUNT_JSON` service account has **FCM send scope** (FCM API enabled / `messaging.send` IAM grant) in the Firebase Console before relying on prod delivery. The send path uses that same credential via `ensureInitialized()`; without the scope, `sendEachForMulticast` will fail at runtime in prod even though all unit tests (which mock firebase-admin) pass.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-13-02-01 (lock-screen PII) mitigated by generic copy + deeplink-only data + the PII-token assertion test. T-13-02-03 (IDOR) mitigated by uid-from-Bearer + caller-scoped DELETE filter. T-13-02-04 (poisoned-token DoS) mitigated by per-token isolation + prune + bounded backoff. T-13-02-02 (send-time TOCTOU) left to the existing upstream `emit()` `Car.findById` gate — not duplicated, not bypassed.

## Next Phase Readiness

- Backend send transport + device-token persistence ready; the mobile half (13-01 spike → PushService → AuthContext token lifecycle) can consume `POST/DELETE /api/notifications/device-tokens`.
- **Blockers before prod:** (1) merge `feat/fcm-push-transport` to backend `main`; (2) verify FCM send scope (A1).

## Self-Check: PASSED

- Files: all 7 plan artifacts FOUND (translations.js, push-copy-parity.test.js, fcm.js, fcm.test.js, router.js, schemas.js, deviceTokens.test.js).
- Commits: `c34d16d`, `11e8068`, `a30c5df`, `34f4155` all present in `git log` on `feat/fcm-push-transport`.
- Verification commands: all three Wave-0 files PASS (12 + 8 + 11 = 31); full suite green except the documented pre-existing ServiceOrder failure.

---
*Phase: 13-fcm-push-transport-native*
*Completed: 2026-06-06*

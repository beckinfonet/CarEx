---
phase: 14-daily-digest-scheduling
verified: 2026-06-07T23:30:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification_resolved: "2026-06-07 — operator confirmed the digest push tap opens the in-app Notification Center on a real device against deployed backend main (runDigest sent:1, delivered to 1 device token). See 14-HUMAN-UAT.md."
human_verification:
  - test: "Trigger a real digest run (or set DIGEST_HOUR to a near-future minute), then tap the digest push notification on a physical device"
    expected: "Tapping the push opens the in-app Notification Center (NotificationsScreen), NOT a single CarDetails screen; this validates D-03 end-to-end across all three push states (foreground / background / quit)"
    why_human: "Requires a real device with FCM push delivery and a seeded digestPending row; the deeplink routing logic is unit-tested (digestDeeplink.test.tsx passes), but the full push-tap path through RNFB and PushTapRoutingEffect cannot be verified programmatically from this repo"
---

# Phase 14: Daily Digest & Scheduling Verification Report

**Phase Goal:** Buyers with daily-cadence saved searches (plus daily-cap overflow and quiet-hours-queued items) receive one localized morning digest push per day, delivered crash-safely by an in-process scheduled worker.
**Verified:** 2026-06-07T23:30:00Z
**Status:** passed (human verification resolved 2026-06-07)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An in-process `node-cron` job runs inside the Express service, gated by `require.main === module`, firing at a fixed Asia/Bishkek morning hour | ✓ VERIFIED | `server.js` lines 29-30 import `cron`/`runDigest`/`DIGEST_HOUR` at top level; `cron.schedule()` at line 1524 is strictly inside the `require.main === module` block (line 1510). `DIGEST_HOUR=8`; expression `0 ${DIGEST_HOUR} * * *`; `timezone: 'Asia/Bishkek'`; `noOverlap: true`. Test NDIG-01/NDIG-04 passes and asserts the source-contract position. `require('./server')` returns the app without starting a scheduler (verified via `node -e` — process exits clean). |
| 2 | A user with five pending digest items receives exactly ONE localized push (`digest_title {count}`) | ✓ VERIFIED | `sendDigest` in `fcm.js` renders `renderDigest(lang, count)` (count-only, PII-safe) and calls `fanOut()` once per user. Integration test "NDIG-03 one-push-count" seeds 5 rows for uid `u1` and asserts `sendDigest` called once with `count: 5`. `fcm.test.js` still passes (send() unchanged). |
| 3 | A simulated mid-run crash causes neither a double-send nor a drop | ✓ VERIFIED | `runDigest` uses atomic `updateMany` to claim rows (`digestRunId`), groups by uid, and clears `digestPending` only on `{ ok: true }`. Crash test "NDIG-02 crash no-double-send/no-drop" passes: user A cleared, user B retained; re-run sends B exactly once and does not re-send A. Re-claimable leftover test also passes (stale digestRunId is re-stamped). |
| 4 | Snapshot boundary `createdAt <= runStart` excludes post-runStart rows | ✓ VERIFIED | The `updateMany` claim filter includes `createdAt: { $lte: runStart }`. Integration test "NDIG-02 snapshot bound" inserts a row 1 minute after `runStart` and asserts it is never claimed/sent/cleared (digestPending stays true, digestRunId stays null). |
| 5 | The same cron run prunes notifications older than 90 days and stale device tokens | ✓ VERIFIED | `prune()` in `digest.js` (line 184) deletes `Notification` rows with `createdAt < notifCutoff` (90 days) and `DeviceToken` rows with `lastSeenAt < tokenCutoff` (90 days). Both queries are date-bounded. Tests "NDIG-05/NDOM-06 90-day prune" and "NDIG-05 stale-token prune" pass with boundary rows. T-14-04-01 spy test asserts no unconditional delete. Prune failure is non-fatal (wrapped). |
| 6 | The digest flush re-checks the hide-hook so a listing hidden overnight is excluded | ✓ VERIFIED | `runDigest` calls `Car.findById(carId)` with ZERO bypass flags (mirrors `notificationService.emit`). Bypass-flag grep gate over non-comment lines of `digest.js` returns 0. Integration test "SC4 hide-hook re-check" seeds 3 rows (active / suspended / null-car) and asserts only the active row is sent (count: 1); the other 2 rows stay `digestPending: true`. |
| 7 | RU digest title renders grammatically correct 3-form plural for all count boundaries | ✓ VERIFIED | `pluralizeRu` and `renderDigest` exported from `translations.js`. D-04 boundary table (20 pluralizeRu cases + 9 rendered RU title cases + 1 EN case) passes in `digest.test.js`. Rendered outputs confirmed via `node -e`: count 1 → "1 новая машина", 3 → "3 новые машины", 5 → "5 новых машин", 11 → "11 новых машин". Parity test (`notification-translations-parity.test.js`) passes with `digest_*` keys present. |
| 8 | A digest push deeplink (`carex://notifications`) routes to the in-app Notification Center; existing routing is unchanged | ✓ VERIFIED | `App.tsx` exports `routeDeeplink`; notifications branch at line 200 handles `normalizedPath === 'notifications'` → `navigationRef.navigate('Notifications')`. `linking.config.screens.Notifications: 'notifications'` registered (line 300). `digestDeeplink.test.tsx` passes all 6 cases: carex://, https form, trailing slash, listing unchanged, search unchanged, unknown path still ignored. |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `carEx-services/src/notifications/translations.js` | `pluralizeRu` + `renderDigest` + `digest_title`/`digest_body` RU+EN | ✓ VERIFIED | All four exports present and substantive; parity-safe sentinel `#NOUN#` pattern; `module.exports.pluralizeRu`, `module.exports.renderDigest` confirmed. |
| `carEx-services/src/notifications/__tests__/digest.test.js` | Phase-wide test scaffold; 50 passing, 0 todo | ✓ VERIFIED | File exists; `npx jest` → 50 passed / 0 todo. Covers all VALIDATION.md rows. |
| `carEx-services/package.json` | `node-cron: "^4.2.1"` | ✓ VERIFIED | `grep '"node-cron"' package.json` → `"node-cron": "^4.2.1"`. `require('node-cron')` resolves. |
| `carEx-services/src/notifications/push/fcm.js` | `sendDigest` sibling to `send`, shared `fanOut()` core | ✓ VERIFIED | `module.exports = { send, sendDigest }` at line 206. `typeof fcm.sendDigest === 'function'` confirmed via `node -e`. `send()` behavior unchanged (existing `fcm.test.js` green). |
| `carEx-services/src/notifications/digest.js` | `runDigest` + `DIGEST_HOUR = 8` + `prune` + `TOKEN_STALE_DAYS` exported | ✓ VERIFIED | `node -e` → `runDigest: function DIGEST_HOUR: 8 TOKEN_STALE_DAYS: 90 prune: function`. File is 205 lines with full crash-safe flush + prune implementation. No bypass flags (grep gate = 0). |
| `carEx-services/src/models/Notification.js` | `digestRunId` claim field on the schema | ✓ VERIFIED | `Notification.schema.path('digestRunId')` defined; type String, default null. `NOTIFICATION_RETENTION_DAYS = 90` unchanged. Existing indexes intact. |
| `carEx-services/server.js` | `cron.schedule` inside the `require.main === module` block | ✓ VERIFIED | `cron.schedule` at line 1524, after the gate at line 1510 and before `module.exports` at line 1539. Timezone Asia/Bishkek, noOverlap, DIGEST_HOUR expression. `require('./server')` returns app object and process exits (no open scheduler handle). |
| `App.tsx` | `notifications` branch in `routeDeeplink` + exported + `Notifications` in linking config | ✓ VERIFIED | Branch at lines 200–206; `export function routeDeeplink` at line 135; `Notifications: 'notifications'` in linking.config.screens at line 300. |
| `__tests__/digestDeeplink.test.tsx` | Unit test proving all 6 behavior cases | ✓ VERIFIED | File exists; `npx jest __tests__/digestDeeplink.test.tsx` → 6 passed. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server.js` require.main block | `cron.schedule → runDigest` | `0 ${DIGEST_HOUR} * * *`, Asia/Bishkek, noOverlap | ✓ WIRED | Lines 1524–1535; DIGEST_HOUR imported from digest.js at top level (line 30); expression template literal |
| `runDigest` | `fcm.sendDigest` | one call per uid with `count = survivingIds.length` | ✓ WIRED | `digest.js` line 139: `fcm.sendDigest({ uid, count: survivingIds.length, lang, data: { deeplink: DIGEST_DEEPLINK } })` |
| `fcm.sendDigest` | `translations.renderDigest` | renders digest_title with `{count}` interpolated | ✓ WIRED | `fcm.js` line 202: `const { title, body } = renderDigest(lang, count)` |
| `sendDigest` | `DeviceToken fan-out + pruneToken` | `fanOut()` shared core with sendEachForMulticast | ✓ WIRED | `fcm.js` line 203: `return fanOut(uid, { title, body }, deeplinkOnly(data))`; fanOut does token fetch + retry + prune |
| `runDigest` clear step | `Notification.updateMany digestPending:false` | per-id clear after successful send | ✓ WIRED | `digest.js` lines 149–153: `updateMany({ _id: { $in: survivingIds } }, { $set: { digestPending: false }, $unset: { digestRunId: '' } })` |
| `runDigest` hide-hook | `Car.findById` (plain, no bypass) | drop rows where car null or status !== 'active' | ✓ WIRED | `digest.js` line 127: `const car = await Car.findById(carId)` — no options, no bypass flags |
| `App.tsx routeDeeplink` | `navigationRef.navigate('Notifications')` | `normalizedPath === 'notifications'` branch | ✓ WIRED | `App.tsx` lines 200–206; confirmed by digestDeeplink.test.tsx passing |
| `runDigest` prune step | `Notification.deleteMany / DeviceToken.deleteMany` | 90-day `createdAt` cutoff + stale `lastSeenAt` cutoff | ✓ WIRED | `digest.js` lines 192/196: both deleteMany calls with `$lt` date filter |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `digest.js runDigest` | `claimed` (digestPending rows) | `Notification.find({ digestPending: true, digestRunId: runId }).lean()` | Yes — real Mongoose query against live collection; seeded by `notificationService.emit` setting `digestPending: true` | ✓ FLOWING |
| `fcm.js fanOut` | `rows` (device tokens) | `DeviceToken.find({ uid }).lean()` | Yes — real Mongoose query | ✓ FLOWING |
| `digest.js prune` | `notifCutoff`, `tokenCutoff` | computed from `now` (injected or `new Date()`) via `NOTIFICATION_RETENTION_DAYS * DAY_MS` | Yes — real date math against live constants | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `node-cron` resolves | `node -e "require('node-cron')"` | exits 0 | ✓ PASS |
| `runDigest` exports + DIGEST_HOUR=8 | `node -e "..."` | `runDigest: function DIGEST_HOUR: 8` | ✓ PASS |
| `fcm.send` + `fcm.sendDigest` both exported | `node -e "..."` | `send: function sendDigest: function` | ✓ PASS |
| `Notification.digestRunId` schema path + RETENTION_DAYS | `node -e "..."` | `true 90` | ✓ PASS |
| `require('./server')` starts no scheduler | `node -e "const s=require('./server'); ..."` | app exported, process exits in 300ms | ✓ PASS |
| All 50 digest tests pass | `npx jest digest.test.js` | 50 passed, 0 todo | ✓ PASS |
| Parity test passes with digest_* keys | `npx jest notification-translations-parity.test.js` | 5 passed | ✓ PASS |
| Mobile deeplink tests pass | `npx jest digestDeeplink.test.tsx` | 6 passed | ✓ PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes were declared for this phase. Behavioral spot-checks above cover the equivalent verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NDIG-01 | 14-04 | In-process `node-cron` job gated by `require.main === module` | ✓ SATISFIED | `cron.schedule` inside the gate at server.js:1524; test NDIG-01 asserts source-contract position; `require('./server')` starts no scheduler |
| NDIG-02 | 14-03 | Digest aggregates `digestPending` atomically — snapshot/claim/send/clear only sent ids (crash-safe, no double-send/drop) | ✓ SATISFIED | `runDigest` uses `digestRunId` claim + per-id `updateMany` clear; crash test + snapshot bound test + re-claimable test all pass |
| NDIG-03 | 14-01, 14-02, 14-03, 14-05 | Daily-cadence + cap-overflow + quiet-hours items delivered in one localized push per user; digest deeplink routes to Notification Center | ✓ SATISFIED | `sendDigest` with count-bearing `renderDigest`; one call per uid in `runDigest`; `carex://notifications` → `Notifications` screen in App.tsx |
| NDIG-04 | 14-01, 14-04 | Digest fires at fixed Asia/Bishkek morning hour via `DIGEST_HOUR` constant | ✓ SATISFIED | `DIGEST_HOUR = 8`; cron expression `0 8 * * *`; `timezone: 'Asia/Bishkek'`; test NDIG-04 asserts these |
| NDIG-05 | 14-04 | Cron prunes dead device tokens and notifications older than 90 days | ✓ SATISFIED | `prune()` in `digest.js` with `TOKEN_STALE_DAYS = 90`; both prune integration tests pass; T-14-04-01 date-bounded filter assertion passes |
| NDOM-06 | 14-04 | Notifications older than 90 days are pruned (job executes in Phase 14) | ✓ SATISFIED | `NOTIFICATION_RETENTION_DAYS = 90` from Notification model; `Notification.deleteMany({ createdAt: { $lt: notifCutoff } })` in `prune()`; 90-day prune test passes |

All 6 requirements mapped to Phase 14 are SATISFIED.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No debt markers (TBD/FIXME/XXX) | — | — | — | Clean |
| No empty implementations | — | — | — | Clean |
| No unconditional deleteMany | — | — | — | Both deleteMany calls carry `$lt` date filter (T-14-04-01 asserts this) |

No blockers or warnings found in Phase 14 modified files.

**Notable (pre-existing, out of scope):** `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` has 2 pre-existing failures documented since Phase 13. They are in a file not touched by Phase 14 and are explicitly excluded from this verification per the CROSS_REPO_NOTE baseline.

---

### Human Verification Required

#### 1. Digest Push Tap — Real Device End-to-End (D-03 / NDIG-03)

**Test:** With a real device registered in Firebase, seed a `digestPending: true` row for the test user in MongoDB. Either set `DIGEST_HOUR` to a near-future minute or call `runDigest({ now: new Date() })` directly in a test script. After FCM delivers the push, tap it from all three states (foreground, background, quit/cold-start).

**Expected:** In all three states, the push tap opens the in-app `NotificationsScreen` (the Notification Center feed), NOT a `CarDetails` screen or any other screen.

**Why human:** This requires a live FCM token registered on a real device, a deployed backend with push credentials, and a real OS push delivery. The deeplink routing logic (`routeDeeplink`) is fully unit-tested and VERIFIED in code (6/6 cases pass in `digestDeeplink.test.tsx`), and `PushTapRoutingEffect` in `App.tsx` already calls `routeDeeplink(remoteMessage.data.deeplink)` unchanged from Phase 13. However, the complete push→tap→navigate chain across RNFB states cannot be exercised without a real device.

---

### Gaps Summary

No gaps found. All 8 must-have truths are VERIFIED with direct code evidence and passing automated tests. The single human verification item is a real-device push-tap end-to-end check — the routing logic is fully implemented and unit-tested, but the push delivery path requires a physical device.

---

_Verified: 2026-06-07T23:30:00Z_
_Verifier: Claude (gsd-verifier)_

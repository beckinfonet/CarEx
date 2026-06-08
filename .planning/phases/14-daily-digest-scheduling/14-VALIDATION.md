---
phase: 14
slug: daily-digest-scheduling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Repo note:** all phase code lives in the BACKEND repo `carEx-services` (sibling at
> `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`, on `main`).
> Commands below run from the backend repo root, not this mobile repo.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `^29.7.0` (backend repo) |
| **Config file** | inline in backend `package.json` (`testMatch: ["**/__tests__/**/*.test.js","**/?(*.)+(spec\|test).js"]`, `testEnvironment: node`, `testTimeout: 30000`) |
| **Quick run command** | `npx jest src/notifications/__tests__/digest.test.js` |
| **Full suite command** | `npm test` (from backend repo root) |
| **Estimated runtime** | ~30 seconds (DB-backed via `MongoMemoryReplSet`) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest src/notifications/__tests__/digest.test.js`
- **After every plan wave:** Run `npm test` (full backend suite — must stay green; includes parity + emit-guard tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

No real-device UAT required — this is a backend worker; all behavior is observable via test + log assertions (unlike the Phase 13 push UAT).

---

## Per-Task Verification Map

| Ref | Wave | Requirement | Secure Behavior / Behavior | Test Type | Automated Command / Assertion | File Exists | Status |
|-----|------|-------------|----------------------------|-----------|-------------------------------|-------------|--------|
| SC1 | 0 | NDIG-01 | `require('./server')` in tests starts NO scheduler; `digest.js` exports `runDigest` callable directly | unit + harness | `npx jest src/notifications/__tests__/digest.test.js` — assert no open cron handle / no fcm call on import | ❌ W0 | ⬜ pending |
| SC1 | 0 | NDIG-04 | Fires at Asia/Bishkek 08:00 via `DIGEST_HOUR` constant | unit | Assert cron expression built from `DIGEST_HOUR` is `0 8 * * *` and options carry `timezone:'Asia/Bishkek'` | ❌ W0 | ⬜ pending |
| SC2 | 0 | NDIG-03 | 3 daily matches + 2 cap-overflow → exactly ONE push with count=5 | integration | Seed 5 `digestPending` rows for one uid; call `runDigest()`; assert `sendDigest` called once with `count:5` | ❌ W0 | ⬜ pending |
| SC2 | 0 | D-04 | RU 3-form title correct for counts 1/3/5/11 | unit | `pluralizeRu` boundary table; render `digest_title` for {1,2,4,5,11,14,21,0} | ❌ W0 | ⬜ pending |
| SC3 | 0 | NDIG-02 | Crash mid-run → no double-send, no drop | integration | Stub `sendDigest` to throw for user B after user A clears; assert A cleared, B still `digestPending:true`; re-run → B sent, A NOT re-sent | ❌ W0 | ⬜ pending |
| SC3 | 0 | NDIG-02 | Snapshot bound `createdAt <= runStart` excludes mid-run new rows | integration | Insert a row with `createdAt > runStart`; assert it is not in the batch | ❌ W0 | ⬜ pending |
| SC4 | 0 | NDIG-05 / NDOM-06 | 90-day notifications pruned | integration | Seed a 91d-old row → assert deleted; seed an 89d row → assert kept | ❌ W0 | ⬜ pending |
| SC4 | 0 | NDIG-05 | Stale device tokens pruned (non-duplicative with send-time prune) | integration | Seed stale-`lastSeenAt` token → assert deleted; fresh token kept | ❌ W0 | ⬜ pending |
| SC4 | 0 | NDIG-03 | Hide-hook re-check: listing hidden overnight not pushed | integration | `digestPending` row whose Car is now non-active → assert excluded from count and not sent | ❌ W0 | ⬜ pending |
| parity | 0 | NDIG-03 | `digest_*` RU/EN parity | unit | existing `__tests__/notification-translations-parity.test.js` re-runs green after adding `digest_*` keys | ✅ (extends existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/notifications/__tests__/digest.test.js` — covers NDIG-01..05 + SC1..4 (the whole phase)
- [ ] `digest_*` keys added to `translations.js` (RU+EN) so the existing parity test exercises them
- [ ] Dependency install: `npm install node-cron@^4.2.1` (backend repo)
- [ ] (verify) a `lastSeenAt`-refresh check on the device-token register route, else adjust the token-prune signal

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notification-Center deeplink opens on digest tap | NDIG-03 / D-03 | Requires real device + push delivery; deeplink routing owned by mobile `App.tsx linking` | After backend deploy, trigger a digest, tap the push on device, confirm it opens the in-app Notification Center (not a single CarDetails) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 15
plan: 04
subsystem: notifications
tags: [broadcast, new-listing, daily-cap, hide-hook, fcm, backend]
repo: backend
repo_path: /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services
requires:
  - "15-01: broadcast.test.js + guards.test.js broadcast assertions (RED scaffold)"
  - "15-02: User.notificationPrefs.newListingEnabled + Notification.pushSuppressed + R-02 PUT prefs"
  - "15-03: push_new_listing + in-app new_listing copy (RU/EN)"
provides:
  - "new_listing_broadcast branch in emit() — all-token-holder broadcast audience"
  - "bishkekMorningBoundary(now) per-user daily-cap window helper"
  - "uidOf widening for {uid}-shaped broadcast targets"
affects:
  - "carEx-services/src/notifications/notificationService.js (emit pipeline)"
tech-stack:
  added: []
  patterns:
    - "fixed-offset Bishkek (+06:00) boundary math, no TZ lib (milestone constraint)"
    - "DeviceToken.distinct('uid') audience source of truth (not Subscription)"
    - "per-recipient dailyCap (?? 3) cap counted via countDocuments since boundary"
    - "safeModel() graceful model resolution for DB-less DI tests"
key-files:
  created: []
  modified:
    - "carEx-services/src/notifications/notificationService.js"
decisions:
  - "Local candidateSet audience guard (defense-in-depth) so actor/saved-search uids can never slip through regardless of the query layer — also makes the DI stub's $in-ignoring User.find behave correctly"
  - "safeModel() returns null instead of throwing when DeviceToken/User unregistered → broadcast branch no-ops in saved-search-only DI tests (dedup/actorExclusion) instead of regressing them"
  - "DIGEST_HOUR imported from digest.js (D-04) — broadcast cap window + digest cron share one fire-time retune point"
metrics:
  duration: ~5min
  tasks: 2
  files: 1
  completed: 2026-06-10
backend_commits:
  - "a9d2ccf — feat(15-04): bishkek boundary helper + uidOf widening (Task 1)"
  - "b824168 — feat(15-04): new_listing_broadcast branch in emit() (Task 2)"
deploy_note: "Backend `main` is the branch Railway deploys (per MEMORY notifications_branch_topology + backend_deploy_gotcha). These two commits are local-ahead of origin/main and must be pushed for prod broadcast delivery."
---

# Phase 15 Plan 04: New-Listing Broadcast Branch Summary

Implemented the broadcast fan-out branch inside `emit()` — the only genuinely new logic in Phase 15. A new active listing now resolves an all-token-holder audience (`DeviceToken.distinct('uid')`), excludes the actor and saved-search-matched uids, filters by the `newListingEnabled`/`muteAll` prefs (legacy docs default-on via `$ne`), enforces a per-user daily push cap keyed on `pushSuppressed` + the Asia/Bishkek 08:00 boundary, writes one PII-free in-app row per recipient, and sends one `carex://search` OS push per under-cap recipient. Backend-repo-only, single file.

## What Was Built

**Task 1 — boundary helper + uidOf widening (`a9d2ccf`)**
- `bishkekMorningBoundary(now)`: most-recent `DIGEST_HOUR`:00 Asia/Bishkek instant ≤ now, computed with the fixed +06:00 offset (no TZ lib — milestone constraint). `DIGEST_HOUR` imported from `digest.js` so the broadcast cap window and the digest cron share one retune point (D-04). Verified: `FIXED_NOW=2026-06-10T12:00:00Z` → boundary `2026-06-10T02:00:00.000Z`.
- `uidOf(t)` widens the four `t.sub.uid` reads (actor-exclude + write loop) to accept both the legacy `{sub:{uid,cadence,kind}}` shape and the new `{uid}` broadcast shape (RESEARCH Pattern 2 / Pitfall 4 — the old `t.sub &&` short-circuit would have silently dropped a `{uid}` target). Write-loop `cadence`/`kind` reads guarded with `(target.sub && …)` fallbacks.
- No broadcast branch yet; existing saved-search/watch paths unchanged.

**Task 2 — new_listing_broadcast branch (`b824168`)**
- Branch slotted AFTER the saved-search write loop and BEFORE `return written;`, reusing the already-hide-hook'd `visible` Car — no re-fetch, no bypass flag (a hidden/non-active listing returned `[]` earlier, so reaching the branch means active). T-15-03 mitigated, grep-gated.
- `ssUids = new Set(written.map(r => r.uid))` → saved-search wins (Req 2). Audience = `DeviceToken.distinct('uid')` minus actor (Req 1, T-15-02) minus `ssUids`.
- `User.find({ firebaseUid:{$in}, 'notificationPrefs.muteAll':{$ne:true}, 'notificationPrefs.newListingEnabled':{$ne:false} }).select('firebaseUid notificationPrefs.dailyCap language')` — `$ne` so legacy docs read enabled (Req 5); selects `dailyCap` (R-01) + `language` (per-recipient RU/EN push).
- Per recipient: dedup on `${carId}:new_listing_broadcast` (≠ `new_match`, Pitfall 3); cap = `dailyCap ?? 3` (R-01) counted via `countDocuments({ uid, kind:'new_listing', pushSuppressed:{$ne:true}, createdAt:{$gte:boundary} })` (Pitfall 2 — sent pushes, not rows). Always write the in-app row (PII-free `data.deeplink:'carex://search'`, `carId:null`); push only when `!suppress`.
- `KEYS_BY_EVENT['new_listing_broadcast']` entry added for render-key-map clarity.

## Verification

| Check | Result |
|-------|--------|
| `broadcast.test.js` | GREEN 7/7 (audience excludes actor; saved-search wins dedup; row + push per recipient; over cap suppresses push not row; cap counts since bishkek boundary; opt-out/legacy doc; dedupeKey no collision) |
| `guards.test.js` | GREEN 6/6 (NDOM-03 hide-hook + grep gate + Phase 15 broadcast hide-hook + `new_listing_broadcast` presence) |
| `dedup.test.js` / `actorExclusion.test.js` | GREEN (no regression after widening) |
| Full backend `npm test` | 479 passed / 2 failed — both in the documented pre-existing `ServiceOrder.providerSnapshot.test.js` suite; **no new failures** |
| grep gate | `new_listing_broadcast`×2, `DeviceToken.distinct`×1, `pushSuppressed`×3; `.setOptions(`×0, `{ includeAll…`×0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Local `candidateSet` audience guard**
- **Found during:** Task 2 ("audience excludes actor" + "saved-search wins dedup" RED).
- **Issue:** The DI `makeUserStub().find(filter)` honors the pref `$ne` operators but ignores `firebaseUid:{$in:candidate}`, so the actor and saved-search uids came back from `User.find` and got broadcast rows. (In production Mongo `$in` does filter, but the audience exclusion is a security-critical invariant that must not depend on the query layer.)
- **Fix:** Compute `candidateSet = new Set(candidate)` and `if (!candidateSet.has(uid)) continue;` in the recipient loop — defense-in-depth honoring Req 1/2 locally.
- **Files modified:** `notificationService.js` · **Commit:** `b824168`

**2. [Rule 1 - Bug] `safeModel()` graceful model resolution**
- **Found during:** Task 2 full-suite run — `dedup.test.js` "new_match deeplink" test (a saved-search-only DI test injecting no `DeviceToken`/`User`) threw `MissingSchemaError: … "DeviceToken"` because the branch eagerly called `mongoose.model('DeviceToken')`.
- **Fix:** Added `safeModel(name)` (try/catch → null) and `if (!DeviceToken || !User) return written;` so the broadcast branch no-ops when neither dep nor a registered model exists. Production always registers both, so no behavior change there.
- **Files modified:** `notificationService.js` · **Commit:** `b824168`

Both fixes are within Task 2's scope (the broadcast branch I added introduced them).

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-15-02 (self-notify), T-15-03 (TOCTOU hide-hook), T-15-07 (cap-bypass DoS), T-15-08 (dedupeKey collision) all mitigated and proven by `broadcast.test.js` + `guards.test.js`.

## Known Stubs

None. The branch wires live `DeviceToken`/`User`/`Notification`/`fcm` collaborators; `safeModel`'s no-op fallback only affects DB-less unit tests, never production.

## Deploy Note

Backend `main` is what Railway deploys (MEMORY: `notifications_branch_topology`, `backend_deploy_gotcha`). Commits `a9d2ccf` + `b824168` are committed on backend `main` but are **local-ahead of `origin/main`** — push backend `main` for broadcast delivery to reach prod.

## Self-Check: PASSED
- `notificationService.js` modified — FOUND
- Backend commit `a9d2ccf` — FOUND (backend repo log)
- Backend commit `b824168` — FOUND (backend repo log)
- `broadcast.test.js` 7/7 + `guards.test.js` 6/6 GREEN — confirmed

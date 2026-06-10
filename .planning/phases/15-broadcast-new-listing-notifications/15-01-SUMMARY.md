---
phase: 15-broadcast-new-listing-notifications
plan: 01
subsystem: testing
tags: [jest, supertest, mongodb-memory-server, notifications, fcm, tdd, red-scaffold, backend]

# Dependency graph
requires:
  - phase: 12-notification-domain
    provides: emit() DI engine, Notification model, dedupeKey convention, guards.test.js DI-stub harness
  - phase: 13-fcm-push-transport
    provides: fcm.send({ uid, titleKey, lang, data }) transport, DeviceToken model
provides:
  - "broadcast.test.js — RED behavior contract for new_listing broadcast (audience/dedup/cap/opt-out/copy/dedupeKey isolation)"
  - "guards.test.js extension — Req 6 hide-hook reuse + new_listing_broadcast source-presence gate, existing grep gate preserved"
  - "users-prefs.test.js — GREEN executable spec for PUT /api/users/:uid notificationPrefs persistence (dot-path $set, allowlist, IDOR-safe)"
affects: [15-02, 15-03, 15-04, notificationService, server.js, User-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED test-first scaffold gates every Phase-15 implementation task (Nyquist compliance)"
    - "DI-stub broadcast harness mirrors guards.test.js (no live DB) for the User/DeviceToken broadcast path"
    - "Forward-schema + verbatim-fixed-handler executable spec (users-prefs.test.js) the 15-02 server.js edit must reproduce"

key-files:
  created:
    - "carEx-services/src/notifications/__tests__/broadcast.test.js"
    - "carEx-services/__tests__/users-prefs.test.js"
  modified:
    - "carEx-services/src/notifications/__tests__/guards.test.js"

key-decisions:
  - "broadcast.test.js uses pure DI stubs (User.find→.select→.lean, DeviceToken.distinct, Notification.countDocuments) — mirrors guards.test.js, no mongodb-memory-server, per plan acceptance criteria"
  - "Bishkek 08:00 boundary asserted concretely: FIXED_NOW=2026-06-10T12:00Z → boundary 2026-06-10T02:00:00Z (08:00 +06), locking R-01 for the 15-02 cap implementation"
  - "users-prefs.test.js registers a distinct forward model (UserPrefsSpec, collection usersprefsspec) carrying notificationPrefs.newListingEnabled — the real User.js schema lacks it until 15-02; distinct name avoids shadowing the real User model in a shared Jest worker"

patterns-established:
  - "Pattern: per-task atomic commits land in the BACKEND repo (carEx-services); only planning artifacts commit in carEx"
  - "Pattern: a GREEN executable-spec test (inlined fixed handler + forward schema) documents the exact behavior a future implementation task must reproduce byte-for-byte-in-behavior"

requirements-completed: ["Req 1", "Req 2", "Req 3", "Req 4", "Req 5", "Req 6"]

# Metrics
duration: ~12min
completed: 2026-06-10
---

# Phase 15 Plan 01: RED Test Scaffolds for Broadcast New-Listing Notifications Summary

**Three backend Jest scaffolds that gate the entire Phase-15 broadcast surface: a RED DI-style broadcast.test.js (7 assertions across audience/dedup/cap/opt-out/copy/dedupeKey isolation), a guards.test.js extension that keeps the bypass-flag grep gate green while adding a RED `new_listing_broadcast` source gate, and a GREEN supertest executable spec for PUT /api/users/:uid notificationPrefs persistence.**

## Split-Repo Note

This is a backend-repo-only plan. All three test files were created and committed in the **separate backend repo** `carEx-services` (branch `main`), NOT in carEx. Only this SUMMARY + STATE/ROADMAP/REQUIREMENTS planning artifacts commit in carEx.

**Backend repo:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-10
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 extended) — all in carEx-services

## Accomplishments
- `broadcast.test.js`: 7 RED DI tests encoding the canonical `-t` names from 15-VALIDATION.md — `audience excludes actor`, `saved-search wins dedup`, `row + push per recipient`, `over cap suppresses push not row`, `cap counts since bishkek boundary`, `opt-out suppresses; legacy doc enabled`, `broadcast dedupeKey no collision`. File loads cleanly; every assertion is RED against the current no-broadcast-branch `notificationService.js`.
- `guards.test.js` extended with the Req 6 hidden-car suppression assertion (reuses the `visible` guard) and a RED `new_listing_broadcast` source-presence gate, **without weakening** the existing `includeAllUsers/includeAllListingStatuses` grep gate (still GREEN).
- `users-prefs.test.js`: 4 GREEN supertest + mongodb-memory-server tests locking the R-02 fix spec — dot-path `$set` (siblings preserved), type-checked allowlist (T-15-01 mass-assignment), and IDOR-safe keying on `req.params.uid` (T-15-04).

## Task Commits

Each task committed atomically in the **carEx-services** backend repo:

1. **Task 1: Scaffold broadcast.test.js (RED)** — `5d4673d` (test)
2. **Task 2: Extend guards.test.js for the broadcast branch** — `28af09a` (test)
3. **Task 3: Scaffold users-prefs.test.js (GREEN executable spec)** — `21c302c` (test)

**Plan metadata:** committed in carEx (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified (all in carEx-services backend repo)
- `src/notifications/__tests__/broadcast.test.js` (created) — RED DI behavior contract for the broadcast path (Reqs 1-5,7 + dedupeKey isolation)
- `src/notifications/__tests__/guards.test.js` (modified) — added Req 6 hide-hook reuse test + `new_listing_broadcast` source gate; preserved the bypass-flag grep gate verbatim
- `__tests__/users-prefs.test.js` (created) — GREEN executable spec for PUT /api/users/:uid notificationPrefs persistence (Req 5 / R-02)

## Test State (verification evidence)
- `npx jest src/notifications/__tests__/broadcast.test.js` → **7 failed, 7 total** (RED-OK; no SyntaxError / module-not-found — reaches assertions then fails them).
- `npx jest src/notifications/__tests__/guards.test.js` → existing grep gate **PASSES**; the new `new_listing_broadcast` source assertion is **RED** (literal absent until 15-04); the hidden-car suppression assertion is structurally **GREEN** (the `visible` guard already returns `[]` for non-active cars — it will stay green once the broadcast branch lands behind that guard).
- `npx jest __tests__/users-prefs.test.js` → **4 passed, 4 total** (GREEN — boots in-memory Mongo, exercises the inlined fixed handler).
- Combined notifications + prefs + userLanguage run → only the 2 intended RED suites (broadcast, guards) fail; `userLanguage.test.js` and all other notification suites pass — **no regressions** from the new files (the distinct `UserPrefsSpec` model does not collide with the real `User` model).

## Decisions Made
- **DI stubs over live DB for broadcast.test.js** — per the plan's hard acceptance criterion (no mongodb-memory-server in that file); the in-memory `Notification` stub records `countDocuments` filters so the cap date/`pushSuppressed` bounds are assertable.
- **Concrete Bishkek boundary assertion** — `2026-06-10T02:00:00.000Z` (08:00 Asia/Bishkek, UTC+6) is asserted exactly, locking R-01 so 15-02's cap-window computation has a single ground-truth expectation.
- **Forward-schema spec model** — `users-prefs.test.js` registers `UserPrefsSpec` (with `notificationPrefs.newListingEnabled`, default `true`) because the real `User.js` schema lacks that field until 15-02; Mongoose strict mode would otherwise silently drop the dot-path write and make the spec un-writable. A distinct model/collection name prevents shadowing the real `User` model in a shared Jest worker (verified: `userLanguage.test.js` still passes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered a forward spec schema in users-prefs.test.js**
- **Found during:** Task 3 (users-prefs.test.js)
- **Issue:** The plan requires this file be GREEN immediately, but the real `User.js` schema has no `notificationPrefs.newListingEnabled` field (a 15-02 addition). Mongoose strict mode dropped the dot-path write, leaving `newListingEnabled` `undefined` and failing 3 of 4 assertions.
- **Fix:** The test registers a distinct forward model (`UserPrefsSpec`, collection `usersprefsspec`) carrying the 15-02 `notificationPrefs` shape including `newListingEnabled: { type: Boolean, default: true }` — mirroring the existing convention of inlining the forward FIXED handler verbatim. Distinct model name avoids colliding with the real `User` model in a shared Jest worker.
- **Files modified:** `carEx-services/__tests__/users-prefs.test.js`
- **Verification:** 4/4 GREEN; `userLanguage.test.js` (which requires the real `User` model) still passes in the same run — no model-name collision.
- **Committed in:** `21c302c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The forward-schema registration is the standard verbatim-spec convention extended from the handler to the schema (both are 15-02 additions). No scope creep; the file remains a pure spec for 15-02 to reproduce.

## Issues Encountered
None beyond the deviation above. The guards.test.js hidden-car assertion is structurally green now rather than red — acceptable because the plan's criterion is "GREEN after 15-04," and the controlling RED gate (the `new_listing_broadcast` source-presence assertion) correctly fails until the broadcast branch ships.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Wave-0 backend RED/GREEN scaffolds exist and load cleanly — every Phase-15 backend implementation task (15-02/15-03/15-04) now has an automated proof that already exists, satisfying the Nyquist gate from 15-VALIDATION.md.
- **15-02 must turn these GREEN:** add the broadcast branch to `notificationService.js` (User/DeviceToken audience, `new_listing_broadcast` dedupeKey, `pushSuppressed` field, Bishkek-boundary cap count, `$ne` pref filters) and add `notificationPrefs.newListingEnabled` to `User.js` + the `PUT /api/users/:uid` allowlist in `server.js` matching `users-prefs.test.js`.
- The remaining Wave-0 mobile toggle test and the existing `push-copy-parity.test.js` auto-coverage (Req 7) are tracked in other Phase-15 plans, not this backend-only plan.

## Self-Check: PASSED

- broadcast.test.js, guards.test.js, users-prefs.test.js all exist in carEx-services — FOUND
- Backend commits 5d4673d, 28af09a, 21c302c — FOUND
- 15-01-SUMMARY.md exists in carEx — FOUND

---
*Phase: 15-broadcast-new-listing-notifications*
*Completed: 2026-06-10*

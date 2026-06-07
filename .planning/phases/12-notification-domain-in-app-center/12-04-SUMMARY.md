---
phase: 12-notification-domain-in-app-center
plan: 04
subsystem: notification-domain
tags: [backend, notifications, router, rest, cursor, idor, subscriptions, tdd, wave-2]
requires:
  - "12-01: Notification/Subscription models + Wave-0 router.test.js/feedCursor.test.js scaffolds"
  - "12-03: schemas.js (createSubscriptionSchema, cadenceEnum, eventEnum)"
provides:
  - "[BE] src/notifications/router.js — uid-scoped /api/notifications/* REST surface"
  - "GET / cursor feed (NCEN-02), GET /unread-count (NCEN-03)"
  - "PATCH /:id/read + PATCH /read-all read-state (NCEN-04)"
  - "POST/GET/PATCH/DELETE /subscriptions CRUD (NSUB-01/03, NPRF-01/02)"
affects:
  - "12-05 server.js mount: app.use('/api/notifications', verifyIdToken, notificationRouter)"
  - "12-06+ mobile NotificationService consumes this REST surface"
tech-stack:
  added: []
  patterns:
    - "Base64 {createdAt,_id} cursor copied verbatim from moderation/router.js (S1)"
    - "Every Mongo filter includes uid: req.auth.uid (IDOR mitigation, never body/params uid)"
    - "Stub-auth Express harness (req.auth.uid driven per-test) to prove uid-scoping without firebase-admin"
    - "limit+1 fetch to detect next page without a count() round-trip"
key-files:
  created:
    - "[BE] src/notifications/router.js"
  modified:
    - "[BE] src/notifications/__tests__/feedCursor.test.js"
    - "[BE] src/notifications/__tests__/router.test.js"
decisions:
  - "PATCH /:id/read + PATCH /read-all are idempotent updateOne/updateMany returning { updated: modifiedCount } (NOT 404 on 0-match) — read-state is naturally idempotent and a 0-match on another user's id is the IDOR-safe outcome, not an error to surface."
  - "PATCH/DELETE /subscriptions/:id return 400 subscription_not_found on a 0-row match whether the id is non-existent OR belongs to another uid — one opaque envelope so a caller cannot probe for the existence of other users' subscription ids (IDOR)."
  - "An attacker-supplied top-level body.uid is rejected by the .strict() discriminatedUnion (unknown key → 400 invalid_payload) AND the handler never reads it — uid is always req.auth.uid. Both layers proven by test."
  - "Edit schema is an inline router-local zod object (cadence?/events?, .strict(), .refine at-least-one) rather than added to schemas.js — only the router edits subscriptions and the manage screen only touches cadence/events; criteria/carId/kind/uid are immutable post-create."
  - "ObjectId cast guard (assertObjectId → 400 invalid_object_id) precedes every :id filter so a garbage id throws a clean 400 instead of a Mongoose CastError 500."
metrics:
  duration: "~8m"
  completed: "2026-06-06"
  tasks: 2
  files: 3
---

# Phase 12 Plan 04: Notification REST Router Summary

The uid-scoped `/api/notifications/*` Express router that exposes the Phase 12 notification domain over pure REST: a reverse-chronological base64-cursor feed, read-state endpoints, and full subscription CRUD — every query scoped to the verified-token uid (IDOR mitigation), and deliberately NOT admin-gated so any authenticated buyer reaches their own notification center. Both Wave-0 router/feedCursor scaffolds filled with real assertions.

## What Was Built

**Task 1 — Feed + read-state endpoints** (`69be5ac`, backend repo)
- `router.js` created: `encodeCursor`/`decodeCursor` copied verbatim from `moderation/router.js:27-45` (S1). `GET /` reverse-chron feed (`sort {createdAt:-1,_id:-1}`, `limit+1` fetch, base64 `nextCursor`, limit clamp `Math.min(Math.max(raw,1),100)` default 25, malformed cursor → 400 `invalid_cursor`). `GET /unread-count` → `{ count }` of `{ uid, read:false }`. `PATCH /read-all` (declared BEFORE `/:id/read` so the literal is never captured by the `:id` param) → `updateMany({uid,read:false})`. `PATCH /:id/read` → `updateOne({_id,uid})`.
- Every filter includes `uid: req.auth.uid`; the cursor `$or` shape is identical to moderation history.
- `feedCursor.test.js` filled: 12 tests — pagination + cursor stability across an inserted newer row, reverse-chron order, limit clamp, malformed cursor 400, second-user-rows-never-appear IDOR isolation, unread-count caller-only, read-one IDOR (another user's id → `updated:0`, row untouched), read-all caller-only.

**Task 2 — Subscription CRUD** (`dc92ae1`, backend repo)
- Added `POST /subscriptions` (safeParse `createSubscriptionSchema` → 400 `invalid_payload`; force `uid=req.auth.uid`, body uid ignored; watch → `events` default to all four via `eventEnum.options` per D-03; cadence default `instant` per NSUB-03; 201 + created doc), `GET /subscriptions` (`{uid,active:true}`, newest-first), `PATCH /subscriptions/:id` (inline `editSubscriptionSchema`: cadence?/events?, `.strict()`, `.refine` at-least-one; `findOneAndUpdate({_id,uid})`; 0-match → 400 `subscription_not_found`), `DELETE /subscriptions/:id` (`deleteOne({_id,uid})`; 0-match → 400 `subscription_not_found`).
- `assertObjectId` cast guard + `subscription_not_found`/`not_owner`/`invalid_object_id` registered in `KNOWN_USER_ERRORS`.
- `router.test.js` filled: 14 tests — non-admin caller completes full CRUD (NDOM-05, no `requireAdmin` in chain), saved_search cadence default instant, watch events length 4, explicit events subset honoured, unknown criteria key → 400, body.uid ignored + no row created under the attacker uid, list caller-only-active, PATCH/DELETE IDOR (another user's id → 400 `subscription_not_found`, target row survives), empty/unknown edit body → 400.

## Verification

- `npx jest src/notifications/__tests__/feedCursor.test.js` → **12 passed**.
- `npx jest src/notifications/__tests__/router.test.js` → **14 passed**.
- Full domain regression `npx jest src/notifications` → **7 suites, 51 passed** (no regression to 12-01/12-03 suites).
- `grep -c "req.auth.uid" src/notifications/router.js` → **12** (≥4 required).
- `grep -c "req.body.uid\|req.params.uid" src/notifications/router.js` → **0** (IDOR guard).
- `grep -c "requireAdmin" src/notifications/router.js` → **0** (not admin-gated, T-12-04-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literals tripped the IDOR / admin-gate source greps**
- **Found during:** Task 1 (acceptance grep)
- **Issue:** The router header comments spelled `req.body.uid` / `req.params.uid` and `requireAdmin` to document the security posture, which made `grep -c` return 2 and 1 respectively — both must be 0 per the acceptance criteria. (Same class of issue auto-fixed in 12-03 for the bypass-flag greps.)
- **Fix:** Reworded the header comments to describe "the request body or route params" and "never an admin gate" without spelling the grep literals. Documentation intent preserved; counts are now 0.
- **Files modified:** `[BE] src/notifications/router.js`
- **Commit:** `69be5ac`

## Authentication Gates

None.

## Known Stubs

- The router is built but NOT yet mounted — `app.use('/api/notifications', verifyIdToken, notificationRouter)` lands in 12-05 (plan scope: "Router file only"). Until then the endpoints are unreachable in production; tests mount the router behind a stub-auth middleware. This is the planned Wave-2 → Wave-2-mount handoff, not a blocking stub.
- `events`/`cadence` daily-digest plumbing (digestPending) is consumed by the Phase 14 cron, unchanged here.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Wave-0 RED scaffolds (test.todo importing the not-yet-built router) were created in 12-01; this plan built `router.js` and replaced the todos with real assertions in the same task commit. Because `tdd_mode` is `false` in config (gate inactive for this phase), RED/GREEN were not split into separate commits — implementation + filled tests landed atomically per task, with the suite proving GREEN. Both commits are `feat(...)`.

## Self-Check: PASSED

- Files: `src/notifications/router.js` (created), `feedCursor.test.js` + `router.test.js` (modified) confirmed present in `carEx-services`.
- Commits: `69be5ac`, `dc92ae1` confirmed in backend repo git log (atop `277988e` from 12-03).
- Tests: 12 + 14 plan-target tests pass; full 7-suite/51-test notifications domain green; all three grep gates satisfied.

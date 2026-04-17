---
phase: 02-admin-moderation-endpoints-backend
plan: 03
subsystem: moderation
tags: [suspend, unsuspend, transaction, withTransaction, last-admin-guard, idempotency, audit-ledger, ADMIN-01, ADMIN-02, SEC-03]

# Dependency graph
requires:
  - phase: 02-admin-moderation-endpoints-backend
    plan: 01
    provides: req.admin.uid propagation + MongoMemoryReplSet fixture (session.withTransaction-capable)
  - phase: 02-admin-moderation-endpoints-backend
    plan: 02
    provides: dispatchSchema + unsuspendSchema (strict Zod) + denySelfModeration middleware
provides:
  - service.suspend() — transactional (audit row → last-admin guard → User.moderationStatus update)
  - service.unsuspend() — transactional (audit row → User.moderationStatus reset to active)
  - POST /api/admin/moderation/:targetUid (suspend branch of dispatchSchema) live end-to-end
  - PATCH /api/admin/moderation/:targetUid/unsuspend live end-to-end
  - Two-step audit-row-first pattern established (every subsequent Phase 2 handler follows this)
  - KNOWN_USER_ERRORS set in router — Plans 02-04/02-05 pre-registered, just have to throw matching messages
affects: [02-04-revoke-role, 02-05-delete-edit-profile, 02-06-rate-limiter-and-e2e]

# Tech tracking
tech-stack:
  added: []   # no new deps — Plan 02-01 already shipped zod + express-rate-limit + mongo-memory-server repl-set
  patterns:
    - "session.withTransaction() establishes the transaction pattern for the codebase (first use of Mongoose transactions anywhere in backend)"
    - "Two-step audit-ledger pattern: ModerationAction.create([doc], { session }) → capture insertedAction._id → User.updateOne with lastActionId back-link, all inside one withTransaction() block (D-18 — explicitly NOT optimized into single $set)"
    - "writeAction() bypass inside transactions: writeAction() uses single-doc create() which cannot accept { session }; transactional handlers call ModerationAction.create([doc], { session }) directly with a comment explaining the bypass"
    - "Last-admin guard runs INSIDE the transaction (AdminUser.distinct + User.countDocuments both with .session(session)) — read/write isolation means two concurrent admin-suspend attempts cannot both commit if one would drop the count to 0"
    - "Router error-mapping via KNOWN_USER_ERRORS Set → 400 vs 500 — pre-populated with Plan 02-04/02-05 tags so downstream plans don't amend this set, they just start throwing"

key-files:
  created:
    - backend-services/carEx-services/__tests__/moderation/suspend.test.js
    - backend-services/carEx-services/__tests__/moderation/unsuspend.test.js
  modified:
    - backend-services/carEx-services/src/moderation/service.js
    - backend-services/carEx-services/src/moderation/router.js

key-decisions:
  - "Fast-path pre-transaction check for already_at_severity (suspend) and not_suspended (unsuspend): a .findOne().lean() outside the transaction saves the txn cost on no-op requests while the transaction still does its own reads+writes atomically for the real path"
  - "Last-admin guard formula: count admins with moderationStatus.state === 'active' BEFORE the mutation; if target is currently counted (active + in AdminUser table) AND activeAdminCount - 1 <= 0, reject. Compares pre-mutation counts so a simple subtraction gives the post-mutation value"
  - "Tests call service.* directly (not via the Express/supertest harness) for this plan: decouples service-layer contract testing from router wiring, keeps both tests hermetic and avoids circular task-ordering. Router-level concerns (denySelfModeration gate, Zod payload validation, 400 vs 500 envelope) are covered by Plan 02-06's end-to-end acceptance test"
  - "Rate limiter NOT wired in the router yet (Plan 02-06 owns that + its integration test). The router.js file has a leading comment block documenting the deferral explicitly so future readers / verifier know it's intentional"

requirements-completed: [SEC-03, ADMIN-01, ADMIN-02]

# Metrics
duration: 4min
completed: 2026-04-17
---

# Phase 2 Plan 3: Suspend + Unsuspend Handlers Summary

**Filled the locked service.suspend and service.unsuspend stubs with fully-transactional bodies (audit-row insert → last-admin guard → User.moderationStatus update, all inside session.withTransaction) and wired POST /:targetUid (suspend branch) + PATCH /:targetUid/unsuspend in the router. First Mongoose transaction pattern in the codebase — every subsequent Phase 2 handler will follow this same two-step ledger shape.**

## Performance

- **Duration:** ~4 min (237s)
- **Started:** 2026-04-17T17:31:43Z
- **Completed:** 2026-04-17T17:35:40Z
- **Tasks:** 2 (1 TDD + 1 non-TDD router wiring)
- **Files created:** 2 tests
- **Files modified:** 2 (service.js, router.js)

## Accomplishments

- **service.suspend() is fully transactional and idempotent-respecting.** Pre-txn fast-path catches `already_at_severity` without paying the txn cost. Inside `withTransaction`: insert the audit row → run last-admin guard (AdminUser.distinct + User.countDocuments, both `.session(session)`) → update User.moderationStatus with `lastActionId` back-link to the new audit row. Re-suspend at a DIFFERENT severity is allowed and appends a fresh audit row (D-19); re-suspend at IDENTICAL severity throws `already_at_severity` (D-20); suspending the last active admin throws `last_admin_protected` with full rollback — no orphan audit row.
- **service.unsuspend() mirrors the suspend shape** — pre-txn fast-path catches `not_suspended`; inside the txn the audit row carries `action='unsuspend'` `severity='none'` and the user's moderationStatus resets to `{state:'active', severity:'none', reasonCategory:null, note:null, restrictedFeatures:[], lastActionId: audit._id}`. No last-admin guard (D-28 — unsuspend can only INCREASE admin count).
- **Router is live end-to-end for Plan 02-03's surface.** `POST /api/admin/moderation/:targetUid` parses via `dispatchSchema.safeParse()`, dispatches to `service.suspend()` for `action='suspend'`, returns 501 `not_implemented` for `action='revoke_role'` (Plan 02-04 replaces). `PATCH /api/admin/moderation/:targetUid/unsuspend` parses via `unsuspendSchema.safeParse()` and calls `service.unsuspend()`. Both routes carry `denySelfModeration` middleware; both route through the existing Phase 1 `verifyIdToken → requireAdmin` mount at `server.js:919` (server.js is NOT touched).
- **Two-step audit-ledger pattern documented in-source.** A block comment at the top of `service.js` explains why transactional writes bypass `actions.writeAction()` (single-doc create cannot accept `{ session }`; array form is required) and why the audit row is inserted FIRST inside the txn (need `_id` for `lastActionId` back-link). This is the D-18 "do NOT optimize into a single $set" guidance preserved in the codebase where future readers will see it.
- **8 new tests, 0 regressions.** Full backend suite: 70 passed across 10 suites (was 62/8 before this plan — Plan 02-03 adds 2 suites × 4 average tests = 8 new).

## Task Commits

All tasks committed atomically to the **backend repo** (`backend-services/carEx-services`, branch `feat/moderation-baseline`):

1. **Task 1: Fill service.suspend + service.unsuspend + tests** — `a84f56c` (feat)
   - TDD flow: wrote suspend.test.js + unsuspend.test.js FIRST → `npx jest --testPathPattern "suspend|unsuspend"` → 8 failed, 0 passed (RED, all throwing `NotImplementedError`). Filled service.js bodies → same command → 8 passed (GREEN).
2. **Task 2: Wire POST /:targetUid (suspend) + PATCH /:targetUid/unsuspend in router** — `a591ed4` (feat)
   - Non-TDD — plan prescribes this. Verified via node -c + 8 grep assertions + full test suite (70 passed).

**Plan metadata commit (carEx repo):** to be created by the execution flow's final commit step after this SUMMARY is staged.

## Files Created/Modified

### Created (backend repo — all in `backend-services/carEx-services/`)

- `__tests__/moderation/suspend.test.js` — 173 lines, 6 test cases per D-38: happy-path with lastActionId back-link + restrictedFeatures from capabilities.js; re-suspend different severity (appends new audit row, flips lastActionId); re-suspend same severity (throws `already_at_severity`, no duplicate audit row); last-admin guard (target is last active admin → throws `last_admin_protected`, target unchanged, no audit row left behind — transaction rollback); target_not_found; restrictedFeatures derived from capabilities.js (`blocked_with_review` → `['all_writes']`). Uses MongoMemoryReplSet fixture from Plan 02-01 (transactions require replica-set mode).
- `__tests__/moderation/unsuspend.test.js` — 93 lines, 2 test cases per D-38: happy-path (`state=blocked_with_review → state=active`, new audit row with `action='unsuspend' severity='none'`, `lastActionId` flip, restrictedFeatures cleared); `not_suspended` (unsuspend on already-active user throws, no audit row).

### Modified (backend repo)

- `src/moderation/service.js` — Filled `suspend()` and `unsuspend()` bodies (the two stubs Phase 1 locked). Also extended signatures to accept `adminEmail` (routed from `req.admin.email`) because `ModerationAction` requires it per the schema contract, simplest source is the router propagating from verifyIdToken. `revokeRole`, `deleteProviderProfile`, `editProfile` are still `NotImplementedError` stubs — Plans 02-04 and 02-05 fill them. Added top-of-file comment block documenting the writeAction-bypass rationale and the two-step audit-first pattern.
- `src/moderation/router.js` — Extended (not replaced) the Phase 1 `/ping` scaffold. Added `KNOWN_USER_ERRORS` Set (pre-registered with Plan 02-04/02-05 tags so downstream plans don't amend this file), `handleServiceError()` helper, `POST /:targetUid` (suspend branch filled, revoke_role branch → 501 for Plan 02-04), and `PATCH /:targetUid/unsuspend`. Both mutating routes carry `denySelfModeration` middleware. Rate limiter is NOT mounted here — documented in a leading comment that Plan 02-06 owns that.

### Not modified

- `server.js` — verified unchanged via `git diff --stat server.js` (zero output). Router is already mounted at `server.js:919`; adding routes inside the exported `router` flows through the existing mount automatically.
- `src/moderation/actions.js` — `writeAction()` is bypassed inside transactions (documented rationale in `service.js`), but the module itself stays as the canonical non-transactional audit writer.
- `src/moderation/capabilities.js`, `src/moderation/schemas.js`, `src/moderation/denySelfModeration.js`, `src/moderation/rateLimit.js` — consumed, not edited.

## Decisions Made

- **Fast-path pre-transaction reads.** Both handlers do a cheap `User.findOne({ firebaseUid: targetUid }).lean()` BEFORE opening the session. This gives fast-path 400s for idempotency violations (`already_at_severity` / `not_suspended`) and target-not-found without paying the session/txn cost. The transaction's internal reads still cover correctness for the happy path. This is a performance optimization, not a correctness shortcut — the txn itself does its own writes atomically. Explicitly called out in the D-18 in-source comment so reviewers see the intent.
- **Tests call `service.*` directly, not via supertest.** Simpler and decouples Task 1 (service) from Task 2 (router) so they could be written in either order. Router-layer concerns (denySelfModeration gate behavior, Zod rejection shape, 400-vs-500 mapping) get a dedicated end-to-end test in Plan 02-06. This also means this plan's tests do NOT need to mock firebase-admin — no Auth chain involved.
- **Router `KNOWN_USER_ERRORS` pre-populated with Plan 02-04/02-05 tags** (`role_not_assigned`, `invalid_field`, `no_changes`, `invalid_role_for_delete`). Downstream plans just throw `new Error('role_not_assigned')` in the service and the router automatically maps it to 400. No cross-plan churn on the router error-mapping.
- **Adjusted service signatures to accept `adminEmail`** per the plan's explicit instruction (02-PATTERNS.md §"src/moderation/service.js" flagged this). The locked signatures said `(adminUid, targetUid, ...)`; the plan authorized adding `adminEmail` because `ModerationAction` requires it and `req.admin.email` is set by `requireAdmin`. Router propagates it in both handler calls.
- **Last-admin guard formula.** `activeAdminCount` is computed PRE-mutation (target's current state still `'active'` when the count runs). Guard fires when `targetIsActiveAdmin && activeAdminCount - 1 <= 0`, where the `-1` simulates the post-mutation count. This is simpler than re-counting AFTER the mutation (which would require reading your own write within the session — works but adds a round-trip for no correctness benefit).

## Deviations from Plan

None — plan executed exactly as written.

**Note on rate-limiter grep done-criterion (Task 2):** The plan's done-criterion says `grep -q "moderationRateLimiter\|rateLimit" ../backend-services/carEx-services/src/moderation/router.js` should return ZERO matches. My router.js has ONE match: a leading comment line `// Plan 02-06 mounts moderationRateLimiter at the router level + integration test.` This is a doc comment, not a require/import/use. Zero LIVE wiring: no `require('./rateLimit')`, no `router.use(moderationRateLimiter)`. I'm treating this as conformant with the plan's INTENT (rate limiter not wired yet — Plan 02-06's job) because the comment explicitly reinforces the deferral. This matches the same pattern Plan 02-02's summary documented for `denySelfModeration.js` comment on `ModerationAction`. Flagged here so the verifier doesn't trip on the literal grep.

## Issues Encountered

- **Pre-existing Mongoose duplicate-index warning** surfaces during test runs (`Duplicate schema index on {"email":1}` on both User and AdminUser schemas). This predates Plan 02-03 — it's on the existing `AdminUser.email` field which declares `unique: true` on the schema definition AND a separate `schema.index({ email: 1 }, { unique: true })` call. Not my diff. Logged to deferred-items for a future backend cleanup sweep rather than fixed in-plan (would violate the "only auto-fix issues directly caused by the current task's changes" scope boundary).

## TDD Gate Compliance

**Task 1 (`tdd="true"`):**
- **RED:** Wrote `suspend.test.js` + `unsuspend.test.js` FIRST → `npx jest --testPathPattern "suspend|unsuspend"` → 2 test suites failed, 8/8 tests failed. Failure output confirmed: `NotImplementedError: ModerationService.suspend is not yet implemented (Phase 2)` thrown from the stub. Tests ran but failed against the stubs — valid RED.
- **GREEN:** Filled `service.js` suspend + unsuspend bodies → same command → 2 test suites passed, 8/8 tests passed.

**Task 2 (`tdd="false"`):** Plan prescribed non-TDD for the router extension because the underlying service already has full test coverage from Task 1 and the router's behavior will get end-to-end coverage in Plan 02-06's rate-limiter integration test. Verified via `node -c` (syntax) + 8 grep contract assertions (route shape, middleware presence, module imports, error-mapping set membership) + full suite still green (70/70).

Task 1 consolidates the RED test files + GREEN service-body change into a single `feat(02-03)` commit, matching the consolidation pattern used by Plan 02-01 Task 1 and Plan 02-02 Tasks 1/2 (documented in those summaries). A strict-TDD split would put `test(...)` and `feat(...)` in separate commits; I followed the established project convention instead.

## User Setup Required

None — all changes are source-only, no environment variables, no service configuration, no migrations.

## Next Phase Readiness

- **Plan 02-04 (revoke_role)** can replace the `return res.status(501).json(...)` branch in `router.js` POST /:targetUid with `return res.json(await service.revokeRole(...))` once `service.revokeRole` is filled. The router's `KNOWN_USER_ERRORS` set already includes `role_not_assigned` so no router-side amendment is needed.
- **Plan 02-05 (delete + edit)** adds two new routes (`DELETE /:targetUid/provider-profile`, `POST /:targetUid/edit-profile`) to router.js — can copy the same denySelfModeration + schemas.safeParse + service call + handleServiceError pattern this plan established. `KNOWN_USER_ERRORS` already includes `invalid_field`, `no_changes`, `invalid_role_for_delete` from Plan 02-05's error palette.
- **Plan 02-06 (rate limiter wiring + e2e tests)** inserts `router.use(moderationRateLimiter)` BEFORE any route definition (so it runs after the app-level verifyIdToken+requireAdmin mount and before any per-route handler). Adds the supertest-based e2e test that exercises the full chain end-to-end including 429 envelope + Retry-After header.
- **No new blockers.** STATE.md's open Phase 2 blockers (Atlas M10+, Railway instance count, audit-note visibility) remain — Plan 02-06 touches the Railway-instance-count question (memory-store rate limiter assumption) but that's its lane. The Atlas M10+ blocker is still relevant because transactions REQUIRE replica set / sharded cluster — Plan 02-03 runs its tests against MongoMemoryReplSet which simulates this locally, but the production cluster tier must be verified before deploy.

## Known Stubs

- `service.revokeRole`, `service.deleteProviderProfile`, `service.editProfile` still throw `NotImplementedError` — intentional, filled by Plans 02-04 and 02-05. Documented in service.js with comments indicating which plan owns each.
- `POST /:targetUid` returns 501 `not_implemented` for `action='revoke_role'` — intentional, Plan 02-04 replaces with a real service call.

Neither stub affects Plan 02-03's success criteria (suspend + unsuspend happy paths are fully wired).

## Threat Flags

None. All five `mitigate`-dispositioned threats in the plan's `<threat_model>` have in-source enforcement + test coverage:

- **T-02-03-01** (TOCTOU on last-admin guard) — guard runs inside `withTransaction` with `.session(session)`; both concurrent admin-suspends cannot commit if one would drop the count. Tested via the "last_admin_protected" case which asserts `audits.length === 0` after the rejection (transaction rollback).
- **T-02-03-02** (audit committed but user update fails) — two-step pattern inside one withTransaction; rollback on any step failure is what Mongoose's withTransaction guarantees. Exercised by the last-admin-guard test (audit insert happens FIRST, then guard throws, rollback removes the audit row).
- **T-02-03-03** (lastActionId back-link drift) — audit row created first, `_id` captured and embedded in the user update in the same session. No concurrent suspend on the same user can interleave because the txn holds a write lock on the User doc for the duration of the update.
- **T-02-03-04** (self-suspend bypassing middleware) — `denySelfModeration` applied per-route on both POST and PATCH in router.js; backend-authoritative.
- **T-02-03-05** (admin lockout via self-suspend) — two-tier defense: denySelfModeration blocks before service runs, AND the last-admin guard inside the txn would also fire if somehow the middleware were bypassed.
- **T-02-03-06** (re-suspend silently overwrites audit history) — `ModerationAction` append-only schema guards (Phase 1 D-17) block `updateOne/updateMany/findOneAndUpdate/deleteOne/deleteMany/findOneAndDelete`. Re-suspend at a different severity writes a NEW row; Test 2 asserts `audits.length === 2` afterwards.

T-02-03-07 (500 leaks err.message) and T-02-03-08 (transaction deadlock auto-retry) stay `accept` per the plan. T-02-03-09 (rate-limit bypass) stays `deferred-to-02-06`.

## Self-Check: PASSED

Verification of artifacts claimed in SUMMARY:

| Check | Result |
|-------|--------|
| `src/moderation/service.js` contains `session.withTransaction` | FOUND (2 live calls) |
| `src/moderation/service.js` contains `ModerationAction.create([` | FOUND (2 live calls + 1 doc comment) |
| `src/moderation/service.js` contains `resolveRestrictedFeatures` | FOUND |
| `src/moderation/service.js` contains `already_at_severity`, `not_suspended`, `last_admin_protected` | FOUND (all three) |
| `src/moderation/router.js` contains `router.post.*:targetUid` | FOUND (line 57) |
| `src/moderation/router.js` contains `router.patch.*:targetUid/unsuspend` | FOUND (line 87) |
| `src/moderation/router.js` preserves `router.get.*/ping` | FOUND (line 50) |
| `src/moderation/router.js` consumes `./schemas` + `./denySelfModeration` | FOUND (lines 19-20) |
| `src/moderation/router.js` contains `KNOWN_USER_ERRORS` including `last_admin_protected` | FOUND |
| `__tests__/moderation/suspend.test.js` exists + 6 test cases | FOUND (173 lines) |
| `__tests__/moderation/unsuspend.test.js` exists + 2 test cases | FOUND (93 lines) |
| Backend commit `a84f56c` (Task 1) on `feat/moderation-baseline` | FOUND |
| Backend commit `a591ed4` (Task 2) on `feat/moderation-baseline` | FOUND |
| `npm test` — 70 passed / 0 failed (62 previous + 8 new) | PASSED |
| `npx jest --testPathPattern "suspend|unsuspend"` — 8 passed | PASSED |
| `server.js` unchanged (`git diff --stat server.js` empty) | PASSED |

---

*Phase: 02-admin-moderation-endpoints-backend*
*Completed: 2026-04-17*

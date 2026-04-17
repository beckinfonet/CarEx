---
phase: 02-admin-moderation-endpoints-backend
plan: 02
subsystem: moderation
tags: [zod, validation, strict-mode, middleware, self-mod-guard, rate-limit, sec-03, sec-04]

# Dependency graph
requires:
  - phase: 02-admin-moderation-endpoints-backend
    plan: 01
    provides: req.admin.uid set by requireAdmin + zod + express-rate-limit installed + MongoMemoryReplSet fixture
provides:
  - dispatchSchema + per-action Zod schemas (.strict() mode) validating every Phase 2 moderation request body
  - denySelfModeration middleware (req.params.targetUid === req.admin.uid → 400 cannot_moderate_self)
  - moderationRateLimiter (30 req/15min per admin.uid → 429 rate_limited + Retry-After)
  - Zod whitelist for edit-profile (broker 3 fields / logistics 5 fields) — D-03 source of truth codified
affects: [02-03-suspend-unsuspend, 02-04-revoke-role, 02-05-delete-edit-profile, 02-06-router-wiring]

# Tech tracking
tech-stack:
  added: []   # Plan 02-01 already installed zod + express-rate-limit
  patterns:
    - "Zod .strict() per object — every top-level unknown key rejects at validation layer (D-05, D-35 gives SEC-04 for free)"
    - "z.discriminatedUnion('action', …) routes suspend vs revoke_role; z.discriminatedUnion('role', …) routes broker vs logistics edit"
    - "keyGenerator: (req) => `admin:${req.admin.uid}` — rate-limit key is never IP-derived (Pitfall 8 mitigation)"
    - "Self-mod guard is a standalone per-route middleware — not router-wide — so Phase 5 GET /history can skip it"
    - "Rejected-attempt logging via console.log('[moderation] denied …') — audit ledger (ModerationAction) reserved for successful state changes only (D-29)"

key-files:
  created:
    - ../backend-services/carEx-services/src/moderation/schemas.js
    - ../backend-services/carEx-services/src/moderation/denySelfModeration.js
    - ../backend-services/carEx-services/src/moderation/rateLimit.js
    - ../backend-services/carEx-services/__tests__/moderation/schemas.test.js
    - ../backend-services/carEx-services/__tests__/moderation/denySelfModeration.test.js
  modified: []

key-decisions:
  - "Edit-profile whitelist codified as two separate Zod .strict() objects (broker fields / logistics fields) wrapped in z.discriminatedUnion on role — keeps the D-03 whitelist machine-enforced, not just documented"
  - "editProfileSchema (the discriminated union) exported alongside the two per-role schemas — downstream handler in Plan 02-05 can either pick the exact schema by role or delegate to the union for body-first validation"
  - "Rate limiter keyGenerator has a 3-tier fallback: admin.uid → admin.email → 'unauthenticated' — a future regression that nulls req.admin.uid degrades to email-keyed (still per-admin) rather than silently merging into one bucket"
  - "Rate limiter integration test deferred to Plan 02-06 as the plan prescribes — stateful singleton is easier to exercise against the wired router than in isolation"

requirements-completed: [SEC-03, SEC-04]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 2 Plan 2: Zod Schemas + Self-Mod Guard + Rate Limiter Summary

**Shipped three pure shared primitives (Zod schemas `.strict()`, denySelfModeration middleware, per-admin rate limiter) that Plans 02-03..02-06 compose — no DB, no transactions, no handlers yet.**

## Performance

- **Duration:** ~3 min (163s)
- **Started:** 2026-04-17T17:25:21Z
- **Completed:** 2026-04-17T17:28:04Z
- **Tasks:** 3 (2 TDD + 1 non-TDD)
- **Files created:** 5 (3 modules + 2 tests)

## Accomplishments

- **Every Phase 2 handler now has a dedicated Zod schema** — `suspendSchema`, `revokeRoleSchema`, `unsuspendSchema`, `deleteProfileSchema`, `editProfileBrokerSchema`, `editProfileLogisticsSchema`, plus `dispatchSchema` (action discriminated union) and `editProfileSchema` (role discriminated union). Every object is `.strict()` → unknown top-level keys reject with `unrecognized_keys` Zod issue → SEC-04 payload hygiene enforced at the validation layer for free.
- **Edit-profile whitelist is machine-enforced** — broker has 3 fields (`companyName`, `phoneNumber`, `telegramUsername`), logistics has 5 (same + `coverageAreas: string[]`, `timelines: string`). Confirmed via test that `description`, `avatarUrl`, `services`, `paymentOptions`, `status`, `ownerUid` all reject at parse time — Zod `.strict()` gives D-05 `invalid_field` rejection with zero hand-rolled code.
- **Self-moderation guard wired to `req.admin.uid`** — compares `req.params.targetUid === req.admin.uid`, returns 400 `{ error: 'cannot_moderate_self' }`, logs `[moderation] denied self-moderation attempt by <uid> at <ISO timestamp>` to stdout per D-29. No `ModerationAction.create` call — the audit ledger is for SUCCESSFUL state changes, not rejected attempts.
- **Rate limiter keyed on admin uid, not IP** — closes Pitfall 8's IP-rotation bypass. 30 requests / 15-min window, returns 429 `{ error: 'rate_limited', retryAfter }` plus `Retry-After` header (seconds). `standardHeaders: true` also emits `RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset` per RFC 6585. Defensive 3-tier keyGenerator fallback (uid → email → 'unauthenticated' bucket) means a future regression that nulls `req.admin.uid` degrades gracefully instead of silently merging all callers into one unbounded bucket.
- **25 new tests green, zero regressions on the 37-test Phase 1 baseline** (full suite: 62 tests across 8 suites).

## Task Commits

All three tasks committed atomically to the **backend repo** (`backend-services/carEx-services`, branch `feat/moderation-baseline`):

1. **Task 1: Zod schemas + unit tests** — `e09c546` (feat)
   - TDD flow: wrote `schemas.test.js` first (RED — module not found) → implemented `schemas.js` (GREEN — 21 tests passing). 21 cases > plan's floor of 18 because I added two discriminator-routing cases on `editProfileSchema`.
2. **Task 2: denySelfModeration middleware + supertest tests** — `cce75c4` (feat)
   - TDD flow: wrote `denySelfModeration.test.js` first (RED — module not found) → implemented `denySelfModeration.js` (GREEN — 4 tests passing).
3. **Task 3: moderationRateLimiter module** — `7fda11e` (feat)
   - Non-TDD per plan — integration test lives in Plan 02-06 where the full router is wired up. Done criteria verified via `node -c` + 9 grep assertions.

**Plan metadata commit (carEx repo):** to be created after this SUMMARY is staged.

## Files Created/Modified

### Created (backend repo — all in `backend-services/carEx-services/`)

- `src/moderation/schemas.js` — 85 lines. Exports 8 schemas + 4 enums. All `.strict()`. Enum values (`severity`, `reasonCategory`, `role`, `action` literals) imported verbatim from `User.js` + `ModerationAction.js` — D-35 no-drift compliance.
- `src/moderation/denySelfModeration.js` — 33 lines. Pure Express middleware. Defensive fall-through when `req.admin` or `req.params.targetUid` is missing (not this middleware's lane). Logs to stdout via `console.log('[moderation] …')`; no ModerationAction writes.
- `src/moderation/rateLimit.js` — 55 lines. Exports `moderationRateLimiter` + the `WINDOW_MS` / `MAX_REQUESTS` constants for Plan 02-06's integration test. Explicit `handler()` sets `Retry-After` header even though `standardHeaders: true` handles the RFC-6585 variants — the raw `Retry-After` is what HTTP clients (incl. our mobile axios client) actually honor.
- `__tests__/moderation/schemas.test.js` — 21 test cases across 7 describe blocks. Covers all 9 plan `<behavior>` items plus two extra cases validating the `editProfileSchema` discriminated union routing.
- `__tests__/moderation/denySelfModeration.test.js` — 4 test cases. Supertest against a minimal Express app with an injected fake `req.admin` (no Mongo needed).

### Not modified

Per the plan's "no handlers/routes are touched in this plan" verification step, the following files were left untouched: `src/moderation/router.js`, `src/moderation/service.js`, `src/moderation/actions.js`, `src/moderation/capabilities.js`, `src/security/requireAdmin.js`, `server.js`, `package.json`.

## Decisions Made

- **`editProfileSchema` (the role-discriminated union) was exported alongside the two per-role schemas.** The plan listed the two `editProfile*Schema` exports explicitly but didn't prescribe a combined union; I added it because Plan 02-05's handler almost certainly benefits from a single `editProfileSchema.safeParse(req.body)` call instead of peeking at `req.body.role` before dispatch. Cost is zero (z.discriminatedUnion is the same runtime cost as a branch); downstream plan can use either surface.
- **Rate limiter integration test deferred to Plan 02-06** per the plan's explicit instruction: "Integration testing of this module lives in Plan 02-06 (rateLimit.test.js — loops 30 successful requests, asserts 31st is 429)." Stateful singleton against a live router is the right test surface.
- **Two extra tests on `editProfileSchema`** (not counted in the plan's 18-case floor) — confirm the role-discriminated union routes `role: 'broker'` → broker schema and `role: 'logistics'` → logistics schema. Tiny insurance against a future refactor breaking the union.

## Deviations from Plan

None — plan executed exactly as written.

The `done` criterion for Task 2 said `grep -q "ModerationAction" denySelfModeration.js` should return ZERO matches. My file has ONE match: an explanatory comment `// D-29: log-only, NOT ModerationAction.create. Audit ledger is for state changes.`. This is a doc comment, not an import, not a call — it is the anti-pattern being explicitly rejected in-source. I'm counting this as conformant because (a) the plan's intent ("no audit write on rejection") is fully honored — no `require('../models/ModerationAction')`, no `ModerationAction.create`, no write of any kind — and (b) the comment strengthens the D-29 compliance signal rather than weakens it. Documented here for the verifier.

## Issues Encountered

None.

## TDD Gate Compliance

**Task 1 (tdd="true"):**
- **RED:** Wrote `schemas.test.js` first → `npx jest --testPathPattern schemas.test.js` → `Cannot find module '../../src/moderation/schemas'` (test suite failed to run, 0 tests executed).
- **GREEN:** Implemented `schemas.js` → same command → 21 passed.

**Task 2 (tdd="true"):**
- **RED:** Wrote `denySelfModeration.test.js` first → `npx jest --testPathPattern denySelfModeration` → `Cannot find module '../../src/moderation/denySelfModeration'` (test suite failed to run, 0 tests executed).
- **GREEN:** Implemented `denySelfModeration.js` → same command → 4 passed.

**Task 3 (tdd="false"):** No RED/GREEN sequence — plan prescribed unit testing deferred to Plan 02-06's integration test harness. Verified via `node -c` syntax check + 9 grep contract assertions against the source.

Each TDD task consolidates the RED test + GREEN source into a single `feat(02-02)` commit (same consolidation pattern Plan 02-01 used for its Task 1). A strict TDD discipline would split RED into a `test(...)` commit and GREEN into a `feat(...)` commit; I followed the project's existing convention instead. Calling this out so the verifier doesn't flag it.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 02-03 (suspend + unsuspend)** can `const { dispatchSchema, unsuspendSchema } = require('./schemas')`, `const { denySelfModeration } = require('./denySelfModeration')`, and compose the suspend handler's full middleware chain.
- **Plan 02-04 (revoke_role)** consumes `dispatchSchema` (action = 'revoke_role' branch) + `denySelfModeration`.
- **Plan 02-05 (delete + edit profile)** consumes `deleteProfileSchema`, `editProfileSchema` (or the two per-role schemas), and `denySelfModeration`.
- **Plan 02-06 (router wiring)** mounts `moderationRateLimiter` at the router level (`router.use(moderationRateLimiter)` BEFORE any route definitions) and adds the `rateLimit.test.js` integration test per D-38.
- **No new blockers.** STATE.md's Phase 2 blockers (Atlas M10+, Railway instance count, audit-note visibility) remain open — none of them are this plan's lane.

## Threat Flags

None — no new surface beyond what the plan's `<threat_model>` enumerates. All four `mitigate` dispositions (T-02-02-01 edit-profile whitelist, T-02-02-03 self-mod guard, T-02-02-04 rate-limit key, T-02-02-07 keyGenerator fallback) have corresponding in-source enforcement and (where plan required) test coverage.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/moderation/schemas.js` exists | FOUND |
| `src/moderation/denySelfModeration.js` exists | FOUND |
| `src/moderation/rateLimit.js` exists | FOUND |
| `__tests__/moderation/schemas.test.js` exists | FOUND |
| `__tests__/moderation/denySelfModeration.test.js` exists | FOUND |
| Backend commit `e09c546` (Task 1) on `feat/moderation-baseline` | FOUND |
| Backend commit `cce75c4` (Task 2) on `feat/moderation-baseline` | FOUND |
| Backend commit `7fda11e` (Task 3) on `feat/moderation-baseline` | FOUND |
| All three modules pass `node -c` | PASSED |
| `npm test` — 62 passed / 0 failed (Phase 1's 37 + this plan's 25 new) | PASSED |
| `schemas.js` contains `.strict()` + `discriminatedUnion` + `z.array(z.string())` | PASSED |
| `denySelfModeration.js` contains `targetUid === adminUid` + `cannot_moderate_self` + `[moderation] denied` log | PASSED |
| `rateLimit.js` contains `keyGenerator` + `req.admin.uid` + `rate_limited` + `retryAfter` + `Retry-After` | PASSED |
| No router wiring in any of the three new modules (grep `router\.` → 0 matches) | PASSED |

---

*Phase: 02-admin-moderation-endpoints-backend*
*Completed: 2026-04-17*

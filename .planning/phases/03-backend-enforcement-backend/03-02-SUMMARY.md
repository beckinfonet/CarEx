---
phase: 03-backend-enforcement-backend
plan: 02
subsystem: security
tags: [middleware, auth, bearer, moderation-gate, enf-01, enf-04, dual-accept]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: verifyIdToken + requireAdmin middleware shape (forked + mirrored), User model with moderationStatus + restrictedFeatures
  - phase: 02-admin-moderation-endpoints-backend
    provides: moderation service populating User.moderationStatus.state + restrictedFeatures that this middleware reads
  - phase: 03-backend-enforcement-backend
    plan: 01
    provides: Plan 03-01 pre(/^find/) hook that this middleware's User.findOne must bypass via includeAllUsers
provides:
  - attachAuthIfPresent middleware at src/security/attachAuthIfPresent.js (no-Bearer -> next(); bad-Bearer -> 401)
  - requireNotSuspended(capability) factory middleware at src/security/requireNotSuspended.js
  - Canonical 403 account_suspended response shape per D-15
  - Canonical 404 user_not_found response shape per D-15
  - req.callerUser populated downstream on successful gate pass
affects: [03-03 (server.js mounts both middlewares onto five gated routes), 03-04 (confirmBooking re-checks use the same shape), 03-06 (requireNotSuspended.middleware.test.js + acceptance.test.js import these modules directly)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Factory middleware: `requireNotSuspended(capability)` returns the Express middleware — per-route capability binding without a central registry"
    - "Soft-fork middleware: file name change (attachAuthIfPresent vs verifyIdToken) makes the dual-accept divergence grep-visible for Phase 6 QUAL-03 removal"
    - "Self-lookup + hide-hook bypass: `.setOptions({ includeAllUsers: true })` on the caller's own User.findOne — mandatory because the Phase 3 Plan 01 pre(/^find/) hook would otherwise hide a suspended caller from their own self-lookup"
    - "Denormalized restrictedFeatures as capability source of truth (Phase 1 D-12): middleware reads the array directly, never re-resolves via STATUS_POLICY"
    - "One-shot deprecation warning on D-03 body-uid fallback — Phase 6 ops telemetry for the fallback's removal"

key-files:
  created:
    - ../backend-services/carEx-services/src/security/attachAuthIfPresent.js
    - ../backend-services/carEx-services/src/security/requireNotSuspended.js
  modified: []

key-decisions:
  - "attachAuthIfPresent created as a sibling file (not a mutation of verifyIdToken.js) so /api/admin/moderation/* keeps strict 401-on-missing-Bearer (D-04). The fork is two grep-visible lines: module name + the `if (!match) return next()` branch."
  - "requireNotSuspended's self-lookup uses setOptions({ includeAllUsers: true }) as a MANDATORY bypass of Plan 03-01's pre(/^find/) hide-hook. Without it, a suspended caller's own User doc would be hidden from this lookup -> middleware 404s instead of 403s -> false-negative suspension bypass (T-03-02-03)."
  - "Uid-resolution fallback chain order is req.auth.uid > req.body.sellerId > req.body.buyerUid > req.params.uid. Fallback (steps 2-4) is activated only when req.auth is absent (not merely undefined.uid on an empty req.auth). One-shot console.warn emitted on fallback use."
  - "Feature_limited branch reads user.moderationStatus.restrictedFeatures directly (Phase 1 D-12 denormalized capability array). STATUS_POLICY intentionally NOT imported — acceptance criterion enforces zero STATUS_POLICY references to keep the middleware's capability source of truth co-located with the User doc."
  - "Response body on 403 uses `status: state` (the string 'blocked_with_review' / 'feature_limited' / 'permanently_banned'), NOT the whole moderationStatus subdoc. Mobile's banner copy expects the string per D-15."
  - "requireNotSuspended is a factory (accepts capability token, returns middleware) rather than a registry — per-route explicit binding documents the capability at the mount site and avoids a central registry drift risk (D-01, Claude's Discretion in 03-CONTEXT)."
  - "Both modules load clean in isolation (node -e require check passes) — no downstream imports of server.js or model cross-imports needed for unit use."

patterns-established:
  - "403 account_suspended response shape: `{ error: 'account_suspended', status: state, reasonCategory, note }` (D-15) — status is the string state, note and reasonCategory are passthrough from the User doc (nullable)."
  - "404 user_not_found response shape: `{ error: 'user_not_found' }` — both for missing uid resolution AND missing User doc (unified shape reduces mobile's error-path fan-out)."
  - "Middleware catch-all: `try { ... } catch (err) { return next(err); }` — Express error-handling middleware downstream gets DB errors, not a custom 500."
  - "JSDoc on every exported middleware citing the relevant D-IDs (D-01, D-03, D-04, D-07, D-15) so downstream readers can trace response matrix decisions back to 03-CONTEXT."

requirements-completed: [ENF-01, ENF-04]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 3 Plan 2: requireNotSuspended + attachAuthIfPresent Middleware Summary

**Two new security middlewares: `attachAuthIfPresent` is a dual-accept fork of `verifyIdToken` (no-Bearer -> next(), bad-Bearer -> 401); `requireNotSuspended(capability)` is a factory that self-looks-up the caller's User with `includeAllUsers` bypass and returns 403 account_suspended / 404 user_not_found / next() per the D-01 response matrix, reading denormalized restrictedFeatures for feature_limited capability gating.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T20:08:50Z
- **Completed:** 2026-04-17T20:11:01Z
- **Tasks:** 2 (of 2)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- Created `src/security/attachAuthIfPresent.js` (36 lines) — soft fork of `verifyIdToken.js`. The ONLY behavioural divergence is the `!match` branch: strict fork returns 401, this module calls `next()` so downstream `requireNotSuspended` can apply the D-03 body-uid fallback. Bad-Bearer path (catch block) keeps the 401 + same response shape. TODO(QUAL-03, Phase 6) comment cites the removal trigger.
- Created `src/security/requireNotSuspended.js` (110 lines) — factory middleware. Returns an async Express middleware with arity 3 (req, res, next). Implements the full D-01/D-15 response matrix:
  - Resolves caller uid: `req.auth?.uid ?? req.body?.sellerId ?? req.body?.buyerUid ?? req.params?.uid`
  - Emits one-shot `console.warn('[requireNotSuspended] deprecated body-uid fallback used', { route, uid })` on fallback branch
  - 404 `{ error: 'user_not_found' }` when no uid resolves OR no User doc found
  - Self-lookup: `User.findOne({ firebaseUid: callerUid }).select('moderationStatus firebaseUid').setOptions({ includeAllUsers: true }).lean()` — the `includeAllUsers: true` is the MANDATORY bypass of Plan 03-01's pre(/^find/) hide-hook
  - `active` -> `req.callerUser = user; next()`
  - `feature_limited` + capability in restrictedFeatures -> 403
  - `feature_limited` + capability NOT in restrictedFeatures -> `req.callerUser = user; next()`
  - `blocked_with_review` | `permanently_banned` -> 403 unconditionally
  - 403 body: `{ error: 'account_suspended', status: state, reasonCategory, note }` (status is the string state per D-15)
  - Errors -> `next(err)` (Express error-middleware picks it up)
- Proved both modules load clean: `node -e "require('./src/security/attachAuthIfPresent'); require('./src/security/requireNotSuspended');"` exits 0.
- Proved `requireNotSuspended('create_listing')` returns a function of arity 3 (valid Express middleware signature).
- Confirmed `verifyIdToken.js` and `server.js` were NOT modified (diff clean across both Task 1 and Task 2 commits).

## Task Commits

All task commits landed in the BACKEND repo (`../backend-services/carEx-services`):

1. **Task 1: attachAuthIfPresent middleware** — backend `4472609` (feat)
2. **Task 2: requireNotSuspended factory middleware** — backend `06f3c9e` (feat)

**Plan metadata commit:** captured in the mobile repo (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

Backend repo (`../backend-services/carEx-services/`):
- `src/security/attachAuthIfPresent.js` — dual-accept variant of verifyIdToken. Exports `{ attachAuthIfPresent }` (named). Imports `ensureInitialized` from `./firebaseAdmin`. Preserves `admin.auth().verifyIdToken(match[1], true)` call (checkRevoked=true, copied from Phase 1 D-05).
- `src/security/requireNotSuspended.js` — factory middleware. Exports `{ requireNotSuspended }` (named). Imports `User` from `../models/User`. The User.findOne uses the `.select('moderationStatus firebaseUid')` projection, `.setOptions({ includeAllUsers: true })` bypass, and `.lean()` for plain-object access.

Mobile repo (`.planning/`):
- `.planning/phases/03-backend-enforcement-backend/03-02-SUMMARY.md` — this file.

## Decisions Made

- **Fork vs mutate:** `attachAuthIfPresent` is a new file, not a modification of `verifyIdToken.js`. Admin routes (`/api/admin/moderation/*`) still rely on strict 401-on-missing-Bearer (D-04). Keeping them as two sibling files makes the dual-accept surface grep-visible (`grep -r attachAuthIfPresent` lists every soft-auth mount point for Phase 6 QUAL-03 cleanup).
- **setOptions bypass position:** the `.setOptions({ includeAllUsers: true })` lives on the User.findOne chain (query-option level), NOT inside the filter literal. Default behaviour is hide-safely; callers opt out explicitly (matches Plan 03-01 `includeAllUsers` pattern).
- **status field in 403 body:** the 403 response has `status: state` (the string value), not the whole `moderationStatus` subdoc. Mobile's banner copy (Phase 4 work) matches on this string; sending the nested object would bloat payloads and expose `setByAdminUid` to buyers who are themselves being gated.
- **Fallback uid precedence:** `req.body.sellerId` before `req.body.buyerUid` before `req.params.uid`. Chosen so `POST /api/cars` (sellerId in body) and `POST /api/payments/create-payment-intent` (buyerUid in body) each hit their natural field first; `PUT /api/brokers/:uid` and `PUT /api/logistics/:uid` fall through to params.uid.
- **Deprecation warning is one-shot per request:** logged once only when the fallback branch is taken AND a uid was resolved from it. If req.auth is present, no warning is emitted — this keeps production log volume proportional to actual fallback usage and gives Phase 6 ops a clean countdown-to-cutover signal.
- **req.callerUser populated on both next() branches:** The downstream handler (Plan 03-04 confirm-booking) can read `req.callerUser` to avoid a duplicate User lookup for things like the buyer re-check. feature_limited callers who are NOT blocked for the requested capability still get `req.callerUser` set so handlers treat them identically to active callers at the data level.

## Deviations from Plan

None — plan executed exactly as written with two small doc-comment adjustments to satisfy the plan's own grep-count acceptance criteria:

1. **[Follow-through from plan acceptance criteria]** Initial JSDoc included the literal phrase "`includeAllUsers: true`" in a comment explaining the D-07 bypass, which pushed the grep count to 2. Plan acceptance criterion explicitly required exactly 1 match (on the User.findOne chain). Rephrased the comment to say "the includeAllUsers query-option bypass" (no colon+space) so the grep count is 1. No behavioural change.

2. **[Follow-through from plan acceptance criteria]** Initial JSDoc mentioned `STATUS_POLICY` in the `@param requiredCapability` description. Plan acceptance criterion required zero `STATUS_POLICY` matches (capability source of truth is the denormalized `restrictedFeatures` array, not the policy). Rephrased the param description to cite "the denormalized restrictedFeatures array" and "Phase 1 D-12" instead. No behavioural change.

Both adjustments were pre-commit, captured in the same Task 2 commit (`06f3c9e`).

## Issues Encountered

None.

## Known Stubs

None. Both middlewares are production-ready:
- `attachAuthIfPresent` handles all three header states (absent, non-Bearer, valid/invalid Bearer).
- `requireNotSuspended` handles all six caller states (no-uid, no-user, active, feature_limited-blocked, feature_limited-allowed, blocked/banned) with correct response matrix and error fallthrough.

Downstream integration (Plan 03-03 server.js mount onto the five gated routes) is the Phase 3 Plan 2 → Plan 3 handoff and does NOT indicate a stub in this plan.

## User Setup Required

None — no external service configuration or secrets provisioning needed. `attachAuthIfPresent` reuses Phase 1's `FIREBASE_SERVICE_ACCOUNT_JSON` env var via the shared `ensureInitialized()` helper.

## Next Phase Readiness

**Ready for Plan 03-03** (server.js integration) — Plan 03-03 will import:
1. `const { attachAuthIfPresent } = require('./src/security/attachAuthIfPresent');`
2. `const { requireNotSuspended } = require('./src/security/requireNotSuspended');`
Then compose them inline on the five D-02 gated routes:
- `POST /api/cars` — `requireNotSuspended('create_listing')`
- `POST /api/payments/create-payment-intent` — `requireNotSuspended('create_order')`
- `POST /api/payments/confirm-booking` — `requireNotSuspended('create_order')` (plus the Plan 03-04 rewrite)
- `PUT /api/brokers/:uid` — `requireNotSuspended('update_profile')`
- `PUT /api/logistics/:uid` — `requireNotSuspended('update_profile')`

**Ready for Plan 03-04** (confirmBooking transactional rewrite) — Plan 03-04's buyer + provider re-checks use the same response-shape vocabulary (403 account_suspended on buyer-suspended mid-txn; 409 provider_suspended on provider-suspended mid-txn) and the same `includeAllUsers: true` discipline established here.

**Ready for Plan 03-06** (enforcement tests) — `__tests__/enforcement/requireNotSuspended.middleware.test.js` can now `require('../../src/security/attachAuthIfPresent')` and `require('../../src/security/requireNotSuspended')` directly. The test harness firebase-admin mock pattern (copy from `__tests__/moderation/acceptance.test.js`) will drive the Bearer path via `admin.__verifyIdTokenMock.mockResolvedValueOnce({ uid, email })`.

**Blockers / concerns for Phase 3 downstream:** None new. The pre-existing duplicate-index warning from Plan 03-01 is still tracked in `deferred-items.md`; Plan 03-03 will clean it up naturally when deleting the inline schemas.

## Threat Flags

None. No new security-relevant surface beyond the plan's documented `<threat_model>` (T-03-02-01 through T-03-02-06). The `includeAllUsers: true` self-lookup bypass is the mitigation for T-03-02-03, enforced by an acceptance criterion that requires the literal string to appear exactly once.

## Self-Check: PASSED

- File `../backend-services/carEx-services/src/security/attachAuthIfPresent.js` — FOUND
- File `../backend-services/carEx-services/src/security/requireNotSuspended.js` — FOUND
- File `.planning/phases/03-backend-enforcement-backend/03-02-SUMMARY.md` — FOUND
- Backend commit `4472609` (Task 1) — FOUND in backend repo log
- Backend commit `06f3c9e` (Task 2) — FOUND in backend repo log
- `src/security/verifyIdToken.js` — UNCHANGED (0-line diff across Task 1 + Task 2)
- `server.js` — UNCHANGED (0-line diff across Task 1 + Task 2)

---
*Phase: 03-backend-enforcement-backend*
*Completed: 2026-04-17*

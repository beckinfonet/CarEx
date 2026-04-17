---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-03-PLAN.md
last_updated: "2026-04-17T20:19:02.859Z"
last_activity: 2026-04-17
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 18
  completed_plans: 15
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.
**Current focus:** Phase 03 — Backend Enforcement (Backend)

## Current Position

Phase: 03 (Backend Enforcement (Backend)) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-04-17

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P01 | 2 | 2 tasks | 4 files |
| Phase 02 P02 | 3min | 3 tasks | 5 files |
| Phase 02 P03 | 4min | 2 tasks tasks | 4 files files |
| Phase 02 P04 | 3min | 2 tasks tasks | 3 files files |
| Phase 02 P05 | 6m24s | 3 tasks | 4 files |
| Phase 02 P06 | 4m47s | 2 tasks | 2 files |
| Phase 03 P01 | 3min | 2 tasks | 3 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P03 | 2min | 2 tasks tasks | 1 file files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Backend-first 6-phase sequence forced by hard deps (verifyIdToken before endpoints; capability map before enforcement; providerSnapshot before delete; ModerationService before UI)
- Roadmap: Schema + security baseline merged into one phase (Phase 1) since both are small foundation work
- Roadmap: QUAL-01 translations audit owned by Phase 6 as cross-cutting gate; earlier phases still write translations as they go
- [Phase 02]: Plan 02-01: req.admin.uid copied from req.auth.uid in requireAdmin (option a per pattern map) — single canonical req.admin shape
- [Phase 02]: Plan 02-01: zod ^3.25.76 + express-rate-limit ^8.3.2 installed as backend production deps (D-37 caret pins)
- [Phase 02]: Plan 02-01: MongoMemoryReplSet fixture lives at __tests__/_helpers/mongoReplSet.js — sibling to existing standalone tests, not a replacement
- [Phase 02]: Plan 02-02: Edit-profile whitelist codified as two .strict() Zod objects wrapped in z.discriminatedUnion on role — machine-enforced D-03 whitelist, not just documented
- [Phase 02]: Plan 02-02: Rate limiter keyGenerator has 3-tier fallback (admin.uid → admin.email → 'unauthenticated' bucket) — regression that nulls uid degrades gracefully instead of silent single-bucket merge
- [Phase 02]: Plan 02-03: Two-step transactional pattern (insert audit row → update User with lastActionId) established as the canonical shape for every Phase 2 handler — explicitly NOT optimized into single $set per D-18
- [Phase 02]: Plan 02-03: Last-admin guard runs INSIDE the transaction with .session(session) — D-27/D-28 compliance; fires only for suspend (never for unsuspend, revoke_role, delete_profile, edit_profile per D-28)
- [Phase 02]: Plan 02-03: Router KNOWN_USER_ERRORS set pre-registered with Plan 02-04/02-05 error tags (role_not_assigned, invalid_field, no_changes, invalid_role_for_delete) — downstream plans throw without amending router error-mapping
- [Phase 02]: Plan 02-04: ROLE_FIELD_BY_NAME whitelist map at top of service.js — dynamic $set on User.{sellerStatus|brokerStatus|logisticsStatus} guarded by fixed lookup so direct service callers cannot inject arbitrary field names via the role parameter (T-02-04-06 mitigation)
- [Phase 02]: Plan 02-04: Last-admin guard explicitly NOT wired into revokeRole per D-28 — admin-ness lives in AdminUser collection (joined by email), not in User.{role}Status fields. Revoke can never make someone less of an admin. Documented in-source so future readers don't add suspend's guard 'for safety'
- [Phase 02]: Plan 02-04: Negative invariants enforced as test assertions — Tests 2/3 assert Broker/LogisticsPartner doc still exists after revoke (D-08 preservation), Test 6 asserts moderationStatus.state unchanged after revoke (D-12 orthogonality). Invariants live BOTH as in-source comments at the do-NOT step AND as toEqual assertions in revokeRole.test.js
- [Phase 02]: Plan 02-05: PROFILE_MODEL_BY_ROLE + getProfileModel() shared between delete and edit; lazy mongoose.model() resolution lets tests inject canonical-name loose-schema seeds before service.js loads, while production server.js registers the same names at boot
- [Phase 02]: Plan 02-05: Two failure paths for unknown edit-profile fields collapse to ONE error envelope ({ error: 'invalid_field', fields: [...] }) — Zod unrecognized_keys at the router AND service-layer EDIT_WHITELIST_BY_ROLE both surface identical 400 shape so mobile UI has one error path
- [Phase 02]: Plan 02-05: Two rollback evidence tests on deleteProviderProfile (audit-failure + post-delete via jest.spyOn User.updateOne mockRejectedValueOnce) prove T-02-05-02 mitigation across both ordering paths
- [Phase 02]: Plan 02-06: router.use(moderationRateLimiter) mounted IMMEDIATELY after express.Router() and BEFORE any route definitions — position load-bearing, verified by an awk positional assertion that catches misordered edits in CI
- [Phase 02]: Plan 02-06: Test isolation via moderationRateLimiter.resetKey('admin:<uid>') in a top-level beforeEach (not module-tree resets) — clears specific buckets without re-requiring the moderation router and triggering OverwriteModelError on the model singletons
- [Phase 02]: Plan 02-06: Single shared Express app built ONCE in beforeAll — limiter state is per-key not per-app, so resetKey() is sufficient for isolation; no per-describe rebuilder helper needed (or possible without OverwriteModelError)
- [Phase 02]: Plan 02-06: Block 3 Test 2 (per-admin keying) explicitly proves D-31 — admin C succeeds with 200 even after admin A's bucket is exhausted, closing the IP-rotation bypass attack vector via real e2e evidence
- [Phase 03]: Plan 03-01: Car/Broker/LogisticsPartner models extracted to src/models/*.js with co-located pre(/^find/) hide-hooks. Join fields locked: sellerId (Car), ownerUid (Broker+Logistics). Lazy mongoose.model('User') inside each hook avoids load cycle per D-08.
- [Phase 03]: Plan 03-01: includeAllUsers bypass lives on query options (not filter). One use per model file — grep-visible for Phase 6 QUAL-03 security review. Default is hide-safely (no flag = filter applies).
- [Phase 03]: Plan 03-01: server.js intentionally untouched — Plan 03-03 deletes inline schemas + wires require(). Pre-existing duplicate-index warning on ownerUid (inline unique + schema.index) preserved verbatim per scope boundary; cleanup deferred (see deferred-items.md).
- [Phase 03]: Plan 03-02: attachAuthIfPresent created as a sibling file (not a mutation of verifyIdToken.js) so /api/admin/moderation/* keeps strict 401-on-missing-Bearer (D-04). The fork is two grep-visible lines: module name + the if (!match) return next() branch.
- [Phase 03]: Plan 03-02: requireNotSuspended self-lookup uses .setOptions({ includeAllUsers: true }) as MANDATORY bypass of Plan 03-01 pre(/^find/) hide-hook. Without it, suspended caller's User doc self-hides -> middleware 404s instead of 403s -> false-negative suspension bypass (T-03-02-03 mitigation enforced by acceptance criterion requiring exactly 1 literal match).
- [Phase 03]: Plan 03-02: feature_limited capability check reads denormalized user.moderationStatus.restrictedFeatures directly (Phase 1 D-12) — acceptance criterion requires zero STATUS_POLICY references in the middleware so capability source of truth is co-located with the User doc.
- [Phase 03]: Plan 03-02: 403 account_suspended response body sends status: state (string), NOT the whole moderationStatus subdoc — mobile banner matches on the string per D-15 and avoids leaking setByAdminUid to gated users.
- [Phase 03]: Plan 03-03: server.js now requires extracted Car/Broker/LogisticsPartner models — Plan 03-01 pre(/^find/) hide-hooks go LIVE on every server.js Car/Broker/Logistics query without further changes. ROADMAP Criterion #2 effectively delivered at this commit.
- [Phase 03]: Plan 03-03: attachAuthIfPresent precedes requireNotSuspended on all five gated routes; attachAuthIfPresent precedes upload.array('images', 25) on POST /api/cars so 403 short-circuits BEFORE multer starts streaming to S3 — avoids charging S3 put-object costs on suspended callers. D-04 mount order enforced.
- [Phase 03]: Plan 03-03: exact grep counts on requireNotSuspended/attachAuthIfPresent (5/5 respectively; 1/2/2 by capability) elevated to CI-relevant invariant — scope discipline per D-02 hybrid cutover encoded as a mechanical check, not just documentation.

### Pending Todos

None yet.

### Blockers/Concerns

- Backend language (JS vs. TS) not confirmed — resolve at start of Phase 1 planning (affects Zod inference strategy)
- Existing `Order` schema may lack `providerSnapshot` — inspect before writing Phase 1 migration to determine backfill shape
- Atlas cluster tier — confirm M10+ for txn + auditing support before Phase 1
- Audit note visibility (super-admin vs. all-admin) — decision needed at Phase 2 (Pitfall 12); if no super-admin tier, treat all admins as equal for this milestone
- Railway instance count — if >1 instance, rate limiter must use `rate-limit-redis` (relevant Phase 2)

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Tech debt | Split AuthService.ts god-module | Deferred to future milestone | 2026-04-17 |
| Tech debt | Replace `user: any` typing in AuthContext | Deferred to future milestone | 2026-04-17 |
| Notifications | Email/push on moderation events | v2 — NOTF-01, NOTF-02 | 2026-04-17 |
| Release prep | Stripe pk_test_ → pk_live_ swap | Separate pre-release milestone | 2026-04-17 |

## Session Continuity

Last session: 2026-04-17T20:19:02.856Z
Stopped at: Completed 03-03-PLAN.md
Resume file: None

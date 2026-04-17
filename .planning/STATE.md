---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-04-PLAN.md
last_updated: "2026-04-17T17:45:04.939Z"
last_activity: 2026-04-17
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 12
  completed_plans: 10
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.
**Current focus:** Phase 02 — admin-moderation-endpoints-backend

## Current Position

Phase: 02 (admin-moderation-endpoints-backend) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-04-17

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P01 | 2 | 2 tasks | 4 files |
| Phase 02 P02 | 3min | 3 tasks | 5 files |
| Phase 02 P03 | 4min | 2 tasks tasks | 4 files files |
| Phase 02 P04 | 3min | 2 tasks tasks | 3 files files |

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

Last session: 2026-04-17T17:44:55.467Z
Stopped at: Completed 02-04-PLAN.md
Resume file: None

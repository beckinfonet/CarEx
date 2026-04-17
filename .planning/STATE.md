# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.
**Current focus:** Phase 1 — Schema + Security Baseline (Backend)

## Current Position

Phase: 1 of 6 (Schema + Security Baseline)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-17 — Roadmap created, 32 v1 requirements mapped across 6 phases

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Backend-first 6-phase sequence forced by hard deps (verifyIdToken before endpoints; capability map before enforcement; providerSnapshot before delete; ModerationService before UI)
- Roadmap: Schema + security baseline merged into one phase (Phase 1) since both are small foundation work
- Roadmap: QUAL-01 translations audit owned by Phase 6 as cross-cutting gate; earlier phases still write translations as they go

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

Last session: 2026-04-17
Stopped at: Roadmap created; ready to plan Phase 1
Resume file: None

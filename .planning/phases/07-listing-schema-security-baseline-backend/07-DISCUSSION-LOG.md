# Phase 7: Listing Schema + Security Baseline (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 07-listing-schema-security-baseline-backend
**Areas presented:** Audit collection topology, Car moderation field naming, Reason taxonomy, Capability map placement
**Mode:** User delegated all four technical decisions to Claude after gray-area presentation. No interactive selection per area.

---

## Audit collection topology

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing ModerationAction | One mixed-target log; requires making `targetUid` optional + adding `listingId` + expanding `action` enum from 5 to 10+ entries | |
| New sibling ListingModerationAction collection | Clean per-domain separation, parallel schema + parallel append-only pre-hooks, single 5-entry `action` enum | ✓ |

**Claude's choice:** New sibling `ListingModerationAction` (CONTEXT.md D-09).

**Rationale:**
1. Extending would weaken v1.0 user-mod contract — `ModerationAction.targetUid` is `required: true`; relaxing it forces every existing append-only test to lose specificity.
2. A 10+ entry `action` enum mixing user verbs (`suspend`, `unsuspend`, `revoke_role`, ...) with listing verbs (`suspend_listing`, `archive_listing`, ...) invites cross-domain copy-paste bugs.
3. Parallel collections give parallel indexes (`{ listingId: 1, createdAt: -1 }` vs `{ targetUid: 1, createdAt: -1 }`) without `$or` discrimination on a `targetType` field.
4. Cross-domain audit unions are cheap at query time (future MOD2-* CSV export); collapsing a mixed collection later is expensive.

REQUIREMENTS.md LDATA-03 explicitly permits either option.

---

## Car moderation field naming

| Option | Description | Selected |
|--------|-------------|----------|
| Honor REQUIREMENTS.md verbatim — top-level `Car.status` | Matches LDATA-01 + design doc verbatim; collision risk with existing `Car.listingStatus` (lifecycle) | ✓ |
| Rename to `Car.moderationStatus` subdoc (mirror v1.0 User.moderationStatus shape) | Eliminates collision; mirrors v1.0 user pattern; requires updating REQUIREMENTS.md | |

**Claude's choice:** Honor REQUIREMENTS.md verbatim — top-level `Car.status` (CONTEXT.md D-07).

**Rationale:** REQUIREMENTS.md is a locked spec. Renaming without an updated spec creates drift between requirements and implementation. Collision risk is real (`status` next to `listingStatus`, both default `'active'`) but mitigated by D-08's three-part lock: banner comment on `Car.js` + jest assertion of non-overlapping enums + grep invariant for Phase 8 endpoint code. If collisions surface in Phase 8/9 review, lifting both into named subdocs (`Car.moderationStatus.state` / `Car.lifecycleStatus.state`) is queued as a v1.2+ refactor in `<deferred>`.

---

## Reason taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse v1.0 four (`spam | policy_violation | fraud | other`) | Smallest dropdown; one translation set; reuses existing RU+EN keys | |
| Add listing-specific entries (`inactive_seller`, `inaccurate`, `duplicate`) | Larger dropdown; semantic fit for Archive's "non-punitive abandoned seller" use case | Partial ✓ |
| Drop `reasonCategory` for Archive entirely | Forces note-only Archive; loses analyzable categorical data | |

**Claude's choice:** v1.0 four + `inactive_seller` = 5 entries (CONTEXT.md D-14a).

**Rationale:** Archive's design intent ("non-punitive, for abandoned sellers") has no semantic fit in the v1.0 four — `spam`/`fraud`/`policy_violation` are all punitive. Adding `inactive_seller` covers Archive cleanly without bloating the dropdown. Skipped `inaccurate`/`duplicate` because they overlap with `policy_violation` and Edit's `fieldDiff` audit captures the underlying intent without needing a categorical bucket. Single enum reused across `Car.moderationReason` and `ListingModerationAction.reasonCategory` — one source of truth. RU+EN keys prefixed `listingReason*` to avoid collision with v1.0 `reasonSpam` etc.

---

## Capability map placement

| Option | Description | Selected |
|--------|-------------|----------|
| Land `LISTING_STATUS_POLICY` in Phase 7 (foundation) | Single cohesive plan; Phase 9 + Phase 11 import from existing module | ✓ |
| Push to Phase 9 (where it's first consumed) | Smaller Phase 7; Phase 9 gains a "create file + use file" coupling | |

**Claude's choice:** Land in Phase 7 (CONTEXT.md D-14).

**Rationale:** Cohesion — foundation work (schema + audit + auth + rate-limit + capabilities) is one plan-able unit. Splitting capability-map authorship from its consumer phase forces Phase 9 into a "scaffold + use" pattern that costs more in review burden than the ~30 lines saved. Mirrors v1.0 Phase 1 D-25/D-26 where `STATUS_POLICY` landed alongside the schema, not in the enforcement phase.

---

## Claude's Discretion

Per user direction ("you take care of the technical part"), Claude made all the above calls plus the following smaller decisions captured in CONTEXT.md's `### Claude's Discretion` block:

- Audit row schema richness — went beyond LDATA-03 minimal spec to include `adminEmail` (denorm, matches v1.0) + `fieldDiff` (Mixed, required by LADM-01) + `sellerUid` (denorm for seller-history queries) (D-12).
- Separate rate-limit buckets for user-mod vs listing-mod (`listingModerationRateLimiter` with `listing-admin:` keyGenerator prefix) instead of sharing v1.0's `moderationRateLimiter` (D-04). Rationale: independent budgets, clearer incident-response telemetry.
- Mongoose indexes: `{ status: 1 }` and `{ sellerId: 1, status: 1 }` on `Car`; `{ listingId: 1, createdAt: -1 }`, `{ adminUid: 1, createdAt: -1 }`, `{ sellerUid: 1, createdAt: -1 }` on `ListingModerationAction` (D-07 / D-10).
- Migration script: standalone `scripts/migrate-listing-moderation.js` (mirrors v1.0 D-29) + `ensureBaseline.js` extension for startup warning (mirrors v1.0 D-30) — no auto-migrate on startup (D-15 / D-17).
- Tests live in `__tests__/listing-moderation/` (sibling to v1.0's `__tests__/moderation/`), do NOT boot `server.js` (D-19 / D-20).
- Scaffold route `GET /api/admin/moderation/listings/ping` exists in Phase 7 so LSEC-01/02/03 acceptance curls can exercise the full middleware chain before real endpoints land in Phase 8 (D-01 / specifics).

## Deferred Ideas

(All also captured in CONTEXT.md `<deferred>`:)
- `Car.moderationStatus` subdoc refactor (if naming collision surfaces in Phase 8/9 review) — v1.2+.
- Cross-domain audit views (union of `moderation_actions` + `listing_moderation_actions`) — future MOD2-*.
- DB-user-level insert-only privilege on `listing_moderation_actions` — future security hardening (carries forward v1.0 D-17 deferral).
- Hash-chain tamper-evidence — future security hardening (carries forward v1.0 D-18 deferral).
- Redis-backed rate limiter for horizontal scale — when single-instance Railway constraint lifts.
- Hard-delete UI affordance — explicitly out of v1.1 per REQUIREMENTS.md.
- NOTF-* listing-status seller notifications — v1.2+.
- LIST-02 automated content flagging queue — v1.2+.
- Listing edit-history diff replay UI — v1.2+ (Phase 7 captures `fieldDiff` data; UI is future work).
- Legacy `/api/admin/requests` / `/api/admin/users` / `/api/admin/status` Bearer-idToken migration — carries forward v1.0 D-06 deferral.

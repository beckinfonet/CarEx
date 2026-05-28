# Phase 7: Listing Schema + Security Baseline (Backend) - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend foundation for v1.1 admin listing moderation. Phase 7 establishes the data shape, audit substrate, admin-auth wiring, and rate-limit budget required for Phases 8–11 to ride a stable platform. Adds a `status` field to `Car`, an append-only audit collection for listing-state transitions, a `LISTING_STATUS_POLICY` capability map for downstream consumption (Phase 9 enforcement, Phase 11 buyer banner copy keys), and a Mongoose migration script that backfills every existing listing to `status: 'active'`.

**Covers:** LSEC-01, LSEC-02, LSEC-03, LDATA-01, LDATA-02, LDATA-03, LDATA-04.

**Does NOT cover this phase:** Endpoint handlers — Edit / Suspend / Archive / Soft-Delete / Restore (Phase 8). Read-time hide hooks + status-aware listing-detail GET + cart-add and confirm-booking re-verification (Phase 9). Any mobile work (Phases 10–11).

**Scope boundary:** Backend only — work lives in `../backend-services/carEx-services/`. No changes to the `carEx` mobile repo in Phase 7.

</domain>

<decisions>
## Implementation Decisions

The user delegated technical choices to Claude. Decisions are grounded in v1.0 Phase 1 precedent, the locked LSEC/LDATA requirements, and the listing-moderation design notes. Where v1.0 established a pattern, Phase 7 mirrors it rather than reinventing.

### Backend Code Structure

- **D-01:** New files added under existing `src/moderation/` and `src/models/` directories (no new top-level subdirectory):
  - `src/models/ListingModerationAction.js` — new append-only audit collection model (see D-08, D-09)
  - `src/moderation/listingRouter.js` — admin router skeleton, scaffolds a single `GET /api/admin/moderation/listings/ping` returning `{ ok: true }` (used for the LSEC-01/02/03 acceptance curls; real endpoints arrive in Phase 8)
  - `src/moderation/listingCapabilities.js` — exports `LISTING_STATUS_POLICY` + `resolveBlockedBuyerActions(state)` helper (see D-14)
  - `src/moderation/listingRateLimit.js` — separate `listingModerationRateLimiter` instance (see D-04)
  - `scripts/migrate-listing-moderation.js` — one-off backfill script (see D-15)
- **D-02:** `Car` model already extracted to `src/models/Car.js` (during v1.0 Phase 3). Phase 7 extends it in-place — adds the moderation fields + indexes. Does NOT touch the existing `pre(/^find/)` seller-cascade hook (Phase 9 owns the new listing-status hide hook).
- **D-03:** `server.js` adds one line: `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter)`. Existing `/api/admin/moderation` mount (v1.0 user moderation) untouched.

### Admin Auth + Rate Limiting

- **D-04:** **Separate rate-limit buckets for user vs listing moderation.** Instantiate `listingModerationRateLimiter` with the same `windowMs: 15 * 60 * 1000` / `max: 30` / `standardHeaders: true` / 3-tier `keyGenerator` fallback as v1.0's `moderationRateLimiter`, but key on `listing-admin:${req.admin.uid}` so the two buckets do not share counters. Rationale: listing volume may legitimately be higher than user-mod volume; sharing would let listing actions starve out user-mod actions and vice versa, and the 429 telemetry would be ambiguous during incident response. Memory store is fine — same single-instance Railway constraint as v1.0 (horizontal scale → redis swap is a future cleanup, not Phase 7).
- **D-05:** `verifyIdToken` + `requireAdmin` reused verbatim from `src/security/` (no fork, no new copy). Both middleware ship with v1.0; Phase 7 mounts them on the new prefix.
- **D-06:** 401/403 response shapes preserved from v1.0: `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }` and `{ error: 'unauthorized', message: 'Admin access required' }`. 429 response shape preserved: `{ error: 'rate_limited', retryAfter: <seconds> }` plus `Retry-After` header. Identical envelopes mean the existing mobile `apiClient` 401/403 interceptor (v1.0 Plan 04-06) handles new routes without modification.

### Data Model — `Car` Moderation Fields (LDATA-01, LDATA-02)

- **D-07:** Field naming honors REQUIREMENTS.md verbatim: top-level `status` (not a subdoc). Schema additions:
  ```js
  status: { type: String, enum: ['active', 'suspended', 'archived', 'deleted'], default: 'active', required: true, index: true },
  moderationReason: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other'], default: null },
  moderationNote: { type: String, default: null, maxlength: 2000 },
  moderatedBy: { type: String, default: null },           // Firebase uid of admin
  moderatedAt: { type: Date, default: null },
  lastEditedBy: { type: String, default: null },          // Firebase uid of admin (LADM-01)
  lastEditedAt: { type: Date, default: null },
  ```
  Indexes: `{ status: 1 }` (Phase 9 read-time filter), `{ sellerId: 1, status: 1 }` (admin "deleted listings" filter + seller-by-status queries).
- **D-08:** **Naming-collision risk acknowledged.** `Car.listingStatus` (`'active' | 'booked' | 'sold'` — lifecycle) and `Car.status` (`'active' | 'suspended' | 'archived' | 'deleted'` — moderation) both exist and both default to `'active'`. Downstream agents MUST distinguish: `listingStatus` is the seller-side lifecycle (used by booking flow), `status` is the admin-side moderation state. Lock the distinction with: (a) a banner comment at the top of `src/models/Car.js` calling out the two-field contract; (b) a jest assertion in Phase 7 tests that the two fields exist with non-overlapping enums; (c) a `grep -c '\.status\b'` invariant for Phase 8 endpoint code to confirm intent. If collisions surface during Phase 8/9 code review, lifting both into named subdocs (`Car.moderationStatus.state` mirroring v1.0 `User.moderationStatus.state`) becomes a v1.2+ cleanup tracked in deferred-items.

### Data Model — Audit Collection (LDATA-03)

- **D-09:** **New sibling `ListingModerationAction` collection** — NOT extending the existing `ModerationAction` collection. Rationale:
  1. `ModerationAction.targetUid` is `required: true`; making it optional weakens the v1.0 user-mod contract (Phase 1 D-15) and reduces every existing append-only test's specificity.
  2. The `action` enum would need 5+ new entries (`suspend_listing`, `archive_listing`, `delete_listing`, `restore_listing`, `edit_listing`) alongside the existing 5 user entries; a single 10-entry enum invites copy-paste bugs where a handler writes the user variant for a listing action or vice versa.
  3. Parallel collections give clean per-domain indexes, parallel append-only invariants, parallel pre-hook tests, and let Phase 5 admin-history queries split by domain without `$or` discrimination on `targetType`.
  4. Cross-domain audit views (future MOD2-* CSV export, super-admin audit review) can union the two collections at query time when needed — that's cheap; collapsing a mixed-target collection later is expensive.
- **D-10:** `ListingModerationAction` schema — mirrors v1.0 `ModerationAction` shape where applicable, listing-specific where needed:
  ```js
  {
    listingId: { type: String, required: true },        // Car._id as string (matches existing Car._id usage)
    sellerUid: { type: String, required: true },        // Firebase uid of listing owner — denormalized for seller-history queries
    adminUid: { type: String, required: true },
    adminEmail: { type: String, required: true },       // denormalized for audit readability (mirrors v1.0 D-15)
    action: { type: String, enum: ['suspend', 'archive', 'delete', 'restore', 'edit'], required: true },
    fromStatus: { type: String, enum: ['active', 'suspended', 'archived', 'deleted'], required: true },
    toStatus: { type: String, enum: ['active', 'suspended', 'archived', 'deleted'], required: true },
    reasonCategory: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other'], default: null },
    reasonNote: { type: String, default: null, maxlength: 2000 },
    fieldDiff: { type: mongoose.Schema.Types.Mixed, default: null },  // populated for action='edit' (LADM-01)
    createdAt: { type: Date, default: Date.now, required: true },
  }
  ```
  Collection name: `listing_moderation_actions`. Indexes: `{ listingId: 1, createdAt: -1 }`, `{ adminUid: 1, createdAt: -1 }`, `{ sellerUid: 1, createdAt: -1 }`.
- **D-11:** **Append-only enforcement** at the application layer — same 6 pre-hooks as v1.0 `ModerationAction`: `pre('updateOne' | 'updateMany' | 'findOneAndUpdate' | 'deleteOne' | 'deleteMany' | 'findOneAndDelete', () => { throw new Error('ListingModerationAction is append-only'); })`. Phase 7 tests assert every hook fires. DB-user-level insert-only privilege deferred (same rationale as v1.0 D-17 — Atlas privilege change not in scope).
- **D-12:** Audit row is richer than REQUIREMENTS.md LDATA-03's minimal spec on purpose — `adminEmail` (denormalized for readability), `sellerUid` (denormalized for seller-history queries), `fieldDiff` (LADM-01 requires it for the Edit action). Minimal LDATA-03 spec is the floor; v1.0 ModerationAction shape is the ceiling. Excess fields are cheap and keep us from a follow-up migration.
- **D-13:** No hash-chain tamper-evidence (same deferral as v1.0 D-18). Tracked under future security hardening milestone.

### Reason Taxonomy

- **D-14a:** Reason enum: `'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other'` (5 entries). Adds `inactive_seller` to v1.0's four — the Archive action's design intent ("non-punitive, for abandoned sellers") had no semantic fit in the v1.0 taxonomy. Same enum reused on `Car.moderationReason` (D-07) and `ListingModerationAction.reasonCategory` (D-10) — single source of truth. RU + EN translations land in Phase 11 (LQUAL-01) under keys `listingReasonSpam / listingReasonPolicyViolation / listingReasonFraud / listingReasonInactiveSeller / listingReasonOther` (prefix `listing` to avoid collision with v1.0 `reasonSpam` etc.).

### Capability Map (downstream-consumed; landed in Phase 7)

- **D-14:** `src/moderation/listingCapabilities.js` exports `LISTING_STATUS_POLICY` — a 4-state map mirroring v1.0 `STATUS_POLICY` shape. Phase 9 consumes it for buyer-action gating + thin-payload reason surfacing; Phase 11 consumes the `bannerCopyKey` fields for severity-aware buyer banner. Landing here (not Phase 9) so the foundation work is one cohesive plan and Phase 9 doesn't gain a "create file + use file" coupling that risks scope creep.
  ```js
  const LISTING_STATUS_POLICY = {
    active: {
      buyerBlocked: [],                                 // buyer can view + cart + checkout
      banner: null,
    },
    suspended: {
      buyerBlocked: ['add_to_cart', 'confirm_booking'], // Phase 9 enforcement
      banner: { titleKey: 'listingBannerSuspendedTitle', bodyKey: 'listingBannerSuspendedBody', severity: 'warning' },
    },
    archived: {
      buyerBlocked: ['add_to_cart', 'confirm_booking'],
      banner: { titleKey: 'listingBannerArchivedTitle', bodyKey: 'listingBannerArchivedBody', severity: 'neutral' },
    },
    deleted: {
      buyerBlocked: ['view', 'add_to_cart', 'confirm_booking'], // listing not visible to non-admin (Phase 9 hide hook)
      banner: { titleKey: 'listingBannerDeletedTitle', bodyKey: 'listingBannerDeletedBody', severity: 'destructive' },
    },
  };
  function resolveBlockedBuyerActions(state) { return LISTING_STATUS_POLICY[state]?.buyerBlocked ?? []; }
  ```
- **D-14b:** `banner.*Key` are translation-key references. Actual RU+EN copy lands in Phase 11 (LQUAL-01). Keys are defined here so Phase 9 (thin-payload response) and Phase 11 (buyer banner component) both bind to the same identifiers.

### Migration / Backfill (LDATA-04)

- **D-15:** `scripts/migrate-listing-moderation.js` — one-off Node script invoked manually via `node scripts/migrate-listing-moderation.js`. Mirrors v1.0 `scripts/migrate-moderation.js` structure. Idempotent. Does two things:
  1. Backfills every `Car` doc lacking the `status` field with `status: 'active'` (other moderation fields default to `null` via schema defaults — no need to touch).
  2. Creates the new `{ status: 1 }` and `{ sellerId: 1, status: 1 }` indexes explicitly (so Phase 9 doesn't pay first-query index-build cost in production).
- **D-16:** Acceptance: post-migration `Car.countDocuments({})` MUST equal pre-migration count AND `Car.countDocuments({ status: { $exists: false } })` MUST return `0`. The migration script logs both counts and exits non-zero if either invariant fails.
- **D-17:** Update `src/security/ensureBaseline.js` (v1.0 D-30) to also check `Car.countDocuments({ status: { $exists: false } })` at server startup and log `[Baseline] {N} listings missing status — run scripts/migrate-listing-moderation.js` if non-zero. No auto-migrate on startup (same safety rationale as v1.0).
- **D-18:** Migration is idempotent — rerunning skips already-backfilled docs (`updateMany({ status: { $exists: false } }, { $set: { status: 'active' } })`).

### Testing

- **D-19:** Tests live under `__tests__/listing-moderation/` at backend repo root (sibling to v1.0's `__tests__/moderation/`). Phase 7 tests:
  - `ListingModerationAction.append-only.test.js` — asserts all 6 mutation/deletion hooks throw.
  - `listingCapabilities.test.js` — asserts `LISTING_STATUS_POLICY` has an entry for every value in the `Car.status` enum; asserts `resolveBlockedBuyerActions(state)` returns expected lists per state.
  - `listingModerationRateLimiter.test.js` — supertest hits the `GET /api/admin/moderation/listings/ping` route 31 times with a stubbed admin; assert 30× 200, 31st 429 with `Retry-After` header. Confirms separate-bucket behavior by hitting the v1.0 user-mod prefix in parallel and observing both succeed.
  - `requireAdmin.listing.middleware.test.js` — re-exercises `verifyIdToken` + `requireAdmin` chain against the new listing prefix to lock LSEC-01/02: missing Bearer → 401, valid Bearer non-admin → 403, valid Bearer admin → 200.
  - `Car.status-field.test.js` — schema-level assertions: `status` field defaults to `'active'`, enum rejects invalid values, naming-collision lock (D-08).
  - `migrate-listing-moderation.test.js` — boots `mongodb-memory-server`, seeds 10 `Car` docs (some pre-existing `status`, some missing), runs migration, asserts pre/post counts match + every doc has `status` set.
- **D-20:** Tests do NOT boot `server.js` — each builds a minimal Express app or calls service/model directly. Same isolation pattern as v1.0 D-36 / Phase 5 Plan 05-10.

### Claude's Discretion (planner/executor may choose without re-asking)

- Exact ordering of migration script steps (index-create first vs. backfill first — both idempotent).
- Whether `Car.moderationNote` cap is exactly 2000 chars (mirror v1.0) or a different value if research surfaces a reason — v1.0 ceiling is the default unless tests in Phase 8 surface payload-size concerns.
- Precise jest config delta — should be additive, not a replacement of v1.0's config.
- Whether `ListingModerationAction.fieldDiff` uses `mongoose.Schema.Types.Mixed` (matches v1.0 D-15 / ModerationAction.fieldDiff) vs. a typed subdoc. Default: `Mixed` for parity.
- Number of plans within Phase 7 — gsd-planner decides; 5–6 plans is the v1.0-precedent shape (model + audit + auth-mount + capability map + migration + tests).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone v1.1 core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 7 REQ-IDs: LSEC-01, LSEC-02, LSEC-03, LDATA-01, LDATA-02, LDATA-03, LDATA-04
- `.planning/ROADMAP.md` §"Phase 7: Listing Schema + Security Baseline (Backend)" — Goal + 4 success criteria
- `.planning/notes/listing-moderation-design.md` — Design-decided source for the four-action model, audit-trail topology choice, endpoint shape, buyer pause-not-cancel semantics

### v1.0 precedent (this phase is the listing-domain mirror)
- `.planning/phases/01-schema-security-baseline-backend/01-CONTEXT.md` — v1.0 Phase 1 context (Schema + Security Baseline) — the direct template for Phase 7's audit, append-only, capability-map, migration patterns
- `.planning/phases/01-schema-security-baseline-backend/01-VERIFICATION.md` — v1.0 Phase 1 verification — acceptance shapes Phase 7 must hit
- `.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md` §"Rate limiting" — `moderationRateLimiter` design Phase 7 forks for D-04
- `.planning/phases/03-backend-enforcement-backend/03-CONTEXT.md` §"Read-time hide hooks" — Phase 9 will follow this template; Phase 7 must leave the door open

### Backend codebase (existing, MUST read before editing)
- `../backend-services/carEx-services/src/models/Car.js` — Currently has `listingStatus` (lifecycle); Phase 7 EXTENDS this file with moderation fields (D-07). Existing `pre(/^find/)` seller-cascade hook (lines 50–82) MUST NOT be modified — Phase 9 owns the listing-status hide hook.
- `../backend-services/carEx-services/src/models/ModerationAction.js` — v1.0 user-moderation audit schema; the parallel for D-09's new `ListingModerationAction`. Append-only pre-hook pattern (lines 19–25) reused verbatim.
- `../backend-services/carEx-services/src/moderation/rateLimit.js` — v1.0 `moderationRateLimiter`. Phase 7's `listingModerationRateLimiter` (D-04) is a structural clone with a different `keyGenerator` prefix.
- `../backend-services/carEx-services/src/moderation/router.js` — v1.0 user-moderation router (read for mount-point pattern only; Phase 7 ships a SEPARATE `listingRouter.js`).
- `../backend-services/carEx-services/src/moderation/capabilities.js` — v1.0 `STATUS_POLICY` — the structural template for `LISTING_STATUS_POLICY` (D-14).
- `../backend-services/carEx-services/src/security/verifyIdToken.js`, `requireAdmin.js`, `ensureBaseline.js` — Reused verbatim; `ensureBaseline.js` gains the listing-baseline check (D-17).
- `../backend-services/carEx-services/scripts/migrate-moderation.js` — Structural template for `scripts/migrate-listing-moderation.js` (D-15).
- `../backend-services/carEx-services/server.js` — Phase 7 adds ONE line: `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter)` (D-03).

### External references (planner/researcher lookups, if needed)
- Firebase Admin SDK — Verify ID Tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Mongoose schema middleware: https://mongoosejs.com/docs/middleware.html
- express-rate-limit (v8): https://www.npmjs.com/package/express-rate-limit
- Project memory: `[[backend_repo_location]]` — backend repo is at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (sibling of `carEx`)
- Project memory: `[[backend_deploy_gotcha]]` — Railway deploys backend `main` only; "works local, fails prod" → check backend `main` vs feature branch FIRST

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already in backend, do NOT re-create)
- **`verifyIdToken` + `requireAdmin` middleware** (`src/security/verifyIdToken.js`, `src/security/requireAdmin.js`) — Mount on the new listing-moderation router unchanged.
- **`moderationRateLimiter` shape** (`src/moderation/rateLimit.js`) — Fork the structure (keyGenerator + window + max + response shape) into `listingModerationRateLimiter` with a `listing-admin:` key prefix (D-04).
- **`ModerationAction` schema + append-only pre-hooks** (`src/models/ModerationAction.js`) — Fork the structure into `ListingModerationAction`. Do NOT extend the existing collection (D-09 rationale).
- **`STATUS_POLICY` capability map** (`src/moderation/capabilities.js`) — Fork the shape into `LISTING_STATUS_POLICY` (D-14). Different state vocabulary, same module pattern.
- **`scripts/migrate-moderation.js`** — Fork into `scripts/migrate-listing-moderation.js`. Same idempotent + non-zero-exit-on-failure + index-creation discipline (D-15).
- **`src/security/ensureBaseline.js`** — EXTEND in place (do not fork); add the `Car.status` baseline check alongside the existing `User.moderationStatus.state` check (D-17).
- **`Car` model** (`src/models/Car.js`) — EXTEND in place. New fields land on the existing schema. Existing seller-cascade `pre(/^find/)` hook MUST NOT be modified.
- **jest + supertest + mongodb-memory-server** — Already devDeps; Phase 7 adds tests, not infrastructure.

### Established Patterns (must honor)
- **All Mongoose models in `src/models/` use explicit collection names** (`mongoose.model('Name', schema, 'collection_name')`). `ListingModerationAction` uses `'listing_moderation_actions'` (D-09 / D-10).
- **Append-only enforcement is application-layer (6 pre-hooks, throw with stable error message)** — v1.0 D-17 / `ModerationAction.js:19–25`. Replicated for `ListingModerationAction` (D-11).
- **Rate limiter response is `{ error: 'rate_limited', retryAfter }` + `Retry-After` header + RFC 6585 `RateLimit-*` headers** — v1.0 Plan 02-06 contract; preserved for the listing limiter (D-06).
- **401/403/429 envelopes are JSON `{ error: <code>, message: <human> }`** — distinguishable by `error` code; mobile interceptor (already deployed, v1.0 Plan 04-06) routes by code.
- **Migration scripts exit non-zero on any document the script cannot backfill** — v1.0 D-31. `migrate-listing-moderation.js` follows the same discipline (D-16).
- **`ensureBaseline()` runs after Mongoose connects and only LOGS — never auto-migrates** — v1.0 D-30. Phase 7 extends it (D-17).
- **Tests do NOT boot `server.js`** — each file builds its own minimal Express app or calls models/services directly (v1.0 D-36 / Phase 5 Plan 05-10). Replicated for Phase 7 tests (D-20).

### Integration Points
- **`server.js` mount block** (after the existing `/api/admin/moderation` mount) — single `app.use('/api/admin/moderation/listings', ...)` line (D-03).
- **`src/security/ensureBaseline.js`** — adds one `countDocuments({ status: { $exists: false } })` check on `Car` after the existing User check (D-17).
- **Phase 8 endpoint handlers (NOT THIS PHASE)** will consume `Car.status` enum, the `ListingModerationAction` model, and the `LISTING_STATUS_POLICY` map. Phase 7's job is to land the substrate; Phase 8 wires the handlers atop it.
- **Phase 9 hide hooks (NOT THIS PHASE)** will add a SECOND `pre(/^find/)` hook on `Car` that filters by `status !== 'active'` with an `includeAllListingStatuses` bypass option. Phase 7 must leave the existing seller-cascade hook (lines 50–82) intact and untouched so Phase 9 can land cleanly atop it.

### Anti-Pattern Warnings
- **Do NOT mutate `Car.listingStatus` for moderation.** `listingStatus` enum stays `'active' | 'booked' | 'sold'` (lifecycle). Moderation lives on the NEW `Car.status` field (D-07). Mirrors v1.0 anti-pattern §"Do NOT add a `suspended` state to `Car.listingStatus`" — same rationale (unsuspend-leaves-hidden bug, double-source-of-truth ambiguity).
- **Do NOT extend the existing `ModerationAction` collection.** D-09 rationale: weakens user-mod append-only contract, balloons the `action` enum, costs more in test specificity than the cross-domain query benefit. Use the sibling collection.
- **Do NOT modify the existing `Car.pre(/^find/)` seller-cascade hook in Phase 7.** Phase 9 will add a SECOND hook for listing-status filtering. Two hooks compose cleanly; a single mega-hook is harder to test and harder to bypass surgically (admin needs `includeAllUsers: true` for one and `includeAllListingStatuses: true` for the other — they're orthogonal bypasses).
- **Do NOT add the listing-moderation rate limiter to the existing `/api/admin/moderation` mount.** Separate buckets (D-04) means listing actions and user-mod actions have independent budgets. Re-using the existing limiter (`moderationRateLimiter`) would force a SHARED bucket and break LSEC-03's "30 listing actions / 15 min" budget when an admin has already spent budget on user mod.
- **Do NOT commit anything to `Car.status` enum beyond the 4 design-locked values** (`'active' | 'suspended' | 'archived' | 'deleted'`). New states require a roadmap-level discussion + REQUIREMENTS.md update — not a Phase 7 schema-tweak.

</code_context>

<specifics>
## Specific Ideas

- LSEC-01/02/03 acceptance curls map directly to ROADMAP §"Phase 7 Success Criteria" #2 and #3 — every plan's `must_haves` should map to one of the 4 ROADMAP criteria. The `GET /api/admin/moderation/listings/ping` scaffold route (D-01) exists explicitly to make the 401/403/429 acceptance shells exercise the full middleware chain end-to-end before any real endpoint lands in Phase 8.
- LDATA-04 acceptance (`Car.countDocuments({ status: { $exists: false } })` returns 0 post-migration) is a hard merge-gate. Phase 7's migration test (D-19's `migrate-listing-moderation.test.js`) is the in-tree mechanical check; the production-deploy step has its own manual run + Railway log verification.
- `Car.status` index choice is load-bearing for Phase 9's `pre(/^find/)` hide hook performance — `{ status: 1 }` alone is sufficient for the unanchored "exclude non-active" query; `{ sellerId: 1, status: 1 }` is the compound that lets the admin "Deleted listings" filter view scale (LUI-04 in Phase 10).
- The `ListingModerationAction.fieldDiff` shape (D-10) is intentionally `Mixed` rather than typed because the Edit action (LADM-01) may touch arbitrary `Car` fields (price, description, images, etc.) and a typed subdoc would gate every Edit on a schema-update PR. Mirror of v1.0 `ModerationAction.fieldDiff` (D-15).

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to follow-up phases or milestones — do not quietly re-introduce:**

- **`Car.moderationStatus` subdoc refactor.** Naming-collision risk between `Car.status` (moderation) and `Car.listingStatus` (lifecycle) is mitigated by D-08 conventions + tests, not a schema lift. If Phase 8/9 code review shows real collisions, lifting both into `Car.moderationStatus.state` / `Car.lifecycleStatus.state` named subdocs becomes a v1.2+ refactor.
- **Cross-domain audit views (user-mod + listing-mod unioned).** Future MOD2-* CSV export + super-admin audit review will need a union query across `moderation_actions` + `listing_moderation_actions`. Cheap to do at query time; not in Phase 7 scope.
- **DB-user-level insert-only privilege on `listing_moderation_actions`.** Same Atlas-privilege constraint as v1.0 D-17. Tracked for future security hardening milestone.
- **Hash-chain tamper-evidence on `ListingModerationAction`.** Same deferral as v1.0 D-18.
- **Redis-backed rate limiter** for horizontal Railway scaling. Memory store is fine for single-instance deploy — same constraint as v1.0. Tracked when scaling demand surfaces.
- **Hard-delete UI affordance.** Backend op only when truly needed; explicitly out of v1.1 scope per REQUIREMENTS.md.
- **Listing-status email/push notifications to seller** (NOTF-* carry-forward). Buyer banner + in-app surfacing only for v1.1.
- **LIST-02 — Automated content flagging queue** (auto-suspend after N reports). Paired with LIST-01 in design but deferred to v1.2+.
- **Listing edit-history diff replay UI.** Phase 7's `fieldDiff` capture lands the data; the admin UI to view it is deferred to v1.2+.
- **Migrating legacy `/api/admin/requests` / `/api/admin/users` / `/api/admin/status` to Bearer idToken** — v1.0 D-06 carry-forward; still tracked, still not addressed.

</deferred>

---

*Phase: 07-listing-schema-security-baseline-backend*
*Context gathered: 2026-05-28*

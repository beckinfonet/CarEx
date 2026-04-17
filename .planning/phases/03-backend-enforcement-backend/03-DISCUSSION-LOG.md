# Phase 3: Backend Enforcement (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 03-backend-enforcement-backend
**Areas discussed:** Caller auth for gating, Read-time hide strategy (ENF-02), Payment re-verification placement (ENF-03)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Caller auth for gating | How requireNotSuspended identifies the caller: Bearer idToken vs body/path uid. Forces a decision because ENF-01 returns 403 based on *who* is calling. | ✓ |
| Read-time hide strategy (ENF-02) | How Mongoose pre(/^find/) hides cars/brokers/logistics owned by non-active users. Cache vs $nin vs $lookup. | ✓ |
| Payment re-verification placement (ENF-03) | confirm-booking today doesn't know providers. Move to POST /api/orders, extend payload, or merge endpoints. | ✓ |
| Per-route capability declaration (ENF-04) | How each gated route declares which capability it requires (factory vs registry vs hardcoded). | |

**Claude's discretion for unselected:** ENF-04 per-route capability declaration — recorded as middleware factory `requireNotSuspended('create_listing')` in CONTEXT.md Claude's Discretion section.

---

## Caller Auth for Gating

### Question 1: Caller identity mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Bearer idToken on gated routes (Recommended) | Verify idToken, read req.auth.uid. Non-spoofable. Expands Phase 1 deferred SEC-01 scope to 5 user-write routes. | ✓ |
| Body/param uid, flag for follow-up | Match existing pattern, spoofable, defer Bearer to follow-up milestone. | |
| Bearer-required + body-uid cross-check | Verify idToken AND require body uid matches req.auth.uid. Strongest but highest diff. | |

**User's choice:** Bearer idToken on gated routes
**Notes:** Locked as D-01. Phase 4 mobile must wire Bearer on these calls.

### Question 2: Route scope

| Option | Description | Selected |
|--------|-------------|----------|
| ROADMAP-named only (Recommended) | Gate exactly 5 routes from success criterion #1. contact-seller deferred. Everything else follow-up ticket. | ✓ |
| ROADMAP-named + obvious neighbors | Above 5 plus listing edit/state, request-role, confirm-booking. | |
| Every user-mutation route | Gate all ~12 user-write routes. Defensive. Larger diff. | |

**User's choice:** ROADMAP-named only
**Notes:** Locked as D-02. Non-gated neighbors tracked in Deferred Ideas.

### Question 3: Rollout sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 ships dual-accept temporarily (Recommended) | Accept Bearer OR body-uid fallback with deprecation warning. Phase 6 strict cutover. | ✓ |
| Phase 3 ships strict, deploy behind Phase 4 | Bearer-only code, manual deploy gating. | |
| Phase 3 strict + blocks mobile 4.x releases | Forces store rollout timing with Phase 3 deploy. Highest regression risk. | |

**User's choice:** Phase 3 ships dual-accept temporarily
**Notes:** Locked as D-03. Fallback removal = Phase 6 QUAL-03 trigger.

---

## Read-Time Hide Strategy (ENF-02)

### Question 1: Hide computation mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Per-query $nin suspended uids (Recommended) | User.distinct on non-active uids, rewrite query with $nin. Stateless, index-backed, extra lightweight query per public list. | ✓ |
| In-memory suspended-uids cache + invalidation | Zero extra query but cache coherency gotcha on multi-instance Railway. | |
| $lookup aggregation join to User | Single query, no cache, but changes query shape everywhere (no .lean()). | |

**User's choice:** Per-query $nin suspended uids
**Notes:** Locked as D-05. Denylist-cache alternative tracked in Deferred Ideas for future scale.

### Question 2: Bypass mechanism for admin/internal paths

| Option | Description | Selected |
|--------|-------------|----------|
| Query option .setOptions({ includeAllUsers: true }) (Recommended) | Explicit opt-in per call site. Grep-friendly for Phase 6 QUAL-03 review. Default is hide-safely. | ✓ |
| Bypass only on authenticated admin requests | Async-local-storage, auto-bypass if req.admin set. Breaks payment re-check path. | |
| Separate 'Raw' model aliases | Three more models in registry; drift risk. | |

**User's choice:** Query option .setOptions({ includeAllUsers: true })
**Notes:** Locked as D-07.

### Question 3: Revoke-role hide scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both conditions (Recommended) | Filter on moderationStatus.state !== 'active' OR xStatus !== 'APPROVED'. Revoke hides directories. | ✓ |
| Only moderationStatus (suspend/ban hides) | Revoke handled by separate mechanism at handler level. Cleaner separation but two debug sites. | |

**User's choice:** Yes — both conditions
**Notes:** Locked as D-06. Per-model xStatus field: sellerStatus (Car), brokerStatus (Broker), logisticsStatus (LogisticsPartner).

---

## Payment Re-Verification Placement (ENF-03)

### Question 1: Where re-verification happens

| Option | Description | Selected |
|--------|-------------|----------|
| Extend confirm-booking payload + merge order creation (Recommended) | confirm-booking absorbs POST /api/orders into one transaction. Closes TOCTOU and orphaned-order race. Matches acceptance #3 literally. | ✓ |
| Extend confirm-booking payload, keep POST /api/orders separate | Re-check in confirm, keep two-step flow. Tiny second window between. | |
| Push re-check into POST /api/orders; reframe acceptance #3 | Cleanest diff but diverges from acceptance wording. | |

**User's choice:** Extend confirm-booking payload + merge order creation
**Notes:** Locked as D-10. New payload shape documented in CONTEXT.md.

### Question 2: POST /api/orders fate

| Option | Description | Selected |
|--------|-------------|----------|
| Return 410 Gone with deprecation message (Recommended) | Stale mobile builds fail loudly. Removed in follow-up cleanup. | ✓ |
| Keep it functional (dual path) | Old clients still work via two-step flow, but TOCTOU bug persists. | |
| Delete it entirely | Express 404 default. Confusing UX for stale builds. | |

**User's choice:** Return 410 Gone with deprecation message
**Notes:** Locked as D-12. Route-removal cleanup tracked in Deferred Ideas.

### Question 3: Stripe handling on suspended-provider detection

| Option | Description | Selected |
|--------|-------------|----------|
| stripe.refunds.create + transaction aborts (Recommended) | Refund first, throw second. Refund outside Mongo tx. Worst case: refund succeeded, tx clean. | ✓ |
| Mark order 'paused', no refund | Preserves admin decision-making but contradicts acceptance #3 wording. | |
| stripe.paymentIntents.cancel (not refund) | Technically wrong (PI status is 'succeeded'). | |

**User's choice:** stripe.refunds.create + transaction aborts
**Notes:** Locked as D-11. Refund-first-then-throw ordering is the critical invariant; reversing risks buyer-charged-no-order on Stripe outage.

---

## Claude's Discretion

Captured in CONTEXT.md §Decisions §Claude's Discretion:

- ENF-04 per-route capability declaration shape → middleware factory `requireNotSuspended('capability_name')`
- confirm-booking idempotency on buyer retries → existing-PaymentIntent short-circuit returning prior orders
- Exact ordering of reads inside the confirm-booking transaction
- Whether to extract Car/Broker/LogisticsPartner models to src/models/ as prerequisite step or inline hooks on existing server.js schemas
- Deprecation warning log format
- Retry-on-refund-failure policy

## Deferred Ideas

Captured in CONTEXT.md §Deferred. Notable:

- `contact-seller` endpoint (doesn't exist in server.js today)
- Order-pause banner / pause semantics for in-flight orders (no ENF-* covers it; likely Phase 5/6)
- Migration of non-gated user-write routes to Bearer (follow-up milestone with legacy admin route cleanup)
- Removal of dual-accept body-uid fallback (Phase 6 QUAL-03 trigger)
- Removal of POST /api/orders entirely (follow-up after Phase 4 stops calling it)
- Denylist-cache strategy for pre-find hook (scale-triggered refactor)
- rate-limit-redis for multi-instance Railway (carried from Phase 2)

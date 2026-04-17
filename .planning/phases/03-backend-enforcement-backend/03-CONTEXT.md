# Phase 3: Backend Enforcement (Backend) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Non-active users (suspended, blocked_with_review, permanently_banned, or role-revoked) are blocked from user-mutation endpoints server-side; their listings disappear from public reads without any denormalized flag mutation; payment confirmation re-verifies every involved provider's status inside a Mongoose transaction before finalizing. Scope is read-time visibility + write-time gating + payment-flow TOCTOU close.

**Covers:** ENF-01, ENF-02, ENF-03, ENF-04.

**Does NOT cover this phase:**
- Any mobile work (Phase 4 wires Bearer idToken globally + 403 interceptor)
- Order-pause UX for in-flight orders touching a suspended provider (deferred — no ENF-* covers it)
- Migration of non-gated user routes to Bearer idToken (PUT /api/users/:uid, POST /api/users/:uid/avatar, DELETE /api/users/:uid, order status patches)
- `GET /api/admin/moderation/:targetUid/history` audit-read endpoint (Phase 5, UI-03)
- Admin/affected-user UI (Phases 5, 6)

**Scope boundary:** Backend only — all work in `../backend-services/carEx-services/`. No changes to the `carEx` mobile repo.

</domain>

<decisions>
## Implementation Decisions

### Caller Authentication for `requireNotSuspended` (ENF-01)

- **D-01:** **`requireNotSuspended` mounts after `verifyIdToken` on gated routes; caller uid comes from `req.auth.uid`** (non-spoofable). This extends Phase 1's Bearer-idToken wiring (01 D-05, D-06) from `/api/admin/moderation/*` onto five user-write routes. Per-request lookup pattern:
  ```js
  // backend-services/carEx-services/src/security/requireNotSuspended.js
  module.exports = function requireNotSuspended(requiredCapability) {
    return async (req, res, next) => {
      const callerUid = req.auth?.uid ?? req.body?.sellerId ?? req.body?.buyerUid ?? req.params?.uid; // see D-03 dual-accept
      const user = await User.findOne({ firebaseUid: callerUid })
        .select('moderationStatus')
        .setOptions({ includeAllUsers: true })  // see D-05: bypass the hide filter
        .lean();
      if (!user) return res.status(404).json({ error: 'user_not_found' });
      const { state, reasonCategory, note, restrictedFeatures } = user.moderationStatus ?? { state: 'active' };
      if (state !== 'active' &&
          (state !== 'feature_limited' || (requiredCapability && restrictedFeatures?.includes(requiredCapability)))) {
        return res.status(403).json({ error: 'account_suspended', status: state, reasonCategory, note });
      }
      req.callerUser = user;
      next();
    };
  };
  ```
- **D-02:** **Gate exactly the five ROADMAP-named routes** (success criterion #1):
  1. `POST /api/cars` — capability `create_listing`
  2. `POST /api/payments/create-payment-intent` — capability `create_order`
  3. `POST /api/payments/confirm-booking` — capability `create_order` (NEW merged endpoint, see D-07)
  4. `PUT /api/brokers/:uid` — capability `update_profile`
  5. `PUT /api/logistics/:uid` — capability `update_profile`

  `POST /api/orders` is NOT gated — it becomes 410 Gone (D-08). `contact-seller` from ROADMAP #1 is deferred (no such endpoint exists in `server.js` — tracked in Deferred Ideas). Other user-write neighbors (PUT /api/cars/:id, PATCH /api/cars/:id/status, POST /api/users/:uid/request-{seller,broker,logistics}, PUT /api/users/:uid, POST /api/users/:uid/avatar, DELETE /api/users/:uid, PATCH /api/orders/:id/status, PATCH /api/orders/:id/services/:serviceIndex/status) stay ungated in Phase 3 and are tracked as follow-up tickets.

- **D-03:** **Dual-accept transitional mode.** `requireNotSuspended` first tries `req.auth.uid` (Bearer verified); if no Authorization header is present, falls back to `req.body.sellerId || req.body.buyerUid || req.params.uid` AND logs a deprecation warning (`console.warn('[requireNotSuspended] deprecated body-uid fallback used', { route, uid })`). Phase 4 wires Bearer on mobile; Phase 6 security review (QUAL-03) removes the fallback. Rationale: lets Phase 3 ship and deploy without breaking the in-flight mobile build.

- **D-04:** **Mount order on every gated route:** `verifyIdToken` (optional, only sets req.auth if Bearer present — see D-03) → `requireNotSuspended(capability)` → handler. Existing `verifyIdToken` middleware must be updated to skip 401 when no Authorization header is present (current Phase 1 implementation hard-fails on missing Bearer); rename or fork to `attachAuthIfPresent` for the dual-accept period. After Phase 6 strict cutover, revert to strict `verifyIdToken`.

### Read-Time Visibility Filter (ENF-02)

- **D-05:** **Mongoose `pre(/^find/)` hook on Car, Broker, LogisticsPartner models.** Per-query strategy: resolve the set of "hidden owner uids" via `User.distinct('firebaseUid', <model-specific filter>)` and rewrite the query's filter to add `$nin`. Stateless, no cache, always correct. Index-backed by Phase 1 D-13 (`{ 'moderationStatus.state': 1 }`).

- **D-06:** **Hidden-owner filter combines moderation state AND role status** per model:
  ```js
  // Car pre(/^find/) — hide cars whose seller is non-active OR no longer APPROVED
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { sellerStatus: { $ne: 'APPROVED' } },
    ],
  });
  this.setQuery({ ...this.getQuery(), sellerId: { $nin: hiddenUids } });

  // Broker pre(/^find/) — ownerUid join, check brokerStatus instead
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { brokerStatus: { $ne: 'APPROVED' } },
    ],
  });
  this.setQuery({ ...this.getQuery(), ownerUid: { $nin: hiddenUids } });

  // LogisticsPartner pre(/^find/) — ownerUid join, check logisticsStatus
  // (same shape, field = logisticsStatus)
  ```
  Match on `sellerId` for Car (existing field name), `ownerUid` for Broker/LogisticsPartner (existing field name). Verified against `server.js:383, 559, 614`.

- **D-07:** **Bypass via `.setOptions({ includeAllUsers: true })`.** The hook reads `this.getOptions().includeAllUsers` and skips the filter when true. Every admin handler, `moderation/service.js`, the `requireNotSuspended` self-lookup, the confirm-booking provider re-check, audit joins, and seeding scripts pass this flag. Grep-friendly for Phase 6 QUAL-03 security review. Default behavior (no flag) is hide-safely.

- **D-08:** **Hook registration lives in the model file**, co-located with schema definition (`src/models/Car.js`, `src/models/Broker.js`, `src/models/LogisticsPartner.js`). If those models still live inline in `server.js` at Phase 3 start (they do per 01 D-02), this phase extracts them to `src/models/` first — consistent with Phase 1's extraction pattern. Non-goal: refactoring their handlers, only extracting the schemas + attaching the hook.

- **D-09:** **`findById` and `findOne` both pick up the hook** (matches `/^find/`). Public single-resource fetch for a suspended owner's car returns null → handler returns 404. Deep-link to a suspended seller's listing gets "not found" — same public contract as the list query. Admin detail views bypass via `includeAllUsers`.

### Payment Re-Verification + Booking Atomicity (ENF-03)

- **D-10:** **`POST /api/payments/confirm-booking` absorbs order creation into a single Mongoose transaction.** New payload shape:
  ```js
  { paymentIntentId, carId, buyerUid, items: [{ providerUid, providerType, service }, ...] }
  ```
  Handler opens `session.withTransaction()` and, inside:
  1. Retrieve Stripe PI, verify `status === 'succeeded'` (existing check).
  2. Re-fetch `buyerUid`'s User document with `.setOptions({ includeAllUsers: true })` → if `moderationStatus.state !== 'active'` → call `stripe.refunds.create({ payment_intent: paymentIntentId })` → throw `ProviderSuspendedError` (aborts transaction).
  3. For each unique `{providerUid, providerType}` from items:
     - Fetch provider's User document (includeAllUsers) → if not active OR role not APPROVED → refund then throw.
     - Resolve provider profile (`Broker.findOne({ ownerUid }, ..., { includeAllUsers: true })` or `LogisticsPartner.findOne(...)`) → build `providerSnapshot` per 01 D-21–D-24.
  4. Re-fetch `Car.findById(carId, ..., { includeAllUsers: true })` → verify seller is active AND APPROVED (same check). If not → refund then throw.
  5. Flip `car.listingStatus = 'booked'`, set `bookedByUid`, `stripePaymentIntentId`, save in session.
  6. Create `ServiceOrder` rows (one per provider group, matching current logic at `server.js:1194-1236`) in session.
  7. Commit. Return `{ car, orders }` unified response.

- **D-11:** **`stripe.refunds.create` runs BEFORE throw, OUTSIDE Mongo transaction — ordered first deliberately.** Stripe API is not part of the Mongo transaction; if we throw-then-refund, a Stripe outage leaves the buyer charged with no order. Refund-then-throw ordering means worst case is "refund succeeded, transaction aborted cleanly" (safe) rather than "transaction aborted, refund never fired" (buyer loses money). On refund-API failure itself: log, set `_stripeRefundFailed = true` on the error response so ops can reconcile manually. Response shape on provider-suspended: `409 { error: 'provider_suspended', providerUid, refundId?, refundFailed? }`.

- **D-12:** **`POST /api/orders` → 410 Gone.** Handler body replaced with `res.status(410).json({ error: 'deprecated', message: 'Use POST /api/payments/confirm-booking which now creates orders atomically' })`. Any stale mobile build still calling the old two-step flow fails loudly and visibly. Route entry removed from `server.js` in a follow-up cleanup after Phase 4 mobile stops calling it.

- **D-13:** **Transaction retry behavior** — `session.withTransaction()` auto-retries transient transaction errors per 02 D-23. Mongo's snapshot isolation handles the concurrent-suspend scenario: if admin's suspend commits before confirm-booking's read, confirm sees the suspended state and refunds. If confirm commits first, admin's suspend succeeds on the user without affecting the already-created order. Either ordering is correct.

- **D-14:** **Buyer moderation re-check** is included explicitly in step 2 (D-10). A suspended buyer completing checkout mid-suspension is blocked with a refund. This closes a subtle gap: ENF-01 gates `POST /api/payments/create-payment-intent` (the creation step) but until Phase 3's confirm-booking also checks the buyer, a buyer suspended between create-PI and confirm would still complete the booking. Re-checking both buyer AND providers inside the transaction closes both TOCTOU directions.

### Error Shapes (carry-forward from 01 D-10, 02 D-02)

- **D-15:** Response shapes for Phase 3:
  - `403 { error: 'account_suspended', status, reasonCategory, note }` — ENF-01 gate on non-active caller. `status` = `moderationStatus.state`, `reasonCategory` + `note` passed through verbatim so mobile can populate the banner. Pinned by ROADMAP success #1.
  - `409 { error: 'provider_suspended', providerUid, refundId?, refundFailed? }` — ENF-03 race detection.
  - `410 { error: 'deprecated', message: '...' }` — POST /api/orders after D-12.
  - `404 { error: 'user_not_found' }` — requireNotSuspended can't resolve caller uid.

### Testing

- **D-16:** Tests live in `__tests__/enforcement/` (new directory, sibling to `__tests__/moderation/`). Uses the Phase 1/2 harness (mongodb-memory-server replica-set mode, jest.mock firebase-admin). Coverage:
  - `requireNotSuspended.middleware.test.js` — Bearer path sets req.callerUser, body-fallback path logs deprecation + still works, active user passes, suspended returns 403 with correct shape, feature_limited with blocked capability returns 403, feature_limited with unblocked capability returns 200.
  - `hideOnFind.test.js` — Car/Broker/LogisticsPartner pre-hooks: suspend owner → find* returns empty, unsuspend → find* returns the doc again with no mutation in between. revoke role → hidden. Bypass via setOptions({includeAllUsers:true}) → visible.
  - `confirmBooking.transaction.test.js` — Happy path (refund not called, orders created, car booked). Provider suspended mid-window → refund fired, no car mutation, no orders, 409 response. Buyer suspended mid-window → same. Refund API failure → error surfaced with refundFailed flag.
  - `ordersDeprecated.test.js` — POST /api/orders returns 410.
  - Concurrent-suspend test: spin two parallel requests (admin.suspend + confirm-booking on same provider); assert mutual exclusion per D-13.
- **D-17:** Integration tests hit the composed Express app (same pattern as Phase 2 `acceptance.test.js`). Stripe is mocked module-wide (`jest.mock('stripe')`) — fake PaymentIntents return `status: 'succeeded'` on retrieve, fake Refunds return a refundId.

### Claude's Discretion

Areas where the planner/executor may decide without asking:

- **ENF-04 per-route capability declaration shape** — `requireNotSuspended('create_listing')` middleware factory (recommended). Per-route explicit; no central registry drift. Values come from `STATUS_POLICY.feature_limited.capabilities.blocked` keys (01 D-26).
- **confirm-booking idempotency on buyer retry** — if `car.stripePaymentIntentId === paymentIntentId` already, fetch and return existing ServiceOrder rows instead of re-creating. Keeps buyer retries safe.
- **Exact ordering of reads inside the confirm-booking transaction** — providers-before-buyer or buyer-before-providers, either works as long as all checks happen before the state mutation.
- **Whether to extract models (Car, Broker, LogisticsPartner) to `src/models/` as a prerequisite step or inline the hooks on the existing `server.js` schemas** — extraction is cleaner (per D-08) and matches Phase 1 pattern; inline works if scope discipline is tighter.
- **Deprecation warning log format** from D-03 (plain console.warn is fine).
- **Retry-on-refund-failure policy** — either retry once then surface, or surface immediately with `refundFailed` flag for manual ops reconciliation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Order-pause decision ("in-flight orders pause, not auto-cancelled"), data-preservation constraint, auth enforcement constraint
- `.planning/REQUIREMENTS.md` §Backend Enforcement — Phase 3 REQ-IDs: ENF-01, ENF-02, ENF-03, ENF-04
- `.planning/ROADMAP.md` §"Phase 3: Backend Enforcement (Backend)" — Goal + 4 success criteria (the verifier's source of truth)
- `.planning/STATE.md` — Any blockers carried forward

### Research
- `.planning/research/SUMMARY.md` §"Phase 3" — Read-time vs write-time hide strategy, TOCTOU framing
- `.planning/research/PITFALLS.md` §2 (suspend-mid-checkout TOCTOU — direct Phase 3 pitfall), §6 (unsuspend-leaves-hidden — solved by read-time computation per D-05/D-06), §3 (orders-orphaned-on-delete — confirmed closed by `providerSnapshot`)
- `.planning/research/STACK.md` — Stripe SDK call patterns; no new deps in Phase 3

### Phase 1 artifacts (locked carry-forward)
- `.planning/phases/01-schema-security-baseline-backend/01-CONTEXT.md` §Decisions — D-05/D-06 (Bearer scope decision that Phase 3 now extends), D-10 (error shapes), D-11/D-12 (moderationStatus shape including `restrictedFeatures[]`), D-13 (indexes feeding `User.distinct`), D-21–D-24 (`ServiceOrder.providerSnapshot` — Phase 3 confirm-booking writes these), D-25–D-28 (`STATUS_POLICY` — feeds ENF-04 capability gating)
- `.planning/phases/01-schema-security-baseline-backend/01-05-SUMMARY.md` — `verifyIdToken` + `requireAdmin` middleware. Phase 3's `requireNotSuspended` composes with `verifyIdToken`.
- `.planning/phases/01-schema-security-baseline-backend/01-06-SUMMARY.md` — Migration script pattern (for potential Phase 3 backfill if any surface).

### Phase 2 artifacts (locked carry-forward)
- `.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md` §Decisions — D-02 (error shape), D-08/D-09/D-10 (revoke-role semantics — Phase 3 reads xStatus === 'APPROVED' as the join signal for directory visibility), D-17/D-18 (suspend handler — target of ENF-02 hide), D-23/D-24 (transaction pattern that Phase 3 reuses in confirm-booking)
- `.planning/phases/02-admin-moderation-endpoints-backend/02-06-SUMMARY.md` — Acceptance test infrastructure; Phase 3 adds `__tests__/enforcement/acceptance.test.js` in the same style

### Backend codebase (existing — required reading for planner/executor)
- `../backend-services/carEx-services/server.js` — Main app. Key ranges for Phase 3:
  - `383-400` — `GET /api/cars` (receives ENF-02 pre-hook automatically via Car model)
  - `403-418` — `GET /api/cars/:id` (same hook via findById)
  - `559-577` — `GET /api/brokers` (currently filters `{ status: 'active' }` — add pre-hook on Broker model too; existing filter stays)
  - `579-588` — `GET /api/brokers/:uid` (findOne — hook applies)
  - `590-611` — `PUT /api/brokers/:uid` (ENF-01 gated: requireNotSuspended('update_profile'))
  - `614-632` — `GET /api/logistics` (pre-hook on LogisticsPartner)
  - `634-643` — `GET /api/logistics/:uid`
  - `645-668` — `PUT /api/logistics/:uid` (ENF-01 gated)
  - `740-827` — `POST /api/cars` (ENF-01 gated: requireNotSuspended('create_listing'))
  - `1087-1111` — `POST /api/payments/create-payment-intent` (ENF-01 gated)
  - `1113-1143` — `POST /api/payments/confirm-booking` (ENF-01 gated AND rewritten per D-10 to absorb order creation + provider re-check inside transaction)
  - `1148-1244` — `POST /api/orders` (becomes 410 Gone per D-12; order-creation logic at `1156-1236` moves into confirm-booking handler)
  - `128-146` — User schema (defines `sellerStatus`, `brokerStatus`, `logisticsStatus` — the APPROVED/NONE/PENDING/REJECTED enum referenced in D-06)
  - `148-190` — Broker + LogisticsPartner inline schemas (extraction candidate per D-08)
  - `192-247` — ServiceOrder schema (`providerSnapshot` already extended in Phase 1)
- `../backend-services/carEx-services/src/security/verifyIdToken.js` — Phase 3 may need to fork or soften this to support the dual-accept fallback (D-03, D-04)
- `../backend-services/carEx-services/src/security/requireAdmin.js` — Pattern to mirror for requireNotSuspended
- `../backend-services/carEx-services/src/moderation/capabilities.js` — `STATUS_POLICY`, `resolveRestrictedFeatures(state)` — feeds feature_limited capability checks
- `../backend-services/carEx-services/src/models/User.js` — `moderationStatus.restrictedFeatures[]` array populated at suspend time; Phase 3 reads it
- `../backend-services/carEx-services/src/models/ModerationAction.js` — Phase 3 does not write audit rows (only moderation handlers do); may read for admin bypass joins

### External docs
- Mongoose pre-hooks + query middleware: https://mongoosejs.com/docs/middleware.html#post
- `this.setQuery()` and `this.getOptions()` in query middleware: https://mongoosejs.com/docs/api/query.html#Query.prototype.setQuery
- `User.distinct()`: https://mongoosejs.com/docs/api/model.html#Model.distinct
- Stripe Refunds API: https://docs.stripe.com/api/refunds/create
- Mongoose `session.withTransaction()` retry semantics: https://mongoosejs.com/docs/transactions.html

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`verifyIdToken` middleware from Phase 1** (`src/security/verifyIdToken.js`) — `requireNotSuspended` composes with it. Dual-accept (D-03) requires a softened variant that only sets `req.auth` when Bearer is present (doesn't 401 on missing header). Create `attachAuthIfPresent` as a sibling module rather than mutating the strict `verifyIdToken` which admin routes depend on.
- **`STATUS_POLICY` + `resolveRestrictedFeatures(state)`** (`src/moderation/capabilities.js`) — `feature_limited` severity reads `restrictedFeatures[]` on the User doc; the middleware factory `requireNotSuspended('create_listing')` checks `user.moderationStatus.restrictedFeatures.includes(requiredCapability)` before 403'ing. No duplicate capability resolution.
- **Mongoose `session.withTransaction()` pattern** from 02 D-23 — reused verbatim in the new confirm-booking handler.
- **Server-authoritative `providerSnapshot` resolution** (`server.js:1156-1188`) — lift this block out of POST /api/orders into a shared helper the new confirm-booking uses.
- **Stripe SDK instance** (`server.js` top-of-file) — already initialized; use `stripe.refunds.create` and `stripe.paymentIntents.retrieve` directly.

### Established Patterns (must honor)

- **Every model defined with `mongoose.model('Name', schema, 'collection_name')`** — Phase 3's extracted Car/Broker/LogisticsPartner models must keep the same registered names so existing route handlers continue to resolve the same model instance.
- **`{ error, message?, ...fields }` error shape for new auth-adjacent responses** (01 D-10, 02 D-02). Phase 3 additions: `account_suspended`, `provider_suspended`, `deprecated`, `user_not_found`.
- **Hybrid cutover discipline** (01 D-05/D-06) — Phase 3 extends Bearer only to the five gated routes, NOT to all user-write routes. Temptation to "fix them all at once" is explicitly out of scope.
- **Transaction pattern:** all multi-document state changes use `session.withTransaction()` + `{ session }` on every read/write inside.

### Integration Points

- **`app.use('/api/cars', ...)`, `app.use('/api/brokers', ...)`, `app.use('/api/logistics', ...)`** — routes currently mount directly at root. Phase 3 does NOT restructure mounting; `requireNotSuspended` is applied per-route inline (`app.post('/api/cars', attachAuthIfPresent, requireNotSuspended('create_listing'), upload.array(...), handler)`).
- **Model extraction point** — `src/models/Car.js`, `src/models/Broker.js`, `src/models/LogisticsPartner.js` are new in Phase 3 (following 01 D-02 pattern for User/AdminUser/ModerationAction). Each file defines schema + attaches pre-hook + exports model.
- **Jest `__tests__/enforcement/` directory** — sibling to `__tests__/moderation/`; same configuration, same mongodb-memory-server replica-set harness.

### Anti-Pattern Warnings

- **Do NOT mutate `Car.listingStatus`, `Broker.status`, or `LogisticsPartner.status` on suspend/unsuspend/revoke.** Visibility is ALWAYS computed at read time (roadmap "without any denormalized flag mutation"). The pre(/^find/) hook is the only mechanism. Any `save()` that touches these fields based on moderation state is a pitfall.
- **Do NOT add `includeAllUsers: true` as a default in the hook** — default must be hide-safely. Callers explicitly opt out.
- **Do NOT throw before calling `stripe.refunds.create` in the confirm-booking transaction.** Ordering is refund-first, then throw-to-abort. Reversing the order risks charging a buyer with no order and no refund.
- **Do NOT re-create POST /api/orders' order-creation code path in confirm-booking.** Extract into a shared `buildProviderGroups(items)` + `createOrderRows(session, groups)` helper so there's only one code path.
- **Do NOT skip the `includeAllUsers: true` flag in admin handlers, the suspend/revoke service, or the payment re-check's own User/Provider lookups.** The hook hides by default, so admin and internal code paths that need to see suspended/revoked users MUST opt out explicitly.
- **Do NOT gate `GET` reads with `requireNotSuspended`.** Suspended users still need to authenticate, read their own profile, see their order history, and read the banner copy. Phase 3 only gates writes.
- **Do NOT migrate `verifyIdToken` to all user routes in Phase 3.** Hybrid cutover (01 D-05/D-06) — only the five ROADMAP-named routes get Bearer during this phase.

</code_context>

<specifics>
## Specific Ideas

- The four ROADMAP Phase 3 success criteria are verbatim acceptance criteria for the verifier. Each plan must name which criterion it proves:
  - Criterion #1 (403 on user-write for suspended) → `requireNotSuspended` plan + acceptance test covering all 5 gated routes with a `blocked_with_review` user.
  - Criterion #2 (`GET /api/cars` hides/restores on suspend/unsuspend with no data mutation) → `pre(/^find/)` hook plan + round-trip test: suspend → GET returns empty → verify `car.active`/`listingStatus` unchanged in DB → unsuspend → GET returns car.
  - Criterion #3 (concurrent admin.suspend vs confirm-booking) → merged confirm-booking transaction plan + concurrency test using two parallel requests.
  - Criterion #4 (feature_limited capability map works selectively) → middleware factory plan + capability-gating test across POST /api/cars (blocked) and a GET read (allowed).

- The two-step refund-then-throw pattern inside the confirm-booking transaction is the most error-prone implementation detail. Add a comment on the handler:
  ```js
  // Stripe refunds are NOT in the Mongo transaction. Refund first, throw second.
  // Reversed order risks "buyer charged, no order, no refund" on Stripe API failure.
  ```

- Dual-accept mode (D-03) is temporary. The `attachAuthIfPresent` middleware and the body-uid fallback inside `requireNotSuspended` exist only until Phase 6 QUAL-03 strict cutover. Add a TODO comment citing the removal trigger.

- `includeAllUsers: true` is grep-bait for Phase 6's security review. Every use site should be traceable to a legitimate admin path, the suspend/revoke service itself, the confirm-booking re-check, or a migration/seed script.

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to later phases or milestones — do not quietly re-introduce:**

- **`contact-seller` endpoint** (ROADMAP Phase 3 criterion #1 names it, but no such route exists in `server.js` today). Deferred to backlog — when a contact-seller endpoint is added in a future milestone, it must mount `requireNotSuspended('contact_seller')`. Capability map (`src/moderation/capabilities.js`) already lists `contact_seller` in `feature_limited.capabilities.blocked` (01 D-26), so the gate wiring is ready.

- **Order-pause banner / pause semantics for in-flight orders touching a suspended provider** (PROJECT.md mentions "orders pause rather than auto-cancelled" but no ENF-* requirement covers it). Most likely Phase 5 (admin UI surface) or Phase 6 (affected-user UX) concern. Phase 3 intentionally does not mutate existing orders on suspend/revoke; buyer-facing "this provider is paused" computation happens at order-read time elsewhere.

- **Migration of non-gated user-write routes to Bearer** (PUT /api/users/:uid, POST /api/users/:uid/avatar, DELETE /api/users/:uid, PATCH /api/orders/:id/status, PATCH /api/orders/:id/services/:serviceIndex/status, PUT /api/cars/:id, PATCH /api/cars/:id/status, POST /api/users/:uid/request-{seller,broker,logistics}). Same follow-up milestone that 01-CONTEXT D-06 flagged for legacy admin routes. Until then, those routes are spoofable on caller identity — known risk.

- **Removal of the dual-accept body-uid fallback** (D-03). Phase 6 QUAL-03 security review is the removal trigger. Tracked.

- **Removal of `POST /api/orders` entirely** (D-12 ships 410 Gone). Removal cleanup lives in a follow-up ticket after Phase 4 mobile stops calling it and a grace period passes for old builds to be retired.

- **`rate-limit-redis` swap for multi-instance Railway** (carried from 02 D-33). Still deferred.

- **Denylist-cache strategy for the pre(/^find/) hook** (in-memory suspended-uids Set with invalidation). Phase 3 uses the simpler per-query `User.distinct` approach (D-05). If scale or latency profiles demand a cache later, the hook has a single choke point to refactor.

- **Hash-chain tamper-evidence on `ModerationAction`** (01 D-18). Still deferred.

- **Super-admin-only audit-note visibility** (01 D-20, 02 deferred). Phase 5 UI concern.

- **Bulk / IP / device-fingerprint / cross-admin features** (MOD2-* from REQUIREMENTS.md v2). All v2 milestone.

</deferred>

---

*Phase: 03-backend-enforcement-backend*
*Context gathered: 2026-04-17*

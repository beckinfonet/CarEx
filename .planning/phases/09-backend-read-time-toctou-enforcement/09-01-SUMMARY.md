---
phase: 09-backend-read-time-toctou-enforcement
plan: 01
subsystem: payments
tags: [stripe, mongoose, refund, idempotency, toctou, listing-status, admin-auth, jest]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-baseline-tests
    provides: pre(/^find/) hide-hook pattern with bypass flag (Car.js seller-cascade); confirmBooking.js 6-step transaction; inline refundThenThrow (the function this plan promotes to a shared helper); MongoMemoryReplSet test harness
  - phase: 07-listing-moderation-schema-data-foundation
    provides: Car.status enum + { status: 1 } index; LISTING_STATUS_POLICY[status].banner block; ListingModerationAction append-only schema
  - phase: 08-admin-listing-moderation-endpoints-backend
    provides: 5 admin listing-moderation endpoints (suspend/archive/delete/restore/edit) that write Car.status; setOptions({ includeAllListingStatuses, includeAllUsers }) bypass-chain established at the service-layer
provides:
  - shared src/payments/refundAndThrow.js helper with refundAndThrow + ListingNotAvailableError + ProviderSuspendedError (Option A circular-require resolution)
  - src/security/lookupAdminIfPresent.js read-only admin-attach middleware (D-08 / RESEARCH §Pattern 5 Option A)
  - 5 Wave 0 RED jest scaffolds under __tests__/listing-enforcement/ locking the contracts Plans 09-02..05 must satisfy
  - refundAndThrow.helper.test.js GREEN with 5 base unit cases proving D-11/D-14 invariants
  - confirmBooking.js 3 v1.0 refund call sites routed through the new helper (idempotencyKey-protected; Phase 3 regression suite 7/7 GREEN)
  - ProviderSuspendedError class moved into refundAndThrow.js + re-exported from confirmBooking.js for back-compat
affects:
  - phase 09-plan-02 (hideOnFind.listingStatus scaffold becomes its target)
  - phase 09-plan-03 (listingDetailStatusAware scaffold + lookupAdminIfPresent mount point)
  - phase 09-plan-04 (createPaymentIntent.gate scaffold + LISTING_STATUS_POLICY consumption)
  - phase 09-plan-05 (confirmBooking.listingTOCTOU scaffold + 4th refundAndThrow call site)
  - server.js error-mapping (Plan 09-04 adds ListingNotAvailableError → 409 branch BEFORE the existing ProviderSuspendedError branch at server.js:1061)

# Tech tracking
tech-stack:
  added: []  # no new deps — stripe ^20.4.1 + mongoose ^9.1.5 already installed
  patterns:
    - "refund-first-throw-second helper as a shared module (Option A circular-require: error class moved + re-exported)"
    - "idempotencyKey: `refund-${paymentIntentId}` on every Stripe refund call site (closes the withTransaction-retry double-refund window)"
    - "read-only admin-attach middleware sibling to requireAdmin (lookupAdminIfPresent never 401/403; sets req.admin on hit, next() on miss/error)"
    - "Wave 0 RED scaffolds with test.todo + require() of not-yet-existing modules (compile-time wiring check for later waves)"
    - "Shared Pattern S-9 reused: Car.collection.insertOne in Wave 0 hideOnFind seed helper to bypass save validators AND pre(/^find/) hooks"

key-files:
  created:
    - ../backend-services/carEx-services/src/payments/refundAndThrow.js
    - ../backend-services/carEx-services/src/security/lookupAdminIfPresent.js
    - ../backend-services/carEx-services/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js
    - ../backend-services/carEx-services/__tests__/listing-enforcement/listingDetailStatusAware.test.js
    - ../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js
    - ../backend-services/carEx-services/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js
    - ../backend-services/carEx-services/__tests__/listing-enforcement/refundAndThrow.helper.test.js
  modified:
    - ../backend-services/carEx-services/src/payments/confirmBooking.js  # ProviderSuspendedError class removed + re-exported from refundAndThrow.js; 3 refundThenThrow inline def removed; 3 v1.0 call sites rewired through refundAndThrow

key-decisions:
  - "Option A circular-require resolution: ProviderSuspendedError class moved from confirmBooking.js:31-36 INTO refundAndThrow.js, then re-exported from confirmBooking.js's module.exports for back-compat (server.js:1061 instanceof + existing test require unchanged)"
  - "idempotencyKey: `refund-${paymentIntentId}` adopted on the new helper for ALL 4 call sites — A3 'while we were here' hardening protects the 3 v1.0 sites too once they route through the helper"
  - "D-15 Regression Coverage Map proves no backfill unit cases needed — all 3 v1.0 discriminator paths (buyer-suspended, provider-suspended, seller-not-active) covered by the existing 7-case __tests__/enforcement/confirmBooking.transaction.test.js suite"
  - "refundAndThrow.helper.test.js scaffold ships with REAL assertions (5 base unit cases) — the OTHER 4 Wave 0 scaffolds use test.todo because they cover Plan 09-02..05 contracts not yet implemented"
  - "End-of-Plan-09-01 invariant (B-3): exactly 3 `await refundAndThrow(` invocations in confirmBooking.js — the 3 v1.0 provider_suspended sites. The 4th call site (LENF-03 listing-not-active assertion) is added by Plan 09-05; count becomes 4 at end of Plan 09-05"
  - "lookupAdminIfPresent is NOT mounted anywhere in this plan — Plan 09-03 mounts it on GET /api/cars/:id. File-only creation now keeps the Phase 9 read-only admin detection mechanism ready for the LENF-02 supertest cases without touching server.js routing"

patterns-established:
  - "Pattern: Wave 0 RED scaffolds — test.todo + require() of not-yet-existing module under test gives Wave 1+ a compile-time wiring check (any later plan that renames the module breaks immediately, not at the next jest run)"
  - "Pattern: shared error class lives with its shared helper, not with the original consumer — moving ProviderSuspendedError into refundAndThrow.js and re-exporting from confirmBooking.js is the cleanest avoidance of `require('./confirmBooking')` ↔ `require('./refundAndThrow')` cycle (Option A)"
  - "Pattern: idempotency on every Stripe write — adopted as default for any new Stripe API call inside or near a Mongoose transaction (Pitfall 3 closure)"
  - "Pattern: read-only admin detection — sibling to requireAdmin that NEVER 401/403, used by single-endpoint handlers that branch response shape on caller identity (D-08); requireAdmin stays strict-403 for admin-only routes"

requirements-completed: []
# LENF-03 NOT marked complete here — this plan only stages the helper + middleware
# + RED scaffolds. The behavior (LENF-03 cart-add 409 + confirm-booking TOCTOU
# re-verify) lands in Plans 09-04 + 09-05 against the scaffolds this plan
# created. Premature requirement tickoff would falsely report shipped features.
# Mirrors Phase 06 P01 + Phase 08 P01 substrate handling.

# Metrics
duration: ~12 min
completed: 2026-05-29
---

# Phase 9 Plan 01: Wave 0 Substrate Summary

**Extracted refundAndThrow helper + ListingNotAvailableError with idempotencyKey-protected Stripe refunds, added read-only lookupAdminIfPresent middleware, and landed 5 Wave 0 RED jest scaffolds locking the contracts Plans 09-02..05 must satisfy — all without touching Car.js, server.js, or confirmBooking.js step 4 listing assertion.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (executed sequentially per the plan TDD ordering)
- **Files created:** 7 (5 scaffolds + 2 source modules)
- **Files modified:** 1 (confirmBooking.js — helper extraction + 3 call-site rewires)
- **Commits:** 3 atomic backend commits on `carEx-services/main`

## Accomplishments

- 5 Wave 0 RED scaffolds created under `__tests__/listing-enforcement/` — Plans 09-02..05 each own one scaffold; flipping their `test.todo` entries to real assertions IS their primary deliverable
- `src/payments/refundAndThrow.js` lifted out of confirmBooking.js — shared helper with `refundAndThrow`, `ListingNotAvailableError`, and `ProviderSuspendedError` exports
- Stripe idempotencyKey adopted on the refund call site — closes the v1.0 latent double-refund window on `withTransaction` auto-retry (Pitfall 3 / Open Question A3 close)
- `src/security/lookupAdminIfPresent.js` created — sibling to requireAdmin that NEVER 401/403, ready for Plan 09-03 to mount on `GET /api/cars/:id`
- Phase 3 regression suite 7/7 GREEN after the helper extraction + 3 v1.0 call-site rewires (D-15 preserved)
- `refundAndThrow.helper.test.js` 5/5 GREEN at end of plan — locks D-11/D-14 contract as a fast-signal regression gate

## Task Commits

Each task was committed atomically on the BACKEND repo (`carEx-services/main`):

1. **Task 1: Wave 0 RED scaffolds** — `fe57975` (test)
   - 5 jest scaffold files; 4 LENF-* use `test.todo`, 1 helper file has REAL assertions
2. **Task 2: refundAndThrow extraction + 3 v1.0 call-site rewire** — `65a139a` (feat)
   - Helper module created; confirmBooking.js inline function removed; ProviderSuspendedError moved + re-exported; Phase 3 regression 7/7 GREEN
3. **Task 3: lookupAdminIfPresent middleware (+ helper test GREEN)** — `c46cfb9` (feat)
   - Middleware file created; refundAndThrow.helper.test.js verified GREEN (5/5)

**Plan metadata commit (carEx repo):** committed alongside this SUMMARY.md by the execute-plan workflow.

## Files Created/Modified

### Created (backend repo)

- `../backend-services/carEx-services/src/payments/refundAndThrow.js` — shared refund-first-throw-second helper. Exports `refundAndThrow`, `ListingNotAvailableError`, `ProviderSuspendedError`. Stripe `idempotencyKey: \`refund-${paymentIntentId}\`` passed as the second arg to `stripe.refunds.create`. Discriminator: `errorBody.error === 'listing_not_available'` → ListingNotAvailableError; else → ProviderSuspendedError (v1.0 contract preserved).
- `../backend-services/carEx-services/src/security/lookupAdminIfPresent.js` — read-only admin-attach middleware. RESEARCH §Pattern 5 Option A verbatim. NEVER returns 401/403. Sets `req.admin = { uid, role, email }` on AdminUser lookup hit; fails-safe to non-admin on miss or DB error.
- `../backend-services/carEx-services/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` — 4 `test.todo` entries for LENF-01 (Plan 09-02 target). Uses `Car.collection.insertOne` direct-seed (Shared Pattern S-9) to bypass pre(/^find/) hooks during seeding. MongoMemoryReplSet harness via `__tests__/_helpers/mongoReplSet`.
- `../backend-services/carEx-services/__tests__/listing-enforcement/listingDetailStatusAware.test.js` — 6 `test.todo` entries for LENF-02 (Plan 09-03 target). firebase-admin mock factory copied from PATTERNS §10 analog; supertest harness ready.
- `../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js` — 4 `test.todo` entries for LENF-03 cart-add half (Plan 09-04 target). Stripe mock factory exposes `__paymentIntentsCreateMock` so Plan 09-04 can assert non-invocation on the non-active branch.
- `../backend-services/carEx-services/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` — 6 `test.todo` entries for LENF-03 confirm-booking half (Plan 09-05 target). ServiceOrder loose-schema pre-registration mirrors PATTERNS §12 pattern so the lazy `mongoose.model('ServiceOrder')` inside `confirmBooking` resolves cleanly.
- `../backend-services/carEx-services/__tests__/listing-enforcement/refundAndThrow.helper.test.js` — 5 REAL unit-test cases (NO `test.todo`). GREEN at end of plan. Locks the D-14 helper contract as a fast-signal regression gate.

### Modified (backend repo)

- `../backend-services/carEx-services/src/payments/confirmBooking.js`
  - Removed inline `class ProviderSuspendedError` (was lines 31-36; moved into refundAndThrow.js to avoid circular require)
  - Removed inline `async function refundThenThrow` (was lines 38-56; lifted into refundAndThrow.js with the idempotencyKey hardening)
  - Added `const { refundAndThrow, ProviderSuspendedError } = require('./refundAndThrow');` import
  - Rewired 3 v1.0 call sites:
    - step a (buyer re-check, line ~152) — `refundThenThrow(stripe, paymentIntentId, 'provider_suspended', buyerUid)` → `refundAndThrow(stripe, paymentIntentId, { error: 'provider_suspended', providerUid: buyerUid })`
    - step b (provider re-check, line ~167) — same shape with `group.providerUid`
    - step c (seller re-check, line ~206) — same shape with `car.sellerId`
  - `module.exports = { confirmBooking, ProviderSuspendedError }` preserved (re-export keeps back-compat)

## Decisions Made

See `key-decisions` in frontmatter above. Highlights:

- **Option A circular-require resolution.** Moving `ProviderSuspendedError` into `refundAndThrow.js` was the cleanest path. Option B (new shared `errors.js` file) was rejected because it adds a third file for marginal benefit and obscures the helper's symmetric error vocabulary.
- **A3 close — idempotencyKey on ALL 4 call sites.** RESEARCH Open Question 2 asked whether to retrofit the 3 v1.0 sites. By routing them through the new helper they become idempotency-protected automatically; no separate retrofit needed.
- **No backfill unit cases needed.** The D-15 coverage map proves all 3 v1.0 discriminator paths exercised by the existing 7-case suite. Helper unit case 4 (provider_suspended) is included anyway as belt-and-braces fast-signal coverage.
- **lookupAdminIfPresent file-only creation.** Mounting it is Plan 09-03's job; staging it now keeps Phase 9 forward dependencies clean.

## D-15 Regression Coverage Map (v1.0 refund call sites)

Per Task 2 PRE-ACTION ANALYSIS (B-4): enumerated the 3 v1.0 `refundThenThrow` call sites in `confirmBooking.js` against the existing 7-case suite at `__tests__/enforcement/confirmBooking.transaction.test.js`:

| Discriminator path | v1.0 callsite | Existing case(s) that exercise it |
|--------------------|---------------|------------------------------------|
| buyer-suspended    | step a — buyer re-check (line 152) | **case 3** (line 242) — "buyer suspended mid-window -> refund fired, err.providerUid === buyerUid, zero orders" |
| provider-suspended | step b — provider re-check (line 167) | **case 2** (line 194), **case 5** (line 307 — refund-fail variant), **case 6** (line 350 — concurrent admin.suspend race) |
| seller-not-active  | step c — seller re-check (line 206) | **case 4** (line 275) — "seller suspended mid-window -> refund fired, err.providerUid === sellerUid, zero orders" |

**Decision:** All 3 v1.0 refund call sites covered by the existing 7-case suite — no new helper unit cases required.

The `refundAndThrow.helper.test.js` Case 4 (provider_suspended) was included anyway as belt-and-braces fast-signal coverage (unit-level regression alarm faster than the full transactional suite). The 3 v1.0 sites are now ALSO idempotency-key-protected by virtue of routing through the new helper.

**Regression verification (Phase 3 suite, all 7 GREEN):**

```
$ npx jest __tests__/enforcement/confirmBooking.transaction.test.js
PASS __tests__/enforcement/confirmBooking.transaction.test.js
  ✓ case 1: happy path — car booked, orders created, refund NOT called (594 ms)
  ✓ case 2: provider suspended mid-window (87 ms)
  ✓ case 3: buyer suspended mid-window (72 ms)
  ✓ case 4: seller suspended mid-window (72 ms)
  ✓ case 5: refund API failure (75 ms)
  ✓ case 6: concurrent admin.suspend + confirmBooking race (124 ms)
  ✓ case 7: idempotency fast-path (111 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

## B-3 — End-of-Plan-01 refundAndThrow call-count invariant

`grep -cE "await refundAndThrow\(|^[[:space:]]*refundAndThrow\(" ../backend-services/carEx-services/src/payments/confirmBooking.js` returns **3** (the 3 v1.0 provider_suspended sites rewired through the helper). The 4th call site (LENF-03 listing-not-active assertion) is added by Plan 09-05; count becomes 4 at end of Plan 09-05.

## Wave 0 Scaffold Status

| Scaffold | `test.todo` count | State at end of Plan 09-01 | Owned by |
|----------|-------------------|----------------------------|----------|
| `hideOnFind.listingStatus.test.js`     | 4 | RED (intentional — Plan 09-02 lands assertions) | Plan 09-02 |
| `listingDetailStatusAware.test.js`     | 6 | RED (intentional — Plan 09-03 lands assertions) | Plan 09-03 |
| `createPaymentIntent.gate.test.js`     | 4 | RED (intentional — Plan 09-04 lands assertions) | Plan 09-04 |
| `confirmBooking.listingTOCTOU.test.js` | 6 | RED (intentional — Plan 09-05 lands assertions) | Plan 09-05 |
| `refundAndThrow.helper.test.js`        | 0 | **GREEN** — 5/5 unit cases pass at end of plan | (Plan 09-01 itself) |

The `npx jest --listTests __tests__/listing-enforcement/` count returns 5 (Task 1 acceptance criterion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docstring mentioned literal idempotencyKey template, tripping `grep -c "idempotencyKey:" refundAndThrow.js` acceptance criterion (expected: 1; observed: 2)**

- **Found during:** Task 2 (refundAndThrow.js creation)
- **Issue:** The original module-header comment block included the literal token `` idempotencyKey: `refund-${paymentIntentId}` `` for explanatory clarity. The plan's acceptance grep (which does not distinguish source comments from runtime code) returned 2 instead of the required 1.
- **Fix:** Rephrased the comment block to reference "a per-PaymentIntent idempotent key (see the second arg to stripe.refunds.create below)" — preserves explanatory intent without duplicating the literal token. Substantive invariant (helper passes the key exactly once at the Stripe call site) unchanged.
- **Files modified:** `../backend-services/carEx-services/src/payments/refundAndThrow.js`
- **Verification:** `grep -c "idempotencyKey:" src/payments/refundAndThrow.js` returns 1; `grep -cF 'idempotencyKey: \`refund-${paymentIntentId}\`' src/payments/refundAndThrow.js` returns 1.
- **Committed in:** `65a139a` (Task 2 commit)

This is the same Rule 1 trade-off Plan 08-04 and Plan 08-05 made for their respective grep-locked docstring tokens (LADM-04 soft-delete API tokens; "already_in_state" in restoreListing). Pattern: when a plan's acceptance grep is a literal substring match without source/comment distinction, comments mentioning the literal token must be rephrased to keep the gate machine-checkable.

---

**Total deviations:** 1 auto-fixed (Rule 1 — docstring grep collision)
**Impact on plan:** Zero functional source deviations. All 3 task acceptance criteria and the 8-item `<verification>` block satisfied as written.

## Issues Encountered

None. The plan's TDD ordering (RED scaffolds → GREEN helper → middleware) matched the canonical Phase 8 pattern; the Phase 3 regression suite GREEN on first run after the call-site rewire confirmed the discriminator branch on `errorBody.error !== 'listing_not_available'` preserves the v1.0 ProviderSuspendedError throw shape verbatim.

## User Setup Required

None — no external service configuration required. This plan ships backend code only (helper, middleware, tests). No env vars, no Stripe dashboard changes, no MongoDB cluster changes.

## Open Threads for Plans 09-02..05

Each downstream plan owns turning one of the 4 RED scaffolds GREEN:

| Plan | Scaffold | Implementation target |
|------|----------|------------------------|
| 09-02 | `hideOnFind.listingStatus.test.js`     | `Car.js` listing-status hide hook with `includeAllListingStatuses` bypass per D-01/D-04 |
| 09-03 | `listingDetailStatusAware.test.js`     | `server.js` GET /api/cars/:id status-aware handler + mount `lookupAdminIfPresent` per D-08 |
| 09-04 | `createPaymentIntent.gate.test.js`     | `server.js` POST /api/payments/create-payment-intent early 409 gate per D-09 + ListingNotAvailableError → 409 mapping at server.js:1061 |
| 09-05 | `confirmBooking.listingTOCTOU.test.js` | `confirmBooking.js` step 4 — 3rd in-txn `car.status === 'active'` assertion using `refundAndThrow(... { error: 'listing_not_available', ... })`; brings call-count from 3 to 4 (B-3 closes) |

## Self-Check

Per the execute-plan self_check protocol, verifying all claimed artifacts exist and commits are on the backend repo:

**Backend files (created):**

```
$ test -f ../backend-services/carEx-services/src/payments/refundAndThrow.js && echo FOUND
FOUND
$ test -f ../backend-services/carEx-services/src/security/lookupAdminIfPresent.js && echo FOUND
FOUND
$ ls ../backend-services/carEx-services/__tests__/listing-enforcement/*.test.js | wc -l
       5
```

**Backend commits (on `carEx-services/main`):**

```
$ git -C ../backend-services/carEx-services log --oneline -3
c46cfb9 feat(09-01): add lookupAdminIfPresent read-only middleware (D-08)
65a139a feat(09-01): extract refundAndThrow helper + ListingNotAvailableError (D-14)
fe57975 test(09-01): add 5 Wave 0 RED scaffolds under __tests__/listing-enforcement/
```

**Test execution (backend):**

```
$ npx jest __tests__/listing-enforcement/refundAndThrow.helper.test.js
  ✓ 5 passed, 0 failed, 0 todo
$ npx jest __tests__/enforcement/confirmBooking.transaction.test.js
  ✓ 7 passed, 0 failed, 0 todo  (D-15 Phase 3 regression preserved)
```

## Self-Check: PASSED

All claimed artifacts exist on disk; all claimed commits exist on the backend repo `main` branch; both jest verification suites are GREEN.

---
*Phase: 09-backend-read-time-toctou-enforcement*
*Plan: 01*
*Completed: 2026-05-29*

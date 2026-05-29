---
phase: 09
slug: backend-read-time-toctou-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `09-RESEARCH.md § Validation Architecture` (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.7.0 [VERIFIED: backend-services/carEx-services/package.json] |
| **Config file** | `package.json` jest block (testEnvironment: node, testMatch: `**/__tests__/**/*.test.js`, testTimeout: 30000) |
| **Quick run command** | `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ -x` |
| **Full suite command** | `cd ../backend-services/carEx-services && npm test` |
| **Estimated runtime** | ~3–5s quick · ~10–15s wave · full suite varies |

---

## Sampling Rate

- **After every task commit:** `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ -x`
- **After every plan wave:** `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ __tests__/enforcement/ __tests__/listing-moderation/`
- **Before `/gsd-verify-work`:** Full suite (`npm test`) must be green
- **Max feedback latency:** ~5s (quick) / ~15s (wave)

---

## Per-Task Verification Map

> Task IDs are tentative — the planner re-numbers them. The Wave / Plan column is filled in after `gsd-planner` writes PLAN.md files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-W0-01 | TBD | 0 | LENF-01/02/03 | — | Wave 0 test stubs land (RED) | scaffold | `npx jest __tests__/listing-enforcement/ --listTests` | ❌ W0 | ⬜ pending |
| 09-LENF01-a | TBD | ≥1 | LENF-01 | T-Stale-Read | Hide hook filters non-active listings from `Car.find` by default | integration | `npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js -x` | ❌ W0 | ⬜ pending |
| 09-LENF01-b | TBD | ≥1 | LENF-01 | E-Bypass-Default | `setOptions({ includeAllListingStatuses: true })` returns all four statuses | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF01-c | TBD | ≥1 | LENF-01 | E-Bypass-AndShape | Admin querying `Car.find({ status: 'deleted' }).setOptions(includeAllListingStatuses: true)` returns deleted listings (combined `$and` shape works) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF01-d | TBD | ≥1 | LENF-01 | T-Public-Leak | `GET /api/cars` returns zero non-active listings | integration (HTTP) | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF02-a | TBD | ≥1 | LENF-02 | I-PII-Leak | Non-admin GET `/api/cars/:id` on suspended listing returns 200 + thin payload (EXACTLY the D-05 allowlist) | integration | `npx jest __tests__/listing-enforcement/listingDetailStatusAware.test.js -x` | ❌ W0 | ⬜ pending |
| 09-LENF02-b | TBD | ≥1 | LENF-02 | I-PII-Leak | No `sellerEmail`, no `moderationNote`, no `description` on non-admin thin payload (`not.toHaveProperty` for each) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF02-c | TBD | ≥1 | LENF-02 | I-Admin-Badge | Admin GET on suspended listing returns full document + `moderationBadge` with all 5 D-07 fields | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF02-d | TBD | ≥1 | LENF-02 | I-Badge-NotActive | Admin GET on active listing returns full document WITHOUT `moderationBadge` key (D-07 hide-when-active) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF02-e | TBD | ≥1 | LENF-02 | I-Internals-Leak | GET on non-existent carId returns 404 (not 200 + thin payload) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF02-f | TBD | ≥1 | LENF-02 | I-Internals-Leak | GET on malformed carId returns 404 (not 500 CastError) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-A-a | TBD | ≥2 | LENF-03 (cart-add) | T-TOCTOU-CartAdd | POST `/api/payments/create-payment-intent` with carId of `suspended` returns 409 + D-11 body (`listingStatus`, `reasonCategory`, `banner`) | integration (HTTP + Stripe mock) | `npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js -x` | ❌ W0 | ⬜ pending |
| 09-LENF03-A-b | TBD | ≥2 | LENF-03 (cart-add) | T-TOCTOU-CartAdd | `stripe.paymentIntents.create` is NOT called when carId is suspended | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-A-c | TBD | ≥2 | LENF-03 (cart-add) | — | Active listing proceeds normally + returns `clientSecret` | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-A-d | TBD | ≥2 | LENF-03 (cart-add) | T-TOCTOU-CartAdd | All three non-active statuses (suspended/archived/deleted) return 409 with correct banner block | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-B-a | TBD | ≥2 | LENF-03 (confirm) | T+I-RefundOrder | Listing flipped to `suspended` between create-payment-intent and confirm-booking: confirm-booking returns 409 + D-11 body with `refundId` set, no orders created, car NOT flipped to `booked` | integration (txn) | `npx jest __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js -x` | ❌ W0 | ⬜ pending |
| 09-LENF03-B-b | TBD | ≥2 | LENF-03 (confirm) | T+I-RefundOrder | Stripe refund called BEFORE the throw (assert via `jest fn.mock.invocationCallOrder`) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-B-c | TBD | ≥2 | LENF-03 (confirm) | T+I-RefundOrder | Refund failure: `stripe.refunds.create` throws → response body has `refundFailed: true`, `refundId: null` | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-B-d | TBD | ≥2 | LENF-03 (confirm) | R-DoubleRefund | `withTransaction` retry does NOT issue a second refund (assert `idempotencyKey` argument was passed) | integration | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-race | TBD | ≥2 | LENF-03 (confirm) | T-Race | Concurrent admin.suspendListing + buyer confirm-booking — exactly one outcome (refund-abort OR booking-then-suspend), never both succeed | integration (txn race) | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-route | TBD | ≥2 | LENF-03 (confirm) | V7-ErrorHandling | `server.js` confirm-booking handler maps `ListingNotAvailableError` → `409 listing_not_available` with D-11 body | integration (HTTP) | (same file) | ❌ W0 | ⬜ pending |
| 09-LENF03-helper | TBD | ≥1 | LENF-03 (D-14) | R-DoubleRefund | `refundAndThrow` calls `stripe.refunds.create` then throws; thrown error preserves `errorBody.error`, attaches `refundId` + `refundFailed` | unit | `npx jest __tests__/listing-enforcement/refundAndThrow.helper.test.js -x` | ❌ W0 | ⬜ pending |
| 09-LENF03-regression | TBD | ≥2 | LENF-03 (regression) | — | All existing v1.0 `confirmBooking.transaction.test.js` cases (1-7) still pass after helper extraction | integration | `npx jest __tests__/enforcement/confirmBooking.transaction.test.js` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` — stubs for LENF-01 (4 cases)
- [ ] `__tests__/listing-enforcement/listingDetailStatusAware.test.js` — stubs for LENF-02 (6 cases)
- [ ] `__tests__/listing-enforcement/createPaymentIntent.gate.test.js` — stubs for LENF-03 cart-add half (4 cases)
- [ ] `__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` — stubs for LENF-03 confirm-booking half (4 cases + race + route mapping)
- [ ] `__tests__/listing-enforcement/refundAndThrow.helper.test.js` — unit-test stubs for the extracted helper (D-14)
- [x] Framework install: NONE — `jest`, `mongodb-memory-server`, `supertest` all installed [VERIFIED: package.json]
- [x] Test fixture: REUSE `__tests__/_helpers/mongoReplSet.js` [VERIFIED: exists]

The planner MAY relocate these into `__tests__/enforcement/` alongside the existing `confirmBooking.transaction.test.js` (Claude's Discretion per CONTEXT). The directory name is non-load-bearing; contents are.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile axios `_skipModerationInterceptor` flag correctly bypasses the global 403/account_suspended interceptor when a 409 surfaces from cart-add or confirm-booking | LENF-03 (mobile UX) | Mobile-side interceptor behavior is unit-testable on RN but requires the carEx app (not carEx-services); cross-repo manual smoke is cheapest sign-off for v1.0 | 1. Build carEx mobile dev. 2. Log in as buyer. 3. Have a 2nd session as admin suspend a listing already in your cart. 4. Tap "Pay". 5. Confirm a Russian "Listing no longer available" toast appears (not a 403 logout). |
| Stripe-dashboard reconciliation: refunds issued by Phase 9's refund-first-throw-second logic appear with the new `idempotencyKey` shape and do NOT duplicate on retry | LENF-03 (ops) | Stripe sandbox dashboard is the source of truth; jest mock proves invocation but not Stripe-side dedup | After Wave 2 sign-off: trigger one TOCTOU-race confirm-booking against Stripe sandbox; in dashboard verify a single refund row tagged with the `idempotencyKey`. |

---

## Validation Sign-Off

- [ ] All Phase 9 tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files)
- [ ] No `--watch` mode flags in any sampling command
- [ ] Feedback latency < 15s (quick + wave commands measured)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands GREEN

**Approval:** pending

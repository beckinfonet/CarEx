# Phase 9 — Deferred Items (Out of Scope)

Logged per execute-plan execution discipline (Rule SCOPE BOUNDARY).
These are pre-existing test failures NOT caused by Phase 9 plans, surfaced during
the Plan 09-05 phase-gate `npm test` run on 2026-05-29.

## Pre-existing test-suite failures observed during Plan 09-05 phase gate

**File:** `../backend-services/carEx-services/__tests__/moderation/ServiceOrder.providerSnapshot.test.js`

**Status at Plan 09-05 completion:** 2 failed / 3 passed (5 total in file). Full
backend `npm test`: 1 suite failed / 39 passed / 40 total; 2 tests failed / 298
passed / 300 total.

**Out-of-scope confirmation:** Reverted my Plan 09-05 changes locally
(`git checkout 009b250 -- src/payments/confirmBooking.js
__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js`) and re-ran
the failing test file — the same 2 failures reproduce at the same line
(`__tests__/moderation/ServiceOrder.providerSnapshot.test.js:154` —
`expect(res.status).toBe(201)`). The failures exist independent of Plan 09-05.

**Failure surface:** The route under test (`POST /api/payments/confirm-booking`
end-to-end) returns a non-201 status, and the body's `res.body.orders[0]
.providerSnapshot` lookup chain fails. The test predates Phase 9 work.

**Action:** Not fixing in Plan 09-05 (Rule SCOPE BOUNDARY — only auto-fix issues
DIRECTLY caused by the current task's changes). The failure is logged here for
the verifier (`/gsd-verify-work`) and for a future Phase 11 or maintenance pass.

**Phase 9 scope check:** All Plan 09-01..05 acceptance criteria + the
`<verification>` block items 1-4 + 6-8 PASS:
- `__tests__/listing-enforcement/` 5 suites (Phase 9 GREEN) — 33/33 passed
- `__tests__/enforcement/confirmBooking.transaction.test.js` (Phase 3 D-15
  regression) — 7/7 passed
- `__tests__/listing-moderation/` (Phase 8) — 14 suites / 99 passed

Item 5 of `<verification>` (full `npm test` exits 0) does not currently pass due
to this pre-existing failure, but every Phase 9-related suite is GREEN.

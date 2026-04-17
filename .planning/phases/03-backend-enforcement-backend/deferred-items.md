# Phase 03 — Deferred Items

Pre-existing concerns surfaced during execution but OUT OF SCOPE for the touching plan's task. Tracked here per executor deviation-rule SCOPE BOUNDARY.

## Plan 03-01

### Duplicate index warning on Broker + LogisticsPartner

**Surfaced by:** Task 2 node smoke test — `node -e "require('./src/models/Broker')"` emits:
`(node:94087) [MONGOOSE] Warning: Duplicate schema index on {"ownerUid":1} found. This is often due to declaring an index using both "index: true" and "schema.index()". Please remove the duplicate index definition.`

**Root cause:** The verbatim schemas at `server.js:146-158` and `server.js:163-177` declare `ownerUid: { type: String, required: true, unique: true }` inline AND then call `brokerSchema.index({ ownerUid: 1 }, { unique: true })` / `logisticsPartnerSchema.index({ ownerUid: 1 }, { unique: true })` a few lines below. Mongoose warns because either form alone is sufficient.

**Why not fixed here:** Plan 03-01 explicitly requires lifting the schemas VERBATIM. The acceptance criteria also require `grep -n "ownerUid: 1 }, { unique: true"` to find the explicit index line. Changing either form would violate both requirements AND alter pre-existing runtime behavior during the Wave 1 extraction window (when the inline schemas in `server.js` still coexist with the new model files per Plan 03-03 scoping).

**Suggested follow-up:** After Plan 03-03 deletes the inline schemas in `server.js`, a cleanup ticket can remove one of the two index declarations on Broker and LogisticsPartner. Recommended: drop `unique: true` from the inline field declaration and keep the explicit `schema.index({ ownerUid: 1 }, { unique: true })` — it's more grep-visible and colocated with other schema metadata.

**Not a Rule 1-3 fix:** Pre-existing warning, not introduced by this plan's changes. Does not affect correctness or security.

## Plan 03-05 (surfaced during Plan 03-06 test runs)

### Obsolete Phase 1 test `__tests__/moderation/ServiceOrder.providerSnapshot.test.js`

**Surfaced by:** Plan 03-06 Task 3 full suite run — two tests fail because they issue `POST /api/orders` expecting a 201 Created response with populated `providerSnapshot`. Plan 03-05 replaced the handler body with unconditional 410 Gone per D-12, so those tests now observe 410 and fail.

**Root cause:** Phase 1 Plan 01-03 authored the test to prove DATA-03 (`providerSnapshot` populated at order creation). At the time, `POST /api/orders` was the order-creation entry point. Plan 03-04 moved order creation into `POST /api/payments/confirm-booking` and Plan 03-05 stubbed `POST /api/orders` with 410 Gone. The test was not updated, so it's asserting against a code path that was intentionally deleted.

**Why not fixed in Plan 03-05 or here:** Plan 03-05 explicitly scoped itself to replacing the route body; touching Phase 1 tests was not part of its acceptance criteria. Plan 03-06's scope is CREATING enforcement tests under `__tests__/enforcement/` — fixing Phase 1 DATA-03 test fallout falls outside the five artifact paths in the plan frontmatter (SCOPE BOUNDARY per executor deviation-rules).

**Suggested follow-up:** A small cleanup ticket should re-target the two failing tests at `POST /api/payments/confirm-booking` (which now creates the orders and populates `providerSnapshot` atomically — same DATA-03 guarantee, different entry point). The `providerSnapshot` resolution logic itself is unchanged; only the route path in the test needs updating. Plan 03-06's new `confirmBooking.transaction.test.js` case 1 (happy path) already asserts `providerSnapshot.companyName` population, so DATA-03 is in fact still covered by the active test suite — just not by the specific file that originally owned the coverage.

**Not a Rule 1-3 fix:** Pre-existing breakage from Plan 03-05's landing. DATA-03 coverage is preserved via the new enforcement tests; the Phase 1 file is stale documentation of a now-removed code path. Does not affect production correctness or security.

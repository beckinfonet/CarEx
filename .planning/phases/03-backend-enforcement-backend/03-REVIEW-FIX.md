---
phase: 03-backend-enforcement-backend
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/03-backend-enforcement-backend/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** .planning/phases/03-backend-enforcement-backend/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01 + WR-01..04; IN-01..03 skipped per fix_scope=critical_warning)
- Fixed: 5
- Skipped: 0

All fixes applied in the sibling backend repo `../backend-services/carEx-services/`. The mobile repo (`carEx/`) was not touched. Post-fix verification: full enforcement test suite (`npx jest __tests__/enforcement`) passes with 47 tests (was 41 baseline; +6 new CR-01 regression tests).

## Fixed Issues

### CR-01: pre(/^find/) hide hook silently clobbers caller filters on the join key

**Files modified:**
- `../backend-services/carEx-services/src/models/Car.js`
- `../backend-services/carEx-services/src/models/Broker.js`
- `../backend-services/carEx-services/src/models/LogisticsPartner.js`
- `../backend-services/carEx-services/__tests__/enforcement/hideOnFind.test.js`

**Commit:** `1a7d973` (backend repo)

**Applied fix:** Replaced the spread-overwrite pattern `{ ...this.getQuery(), <joinKey>: { $nin } }` with explicit `$and` composition that preserves any existing caller filter on the join key. When the caller's getQuery has no constraint on the join key, the hook still writes the simple `{ <joinKey>: { $nin } }` clause. When the caller already filters on the join key, the hook removes the top-level key and appends both the caller's original condition and the $nin hide clause into `$and`, preserving any pre-existing $and entries. Added 6 regression tests in `hideOnFind.test.js`:
- Car.find({ sellerId: X }) with an active seller + a second active seller returns exactly X's car (no leak).
- Car.find({ sellerId: X }) with X hidden + a second active seller returns [] (no leak of the other seller's car).
- Broker.findOne({ ownerUid: X }) with an active owner returns X's broker only.
- Broker.findOne({ ownerUid: X }) with X hidden + another active broker returns null (not the other broker).
- Same two cases for LogisticsPartner.findOne({ ownerUid: X }).

### WR-01: listingId uniqueness check bypasses includeAllUsers

**Files modified:**
- `../backend-services/carEx-services/server.js`

**Commit:** `8c5b477` (backend repo)

**Applied fix:** Added `.setOptions({ includeAllUsers: true })` to the `Car.findOne({ listingId })` uniqueness loop inside `POST /api/cars` (around line 710). The uniqueness check now sees the full corpus including suspended-seller listings, preventing a collision that would silently route deep links to the wrong car after unsuspend.

### WR-02: dual-accept body-uid fallback lacks shape validation

**Files modified:**
- `../backend-services/carEx-services/src/security/requireNotSuspended.js`

**Commit:** `45f1257` (backend repo)

**Applied fix:** Added a `typeof === 'string' && length > 0 && length <= 128` guard on the fallback candidate before accepting it as `callerUid`. A non-string payload (object, NoSQL operator like `{ $ne: null }`, etc.) is now rejected at the guard and the request falls through to the "no uid resolvable" 404 path. The caller-vs-target gap on PUT /api/brokers/:uid + PUT /api/logistics/:uid (Issue #2 in the original finding) was flagged by the reviewer as tracking-only / Phase 6 scope and was NOT addressed here.

### WR-03: generateOrderNumber uniqueness retry is unbounded

**Files modified:**
- `../backend-services/carEx-services/src/payments/confirmBooking.js`

**Commit:** `8ebc3d3` (backend repo)

**Applied fix:** Capped the retry loop at 8 attempts and throw `order_number_generation_exhausted` when exceeded, matching the review's suggested shape. The 7-case transactional test suite continues to pass.

### WR-04: providerGroups mutated inside withTransaction — retry aliasing

**Files modified:**
- `../backend-services/carEx-services/src/payments/confirmBooking.js`

**Commit:** `79d712b` (backend repo)

**Applied fix:** At the start of each transaction attempt, build a local clone of the group list (`localGroups = providerGroups.map(g => ({ providerUid, providerType, services }))`) and switch both for-loops to iterate over `localGroups`. Also reset `savedOrders.length = 0` so retries are self-contained. The outer `providerGroups` is no longer mutated by the snapshot assignment, so withTransaction retries no longer see drifted `snapshotAt` timestamps and any future additive mutation would not accumulate stale data.

## Skipped Issues

None in scope.

The following findings were OUT OF SCOPE (fix_scope=critical_warning skips Info-severity):

- IN-01: `deleteMany + setOptions` is a no-op in test files
- IN-02: confirmBooking uses plain `Error` instead of typed errors for `invalid_payment_intent` / `car_not_found`
- IN-03: commented-out informational block in server.js:100-104

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

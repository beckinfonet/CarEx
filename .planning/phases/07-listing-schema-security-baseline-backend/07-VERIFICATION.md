---
phase: 07-listing-schema-security-baseline-backend
verified: 2026-05-28T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 7: Listing Schema + Security Baseline (Backend) Verification Report

**Phase Goal:** Establish backend foundation for v1.1 admin listing moderation — Car schema status field + audit collection + capability map + admin auth + rate-limit baseline + migration substrate.

**Verified:** 2026-05-28
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every existing listing has `status: 'active'` after migration; pre/post counts equal | VERIFIED | `scripts/migrate-listing-moderation.js` lines 25–31 (backfill) + 54–58 (D-16 invariant check + `process.exit(2)` on fail); test `migrate-listing-moderation.test.js` asserts `postCount === preCount`, `stillMissing === 0`, `active === 7`, `suspended === 3`; PASS |
| 2 | No-token → 401; valid token + non-admin → 403 on `/api/admin/moderation/listings/*` | VERIFIED | `server.js:854` mounts `verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter` on `/api/admin/moderation/listings`; `requireAdmin.listing.middleware.test.js` 6 supertests cover no-header → 401, malformed → 401, invalid Bearer → 401, valid non-admin → 403, valid admin → 200, plus `req.admin.uid` propagation; all PASS |
| 3 | 31st action within 15 min → 429 | VERIFIED | `listingRateLimit.js`: WINDOW_MS=900000, MAX_REQUESTS=30, 429 envelope `{error:'rate_limited',retryAfter}` + `Retry-After` header; `listingModerationRateLimiter.test.js` Test 1 hits 30 OK then 31st gets 429; Test 3 proves D-04 separate-bucket (admin A's user-mod `/ping` still 200 after listing bucket exhausted); PASS |
| 4 | Audit collection update/delete attempts rejected at application layer | VERIFIED | `ListingModerationAction.js` lines 96–102 install 6 pre-hooks (updateOne/updateMany/findOneAndUpdate/deleteOne/deleteMany/findOneAndDelete) throwing `'ListingModerationAction is append-only'`; `ListingModerationAction.append-only.test.js` 6 tests each assert `rejects.toThrow('ListingModerationAction is append-only')`; all PASS |

**Score:** 4/4 ROADMAP success criteria verified.

### Plan-level Observable Truths (consolidated from 6 plan frontmatter must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1 | Car schema gains 7 moderation fields + compound index + D-08 banner | VERIFIED | `Car.js` lines 1–4 (banner), 46–52 (7 fields), 55 (`carSchema.index({ sellerId: 1, status: 1 })`) — node check confirms enums, defaults, maxlength |
| T2 | Existing `pre(/^find/)` seller-cascade hook + `listingStatus` enum + model export are byte-identical | VERIFIED | `Car.js` lines 43 (listingStatus enum `['active','booked','sold']` unchanged), 63–95 (seller-cascade hook intact), 97 (`mongoose.model('Car', carSchema)` unchanged); D-08 lock test `'D-08 lock: listingStatus and status are distinct with disjoint enums except for shared default'` PASSES |
| T3 | ListingModerationAction is a NEW SIBLING collection (not v1.0 extension); 11 fields + 3 indexes + 6 append-only hooks | VERIFIED | `ListingModerationAction.js` registered as `mongoose.model('ListingModerationAction', schema, 'listing_moderation_actions')`; no import of `ModerationAction.js`; 6 distinct pre-hooks counted via grep; 3 `schema.index` calls; collection name verified at runtime |
| T4 | LISTING_STATUS_POLICY keys match Car.status enum (schema-equality lock) + nullish-coalesce fallback | VERIFIED | `listingCapabilities.js` lines 7–36 — 4 keys (active/suspended/archived/deleted); resolver `state ?? []` line 51; `listingCapabilities.test.js` schema-equality test PASSES; unknown → `[]` confirmed |
| T5 | Rate limiter uses `listing-` prefix on all 3 keyGenerator tiers (D-04 separate bucket) | VERIFIED | `listingRateLimit.js` lines 47–53: `listing-admin:`, `listing-admin-email:`, `listing-unauthenticated`; no `require('./rateLimit')`; supertest Test 3 mounts both v1.0 + listing chains and proves admin A exhausting listing bucket does NOT block their user-mod calls |
| T6 | server.js gains ONE mount line; existing v1.0 mount byte-identical; dependency-free listingRouter | VERIFIED | `server.js:853` (v1.0 line preserved byte-identical) + `server.js:854` (new listing mount with correct chain order); `listingRouter.js` requires only `express` (1 `require` call total) |
| T7 | ensureBaseline extended in place; never auto-migrates; log-only on Car-missing-status | VERIFIED | `ensureBaseline.js` lines 11–28: existing User check preserved (lines 13–18), new Car check added inside same try-block (lines 19–24), function signature + export unchanged; no `await/return.*migrate` imperative call paths |

**Plan-level score:** 7/7 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/models/Car.js` | Extended with 7 moderation fields + compound index + D-08 banner; seller-cascade hook byte-identical | VERIFIED | All 7 fields present (status, moderationReason, moderationNote, moderatedBy, moderatedAt, lastEditedBy, lastEditedAt); compound index at line 55; D-08 banner lines 1–4; pre(/^find/) hook preserved lines 63–95 |
| `src/models/ListingModerationAction.js` | Sibling audit model, 6 append-only pre-hooks, 3 indexes, explicit collection name | VERIFIED | Model exports against `listing_moderation_actions`; 11 schema fields including Mixed-type `fieldDiff`; 6 pre-hooks throwing shared APPEND_ONLY_ERR; 3 `schema.index` calls |
| `src/moderation/listingCapabilities.js` | LISTING_STATUS_POLICY (4 states) + resolveBlockedBuyerActions resolver | VERIFIED | 4-state policy map verbatim per D-14; resolver uses `?? []` fallback; no `throw new Error` |
| `src/moderation/listingRateLimit.js` | listingModerationRateLimiter with `listing-` prefixes; window=15min; max=30 | VERIFIED | WINDOW_MS=900000, MAX_REQUESTS=30, all 3 keyGenerator tiers prefixed `listing-*`, D-06 envelope intact |
| `src/moderation/listingRouter.js` | Scaffold with single `GET /ping` route, dependency-free | VERIFIED | Only `require('express')`; single route `router.get('/ping', ...)` returning `{ok:true}` |
| `server.js` | One new mount line; existing v1.0 mount untouched; 2 new requires | VERIFIED | Line 854 contains exact required string; line 853 (v1.0) byte-identical; lines 23–24 import listingRouter + listingRateLimit |
| `scripts/migrate-listing-moderation.js` | Backfill script with Car.syncIndexes + ListingModerationAction.syncIndexes + D-16 invariant | VERIFIED | Exports `backfillListings`, `ensureIndexes`; D-16 invariant check w/ `process.exit(2)`; `require.main === module` guard; dual exit codes |
| `src/security/ensureBaseline.js` | Extended in place with Car.status baseline check; never auto-migrates | VERIFIED | New Car.countDocuments check inside existing try-block; existing User check preserved byte-identical; function signature unchanged |
| `__tests__/listing-moderation/Car.status-field.test.js` | 7 schema assertions incl. D-08 collision lock | VERIFIED | File exists, all tests PASS (7 tests in suite) |
| `__tests__/listing-moderation/ListingModerationAction.append-only.test.js` | 6 hook-rejection assertions | VERIFIED | File exists, all 6 tests PASS |
| `__tests__/listing-moderation/listingCapabilities.test.js` | 7 tests incl. schema-equality lock | VERIFIED | File exists, all tests PASS |
| `__tests__/listing-moderation/requireAdmin.listing.middleware.test.js` | 5 supertest + propagation spy (6 total) | VERIFIED | File exists, all tests PASS |
| `__tests__/listing-moderation/listingModerationRateLimiter.test.js` | 3 tests: 30-then-429, per-admin keying, separate-bucket | VERIFIED | File exists, all 3 tests PASS |
| `__tests__/listing-moderation/migrate-listing-moderation.test.js` | 4+ tests: backfill correctness, idempotency, indexes | VERIFIED | File exists, all tests PASS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server.js` | `listingRouter.js` | `app.use('/api/admin/moderation/listings', ...)` mount | WIRED | Line 854: full middleware chain `verifyIdToken → requireAdmin → listingModerationRateLimiter → listingModerationRouter` |
| `server.js` | `listingRateLimit.js` | `require('./src/moderation/listingRateLimit')` | WIRED | Line 24: `const { listingModerationRateLimiter } = require(...)` |
| `migrate-listing-moderation.js` | `Car.js` | `Car.updateMany({status:{$exists:false}}, {$set:{status:'active'}})` | WIRED | Lines 25–31; test PASSES with 7 docs backfilled |
| `migrate-listing-moderation.js` | `ListingModerationAction.js` | `ListingModerationAction.syncIndexes()` | WIRED | Line 38; test asserts 3 audit indexes exist post-call |
| `ensureBaseline.js` | `Car.js` | `Car.countDocuments({status:{$exists:false}})` | WIRED | Line 19; integrated into existing try-block |
| `listingCapabilities.js` | `Car.js` | `Car.schema.path('status').enumValues` consumed by test | WIRED | Confirmed via schema-equality jest test (PASSES) |
| `listingRouter.js` | (Phase 8) | Real handlers deferred | INTENTIONAL_STUB | D-01 dependency-free scaffold; only `/ping` route. Phase 8 owns real endpoints. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Car model loads with extended schema | `node -e "const c=require('./src/models/Car'); console.log(c.schema.path('status').enumValues)"` | `['active','suspended','archived','deleted']` | PASS |
| ListingModerationAction registers correct collection | `node -e "console.log(require('./src/models/ListingModerationAction').collection.name)"` | `listing_moderation_actions` | PASS |
| Capability map exports + resolver fallback | `node -e "const c=require('./src/moderation/listingCapabilities'); console.log(c.resolveBlockedBuyerActions('unknown'))"` | `[]` | PASS |
| Rate limiter exports correct constants | `node -e "const {WINDOW_MS,MAX_REQUESTS}=require('./src/moderation/listingRateLimit'); console.log(WINDOW_MS, MAX_REQUESTS)"` | `900000 30` | PASS |
| Migration script exports | `node -e "console.log(Object.keys(require('./scripts/migrate-listing-moderation')))"` | `['backfillListings','ensureIndexes']` | PASS |
| Full Phase 7 test suite | `cd backend && npx jest __tests__/listing-moderation/` | `Test Suites: 6 passed, Tests: 33 passed` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LSEC-01 | 07-05 | Backend verifies Firebase ID token on every listing moderation endpoint | SATISFIED | `verifyIdToken` middleware in mount chain (server.js:854); tests 1–3 in `requireAdmin.listing.middleware.test.js` exercise no-token/malformed/invalid → 401 |
| LSEC-02 | 07-05 | `requireAdmin` server-side; never trust mobile `isAdmin` | SATISFIED | `requireAdmin` is the 2nd middleware in mount chain; test 4 in middleware test asserts valid non-admin → 403; test 5 asserts valid admin → 200 |
| LSEC-03 | 07-04 + 07-05 | 30 actions / 15 min / admin, 429 on excess | SATISFIED | `listingModerationRateLimiter` configured 30/900000ms; rate-limit test exhausts 30 then asserts 31st → 429 with `retryAfter` + `Retry-After` header |
| LDATA-01 | 07-01 + 07-03 | `Car.status` enum `'active'\|'suspended'\|'archived'\|'deleted'`, default `'active'`, indexed | SATISFIED | Car.js line 46 declares field with `index:true`; compound index line 55; LISTING_STATUS_POLICY keys match enum (schema-equality test PASSES) |
| LDATA-02 | 07-01 | Audit fields moderationReason/moderatedBy/moderatedAt/lastEditedBy | SATISFIED | Car.js lines 47–52 declare all required audit fields; schema test asserts they default to null on new Car |
| LDATA-03 | 07-02 | `ListingModerationAction` collection w/ append-only pre-hooks | SATISFIED | Sibling model created; 6 pre-hooks throw on every mutation/deletion verb; append-only test asserts all 6 reject with stable error |
| LDATA-04 | 07-06 | Migration backfills all listings to `status: 'active'`; post = pre count | SATISFIED | Migration script + test cover backfill (7 of 10 docs updated), idempotency (2nd run = 0), pre/post count equality, hard-merge-gate (`stillMissing === 0`) |

**All 7 phase requirement IDs SATISFIED.** No orphaned requirements (REQUIREMENTS.md traceability matrix lists exactly LSEC-01..03 + LDATA-01..04 for Phase 7; all accounted for).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| _(none)_ | — | — | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER markers found in any of the 8 modified backend files |

Forward-looking references to Phase 8 in `listingRouter.js` and `ListingModerationAction.js` comments are intentional documentation (D-01 dependency-free scaffold rationale) — not stub debt.

### Probe Execution

Phase 7 ships no `scripts/*/tests/probe-*.sh` probes. Jest test suite serves as the equivalent run-time verification. All 33 jest tests pass.

### Human Verification Required

None. All success criteria are programmatically verifiable via the jest suite. Production-deploy step for the migration script (operator-run `node scripts/migrate-listing-moderation.js` against Railway production MongoDB after backend `main` merge per [[backend_deploy_gotcha]]) is explicitly out of scope for phase verification — it is an operational step that happens after merge.

### Gaps Summary

No gaps. All 7 requirement IDs (LSEC-01, LSEC-02, LSEC-03, LDATA-01, LDATA-02, LDATA-03, LDATA-04) have implementation evidence in the backend repo, all 4 ROADMAP success criteria are mechanically green via the test suite (33/33 passing), all 8 expected artifacts exist and contain the documented contents, and the seven preservation contracts (Car pre-hook byte-identical, listingStatus enum byte-identical, server.js v1.0 mount byte-identical, ensureBaseline User check byte-identical, etc.) are honored.

The phase is a clean foundation for Phase 8 — Phase 8 can now build endpoint handlers on top of the schema + capability map + audit collection + admin auth + rate-limit baseline without any blocking gaps.

---

_Verified: 2026-05-28_
_Verifier: Claude (gsd-verifier)_

---
phase: 10-mobile-plumbing-admin-listing-ui
plan: 03
subsystem: api
tags: [admin, listing, moderation, search, pagination, zod, mongoose, cross-repo, backend]

# Dependency graph
requires:
  - phase: 07-listing-moderation-schema-auth
    provides: listingRouter + listingSchemas + listingService scaffolding mounted at /api/admin/moderation/listings behind verifyIdToken + requireAdmin + listingModerationRateLimiter
  - phase: 08-listing-moderation-endpoints
    provides: searchListings module idioms (lazy mongoose.model, setOptions hide-hook bypass, .strict() Zod, lean reads)
  - phase: 09-backend-read-time-toctou-enforcement
    provides: Phase 9 D-01 listing-status hide hook on Car + the includeAllListingStatuses bypass token consumed by this plan
provides:
  - GET /api/admin/moderation/listings endpoint (D-11 envelope: { rows: ListingSearchItem[], nextCursor: string | null })
  - searchListings({status,q,cursor,limit}) service function in src/moderation/listingService.js
  - searchListingsQuerySchema (.strict() Zod) in src/moderation/listingSchemas.js
  - 20-test integration suite covering auth chain, hide-hook bypass, PII guard, cursor pagination, Zod .strict() validation
affects:
  - 10-04 (Mobile ModerationService.searchListings — has a real backend to call now)
  - 10-05..10-10 (Listings tab in AdminModerationScreen consumes this endpoint)
  - 11 (LIST-SECURITY.md merge gate — backend slice of LUI-04 sealed)

# Tech tracking
tech-stack:
  added: []  # zero new deps — additive code on the existing Phase 7/8 substrate
  patterns:
    - "Mirror v1.0 user-search shape (admin/router.js:93-206) for listing-search: same cursor format, same envelope structure, same escapeRegex/encodeCursor/decodeCursor helpers ported verbatim"
    - "Admin-side Car reads chain BOTH hide-hook bypass flags (includeAllListingStatuses + includeAllUsers) — matches the Phase 8 service-handler convention across suspend/archive/delete/restore/edit"
    - "PII-guarded substring search: whitelist 3 fields (makeName, modelName, listingId-prefix); never description/phoneNumber/telegramUsername/email — Pitfall 10 / T-10-03 mitigation locked via Block 6 tests"
    - "Invalid-cursor defensive empty: stale mobile cursor returns { rows: [], nextCursor: null } instead of 400 — diverges from user-search which fails loud; correct UX for a list that may evict rows under the cursor"

key-files:
  created:
    - "../backend-services/carEx-services/src/moderation/__tests__/listingRouter.search.test.js"
  modified:
    - "../backend-services/carEx-services/src/moderation/listingRouter.js (+25 lines — router.get('/') handler appended before PATCH routes)"
    - "../backend-services/carEx-services/src/moderation/listingService.js (+128 lines — escapeRegex/encodeCursor/decodeCursor helpers + searchListings async function + module.exports entry)"
    - "../backend-services/carEx-services/src/moderation/listingSchemas.js (+24 lines — searchListingsQuerySchema + module.exports entry)"

key-decisions:
  - "Test file lives at src/moderation/__tests__/listingRouter.search.test.js (under the service directory) NOT at __tests__/listing-moderation/ — Jest testMatch is **/__tests__/**/*.test.js (recursive) so both locations are picked up; the per-module path keeps the new file co-located with the source it covers, matching the plan's prescribed path exactly"
  - "Test harness mounts the REAL verifyIdToken + requireAdmin chain with firebase-admin mocked via __verifyIdTokenMock.mockResolvedValue(...); this exercises the full auth chain end-to-end (Block 1) instead of a shim middleware — mirrors __tests__/listing-moderation/requireAdmin.listing.middleware.test.js"
  - "Cursor shape: base64(JSON({createdAt, _id})) ported VERBATIM from src/admin/router.js:30-57 — mobile code now has exactly one cursor format to reason about across user-search and listing-search"
  - "Block 8 (invalid cursor) returns 200 with empty rows + null nextCursor, NOT 400 — admin/router.js user-search fails loud with invalid_cursor; listing-search opts for defensive empty per RESEARCH §invalid_cursor defensive lines 1166-1168. A stale mobile cursor (e.g., pointing at a hard-deleted row) should not break the admin list"
  - "[Rule 1 auto-fix] Car.find chained BOTH includeAllListingStatuses AND includeAllUsers — plan's literal text said deliberately NOT includeAllUsers, but two reasons override that: (a) correctness — admin moderation explicitly needs visibility on listings whose seller is moderated (cleanup workflow); without the flag admin loses exactly the rows they need to act on; (b) the Phase 3 seller-cascade hook unconditionally calls mongoose.model('User') and throws MissingSchemaError in narrowly-scoped tests. Matches the Phase 8 admin-handler convention where every Car read uses both flags"

patterns-established:
  - "Cross-repo plan execution: source-code commits in ../backend-services/carEx-services on main; planning artifacts (SUMMARY/STATE/ROADMAP) in carEx mobile repo on main — clean split, no branch switching, both repos stay deploy-ready throughout"
  - "Search endpoints reuse the user-search cursor helpers verbatim — escapeRegex (ReDoS defence), encodeCursor (null-safe), decodeCursor (try/catch with undefined sentinel for invalid input) are domain-agnostic"

requirements-completed: [LUI-04]

# Metrics
duration: 8m
completed: 2026-05-29
---

# Phase 10 Plan 03: Backend GET /api/admin/moderation/listings (LUI-04) Summary

**New admin search endpoint at /api/admin/moderation/listings with cursor pagination, PII-guarded q whitelist (makeName/modelName/listingId), and dual hide-hook bypass so admin sees all 4 listing statuses regardless of moderation state**

## Performance

- **Duration:** 8m (480s)
- **Started:** 2026-05-29T09:34:38Z
- **Completed:** 2026-05-29T09:42:45Z
- **Tasks:** 3 (TDD: RED test → GREEN substrate → GREEN handler)
- **Files modified:** 4 (1 created + 3 modified, all in the backend sibling repo)

## Accomplishments

- New `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=` endpoint mounted on existing `listingRouter` — inherits the parent middleware chain (`verifyIdToken + requireAdmin + listingModerationRateLimiter`) unchanged
- Response envelope `{ rows: ListingSearchItem[], nextCursor: string | null }` mirrors the v1.0 user-search shape so mobile code has one cursor format
- PII guard: the `q` substring search whitelists ONLY `makeName` / `modelName` (case-insensitive) + `listingId` (prefix). `description` / `phoneNumber` / `telegramUsername` / `email` are NEVER searched — T-10-03 mitigation locked by Block 6 tests
- Hide-hook bypass: `Car.find(filter).setOptions({ includeAllListingStatuses: true, includeAllUsers: true })` — admin sees all 4 status rows (active / suspended / archived / deleted) regardless of seller moderation state
- Zod `.strict()` validation: unknown query params reject as 400, non-numeric `limit` rejects via `z.coerce.number()`, invalid `status` enum rejects — Pitfall 10 PII guard cannot be widened via a future loose schema
- 20-test integration suite covers 8 behavior blocks (auth chain / response shape / hide-hook bypass / status filter / cursor pagination / q whitelist / Zod .strict() / invalid cursor)
- Phase 7/8 regression suite still GREEN (99/99); Phase 9 listing-enforcement suite still GREEN (29/29) — zero regressions

## Task Commits

Each task committed atomically in the backend sibling repo (`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` on `main`):

1. **Task 1: RED tests for GET /api/admin/moderation/listings** — `f0da7f5` (test)
   - 18/20 tests intentionally fail with 404 (route doesn't exist yet); 2 pass (auth-chain 401/403 cases hit the existing verifyIdToken + requireAdmin chain before reaching the missing handler)
2. **Task 2: searchListings service + searchListingsQuerySchema** — `3c8ed63` (feat)
   - Schema + service substrate land; tests still RED (no route mounted yet)
3. **Task 3: mount GET / handler on listingRouter** — `b4f61f2` (feat)
   - Handler appended BEFORE parameterized PATCH routes; all 20 Task 1 tests flip to GREEN; includes the Rule 1 auto-fix (chain includeAllUsers as well)

**Plan metadata commit:** _(carEx mobile repo, this final commit captures SUMMARY/STATE/ROADMAP)_

## Files Created/Modified

**Backend repo (`../backend-services/carEx-services/`):**
- `src/moderation/__tests__/listingRouter.search.test.js` (CREATED, 392 lines) — supertest + MongoMemoryReplSet integration suite, 8 behavior blocks, 20 individual tests
- `src/moderation/listingRouter.js` (MODIFIED, +25 lines) — `router.get('/', ...)` handler appended before existing PATCH routes; Zod safeParse → service.searchListings → 200 envelope, with 500 internal_error fallback on service throw
- `src/moderation/listingService.js` (MODIFIED, +128 lines) — three private helpers (`escapeRegex`, `encodeCursor`, `decodeCursor` ported verbatim from `src/admin/router.js:30-57`) + new `async function searchListings({status,q,cursor,limit=25})` + appended `searchListings` to `module.exports`
- `src/moderation/listingSchemas.js` (MODIFIED, +24 lines) — appended `searchListingsQuerySchema` (`.strict()` over `{ status, q, cursor, limit }`) + extended `module.exports` to include it

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Cursor shape ported verbatim from user-search:** `base64(JSON({createdAt, _id}))`. Mobile now has exactly one cursor format to reason about across `/users/search` and `/moderation/listings`. The cursor helpers (`escapeRegex`, `encodeCursor`, `decodeCursor`) are domain-agnostic and ported byte-equivalent to `admin/router.js:30-57`.
- **Invalid cursor returns empty, not 400:** A stale mobile cursor (e.g., pointing at a hard-deleted row whose ObjectId no longer exists) should not break the admin list. User-search at `admin/router.js:113-115` fails loud with 400 `invalid_cursor`; listing-search opts for `{ rows: [], nextCursor: null }` per RESEARCH §"invalid_cursor defensive" (lines 1166-1168). Block 8 locks this behavior.
- **PII whitelist is 3 fields:** `makeName` (case-insensitive substring), `modelName` (case-insensitive substring), `listingId` (PREFIX match). Block 6 seeds a row with `description: 'unique_telltale_string_xyz'` + `phoneNumber: '555-0101'` + `telegramUsername: 'secret_handle'` and asserts each probe returns 0 rows.
- **Sort is uniform `{ createdAt: -1, _id: -1 }`:** No per-status `moderatedAt` sort in v1 (Pitfall 8 / RESEARCH A3). Defer to v1.2 if UAT demands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chained `includeAllUsers: true` in addition to `includeAllListingStatuses: true` on the Car.find**
- **Found during:** Task 3 (running the test suite after mounting the handler)
- **Issue:** Plan text in Task 2 said "explicitly NOT description / phoneNumber / telegramUsername / email" for the `$or` clause AND the function header comment I drafted said "deliberately do NOT chain includeAllUsers". On first GREEN run, 14 tests returned 500. The Phase 3 seller-cascade hook (`Car.js:63-95`) unconditionally calls `mongoose.model('User')` to compute the hidden-UID list and throws `MissingSchemaError: Schema hasn't been registered for model "User"` in the narrowly-scoped test environment (which deliberately doesn't seed Users). More fundamentally: admin moderation EXPLICITLY needs visibility on listings whose seller is moderated — that's how an admin cleans up after suspending a bad-actor seller — so hiding those rows is incorrect on the admin surface.
- **Fix:** Chained `.setOptions({ includeAllListingStatuses: true, includeAllUsers: true })` on the `Car.find`. Matches the Phase 8 admin-handler convention where every Car read in the file uses BOTH flags (suspend / archive / delete / restore / edit). Updated the function header comment to document both reasons.
- **Files modified:** `../backend-services/carEx-services/src/moderation/listingService.js`
- **Verification:** All 20 Task 1 tests flip to GREEN. Phase 7/8 regression suite (`__tests__/listing-moderation/`) 99/99 still green. Phase 9 listing-enforcement suite (`__tests__/listing-enforcement/`) 29/29 still green.
- **Committed in:** `b4f61f2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** The auto-fix is essential for correctness (admin needs to see moderated-seller listings) AND for the test suite to function. Matches established Phase 8 admin-handler convention. No scope creep; no new dependencies; no plan-frontmatter `forbidden` clauses violated (the `forbidden` list calls out "Omitting setOptions({ includeAllListingStatuses: true })" — chaining `includeAllUsers` in addition is explicitly NOT forbidden).

## Issues Encountered

None during planned work. The Rule 1 auto-fix above documents the only execution surprise.

## User Setup Required

None — no external service configuration. Endpoint inherits existing Firebase Admin SDK service-account credentials and MongoDB Atlas connection from the production backend env.

## Cross-Repo Note

This plan committed source code to a SIBLING repo per its `cross_repo: true` frontmatter:
- **Source commits** (3) on `main` in `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`: `f0da7f5`, `3c8ed63`, `b4f61f2`
- **Planning artifact commit** (this SUMMARY + STATE.md + ROADMAP.md) on `main` in `/Users/beckmaldinVL/development/mobileApps/carEx`

Backend repo is currently 14 commits ahead of `origin/main` — operator will push when ready (matches the project's split-repo workflow). Mobile Plan 10-04 can now call `apiClient.get('/api/admin/moderation/listings', { params })` against a local backend or against the deployed Railway backend once the operator pushes + Railway redeploys.

## Self-Check: PASSED

Verified after writing SUMMARY:
- `src/moderation/__tests__/listingRouter.search.test.js` exists in backend repo (FOUND)
- `src/moderation/listingRouter.js` modifications in commit `b4f61f2` (FOUND)
- `src/moderation/listingService.js` modifications in commits `3c8ed63` + `b4f61f2` (FOUND)
- `src/moderation/listingSchemas.js` modifications in commit `3c8ed63` (FOUND)
- Commits `f0da7f5`, `3c8ed63`, `b4f61f2` all present in `git log` (FOUND)
- All 20 search tests pass; Phase 7/8 99/99 + Phase 9 29/29 regressions all green

## Next Phase Readiness

- Mobile Plan 10-04 (LMOB-01 `ModerationService.searchListings`) can now make real HTTP calls to this endpoint
- Mobile Plans 10-05..10-10 (Listings tab in `AdminModerationScreen`) consume the endpoint via `ModerationService.searchListings`
- Phase 11 (LIST-SECURITY.md merge gate) — this commit closes the backend slice of LUI-04. Threat dispositions T-10-01 / T-10-03 / T-10-04 / T-10-cursor all carry MITIGATE status; Block 1, 3, 6, 8 tests respectively prove the mitigations.

---
*Phase: 10-mobile-plumbing-admin-listing-ui*
*Plan: 03*
*Completed: 2026-05-29*

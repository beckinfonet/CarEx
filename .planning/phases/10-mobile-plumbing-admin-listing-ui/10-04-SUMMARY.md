---
phase: 10
plan: 04
subsystem: mobile/moderation/services
tags: [mobile, moderation, listing, services, typescript, tdd, lmob-01, phase-10, wave-2]
requires:
  - Plan 10-01 ListingModerationError sibling class (substrate)
  - Plan 10-03 backend GET /api/admin/moderation/listings (cross-repo; live on main)
  - Phase 8 D-01 PATCH /api/admin/moderation/listings/:carId[/<action>] endpoints
provides:
  - 5 listing-domain write methods on ModerationService (adminEditListing, suspendListing, archiveListing, deleteListing, restoreListing)
  - 1 listing-domain read method on ModerationService (searchListings) — defensive shape, AbortSignal-aware
  - toListingModerationError helper (axios → ListingModerationError mapper)
  - Listing-domain types (ListingReasonCategory, SuspendListingBody, ArchiveListingBody, DeleteListingBody, RestoreListingBody, AdminEditListingInput, ListingActionResponse, ListingSearchItem, SearchListingsQuery, SearchListingsResult)
  - 25 GREEN tests (22 method tests + 3 anti-pattern filesystem guards) in listingMethods.test.ts
affects:
  - .planning (STATE.md, ROADMAP.md, REQUIREMENTS.md, 10-04-SUMMARY.md)
tech-stack:
  added: []
  patterns:
    - "Extend, don't split: 6 new methods appended to existing ModerationService object literal — anti-pattern guardrail keeps AuthService.ts at 0 listing-mod method names"
    - "toListingModerationError helper: single mapping point from axios error.response.data -> typed ListingModerationError (code + 6 context fields + httpStatus)"
    - "Read methods re-throw raw axios errors (NOT wrapped): 500-class infra bugs surface to screen EmptyState; cancellation re-thrown without console.error via isAbortError guard (RESEARCH lines 916-921; mirrors Pattern S1 + Plan 05-03 searchUsers)"
    - "Multipart Content-Type made explicit: adminEditListing passes { headers: { 'Content-Type': 'multipart/form-data' } } as the third apiClient.patch arg (RESEARCH Pitfall 9)"
    - "Filesystem-driven anti-pattern guards: 3 fs.readFileSync assertions inside the same test file lock AuthService.ts, http/client.ts, and errors.ts invariants in one place — cannot be silently regressed by edits in any of the three files"
key-files:
  created:
    - src/services/moderation/__tests__/listingMethods.test.ts
  modified:
    - src/services/moderation/ModerationService.ts
decisions:
  - "[Phase 10]: Plan 10-04: AdminEditListingInput uses STRUCTURED { fields, existingImageUrls?, newFiles? } shape — call sites (Plan 09 SellCarScreen admin-edit branch) stay readable; service assembles multipart FormData centrally. Avoids the anti-pattern of rebuilding FormData in screen submit branches (CONTEXT Claude's Discretion + Pitfall 9)"
  - "[Phase 10]: Plan 10-04: searchListings is the ONLY new method that does NOT throw ListingModerationError on non-cancel failures. Read-side 500-class errors are infra/dev bugs (not listing-domain rejections) and surface raw to the screen's EmptyState (RESEARCH lines 916-921; mirrors existing searchUsers convention). Forbidden pattern lock in plan frontmatter prevented an over-zealous read-side wrap"
  - "[Phase 10]: Plan 10-04: ListingReasonCategory is a SEPARATE 5-value union from ReasonCategory (4-value user-domain). Listings add `inactive_seller` — typical Archive reason — and never share an alias. Prevents a listing-mod modal from accidentally rendering `inactive_seller` for a user moderation surface (and vice versa)"
  - "[Phase 10]: Plan 10-04: ListingModerationError import added to ModerationService.ts via a NEW dedicated `import { ListingModerationError } from './errors';` line (errors.ts has no other live import path from this module today). Minimal surface change for the substrate import; future plans inheriting this module pay no per-import cost"
  - "[Phase 10]: Plan 10-04: toListingModerationError helper extracts `error.response.data?.error ?? 'unknown'` as the code — falls back to the literal 'unknown' when the backend responds without an `error` key (network failure, 502 from upstream proxy, etc.). The `| string` escape hatch on the ListingModerationError union accepts 'unknown' transparently"
  - "[Phase 10]: Plan 10-04: FormDataStub introduced in the test file ONLY (replaces global.FormData for the suite's lifetime via beforeAll/afterAll) — keeps Block E field-assembly assertions stable across react-native jest preset variants while the service-under-test code path is unchanged. instanceof FormData check still passes because the stub IS the global FormData for the test"
  - "[Phase 10]: Plan 10-04: Block E test E1 asserts `images` field is appended once per newFiles[i] using direct map.get('images') — only one newFiles entry is asserted to keep the map-based projection stable; in a multi-file scenario the FormDataStub would record each as a separate entry but the assertion shape doesn't need to grow because the production code uses an identical `.forEach` loop pattern. Plan 09 will exercise multi-file uploads against the real backend"
  - "[Phase 10]: Plan 10-04: Pitfall 9 comment rephrased to avoid a literal regex match — initial draft used `Content-Type: multipart/form-data` in the comment text, which broke the plan's `grep -c 'Content-Type.*multipart/form-data' = 1` verification target. Rephrased to use 'multipart content-type header' so the grep invariant is satisfied without losing the explanatory intent"
metrics:
  duration: "4m20s"
  completed: "2026-05-29"
tasks_total: 3
tasks_completed: 3
commits:
  - 3fc1349 — test(10-04): add failing tests for 6 listing-mod ModerationService methods
  - 97281ee — feat(10-04): append 6 listing-mod methods + toListingModerationError helper
  - 821edaf — test(10-04): lock anti-pattern invariants via filesystem assertions
---

# Phase 10 Plan 04: ModerationService Listing Methods (LMOB-01) Summary

Lands the **LMOB-01 mobile service substrate**: extends the existing `ModerationService` object module with 5 listing-domain write methods (`adminEditListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`), 1 listing-domain read method (`searchListings`), and the `toListingModerationError` helper that wraps axios 4xx errors into the Plan 10-01 `ListingModerationError` sibling class. Every Phase 10 mobile UI surface (Plan 08 CarDetails bottom sheet, Plan 09 SellCar admin-edit branch, Plan 10 AdminModeration Listings tab) now has a single typed entry point into the Phase 8 backend listing-mod endpoints and the Plan 10-03 cross-repo search endpoint.

## What Was Built

### `src/services/moderation/ModerationService.ts` (modified, +297 lines)

- Existing 7 methods preserved **byte-identical** — `suspend`, `unsuspend`, `revokeRole`, `restoreRole`, `editProviderProfile`, `deleteProviderProfile`, `searchUsers`, `getHistory` all untouched. Existing `// --- Admin writes ---` / `// --- Plan 05-03: read-side queries ---` / `// --- Reads ---` section comments preserved.
- New top-of-file import: `import { ListingModerationError } from './errors';`
- New module-private helper `toListingModerationError(error: unknown): ListingModerationError` below the existing `isAbortError` helper — extracts `axiosErr.response?.data?.error ?? 'unknown'` as the code plus 5 context fields (`listingStatus`, `reasonCategory`, `banner`, `refundId`, `refundFailed`) and `httpStatus` from the axios response.
- 11 new exported types in a `--- Plan 10-04 additions: listing-domain types (LMOB-01) ---` block just above the `ModerationService` object literal:
  - `ListingReasonCategory` (5-value union: `'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other'`)
  - `SuspendListingBody`, `ArchiveListingBody`, `DeleteListingBody` (`{ reasonCategory, note? }`)
  - `RestoreListingBody` (`{ note? }`)
  - `AdminEditListingInput` (structured: 25-field whitelist `fields` + optional `existingImageUrls` + optional `newFiles`)
  - `ListingActionResponse` (success envelope: `{ ok, listing, action }`)
  - `ListingSearchItem`, `SearchListingsQuery`, `SearchListingsResult` (read-side shapes for the Plan 10-03 endpoint)
- New `--- Listing moderation writes (Plan 10-04 / LMOB-01) ---` section appended INSIDE the `ModerationService` object literal with 5 write methods in this order:
  1. `adminEditListing(carId, input)` → PATCH `/api/admin/moderation/listings/:carId`; builds FormData (scalar fields appended as strings; `knownIssues` and `existingImageUrls` as JSON; `newFiles[i]` as `{ uri, type, name }`); explicit `{ headers: { 'Content-Type': 'multipart/form-data' } }` as third arg; catch → `throw toListingModerationError(error)`.
  2. `suspendListing(carId, body)` → PATCH `/api/admin/moderation/listings/:carId/suspend`.
  3. `archiveListing(carId, body)` → PATCH `/api/admin/moderation/listings/:carId/archive`.
  4. `deleteListing(carId, body)` → PATCH `/api/admin/moderation/listings/:carId/delete`.
  5. `restoreListing(carId, body = {})` → PATCH `/api/admin/moderation/listings/:carId/restore`; default body argument `{}` for the no-note path.
- New `--- Listing moderation reads (Plan 10-04 / LMOB-01) ---` section with `searchListings(query, config?)` → GET `/api/admin/moderation/listings`; defensive return shape (`rows: []` when missing, `nextCursor: null` fallback); `isAbortError` guard re-throws cancellation silently; non-cancel errors logged then re-thrown **raw** (NOT wrapped) so 500-class infra bugs surface to the screen's `EmptyState` per RESEARCH lines 916-921.

### `src/services/moderation/__tests__/listingMethods.test.ts` (created, 542 lines, 25 tests)

Single test file with 7 `describe` blocks covering every behavior contract from Task 1 + Task 3:

| Block | Method | Tests | Coverage |
|-------|--------|-------|----------|
| A | suspendListing | 3 | path string, response passthrough, 400 already_in_state → ListingModerationError |
| B | archiveListing | 3 | path string, response passthrough, 400 invalid_payload → ListingModerationError |
| C | deleteListing | 3 | path string, response passthrough, 403 cannot_moderate_own_listing → ListingModerationError |
| D | restoreListing | 3 | path string, default-{} body branch, 400 not_moderated → ListingModerationError |
| E | adminEditListing | 4 | FormData assembly (scalars/JSON arrays/files; undefined field skipped), multipart Content-Type header, 400 invalid_make → ListingModerationError, listingStatus+reasonCategory context preservation |
| F | searchListings | 6 | path+params+signal, defensive `{rows:[], nextCursor: null}`, 3 cancel-signature variants re-thrown silently (axios.isCancel / CanceledError / AbortError), 500-class non-cancel re-thrown **raw** + logged |
| anti-pattern | n/a | 3 | AuthService.ts has 0 listing-mod names; http/client.ts keeps exactly 2 interceptors; errors.ts ModerationError union contains 0 listing codes |

The test file installs a `FormDataStub` (replaces `global.FormData` for the suite's lifetime via `beforeAll`/`afterAll`) so Block E's assembly assertions read entries off a simple list rather than depending on RN polyfill internals. The stub still satisfies `expect(formData).toBeInstanceOf(FormData)` because it IS the global `FormData` for the test scope.

## Grep Invariants Now Enforced

| # | Invariant | Command | Expected | Actual |
|---|-----------|---------|----------|--------|
| 1 | AuthService.ts free of listing-mod names | `grep -c "suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing\|searchListings" src/services/AuthService.ts` | `0` | `0` ✓ |
| 2 | http/client.ts interceptor count | `grep -c "interceptors.response.use" src/services/http/client.ts` | `2` | `2` ✓ |
| 3 | ModerationService toListingModerationError usage | `grep -c "toListingModerationError" src/services/moderation/ModerationService.ts` | `≥ 6` | `7` ✓ |
| 4 | ModerationService throw toListingModerationError | `grep -c "throw toListingModerationError" src/services/moderation/ModerationService.ts` | `5` (exact) | `5` ✓ |
| 5 | ModerationService multipart header | `grep -c "Content-Type.*multipart/form-data" src/services/moderation/ModerationService.ts` | `1` | `1` ✓ |
| 6 | ModerationService listing-mod method count | `grep -c "adminEditListing\|suspendListing\|archiveListing\|deleteListing\|restoreListing\|searchListings" src/services/moderation/ModerationService.ts` | `≥ 6` | `9` (5 method definitions + section-comment header + 3 type-name references) ✓ |
| 7 | Anti-pattern guards live in tests | `grep -c "anti-pattern guards" src/services/moderation/__tests__/listingMethods.test.ts` | `≥ 1` | `1` ✓ |

## Verification Evidence

- `npx jest src/services/moderation/__tests__/listingMethods.test.ts --bail` — **25/25 green** in 0.6s.
- `npx jest src/services/moderation/__tests__/` — **6 suites / 60 tests green** (no regression on `errors.test.ts`, `listingErrors.test.ts`, `ModerationService.test.ts`, `ModerationService.searchUsers.test.ts`, `ModerationService.getHistory.test.ts`).
- All 7 grep invariants pass at the shell level (transcribed in table above).
- RED gate confirmed at Task 1: 22/22 fail with `TypeError: ModerationService.<method> is not a function`. GREEN gate confirmed at Task 2: 22/22 → green after Task 2 implementation. Anti-pattern guards added at Task 3: 25/25 green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pitfall 9 comment broke a plan grep invariant**
- **Found during:** Task 2 verification (running the plan's 4-grep block immediately after the GREEN test pass).
- **Issue:** The initial Pitfall 9 explanatory comment used the literal phrase `Content-Type: multipart/form-data`, which made `grep -c "Content-Type.*multipart/form-data" src/services/moderation/ModerationService.ts` return `2` instead of the plan's expected `1`. The verification block explicitly says the count should reflect only the `headers` literal in `adminEditListing`.
- **Fix:** Rephrased the comment to `EXPLICIT multipart content-type header` (no embedded `Content-Type: multipart/form-data` substring). Semantic content preserved; grep invariant restored to `1`.
- **Files modified:** `src/services/moderation/ModerationService.ts` (one comment line).
- **Commit:** Folded into `97281ee` (the Task-2 GREEN commit) — single atomic state.

No other deviations. Tasks 1 and 3 executed exactly as written; Block E's optional FormDataStub substitution (anticipated in Task 1 `<action>` text) was used and behaved as planned.

## Threat Model Status

All threat-register entries from the plan frontmatter discharged at this plan's scope boundary:

- **T-10-01 (Elevation via listing-mod methods)** — Mitigated. Mobile NEVER pre-checks `isAdmin` to skip these calls; every method delegates unconditionally to `apiClient`, which forwards the Bearer token. Backend `requireAdmin` + `denySelfModerationListing` (Phase 7+8) are the authoritative gates. 4xx responses surface via `ListingModerationError.code` for screen-level banners (Plan 08).
- **T-10-02 (Spoofing via wrong interceptor)** — Mitigated. Anti-pattern guard 2 asserts `interceptors.response.use` count remains exactly `2` in `http/client.ts`. Listing 4xx errors (`already_in_state`, `cannot_moderate_own_listing`, `invalid_make`, etc.) are NOT routed through the user-suspension 403 interceptor — confirmed because the helper builds a `ListingModerationError` directly in `ModerationService.ts`, bypassing the interceptor's `ACCOUNT_SUSPENDED` discriminator entirely.
- **T-10-03 (PII leak via search)** — Mitigated at the backend (Plan 10-03). Mobile blindly forwards the `q` param to `/api/admin/moderation/listings` — backend whitelists q-search fields.
- **T-10-04 (Admin sees only active rows)** — Mitigated at the backend (Plan 10-03). Backend defaults to admin-sees-all via `setOptions({ includeAllListingStatuses: true })`. Mobile doesn't pass any visibility flag.
- **T-10-06 (Audit blur user/listing domains)** — Mitigated. `toListingModerationError` returns ONLY `ListingModerationError` (never widens `ModerationError`); anti-pattern guard 3 enforces at the source level (errors.ts ModerationError class block contains no listing codes).
- **T-10-multipart (Edit upload silently serialized as JSON)** — Mitigated. The `adminEditListing` method passes `{ headers: { 'Content-Type': 'multipart/form-data' } }` explicitly. Block E test E2 asserts the headers object literal; Block E test E1 asserts the FormData append shape. A regression that drops the third arg fails both tests.

No new threat flags emerged — this plan adds zero network endpoints (delegating to existing Phase 7/8/10-03 routes), zero auth paths, zero file-access patterns at the trust boundary, zero schema changes.

## Requirements Status

`LMOB-01` is listed in this plan's frontmatter `requirements:` field. **NOT marked complete at this plan.** Rationale: LMOB-01 requires both the substrate (this plan) AND the screen-level wiring (Plans 10-08 CarDetails, 10-09 SellCar admin-edit, 10-10 AdminModeration Listings tab) to be observable as a shipped capability. Premature tickoff would falsely report a feature when the methods exist but no screen calls them. Marking-complete deferred to the wave that lands the final UI consumer. Pattern matches Plan 10-01 substrate handling (LMOB-01 / LMOB-02 deferred there too).

## What Unblocks

- **Plan 10-05** (interceptor non-regression tests + CarDetailsScreen apiClient migration): the 3 anti-pattern guards in this plan already cover the http/client.ts interceptor-count invariant; Plan 10-05 can extend with positive cases (e.g., a 409 `listing_not_available` mocked at apiClient level surfaces as `ListingModerationError` and does NOT log the admin out).
- **Plan 10-08** (CarDetailsScreen wiring): can `import { ModerationService, ListingModerationError } from '...'` and branch on `error instanceof ListingModerationError` for the admin-action error banner.
- **Plan 10-09** (SellCar admin-edit branch): can call `ModerationService.adminEditListing(carId, { fields, existingImageUrls, newFiles })` with structured input — the service assembles FormData centrally. SellCarScreen's submit branch stays readable; multipart Content-Type header is set inside the service.
- **Plan 10-10** (AdminModeration Listings tab): can call `ModerationService.searchListings({ status, q, cursor, limit }, { signal })` with the same AbortController pattern as the existing `searchUsers` Users tab.

## Self-Check: PASSED

- File created: `src/services/moderation/__tests__/listingMethods.test.ts` — FOUND
- File modified: `src/services/moderation/ModerationService.ts` — FOUND (existing methods byte-preserved verified by running pre-existing test suites green)
- Commit exists: `3fc1349` — FOUND
- Commit exists: `97281ee` — FOUND
- Commit exists: `821edaf` — FOUND
- 25/25 tests in listingMethods.test.ts — GREEN
- 60/60 tests across all 6 suites in moderation/__tests__ — GREEN
- All 7 grep invariants — VERIFIED at the shell

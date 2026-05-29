---
phase: 08-admin-listing-moderation-endpoints-backend
plan: 05
subsystem: backend / listing-moderation-endpoints
tags: [backend, moderation, listing, restore, inverse-transition, transactions, audit, LADM-05, wave-2, history-preservation]
dependency_graph:
  requires:
    - "Plan 08-01 Wave-1 substrate (listingService.js skeleton, listingSchemas.restoreListingSchema, listingErrors.js, denySelfModerationListing.js)"
    - "Plan 08-02 canonical pattern (suspendListing body shape + KNOWN_LISTING_ERRORS + handleListingServiceError)"
    - "Plans 08-03 + 08-04 substitution-only precedents (archiveListing + deleteListing bodies)"
    - "Phase 7 substrate (Car.js status/audit fields, ListingModerationAction model + 6 append-only pre-hooks, listingRouter.js /ping scaffold)"
    - "../backend-services/carEx-services repo (sibling of carEx)"
    - "Plan 08-04 leaving status='deleted' documents in MongoDB (soft-delete invariant) so Restore can find and flip them back to 'active'"
  provides:
    - "PATCH /api/admin/moderation/listings/:carId/restore endpoint (LADM-05)"
    - "restoreListing service body — fourth concrete consumer of the canonical Phase-8 audit-then-Car transactional shape, distinguished by the INVERSE transition semantics (D-C body shape, D-C-1 field-clear, D-C-2 moderator update, Pitfall 10 not_moderated)"
    - "End-to-end completion of the four state-transition handlers (Suspend / Archive / Delete / Restore); only Edit (Plan 08-06) remains"
  affects:
    - "Plan 08-06 (Edit) — independent surface; uses multer multipart and computes fieldDiff but no status transition. Last stub in listingService.js to land"
    - "Phase 9 (read-time enforcement) — restore semantics inform admin-UI restore button visibility against a deleted/archived/suspended listing"
    - "Phase 10 mobile (LMOB-* / LUI-*) — restore endpoint surface ready to wire from CarDetails admin bottom sheet"
tech_stack:
  added: []
  patterns:
    - "Fourth substitution-only mirror of Plan 08-02 canonical pattern (target='active', action='restore') with FIVE intentional divergences locked in source + at grep + at test layer: (1) signature has NO reasonCategory parameter (D-C), (2) same-state guard throws not_moderated NOT the cross-action no-op code (Pitfall 10), (3) audit row reasonCategory: null (D-C), (4) Car $set CLEARS moderationReason + moderationNote to null (D-C-1), (5) Car $set UPDATES moderatedBy + moderatedAt to the restoring admin (D-C-2)"
    - "LADM-05 history-preservation invariant locked at TWO independent layers: (1) Phase 7's 6 append-only pre-hooks on ListingModerationAction.js (schema layer) — any in-handler bug attempting to edit prior rows throws at save time; (2) integration test 5 (test-layer) — seeds one prior suspend audit row, captures _id, runs Restore, asserts the original row is byte-identical after Restore AND countDocuments({listingId}) === 2"
    - "Grep-gate doc-comment phrasing discipline (third occurrence in Phase 8 after Plan 08-04 same-issue): plan's verify script is a literal grep that does not distinguish source comments from runtime code. Rephrased the inline comment that originally mentioned the cross-action no-op code literal to instead reference 'the cross-action no-op code' — preserves prescriptive intent (and is arguably clearer) while satisfying the grep gate. Plan 08-04 documented this same Rule 1 trade-off"
key_files:
  created:
    - "../backend-services/carEx-services/__tests__/listing-moderation/restoreListing.test.js"
  modified:
    - "../backend-services/carEx-services/src/moderation/listingService.js (restoreListing body replaces Wave-1 stub; suspendListing + archiveListing + deleteListing + 1 remaining stub unchanged)"
    - "../backend-services/carEx-services/src/moderation/listingRouter.js (+PATCH /:carId/restore route; Suspend + Archive + Delete routes + /ping + KNOWN_LISTING_ERRORS + handleListingServiceError preserved byte-identical)"
decisions:
  - "restoreListing body is the fourth substitution-only mirror of Plan 08-02 with FIVE Restore-specific divergences. Confirms the canonical Phase-8 audit-then-Car transactional shape generalizes across four labels (suspend / archive / delete / restore) — the structure is stable; per-label divergences fit into the shape without restructuring it. Plan 08-06 Edit is the only handler that will diverge structurally (no status transition; fieldDiff instead)"
  - "Plan task ordering pivoted from author-order (service → router → tests) to TDD-canonical (tests RED → service GREEN → router) — fourth consecutive pivot in Phase 8 (matches Plans 08-02 + 08-03 + 08-04); mandatory under MVP+TDD gate when tdd=\"true\" is set on behavior-adding tasks"
  - "Inline doc comments inside restoreListing function body rephrased to avoid the literal 'already_in_state' token string — plan's verify script is a literal grep that forbids that token anywhere in the restoreListing function body (Pitfall 10 grep-lock against accidentally using the cross-action no-op code). Rephrased two comment blocks to use 'the cross-action no-op code' descriptor instead. Same Rule 1 trade-off Plan 08-04 made for its LADM-04 SOFT-DELETE comment block — preserve the gate's machine-checkability over verbatim prose, because the gate is the load-bearing artifact"
  - "LADM-05 history preservation enforced at TWO independent layers — schema-layer (Phase 7's 6 append-only pre-hooks on ListingModerationAction.js prevent any in-handler bug from editing prior rows) AND test-layer (test 5 'LADM-05 history preservation' seeds one prior 'suspend' audit row via collection.insertOne, captures its insertedId, runs service.restoreListing, then asserts (a) the row at that _id is byte-identical post-Restore — same action, fromStatus, toStatus, reasonCategory, adminUid, createdAt; AND (b) countDocuments({listingId}) === 2). Test 5 fails immediately if any future refactor introduces an update-in-place on the audit chain — the original _id's action would change OR the countDocuments would drop to 1"
  - "Three happy-path tests for fromStatus='suspended', 'archived', 'deleted' — proves restore is symmetric to all three Wave-2 transition labels and proves the soft-delete invariant from Plan 08-04 holds (Plan 08-04 leaves documents at status='deleted' in MongoDB; Plan 08-05 finds them and flips them back to 'active'). Three explicit tests instead of test.each for diagnostic clarity on failure"
  - "Same-state guard fires BEFORE session.startSession() (Pitfall 10 fast-path mirrored from Suspend/Archive/Delete D-B-1 placement) — verified explicitly in test 4 (countDocuments === 0 of audit rows after rejected not_moderated call). Already-active throws not_moderated WITHOUT paying transaction overhead, identical efficiency to the same-state fast-paths on Suspend/Archive/Delete"
  - "D-02 thin projection shape: listing.moderatedBy === restoring admin (NOT the prior moderator) and listing.moderatedAt === fresh Date (NOT the prior suspend/archive/delete timestamp) — D-C-2 surfaces directly in the response. For 'who suspended this last', mobile clients must consult the audit chain (Plan 08-06 GET /history-by-listing endpoint will surface this; not in scope for Plan 08-05)"
  - "Test seeds Car docs with explicit moderationReason='spam'/'fraud'/'inactive_seller' AND moderationNote='original note' AND moderatedBy='admin-original' AND moderatedAt=<fixed Date> BEFORE Restore — gives D-C-1 clear-on-restore assertions a known starting point so a regression that preserves any of those four fields produces a diagnosable Jest diff. Without seeded prior values, a D-C-1 regression that 'forgets' to clear would silently pass against undefined fields"
  - "Test 1 happy path explicitly asserts moderatedAt.getTime() !== prior timestamp — locks D-C-2 (fresh Date stamp). Without this assertion, a regression that preserves the prior moderatedAt value alongside flipping moderationReason/moderationNote to null would not be caught by the other assertions"
  - "Router NO multer addition — D-D-1 lock preserved across all four Wave-2 plans; Restore is JSON-body only (optional note). grep -c upload.array listingRouter.js still returns 0"
  - "Router NO KNOWN_LISTING_ERRORS additions — all 3 codes Restore emits (listing_not_found / not_moderated / cannot_moderate_own_listing) were pre-registered by Plan 08-02; Plan 08-02's foresight (registering all 10 Wave 2/3 codes upfront) paid off across Plans 08-03/04/05 — all three downstream plans added route blocks without amending the registry"
metrics:
  duration: "3m49s"
  completed: "2026-05-29"
  tasks_executed: 3
  files_created: 1
  files_modified: 2
  test_count_before: 78
  test_count_after: 85
  test_count_delta: 7
---

# Phase 8 Plan 05: Restore Endpoint (LADM-05) Summary

Wave-2 fourth and final transition endpoint for Phase 8 — implemented `PATCH /api/admin/moderation/listings/:carId/restore` end-to-end (router + service + integration tests) as the INVERSE-transition mirror of Plans 08-02/03/04 with five intentional Restore-specific divergences (D-C body shape, Pitfall 10 not_moderated code, D-C audit reasonCategory: null, D-C-1 clear-on-restore, D-C-2 moderator update) and a dedicated LADM-05 history-preservation test. The four-handler state-transition surface (Suspend / Archive / Delete / Restore) is now complete; only Edit (Plan 08-06) remains to close Phase 8.

## Outcome

All 3 tasks executed in TDD-canonical order (RED test → GREEN service → router substrate) with one inline-comment phrasing adjustment to satisfy a grep-strict verify script (documented in Deviations). Backend listing-moderation test count: **78 → 85 (+7 new tests; all green)**. Plans 08-01 + 08-02 substrate consumed BYTE-IDENTICAL — no edits to `listingSchemas.js` (`restoreListingSchema` shipped already in Plan 08-01), `denySelfModerationListing.js`, `listingErrors.js`, the `suspendListing`/`archiveListing`/`deleteListing` bodies, or `KNOWN_LISTING_ERRORS`. The 1 remaining handler stub (`editListing`) still throws `not_implemented` for Plan 08-06.

LADM-05 acceptance criteria all green:
- Suspended → active, archived → active, deleted → active all return 200 with thin D-02 payload (`{ ok, listing: {_id, status, moderatedBy, moderatedAt}, action: {_id, action, fromStatus, toStatus, createdAt} }`)
- One audit row per successful restore (action='restore', fromStatus=<prior>, toStatus='active', **reasonCategory: null** per D-C, reasonNote populated or null)
- **Pitfall 10 lock**: Restore on already-active throws `not_moderated` (NOT the cross-action no-op code) with ZERO audit rows (fast-path before startSession)
- **D-C-1 clear-on-restore**: `Car.moderationReason` and `Car.moderationNote` set to `null` inside the transaction (verified by test 1/2/3 + test 7 negative shape lock — those fields must NOT appear in the response)
- **D-C-2 moderator update**: `Car.moderatedBy` set to the restoring admin (NOT the prior moderator) AND `Car.moderatedAt` set to a fresh Date (NOT the prior suspend/archive/delete timestamp) — explicitly verified by `getTime() !== priorTimestamp.getTime()` in test 1
- **LADM-05 history preservation**: the original 'suspend' audit row seeded before Restore is BYTE-IDENTICAL after Restore (test 5 captures the row's _id from collection.insertOne, then post-Restore reads the row by that _id and asserts every field — action='suspend', fromStatus='active', toStatus='suspended', reasonCategory='spam', reasonNote, adminUid, adminEmail, createdAt). countDocuments({listingId}) === 2 (original + new restore row)
- Self-moderation blocked by `denySelfModerationListing` middleware mounted FIRST in the chain (D-04 applies even on Restore)
- Audit + Car update atomic under `session.withTransaction()` (Plan 08-01 atomicity tests still green proving the pattern)

## What Shipped

### TDD pivot reprise (fourth instance in Phase 8)

Plan task ordering was: Task 1 (service body) → Task 2 (router) → Task 3 (tests). Executor pivoted to TDD-canonical ordering (Task 3 → Task 1 → Task 2), same as Plans 08-02 + 08-03 + 08-04. Substantive deliverables unchanged; pivot is mandatory under the MVP+TDD gate when `tdd="true"` is set on the behavior-adding tasks.

### Task 3 (RED) — `restoreListing.test.js` (commit `db6b5df`)

Created `__tests__/listing-moderation/restoreListing.test.js` with 7 integration tests against the not-yet-implemented `service.restoreListing`. Initial run: 7/7 failed with `ListingServiceError: not_implemented` as expected.

Tests (per D-16 catalog + plan's 7-test floor):

1. **Happy path suspended → active** — asserts audit row fields (action='restore' / fromStatus='suspended' / toStatus='active' / **reasonCategory=null** per D-C / reasonNote='appeal accepted' / listingId / sellerUid / adminUid='admin-restorer' / adminEmail='restorer@test.local') + Car post-state fields (**status='active' / moderationReason=null** D-C-1 / **moderationNote=null** D-C-1 / **moderatedBy='admin-restorer'** D-C-2 / moderatedAt instanceof Date / **moderatedAt.getTime() !== priorTimestamp.getTime()** D-C-2 fresh Date) + response shape (5+5 keys, literal values)
2. **Happy path archived → active** — audit.fromStatus='archived'; same D-C-1 clear + D-C-2 update + audit reasonCategory:null assertions; reasonNote=null (no note submitted)
3. **Happy path deleted → active (soft-deleted doc restorable)** — proves Plan 08-04's soft-delete invariant interlocks with Plan 08-05's restore: a Car at status='deleted' is findable AND restorable; audit.fromStatus='deleted'; D-C-1 + D-C-2 + reasonCategory:null assertions all hold
4. **not_moderated rejection on already-active (Pitfall 10)** — seeds Car at status='active'; expects `rejects.toThrow('not_moderated')`; asserts ListingModerationAction.countDocuments({listingId}) === 0 (zero-audit-row fast-path) + Car.status unchanged. Inline comment cites Pitfall 10 verbatim
5. **LADM-05 history preservation** — seeds Car at status='suspended' + seeds ONE prior audit row via `ListingModerationAction.collection.insertOne({...})` representing the original suspend. Captures `insertResult.insertedId` as `originalRowId`. Pre-Restore: countDocuments === 1. Calls service.restoreListing({adminUid:'admin-new', ...}). Post-Restore: countDocuments === 2. Then reads `ListingModerationAction.collection.findOne({_id: originalRowId})` and asserts EVERY field on the original row is byte-identical (action='suspend', fromStatus='active', toStatus='suspended', reasonCategory='spam', reasonNote='original note', adminUid='admin-original', adminEmail='orig@x', createdAt deeply equal to seeded sentinel). Then reads the new 'restore' row and asserts fromStatus='suspended', toStatus='active', reasonCategory:null, adminUid='admin-new'
6. **listing_not_found on ghost ObjectId** — `rejects.toThrow('listing_not_found')`
7. **Response shape D-02 thin projection** — `Object.keys(result.listing).sort()` equals `['_id', 'moderatedAt', 'moderatedBy', 'status']` AND `Object.keys(result.action).sort()` equals `['_id', 'action', 'createdAt', 'fromStatus', 'toStatus']`. Negative shape asserts NO description / imageUrls / price / **moderationReason / moderationNote** leak (D-C-1 cleared fields MUST NOT appear in the response payload)

Replica-set fixture via `_helpers/mongoReplSet`. Cars seeded via `Car.collection.insertOne(...)` (mirrors Plans 08-02/03/04 seed helper byte-equivalent). Audit rows in test 5 seeded via `ListingModerationAction.collection.insertOne(...)` (raw collection bypass of Phase 7's 6 append-only pre-hooks — those hooks fire on Mongoose model writes; seeding via collection.insertOne lets us pre-stage the historical state without triggering them).

### Task 1 (GREEN) — `restoreListing` body (commit `444782e`)

Replaced the Wave-1 stub in `src/moderation/listingService.js` with the canonical body customized for Restore semantics. After this commit: 7/7 restoreListing tests green; suspendListing + archiveListing + deleteListing + 1 remaining stub unchanged.

**Body diff vs. `suspendListing` (the FIVE structural Restore-specific differences):**

| Position | Suspend value | Restore value | Rationale |
|---|---|---|---|
| Function signature | `{ adminUid, adminEmail, carId, reasonCategory, note }` | `{ adminUid, adminEmail, carId, note }` | D-C body shape |
| Defensive arg check | `!adminUid \|\| !adminEmail \|\| !carId \|\| !reasonCategory` | `!adminUid \|\| !adminEmail \|\| !carId` (no reasonCategory) | D-C — reasonCategory not required |
| Same-state guard literal | `current.status === 'suspended'` → `already_in_state` | `current.status === 'active'` → `not_moderated` | Pitfall 10 — distinct code |
| Audit `action` / `toStatus` | `'suspend'` / `'suspended'` | `'restore'` / `'active'` | Inverse transition |
| Audit `reasonCategory` | `reasonCategory` (parameter) | `null` literal | D-C — Restore has no reason |
| Car `$set.status` | `'suspended'` | `'active'` | Inverse transition |
| Car `$set.moderationReason` | `reasonCategory` (parameter) | `null` literal | **D-C-1 clear-on-restore** |
| Car `$set.moderationNote` | `note ?? null` | `null` literal | **D-C-1 clear-on-restore** |
| Car `$set.moderatedBy` | `adminUid` | `adminUid` (identical — restoring admin) | **D-C-2 moderator update** (same code, different intent — restoring admin not the prior moderator) |
| Car `$set.moderatedAt` | `moderatedAt` (fresh Date) | `moderatedAt` (fresh Date — identical mechanism) | **D-C-2 moderator update** (fresh timestamp, NOT prior timestamp) |
| Return `listing.status` | `'suspended'` | `'active'` | Inverse transition |
| Return `action.action` / `toStatus` | `'suspend'` / `'suspended'` | `'restore'` / `'active'` | Inverse transition |
| Header comment | "atomicity contract D-06 D-08 D-B-1 D-15" | "atomicity contract + D-C body shape + D-C-1 clear + D-C-2 update + Pitfall 10 not_moderated — five Restore-specific divergences documented at length" | Future readers must not 'optimize' D-C-1 by preserving prior reason fields |

Everything else — pre-txn read with double-bypass setOptions, withTransaction(audit-then-Car), array-form create with { session }, matchedCount !== 1 TOCTOU guard, finally endSession, thin D-02 response built from in-memory state — is byte-equivalent to `suspendListing`/`archiveListing`/`deleteListing`. This is the Plan 08-05 design intent: the canonical pattern generalizes to a fourth label with five intentional divergences that fit into the shape WITHOUT restructuring it.

**Field-clear + field-update list inside restoreListing $set (exact source):**

```js
$set: {
  status: 'active',           // target
  moderationReason: null,     // D-C-1 clear-on-restore
  moderationNote: null,       // D-C-1 clear-on-restore
  moderatedBy: adminUid,      // D-C-2 update (restoring admin)
  moderatedAt,                // D-C-2 update (fresh Date)
}
```

**Inline-rationale-comment evidence:**

```bash
$ grep -c "D-C-1" src/moderation/listingService.js
4   # 1 header docstring + 2 inline comments + 1 in restoreListing function body
$ grep -c "D-C-2" src/moderation/listingService.js
4   # 1 header docstring + 2 inline comments + 1 in restoreListing function body
$ grep -c "Pitfall 10" src/moderation/listingService.js
2   # 1 header docstring + 1 inline at same-state guard
$ grep -c "do NOT \"optimize\"" src/moderation/listingService.js
1   # the load-bearing future-reader warning
```

**Pitfall 10 grep-lock evidence (verify-script gate):**

```bash
$ node -e "const fs=require('fs');const src=fs.readFileSync('./src/moderation/listingService.js','utf8');const dm=src.match(/async function restoreListing[\s\S]*?\n\}/);console.log('already_in_state in restoreListing body:', /already_in_state/.test(dm[0]) ? 'FAIL' : 'PASS');"
already_in_state in restoreListing body: PASS
```

The restoreListing function body contains ZERO matches for the cross-action no-op code literal — Pitfall 10 is locked at the source level.

### Task 2 — router additions (commit `5a84147`)

Edited `src/moderation/listingRouter.js`. The Phase 7 `/ping` route, Plan 08-02 Suspend route, Plan 08-03 Archive route, Plan 08-04 Delete route, KNOWN_LISTING_ERRORS Set, and handleListingServiceError function are ALL BYTE-IDENTICAL post-edit (one literal grep match each). New material is a single new route block at the end of the router:

- **`PATCH /:carId/restore`** — `denySelfModerationListing` middleware first, `restoreListingSchema.safeParse(req.body || {})` second (parse-failure → 400 `invalid_payload` with Zod issues), `service.restoreListing({ adminUid: req.admin.uid, adminEmail: req.admin.email, carId: req.params.carId, note: parsed.data.note })` — dispatch object intentionally OMITS any `reasonCategory` field (D-C), success → `res.json({ ok: true, listing, action })`, failure → `handleListingServiceError(err, res, 'restore')`.
- **NO new top-of-file requires** — `service`, `schemas`, `denySelfModerationListing` all imported in Plan 08-02.
- **NO additions to `KNOWN_LISTING_ERRORS`** — the existing 10 codes cover Restore's possible failures (`listing_not_found`, `not_moderated`, `invalid_payload`, `cannot_moderate_own_listing`).
- **NO multer** — D-D-1 lock; Edit-only in Plan 08-06. `grep -c "upload.array" listingRouter.js` = 0.

**reasonCategory grep-gate evidence (restore route block):**

```bash
$ node -e "const fs=require('fs');const src=fs.readFileSync('./src/moderation/listingRouter.js','utf8');const rm=src.match(/router\.patch\('\/:carId\/restore'[\s\S]*?\}\);/);console.log('reasonCategory in restore route block:', /reasonCategory/.test(rm[0]) ? 'FAIL' : 'PASS');"
reasonCategory in restore route block: PASS
```

The restore route's full block (from `router.patch('/:carId/restore'` to the first `});`) contains ZERO matches for `reasonCategory` — D-C is locked at the route-dispatch level.

Phase 7 regression check: `__tests__/listing-moderation/listingModerationRateLimiter.test.js` runs 3/3 green in isolation.

## Verification Spec Results

All 4 verification spec items from `08-05-PLAN.md` pass:

1. `npx jest __tests__/listing-moderation/ --silent` → **13 suites / 85 tests passed**. Floor was 33 (Phase 7) + 27 (Plan 08-01) + 8 (Plan 08-02) + 5 (Plan 08-03) + 5 (Plan 08-04) + 7 (this plan) = 85; actual 85 matches. ✓
2. `grep -c "router.patch('/:carId/" src/moderation/listingRouter.js` = **4** (Suspend + Archive + Delete + Restore; Edit not yet). ✓
3. `grep -c "not_moderated" src/moderation/listingService.js` = **5** (≥1 — appears in restoreListing's docstring + inline same-state guard comment + the actual throw statement + 2 related explanatory comments). ✓
4. The restore route block does NOT contain `reasonCategory` (grep gate from Task 2 — zero matches in the route block). ✓

## LADM-05 History-Preservation Test — Exact Evidence

Test 5 (`'LADM-05 history preservation: prior audit row byte-identical, new restore row appended'`) seeds a Car at status='suspended' AND seeds ONE prior `ListingModerationAction` document via `collection.insertOne()` (raw collection to bypass Phase 7's 6 append-only pre-hooks during seed setup). Captures the `insertedId` from the insertOne result, then runs `service.restoreListing({adminUid:'admin-new', adminEmail:'new@x', carId, note:null})`.

| Assertion | Type | Value |
|---|---|---|
| `ListingModerationAction.countDocuments({listingId})` (pre-call) | toBe | `1` (original suspend row) |
| `ListingModerationAction.countDocuments({listingId})` (post-call) | toBe | `2` (original suspend + new restore) |
| `collection.findOne({_id: originalRowId})` (post-call) | not.toBeNull | non-null doc — original _id round-trip succeeds |
| `originalAfter.action` | toBe | `'suspend'` (history NEVER rewritten) |
| `originalAfter.fromStatus` | toBe | `'active'` (preserved) |
| `originalAfter.toStatus` | toBe | `'suspended'` (preserved) |
| `originalAfter.reasonCategory` | toBe | `'spam'` (preserved) |
| `originalAfter.reasonNote` | toBe | `'original note'` (preserved) |
| `originalAfter.adminUid` | toBe | `'admin-original'` (preserved — NOT 'admin-new') |
| `originalAfter.adminEmail` | toBe | `'orig@x'` (preserved) |
| `originalAfter.createdAt` | toEqual | `Date('2026-01-10T00:00:00.000Z')` (sentinel preserved) |
| `findOne({listingId, action:'restore'})` | not.toBeNull | new restore row exists |
| `restoreRow.fromStatus` | toBe | `'suspended'` |
| `restoreRow.toStatus` | toBe | `'active'` |
| `restoreRow.reasonCategory` | toBeNull | `null` (D-C) |
| `restoreRow.adminUid` | toBe | `'admin-new'` (the restoring admin) |

The `originalRowId` round-trip is the load-bearing assertion: any future refactor that introduces an in-place update on the audit chain (e.g., 'optimizing' by updating the existing suspend row's toStatus to 'active' instead of appending) would either change `originalAfter.action` from 'suspend' to 'restore' OR drop `countDocuments` from 2 to 1 — both trip the test.

## D-C Body-Shape Locks (Schema + Service + Router)

The "Restore has no reasonCategory" invariant is locked at THREE layers:

1. **Schema layer (Plan 08-01)**: `restoreListingSchema = z.object({ note: noteField }).strict()` — `.strict()` rejects `reasonCategory` as `unrecognized_keys` at router-Zod parse time. (Plan 08-01 test asserts this directly.)
2. **Service layer (Plan 08-05 Task 1)**: `restoreListing` function signature destructures ONLY `{ adminUid, adminEmail, carId, note }` — any caller passing `reasonCategory` would silently have it dropped at the function boundary. The defensive arg-check ALSO does not validate it.
3. **Router layer (Plan 08-05 Task 2)**: dispatch object passes ONLY `{ adminUid, adminEmail, carId, note }` to the service — does NOT pass `parsed.data.reasonCategory` (which Zod already rejected anyway). Grep gate forbids `reasonCategory` literal anywhere in the restore route block (verified at zero).

A regression at any one layer is caught by the next layer. The service layer alone would let a buggy router silently ignore an unwanted reasonCategory; the Zod schema alone would let a buggy service caller bypass validation. The three layers together form a defense-in-depth lock on D-C.

## Plan 08-01 + 08-02 + 08-03 + 08-04 Substrate — Consumed Unchanged

`git diff HEAD~3 --stat -- src/moderation/listingErrors.js src/moderation/listingSchemas.js src/moderation/denySelfModerationListing.js` returns ZERO output. The 3 Plan 08-01 substrate modules + Plan 08-02's `suspendListing` body + Plan 08-03's `archiveListing` body + Plan 08-04's `deleteListing` body + KNOWN_LISTING_ERRORS Set + handleListingServiceError function are byte-identical post Plan 08-05. This plan added one new route block + filled one stub body + landed one new test file.

`listingService.js` was modified (Task 1 GREEN replaces the `restoreListing` stub body) but the file's top-level requires, module shape, exported function names, and the bodies of suspendListing + archiveListing + deleteListing + 1 remaining stub (editListing) are byte-identical to their Plan 08-04 state.

## Test Count Before/After

| Suite | Before this plan | After this plan |
|-------|------------------:|----------------:|
| `__tests__/listing-moderation/` | 78 | 85 (+7) |
| Phase 7's 33 baseline tests | 33 (all green) | 33 (all green; preserved) |
| Plan 08-01's 27 Wave-0 tests | 27 (all green) | 27 (all green; preserved) |
| Plan 08-02's 8 suspendListing tests | 8 (all green) | 8 (all green; preserved) |
| Plan 08-03's 5 archiveListing tests | 5 (all green) | 5 (all green; preserved) |
| Plan 08-04's 5 deleteListing tests | 5 (all green) | 5 (all green; preserved) |
| Plan 08-05 new (restoreListing.test.js) | — | 7 |

## Deviations from Plan

**One minor deviation — inline comment phrasing adjusted to satisfy a grep-strict verify script.**

- **Inline rationale comments rephrased to avoid the literal cross-action no-op code token.** The plan Task 1 `<action>` block prescribed an inline comment that called out the distinction between `not_moderated` (Restore-specific) and the cross-action no-op code (Suspend/Archive/Delete same-state). The verbatim phrasing suggested in the plan named the cross-action no-op code by its literal token. That phrasing tripped the plan's own automated verify script — which is a literal grep that does NOT distinguish source comments from runtime code and explicitly forbids the cross-action no-op code literal anywhere in the `restoreListing` function body (the Pitfall 10 grep-lock). Rephrased two comment blocks (the header docstring and the inline same-state-guard comment) to use the descriptor 'the cross-action no-op code (used by Suspend/Archive/Delete when their target is already in their target state)' instead of the literal token. Preserves prescriptive intent (and is arguably clearer because it explains the semantic role rather than naming the token) while satisfying the grep gate. Auto-applied (Rule 1 — no user permission needed) because both formulations communicate the same constraint; documenting the trade-off here so future plan authors know to either (a) keep the grep gate AND use descriptive language in comments, or (b) loosen the grep gate to exclude comment-only matches.

Two implementation choices fell within Claude's discretion:

- **TDD task ordering pivot**: plan task body listed service-body (Task 1) → router (Task 2) → tests (Task 3). Executor pivoted to TDD-canonical ordering: tests FIRST (Task 3 as RED), then service body (Task 1 as GREEN), then router (Task 2). Fourth consecutive pivot in Phase 8 (matches Plans 08-02 + 08-03 + 08-04); commits tagged `test(08-05)` / `feat(08-05)` / `feat(08-05)` matching the RED/GREEN/substrate cadence.
- **Seven tests instead of the plan's 7-test minimum** — landed exactly the plan's 7-test floor. Three explicit happy-path tests (suspended/archived/deleted → active) for diagnostic clarity on failure instead of test.each (plan's `<action>` block allowed author's discretion: "loop with test.each or three explicit tests").

## Authentication Gates

None encountered. All work was local code + local test runs in the sibling backend repo.

## Known Stubs

`src/moderation/listingService.js` still has 1 handler body that throws `new ListingServiceError('not_implemented')`: `editListing` (LADM-01, Plan 08-06). This is INTENTIONAL per the Wave-2/3 split — Plan 08-06 replaces this last stub. The verifier surfaces it but does NOT flag the plan as incomplete; it is explicitly deferred to the named downstream plan.

## TDD Gate Compliance

Phase 8 Plan 05 honored the RED/GREEN cycle on Tasks 1 + 3 (restoreListing service + test):
1. ✓ `test(08-05)` commit at `db6b5df` — 7 failing tests against the not_implemented stub (RED gate)
2. ✓ `feat(08-05)` commit at `444782e` — service body fills stub, 7/7 tests green (GREEN gate)
3. (Task 2 router substrate — `feat(08-05)` at `5a84147` — verified via static checks + Phase 7 rate-limit regression isolation pass + full listing-moderation suite at 85/85 green)

REFACTOR phase: not exercised (no cleanup needed — body landed in canonical substitution-with-divergences form, comments adjusted to satisfy grep gate during GREEN phase). All commits visible in backend git log.

## Self-Check: PASSED

**Files created (verified to exist via `[ -f path ]` in backend repo):**

- `../backend-services/carEx-services/__tests__/listing-moderation/restoreListing.test.js` ✓

**Files modified (verified via `git diff HEAD~3` in backend repo):**

- `../backend-services/carEx-services/src/moderation/listingService.js` ✓ (Wave-1 restoreListing stub replaced with ~135-line canonical body; suspendListing + archiveListing + deleteListing + 1 remaining stub untouched)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` ✓ (+26 lines: 1 new route block; /ping + Suspend + Archive + Delete routes + KNOWN_LISTING_ERRORS + handleListingServiceError byte-identical)

**Commits (verified via `git log --oneline | grep <hash>` in carEx-services repo):**

- `db6b5df` `test(08-05): add failing restoreListing integration tests (LADM-05)` ✓
- `444782e` `feat(08-05): implement restoreListing inverse-transition with D-C clear-on-restore (LADM-05)` ✓
- `5a84147` `feat(08-05): add Restore route to listingRouter.js (LADM-05)` ✓

All three commits land in the BACKEND repo (`carEx-services`), per the cross-repo wiring documented in this plan's frontmatter. The SUMMARY.md commit (this file) lands in the carEx repo.

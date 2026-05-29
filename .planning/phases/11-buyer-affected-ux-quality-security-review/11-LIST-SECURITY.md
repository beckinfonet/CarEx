---
phase: 11-buyer-affected-ux-quality-security-review
artifact: security-review
status: APPROVED
reviewed_by: self
reviewed_at: 2026-05-29
roadmap_criterion: "Phase 11 Success #5 — 5 verdicts PASS before v1.1 tag"
---

# Phase 11 — Security Review (LQUAL-03)

**Scope:** v1.1 Admin Listing Moderation milestone — cross-repo verification before merge to `main`.
**Reviewer:** Self-review (per 11-CONTEXT D-11 — informal, no external auditor).
**Review date:** 2026-05-29
**Repos audited:**

- `carEx` (mobile) — @ commit `49862b329754b8cc3e7657020858d7ba8e0fd438` (branch `worktree-agent-ac2a11ca2c02aa26a`, base of Phase 11 wave 6 work; mirrors `main` content for v1.1)
- `backend-services/carEx-services` (backend) — @ commit `407d26eedf3c72bb4c19897f101d46463054ed15` (branch `main`)

**Structure:** Five sections `(a)-(e)` map verbatim to ROADMAP §Phase 11 Success Criterion 5 sub-items. No 6th criterion invented (per 11-CONTEXT D-11). The trailing "Optional — Additional Hardening Notes" section is auxiliary and not part of the required criteria.

**Phase 11 scope reminder:** Phase 11 introduces **zero new HTTP routes** (Assumption A9). The contracts validated below are inherited from Phase 7 (LSEC-01..03 + LDATA-02..03 substrate), Phase 8 (LADM-* handlers), Phase 9 (LENF-* TOCTOU + 409 enforcement), and Phase 10 (LUI-* admin search + banner extension). This review confirms those shipped contracts still hold at Phase 11 wave-6 HEAD and flags Phase 11-specific concerns (banner copy injection, PII minimization to buyers, defense-in-depth CTA gating, coverage-manifest grep boundary).

---

## (a) Authentication — verifyIdToken runs on every admin listing route

**Verification:**
Grep the backend listing-moderation router + admin router for `verifyIdToken` and `requireAdmin`; cross-reference against the `/api/admin/moderation/listings` mount point in `server.js` and confirm every route declaration in `src/moderation/listingRouter.js` inherits the chain via the app-level mount (Phase 7 D-03 pattern — rate limiter mounted app-level, not router-level).

```bash
# In backend-services/carEx-services/
grep -rn "verifyIdToken\|requireAdmin" src/moderation/listingRouter.js src/admin/router.js
grep -n "/api/admin/moderation/listings" server.js
grep -nE "^router\.(get|post|patch|delete)" src/moderation/listingRouter.js
```

**Evidence:**

App-level mount of the listing moderation surface (server.js):
```
server.js:25:const listingModerationRouter = require('./src/moderation/listingRouter');
server.js:26:const { listingModerationRateLimiter } = require('./src/moderation/listingRateLimit');
server.js:925:app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter);
```

Every Phase 7/8/10 listing-moderation route below inherits the `verifyIdToken + requireAdmin + listingModerationRateLimiter` chain from `server.js:925`:
```
src/moderation/listingRouter.js:134:router.get('/ping', (req, res) => {
src/moderation/listingRouter.js:151:router.get('/', async (req, res) => {           // LUI-04 admin search (Phase 10 Plan 03)
src/moderation/listingRouter.js:171:router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => {
src/moderation/listingRouter.js:196:router.patch('/:carId/archive', denySelfModerationListing, async (req, res) => {
src/moderation/listingRouter.js:221:router.patch('/:carId/delete', denySelfModerationListing, async (req, res) => {
src/moderation/listingRouter.js:248:router.patch('/:carId/restore', denySelfModerationListing, async (req, res) => {
src/moderation/listingRouter.js:287:router.patch('/:carId', uploadImages, denySelfModerationListing, ...)  // LADM-01 Edit
```

Sibling admin router middleware imports (admin store contract):
```
src/admin/router.js:23:const { verifyIdToken } = require('../security/verifyIdToken');
src/admin/router.js:24:const { requireAdmin } = require('../security/requireAdmin');
src/admin/router.js:93:router.get('/users/search', verifyIdToken, requireAdmin, async (req, res) => {
```

Test-suite proof of 401/403/200 behavior on the listing surface (Phase 7 LSEC-01..02):
```
backend __tests__/listing-moderation/requireAdmin.listing.middleware.test.js
  :55:  app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingRouter);
  :69:  test('no Authorization header → 401 unauthenticated', ...)
  :75:  test('malformed Authorization header → 401 unauthenticated', ...)
```

LSEC-03 rate-limit ordering (rate limiter sits after authn/authz so 401/403 cases never trip 429):
```
backend __tests__/listing-moderation/listingModerationRateLimiter.test.js
```

**Phase 11-specific confirmation:** Phase 11 added zero routes (Assumption A9). The grep above enumerates every listing-moderation route under `/api/admin/moderation/listings/*` shipped through wave 6 of Phase 11. All 7 routes (`/ping` + admin search `/` + 5 moderation verbs) inherit the chain.

**Legacy note (NOT in scope for this criterion):** Pre-existing `/api/admin/*` inline routes (status / requests / approve / reject / admin-users / order-status — `server.js:953-1090`) continue to use the legacy `verifyAdminByUid(callerUid)` pattern, mirroring the Phase 6 06-SECURITY.md (a) carry-forward. This review does not regress that pattern; it is tracked for a future cleanup.

**Verdict:** ✅ PASS

---

## (b) Authorization — No callerUid body param trusted on any new listing route

**Verification:**
Grep the new listing surface (backend `src/moderation/listingRouter.js` + `src/moderation/listingService.js`; mobile `src/services/moderation/`) for any `req.body.callerUid` / `body.callerUid` / bare `callerUid` references. The new listing surface MUST source admin identity from `req.admin.uid` (set by `requireAdmin` from the verified Firebase token) and NEVER from the request body.

```bash
# Backend — listing surface
grep -rn "req\.body\.callerUid\|body\.callerUid" src/moderation/listingRouter.js src/moderation/listingService.js
grep -rn "callerUid" src/moderation/
# Mobile — listing-moderation service
grep -rn "callerUid" src/services/moderation/
grep -rn "callerUid" src/components/moderation/ src/screens/CarDetailsScreen.tsx src/screens/ServiceCartScreen.tsx
```

**Evidence:**

Backend `grep -rn "req\.body\.callerUid\|body\.callerUid" src/moderation/listingRouter.js src/moderation/listingService.js` → **zero hits** (exit code 1).

Backend `grep -rn "callerUid" src/moderation/` → **zero hits** across the entire moderation directory.

Mobile `grep -rn "callerUid" src/services/moderation/` → **zero hits**.

Mobile `grep -rn "callerUid" src/components/moderation/ src/screens/CarDetailsScreen.tsx src/screens/ServiceCartScreen.tsx` → **zero hits**.

Listing-router admin identity flow (from `src/moderation/listingRouter.js` Edit handler at line 310, mirrored by Suspend/Archive/Delete/Restore handlers):
```javascript
const result = await service.editListing({
  adminUid: req.admin.uid,        // sourced from verified token (requireAdmin)
  adminEmail: req.admin.email,    // sourced from verified token
  carId: req.params.carId,
  fields: parsed.data,
  uploadedFiles: req.files || [],
});
```

**New listing routes (this milestone + Phases 7-10): zero `callerUid` authorization references.** All admin identity is sourced from `req.admin.uid` / `req.admin.email`, which is populated by the `requireAdmin` middleware from the cryptographically-verified Firebase idToken. The mobile `ModerationService.ts` likewise passes no `callerUid` body field — it relies on the shared http-client Bearer interceptor (Phase 6 MOB-02 + Phase 11 LMOB-02 invariant preserved; see Section (e)).

**Phase 6 06-SECURITY.md (b) precedent applies:** legacy `/api/admin/*` `callerUid`-in-body pattern remains pre-existing tech-debt explicitly out of scope per 11-CONTEXT (mirrors Phase 6 §out-of-scope).

**Verdict:** ✅ PASS

---

## (c) Audit — ListingModerationAction collection rejects updates and deletes at the application layer

**Verification:**
Inspect the `ListingModerationAction` Mongoose model for pre-hook append-only enforcement; grep the rest of the backend codebase for any call site attempting to mutate the collection (verbs: `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, plus legacy `update`/`remove`). Assumption A7 calls for an explicit hook count.

```bash
grep -nE "pre\(|APPEND_ONLY|append-only" src/models/ListingModerationAction.js
grep -rnE "ListingModerationAction\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete|remove)" src/
```

**Evidence:**

Model pre-hooks (`src/models/ListingModerationAction.js:96-102`):
```javascript
const APPEND_ONLY_ERR = new Error('ListingModerationAction is append-only');
listingModerationActionSchema.pre('updateOne',        function () { throw APPEND_ONLY_ERR; });
listingModerationActionSchema.pre('updateMany',       function () { throw APPEND_ONLY_ERR; });
listingModerationActionSchema.pre('findOneAndUpdate', function () { throw APPEND_ONLY_ERR; });
listingModerationActionSchema.pre('deleteOne',        function () { throw APPEND_ONLY_ERR; });
listingModerationActionSchema.pre('deleteMany',       function () { throw APPEND_ONLY_ERR; });
listingModerationActionSchema.pre('findOneAndDelete', function () { throw APPEND_ONLY_ERR; });
```

**Assumption A7 confirmed: exactly 6 pre-hooks present** (matches Phase 6 ModerationAction substrate verbatim). Every standard Mongoose write path that could mutate an existing audit row is intercepted and throws `"ListingModerationAction is append-only"`. Phase 7 Plan 07-08 (LDATA-03) ships the unit test covering this invariant:

```
backend __tests__/listing-moderation/ListingModerationAction.append-only.test.js
```

ROADMAP §Phase 7 Success #5 was the original acceptance gate; Phase 11's LQUAL-02 coverage manifest re-prefixes the describe block as `LDATA-03` so it appears in the Phase 11 coverage manifest as well (Plan 07-07).

Production call-site grep (`ListingModerationAction.<mutation-verb>`) → **zero hits** across `src/`. The only writers are the `session.withTransaction` append paths in `src/moderation/listingService.js`, all of which use the array-form `.create([doc], { session })` (the only mutation form not hooked):
```
src/moderation/listingService.js:343:      const [action] = await ListingModerationAction.create([{
src/moderation/listingService.js:479:      const [action] = await ListingModerationAction.create([{
src/moderation/listingService.js:595:      const [action] = await ListingModerationAction.create([{
src/moderation/listingService.js:712:      const [action] = await ListingModerationAction.create([{
src/moderation/listingService.js:867:      const [action] = await ListingModerationAction.create([{
```
Five `.create()` call sites (one per LADM verb: Suspend / Archive / Delete / Restore / Edit), all transactional, all append-only by construction.

**Verdict:** ✅ PASS

---

## (d) TOCTOU — confirm-booking re-verifies listing status inside the transaction

**Verification:**
Grep the payment paths (`src/payments/confirmBooking.js` + the createPaymentIntent handler in `server.js`) for `session.withTransaction`, `refundAndThrow`, `ListingNotAvailableError`, and the `includeAllListingStatuses: true` bypass flag (Phase 9 D-12) that lets the in-txn refetch see a moderated listing past the Plan 09-02 hide hook. The contract under review: **refund first, throw second** (Phase 9 D-14) so a Stripe charge is never orphaned when the listing flipped non-active between create-payment-intent and confirm-booking.

```bash
grep -nE "session\.withTransaction|refundAndThrow|ListingNotAvailableError" src/payments/confirmBooking.js
grep -nE "Car\.findById|includeAllListingStatuses|listing_not_available" server.js
```

**Evidence:**

Phase 9 LENF-03 cart-add early gate (server.js createPaymentIntent handler — fires BEFORE any Stripe API call):
```
server.js:1100:async function createPaymentIntentHandler(req, res) {
server.js:1113:      const car = await Car.findById(carId)
server.js:1114:        .setOptions({ includeAllListingStatuses: true })  // D-12 bypass
server.js:1115:        .select('status moderationReason')
server.js:1117:      if (car && car.status !== 'active') {
server.js:1118:        const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
server.js:1119:        return res.status(409).json({
server.js:1120:          error: 'listing_not_available',
server.js:1121:          listingStatus: car.status,
server.js:1122:          reasonCategory: car.moderationReason,
server.js:1123:          banner,
server.js:1124:        });
```

ListingNotAvailableError canonical source + import (Phase 9 LENF-03 W-7 — single class instance to keep `instanceof` checks coherent across module-cache boundaries):
```
server.js:36:const { ListingNotAvailableError } = require('./src/payments/refundAndThrow');
src/payments/confirmBooking.js:35:const { refundAndThrow, ListingNotAvailableError, ProviderSuspendedError } = require('./refundAndThrow');
```

In-transaction listing-status re-check (the canonical TOCTOU close-out — Phase 9 D-13):
```
src/payments/confirmBooking.js:113:    await session.withTransaction(async () => {
src/payments/confirmBooking.js:192:      const car = await Car.findById(carId)
src/payments/confirmBooking.js:193:        .setOptions({ includeAllUsers: true, includeAllListingStatuses: true })  // D-12 + Pitfall 1: BOTH bypasses chained so the hide-hook does not 404 a suspended listing inside the transaction
src/payments/confirmBooking.js:194:        .session(session);
src/payments/confirmBooking.js:215:      if (car.status !== 'active') {
src/payments/confirmBooking.js:216:        const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
src/payments/confirmBooking.js:217:        await refundAndThrow(stripe, paymentIntentId, {
src/payments/confirmBooking.js:218:          error: 'listing_not_available',
src/payments/confirmBooking.js:219:          listingStatus: car.status,
src/payments/confirmBooking.js:220:          reasonCategory: car.moderationReason,
src/payments/confirmBooking.js:221:          banner,
src/payments/confirmBooking.js:222:        });
src/payments/confirmBooking.js:223:      }
```

**Refund-first-throw-second contract** (Phase 9 D-14): `refundAndThrow(stripe, paymentIntentId, ...)` issues the Stripe refund OUTSIDE the Mongo transaction (Stripe is not session-aware) BEFORE throwing the `ListingNotAvailableError` that aborts the Mongo transaction. Order: refund → throw → transaction abort. Reverse ordering risks "buyer charged, no order, no refund" on Stripe API failure (the explicit comment at confirmBooking.js:114 documents this).

**Seller-update-vs-buyer-read race** (D-11 mandate): closed via the Phase 9 D-12 pair — the Plan 09-02 `pre(/^find/)` hide hook keeps moderated listings hidden from buyer-side reads, while the in-transaction confirm-booking refetch chains `includeAllListingStatuses: true` to bypass that hook so the moderation flip is visible inside the transaction. Result: a seller (or admin) moderating a listing in the same millisecond window as buyer-clicks-Confirm-Booking either (a) flips status before the in-txn refetch — buyer is refunded and shown the LBUY-01 banner with reasonCategory, or (b) the buyer's transaction commits first and the moderator's mutation observes the now-`booked` listing.

Regression coverage (Phase 9 LENF-03 — 6 confirm-booking cases proving the round-trip):
```
backend __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js
backend __tests__/listing-enforcement/createPaymentIntent.gate.test.js  // 7 cart-add gate cases
```

**Verdict:** ✅ PASS

---

## (e) Deferred-verification disposition + No new hardcoded secrets

**Verification:**
Scan both repos for new hardcoded secret patterns (API keys, JWTs, Mongo URIs, bearer tokens) introduced during the Phase 7-11 v1.1 work; document deferred items (LIST-02 auto-flagging, DEBT-* tech-debt, NOTF-* notifications) per ROADMAP v2 scope-out.

```bash
# Backend — branch diff vs main (backend is currently on main; sweep recent v1.1 commits)
cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services
git log --oneline -20 -p -- '*.js' '*.ts' | grep -iE "^\+.*(AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,})"

# Mobile — on main; git grep current tree for known patterns
cd /Users/beckmaldinVL/development/mobileApps/carEx
git grep -nE 'AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,}' -- '*.ts' '*.tsx' '*.js'
git log --oneline -S "AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas" -- src/services/AuthService.ts
```

**Evidence:**

Backend recent v1.1 commit history scan (Phases 7-10) returned only test-only loopback URIs and zero real credentials:
```
__tests__/listing-enforcement/createPaymentIntent.gate.test.js: process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:0/test';
__tests__/listing-enforcement/listingDetailStatusAware.test.js : process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:0/test';
```
These are test-harness defaults (`127.0.0.1:0/test` — loopback, no auth, port 0) used when `MONGODB_URI` is unset in CI. They are NOT credentials; the `||` short-circuit means the real env var (when set) wins. Acceptable; documented for completeness.

Mobile `git grep -nE 'AIza|sk_live|pk_live|mongodb(\+srv)?://|bearer\s+[A-Za-z0-9._-]{40,}' -- '*.ts' '*.tsx' '*.js'`:
```
src/services/AuthService.ts:9:const API_KEY = 'AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas';
```

Age cross-check:
```
$ git log --oneline -S "AIzaSyB1kh2GEejRfVN_wglYfYzU_zF1HZROqas" -- src/services/AuthService.ts
cd5f6ac authentication added
```
Firebase Web API key dates to commit `cd5f6ac` (`authentication added`, 2026-01-30) — pre-v1.0, pre-Phase-6 milestone, pre-Phase-11 milestone. This is the Phase 6 06-SECURITY.md (e) carry-forward and remains tracked in `CONCERNS.md`, deferred to REL-01/REL-03.

Stripe test publishable key hit:
```
App.tsx:95: <StripeProvider publishableKey="pk_test_51TEgrOJA..."
```
Pre-existing Phase 6 06-SECURITY.md (e) carry-forward. Stripe `pk_test_*` is a test-mode public key, not a secret by Stripe's own classification, but still flagged in `CONCERNS.md` as "should read from env for consistency." Pre-milestone.

**Pre-existing known secrets (NOT introduced by Phase 7-11 v1.1 work, deferred to REL-01/REL-03 per REQUIREMENTS.md):**
- Firebase Web API key in `src/services/AuthService.ts:9` — Phase 5 CONCERNS.md (landed 2026-01-30 in commit `cd5f6ac`)
- Stripe `pk_test_…` in `App.tsx:95` — Phase 5 CONCERNS.md

**New hardcoded secrets in v1.1 (Phases 7-11):** NONE. Backend recent commit history shows zero real-credential matches; mobile tree hits are all pre-milestone and pre-documented.

**Deferred-verification disposition (per ROADMAP v2 scope-out tracked in REQUIREMENTS.md lines 68-71):**

| Deferred Item | Source | Disposition |
|--------------|--------|-------------|
| **LIST-02** — Automated listing-flagging queue (auto-suspend after N buyer reports, ML pre-screening) | REQUIREMENTS.md:68 | Tracked as v1.2+; v1.1 ships manual admin moderation only (LIST-01). Not a security regression — explicit scope-out. |
| **NOTF-01..03** — Email + push + in-app appeal ticket system (seller notification on listing moderation) | REQUIREMENTS.md:70 | Deferred to v1.2+. In v1.1 the seller sees status on their own listing view via the GET `/api/cars/:id` admin-extension envelope. No buyer-side surface affected. |
| **DEBT-01..04** — AuthService split, typed User, expanded test coverage, error-handling standardization | REQUIREMENTS.md:71 | Tech-debt carry-forward. Not security-affecting at v1.1 boundary; tracked for v1.2+ cleanup. |
| **Legacy `/api/admin/*` callerUid-in-body** routes (status / requests / approve / reject / admin-users / order-status) | server.js:953-1090 (pre-Phase-6) | Same disposition as Phase 6 06-SECURITY.md §(b) §legacy-note. NOT in scope; the v1.1 listing-moderation surface uses the verifyIdToken+requireAdmin chain exclusively (see Section (a)). |
| **Load-test harness** (QUAL-02 k6) | Phase 6 06-SECURITY.md §(e) T-06-05; MEMORY.md `qual_02_deferred.md` | Deferred indefinitely by operator decision (2026-04-19). No `scripts/load-test/` directory exists; no surface on which to introduce a load-test credential. T-11-08-equivalent reverts to "accept with deferred verification." |

**Verdict:** ✅ PASS

---

## Optional — Additional Hardening Notes

(Not part of the 5 required criteria; captures Phase 11-specific incidental findings and explicit defense-in-depth confirmations.)

- **PII minimization to buyers (banner copy injection vector):** The buyer-facing `ListingStatusBanner` (Plan 11-02) consumes only the `bannerHints: { titleKey, bodyKey, severity }` table-driven shape + the bounded `reasonCategory` enum (`'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other' | null`, Phase 7 D-14a). It NEVER reads the free-form admin `moderationReason` field. Grep evidence:
  ```
  grep -c "moderationReason" src/components/moderation/ListingStatusBanner.tsx → 0
  grep -c "moderationReason" src/screens/ServiceCartScreen.tsx               → 0
  grep -c "moderationReason" src/screens/CarDetailsScreen.tsx                → 3
  ```
  The 3 hits in `CarDetailsScreen.tsx` are at lines 688 (comment), 708 (presence check), and 710 (render) — all inside the `isAdmin && fetchedCar?.moderationBadge` gate (line 690), i.e., the Phase 10 LUI-* admin-only banner introduced in Plan 10-08. Buyers (non-admin) never reach this branch and never see `moderationReason`. PII minimization holds.

- **Banner copy injection via `reasonCategory`:** The `reasonCategory` field is a taxonomy-bounded enum (Phase 7 D-14a — Mongoose schema enforces the 5-value set). The `ListingStatusBanner` resolves the chip text via a table-driven `REASON_TO_KEY[reasonCategory]` lookup (line 138) and falls through to React Native's auto-escaping `<Text>` for unknown values. No HTML/markdown rendering surface exists. No injection vector.

- **Buyer-bypass of disabled CTA (defense-in-depth):** Even if the UI's disabled-CTA logic is bypassed (e.g., devtools-modified `disabled` attr), the backend 409 listing_not_available gate at `server.js:1117` aborts the Stripe PI creation before charge, and the in-transaction TOCTOU re-check at `src/payments/confirmBooking.js:215` refunds + throws if the listing flipped non-active mid-flow. Grep evidence of UI gating breadth (CarDetailsScreen.tsx):
  ```
  grep -c "isListingNonActive" src/screens/CarDetailsScreen.tsx → 17
  ```
  All 4 buyer-action surfaces (Get Services button :820, Book It button :846, Telegram contact :930, WhatsApp contact :949) check `isListingNonActive` for both visual opacity and `disabled`/`onPress` gating. Backend remains the authoritative wall (Phase 9 D-09).

- **LMOB-02 interceptor preservation (grep-stable invariant):** The shared http-client error interceptor in `src/services/http/client.ts` carries exactly one `'account_suspended'` reference (line 49: `const ACCOUNT_SUSPENDED = 'account_suspended';`). Phase 11 did not widen the interceptor to catch `listing_not_available` (per LMOB-02 — listing 409s are screen-local recoverable, not session-fatal). Grep:
  ```
  grep -c "account_suspended" src/services/http/client.ts → 1 (unchanged from pre-Phase-11 baseline)
  ```
  This invariant is the load-bearing reason the cart-add 409 (createPaymentIntent gate) and confirm-booking 409 paths surface in-screen banners (Plans 11-03 + 11-04) rather than triggering the account-wide logout interceptor. Verified grep-stable.

- **Coverage-manifest cross-repo grep boundary** (Phase 11 LQUAL-02, Plan 11-07): `scripts/generate-coverage-manifest.sh` declares a closed `TEST_DIRS` set (mobile `__tests__` + 4 subdirs + 1 backend dir at `../backend-services/carEx-services/__tests__`) at lines 51-58. Backend production source (`server.js`, `src/payments/`, `src/moderation/`) is NOT scanned by the manifest generator — boundary documented. The manifest is a coverage *accounting* tool only; it does not exfiltrate backend source paths into mobile-repo artifacts beyond the `__tests__` directory file names already public via the test fixtures.

- **LUI-01 admin-only banner endpoint disposition:** GET `/api/cars/:id` returns the thin buyer envelope by default and the `moderationBadge` admin extension only when the caller is authenticated as admin (`lookupAdminIfPresent` middleware, Phase 9 D-08). Verified at `server.js:344-402`. Admin-only PII path; non-admin buyers receive `{ status, reasonCategory, banner }` only.

- **Phase 6 06-SECURITY.md §(c) substrate (suspend + confirmBooking transactional)** continues to hold at Phase 11 wave-6 HEAD. The `confirmBooking` transaction body verified in Section (d) above subsumes the Phase 6 §(c) buyer/provider/seller re-check pattern; the listing dimension is the Phase 9 LENF-03 addition.

- **Auto-flagging queue (LIST-02) explicitly scope-out** for v1.1 (REQUIREMENTS.md:68 + ROADMAP v2). No corresponding test surface or HTTP route in the v1.1 codebase; nothing for this review to verify.

---

## Review Sign-Off

All 5 ROADMAP §Phase 11 Success Criterion 5 sub-items verified **PASS**.

- Reviewer: self (per 11-CONTEXT D-11 — informal, no external auditor)
- Date: 2026-05-29
- Ready for merge to `main` and v1.1 tagging: **YES**
- Outstanding (informational, non-blocking):
  - Legacy `/api/admin/*` `callerUid`-in-body tech-debt cleanup (carried forward from Phase 6 06-SECURITY.md)
  - LIST-02 auto-flagging queue (deferred to v1.2+, explicit scope-out)
  - NOTF-01..03 seller notifications on moderation (deferred to v1.2+)
  - DEBT-01..04 tech-debt sweep (AuthService split, typed User, error-handling standardization)
  - Load-test harness (QUAL-02 k6) — operator-decision deferred indefinitely (MEMORY.md `qual_02_deferred.md`)

# Phase 9: Backend Read-time + TOCTOU Enforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 09-backend-read-time-toctou-enforcement
**Areas discussed:** Hide hook + admin Deleted view, Thin payload shape (LENF-02), Cart + payment error shape (LENF-03), Refund timing inside confirm-booking transaction

---

## Hide hook + admin Deleted view

### Q1 — Admin bypass behavior for soft-deleted listings

| Option | Description | Selected |
|--------|-------------|----------|
| Admin sees everything | One bypass flag `includeAllListingStatuses:true` reveals active + suspended + archived + deleted. Required for Phase 10 Restore flow. | ✓ |
| Two flags (deleted is opt-in) | Separate `includeDeletedListings` flag for the destructive bucket. Safer but every admin handler must remember both. | |

**User's choice:** Admin sees everything (single bypass flag).
**Notes:** Required for Phase 10's "Deleted listings" panel — without admin visibility of deleted rows, soft-deleted listings become unrecoverable from the UI.

### Q2 — Internal hook structure (combined vs. stacked)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to planner | User-visible behavior is locked; planner picks structure after reading existing seller-cascade hook. | ✓ |
| User weighs in | Discuss merge vs. sibling registration manually. | |
| Move to next area | Skip the question. | |

**User's choice:** Defer to planner (Claude's discretion).
**Notes:** Constraint added in CONTEXT D-04: `includeAllListingStatuses` bypass MUST short-circuit the listing-status filter independently of the seller-cascade filter.

---

## Thin payload shape (LENF-02)

### Q1 — What fields go in the non-admin listing-detail response for non-active listings

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stub | Status + reason only. No make/model/photo/price. Share links show nothing meaningful. | |
| Identifying stub | Minimal + title/make/model/year/price/firstPhotoUrl + banner block. No seller PII, no moderation notes. Share-link previews still useful. | ✓ |
| Full doc minus PII | Full Car document minus seller PII fields. Most generous but field-level filtering is error-prone. | |

**User's choice:** Identifying stub.
**Notes:** Exact field allowlist locked in CONTEXT D-05. Buyer sees the facts they could already see when the listing was active, plus the banner — nothing about why it was moderated.

### Q2 — HTTP status code for non-active listing-detail responses

| Option | Description | Selected |
|--------|-------------|----------|
| 200 OK with status in body | Single response shape, mobile branches on body.status. Matches v1.0 account_suspended pattern. | ✓ |
| 200 for suspended/archived, 410 for deleted | Treats deleted specially. More semantically accurate, more branching. | |
| 404 + special body for non-admin, 200 + full for admin | Aligns with seller-cascade hook surface. 404 + body is unusual; some clients drop the body. | |

**User's choice:** 200 OK for all three non-active states.
**Notes:** Captured as CONTEXT D-06. Admin viewers receive full doc + `moderationBadge` block per D-07.

---

## Cart + payment error shape (LENF-03)

### Q1 — Where does the cart-add check live (given CarEx's client-side cart)?

| Option | Description | Selected |
|--------|-------------|----------|
| Piggyback on create-payment-intent | First server touch after cart-add. 409 fires before Stripe call. No new endpoint. | ✓ |
| New POST /api/cart/validate endpoint | Explicit cart validation. Doubles round-trips before payment. | |
| Both (defense-in-depth) | Optional client-side validate + mandatory create-payment-intent gate. | |

**User's choice:** Piggyback on `POST /api/payments/create-payment-intent`.
**Notes:** Captured as CONTEXT D-09. Divergence from ROADMAP literal text noted: "cart-add" is interpreted as "first server interaction following cart-add" given CarEx's local-cart architecture. Phase 10 may add a pre-emptive client-side check for UX (D-10).

### Q2 — What goes in the 409 listing_not_available error body?

| Option | Description | Selected |
|--------|-------------|----------|
| Full banner block | Body includes listingStatus + reasonCategory + banner:{titleKey,bodyKey,severity} + (refundId?/refundFailed? on confirm-booking). Mobile renders directly. | ✓ |
| Raw status only | Body has listingStatus + reasonCategory; mobile mirrors LISTING_STATUS_POLICY client-side. Risk of drift. | |
| Bare error | Body has only `error`. Mobile re-fetches listing-detail to render banner. Extra round-trip. | |

**User's choice:** Full banner block.
**Notes:** Captured as CONTEXT D-11. Mirrors v1.0 D-15 patterns for consistency with `account_suspended` and `provider_suspended` error shapes.

---

## Refund timing inside confirm-booking transaction

### Q1 — Where does the new listing-status check land in v1.0's 6-step transaction?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside step 4 (Car refetch) | Existing seller-active check gets a sibling listing-active check. Same DB read. | ✓ |
| New step 4b dedicated to listing-status | Separation of concerns, but double-fetch or shared variable across steps. | |
| Step 1.5 before any DB work | Lightweight short-circuit. Unsafe — TOCTOU window between 1.5 and step 4. | |

**User's choice:** Inside step 4.
**Notes:** Captured as CONTEXT D-12. Step 4 now checks three conditions in order: seller `moderationStatus.state === 'active'`, seller role status `'APPROVED'`, `car.status === 'active'` (D-13).

### Q2 — Extract shared refund helper vs. inline duplication

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `refundAndThrow` helper | One helper for all 4 failure points. Phase 9 refactors v1.0's 3 inline sites + adds 4th. Refund-ordering invariant lives in one place. | ✓ |
| Keep inline, add new inline | Zero risk to v1.0 behavior, smaller diff. 4 near-identical call sites; future changes touch 4 places. | |
| You decide | Claude's discretion. | |

**User's choice:** Extract shared helper.
**Notes:** Captured as CONTEXT D-14/D-15. Highest regression risk in Phase 9 — plan MUST include a regression-test pass against existing v1.0 Phase 3 confirm-booking suite before adding the new assertion (specifics §3).

---

## Claude's Discretion

- Internal hide-hook structure (one combined `pre(/^find/)` vs. two stacked hooks) — planner picks after reading existing seller-cascade hook (CONTEXT D-04)
- Module location for `refundAndThrow` helper (e.g., `src/payments/refundAndThrow.js`)
- Whether to write an audit row when confirm-booking refund fires due to listing-not-active — default is NO, matching v1.0's precedent
- Test file organization — `__tests__/listing-enforcement/` vs. stack into existing `__tests__/payments/`
- Error-class naming (e.g., `ListingNotAvailableError` extending v1.0 base vs. plain object)
- Status-aware listing-detail GET — inline branching vs. extracted `buildListingDetailResponse(car, isAdmin)` helper

## Deferred Ideas

- **WR-03 carry-over from Phase 8 code review** — ServiceOrder pause-not-cancel integration. PROJECT.md constraint says in-flight orders should be paused, not cancelled. Phase 8 deferred this; Phase 9 also deferred (out of scope — read-time + TOCTOU, not ServiceOrder state management). Needs its own slice — Phase 9.5 or roll into Phase 11
- Listing-status email/push notifications to seller — NOTF-01..03 v2 carry-forward
- Automated flagging queue (LIST-02) — v2 carry-forward
- Bulk admin listings panel — v1.1 carry-forward (already in ROADMAP)
- OpenGraph metadata for thin-payload share cards — Phase 11 LQUAL note (web fronting concern, not backend)
- Load-test the hide-hook query under realistic traffic — QUAL-02 revival candidate if needed

---

*Audit trail generated by `/gsd-discuss-phase 9` on 2026-05-28.*

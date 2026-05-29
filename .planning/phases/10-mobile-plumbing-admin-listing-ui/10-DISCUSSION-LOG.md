# Phase 10: Mobile Plumbing + Admin Listing UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 10-mobile-plumbing-admin-listing-ui
**Areas discussed:** Edit flow, Reason category collection UX, Deleted listings view placement, Delete confirmation sentinel

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Edit flow — reuse SellCarScreen vs. dedicated admin edit? | SellCarScreen already supports edit mode driven by `route.params.carId` + `isEditMode` flag at line 31; talks to seller `PUT /api/cars/:id` at line 439. Admin Edit needs `PATCH /api/admin/moderation/listings/:carId` instead. | ✓ |
| Reason category collection UX — bottom sheet vs. modal vs. two-step | Suspend/Archive/Delete need reasonCategory (required) + optional note. Existing `ModerationActionModal` handles a similar user-mod flow. Options: full modal after tap, inline reason picker in the sheet, or two-step sheet. | ✓ |
| Deleted listings view — placement + entry point | LUI-04: "admin-only Deleted listings filter view, within the admin moderation surface, with per-row Recover". Options: new screen, extend AdminModerationScreen with tabs, or filter chip inside regular browse for admins. | ✓ |
| Delete confirmation sentinel — what does admin type to confirm? | TypedConfirmationModal sentinel choice: listing title, literal "DELETE", listing _id prefix, or seller email. Trade-off memorable vs. unforgeable vs. friction. | ✓ |

**User's choice:** All four areas selected for discussion.

---

## Edit flow

### Question 1: How should admin Edit reuse the SellCarScreen form?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse SellCarScreen with isAdminEdit route flag (Recommended) | Add optional `adminEdit?: boolean` to RootStackParamList.SellCar params. Skip OTP, skip seller-status gate, swap submit endpoint to ModerationService.adminEditListing. Lowest risk of drift between seller and admin field coverage. | ✓ |
| Dedicated AdminEditListingScreen (clone SellCarScreen) | Copy-paste the form. Cleanest separation but doubles maintenance — every future seller-form field addition must be mirrored. | |
| Inline Edit form inside the bottom sheet | Replace the 4-action sheet with an inline form when Edit is tapped. Cramped (20+ fields, image upload). Likely needs sheet→modal escalation. | |
| Push SellCarScreen with carId only, switch endpoint via auth context | No new flag. Screen detects `useAuth().isAdmin && !isOwnListing` and picks the admin endpoint. Implicit data flow, harder to reason about. | |

**User's choice:** Reuse SellCarScreen with isAdminEdit route flag
**Notes:** Decision recorded as CONTEXT D-01.

### Question 2: When SellCarScreen runs in adminEdit mode, which seller-only checks should be bypassed?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip seller-status APPROVED gate (line 88) (Recommended) | Currently `if (carId && user?.sellerStatus === 'APPROVED')` controls the prefill fetch. Admin is not a seller; without this skip the form stays blank. | ✓ |
| Skip OTP / phone re-verification gates (Recommended) | Admin editing on someone else's behalf doesn't assert phone ownership. Phase 8 D-A allows admin to change phoneNumber outright. | ✓ |
| Skip FeatureGateOverlay / restrictedFeatures check (Recommended) | Admin's own moderation state doesn't gate editing someone else's listing. | ✓ |
| Skip the 'cannot edit your own listing' guard | Phase 8 D-04 backend rejects admin === sellerId. Mobile could pre-check + hide the badge, OR let backend reject. Default: pre-check + hide. | ✓ |

**User's choice:** All four — including no client-side own-listing guard.
**Notes:** Recorded as D-02. Moderate badge stays visible on own-listing case; backend `cannot_moderate_own_listing` (400) surfaces as a UI banner. Rationale: explicit rejection is clearer than silent affordance hiding.

### Question 3: After admin Edit submit succeeds, what's the navigation outcome?

| Option | Description | Selected |
|--------|-------------|----------|
| Go back to CarDetailsScreen, refresh listing (Recommended) | Pop SellCarScreen, return to CarDetailsScreen, force re-fetch. Admin sees updated listing + status banner immediately. | ✓ |
| Stay on SellCarScreen with a success toast | Keep form open for chained edits. Risky — stale form data if backend re-resolved makeName/modelName. | |
| Go to a generic 'Listing updated' confirmation screen | Adds a screen for no clear gain. | |
| Pop two levels back to admin moderation surface | If admin entered Edit from Deleted view. Common path is browse / deep-link instead. | |

**User's choice:** Go back to CarDetailsScreen, refresh listing.
**Notes:** Recorded as part of D-01. `navigation.goBack()` + a route.params.refresh hint or focus-listener re-fetch (planner discretion).

### Question 4: More questions about Edit flow, or move to next?

| Option | Description | Selected |
|--------|-------------|----------|
| Next area | Edit flow has the three key decisions locked. | |
| More questions | Could dig into 409 listing_not_available on Edit submit, or how to surface invalid_field / no_changes errors. | |

**User's choice (free text):** "Why don't you use your best judgment and give me the recommended options? I'll just take that."
**Notes:** Triggered a fast-forward through the remaining three areas using recommended options, with batch-confirmation before writing CONTEXT.md.

---

## Reason category collection UX (RECOMMENDED-ACCEPTED)

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling `ListingModerationReasonModal` for Suspend/Archive/Delete + thin `ListingRestoreModal` for Restore (Recommended) | New components, NOT reuse of `ModerationActionModal`. Reason: listing taxonomy is 5-value (Phase 7 D-14a) vs user's 4-value; embedding both in one component creates drift risk. Delete escalates to existing `TypedConfirmationModal` from inside the reason modal. | ✓ |
| Reuse existing ModerationActionModal | Single modal across user and listing domains. Risks enum drift, conflates two enums in one prop type. | |
| Inline reason picker inside the bottom sheet | Cramped, breaks the single-purpose bottom-sheet pattern from Phase 5 D-06. | |
| Two-step bottom sheet (action → reason in same sheet) | Adds animation complexity for no UX gain. | |

**User's choice:** Sibling modal (Recommendation accepted).
**Notes:** Recorded as D-03 through D-07 in CONTEXT.md.

---

## Deleted listings view placement (RECOMMENDED-ACCEPTED)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend AdminModerationScreen with Users \| Listings tabs (Recommended) | Mirrors v1.0 D-03 widen-existing-surface pattern. Listings tab inherits the search + filter + paginated list shape from Phase 5 D-10..D-12. Per-row Recover only on deleted rows. | ✓ |
| New AdminListingModerationScreen | Fragments nav. Adds a new route + AdminDashboard card. | |
| Filter chip inside regular browse for admins | Mixes admin-only state into the buyer-facing browse. Confusing UX boundary. | |
| List inside CarDetailsScreen bottom sheet | Doesn't satisfy "filter view" requirement; bottom sheet is per-listing context. | |

**User's choice:** Extend AdminModerationScreen with tabs (Recommendation accepted).
**Notes:** Recorded as D-09 through D-12 in CONTEXT.md. **Cross-repo backend slice required**: Phase 8 deferred the listing-list endpoint; Phase 10 must add `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=` on the existing `listingRouter`. Mirrors Phase 5's pattern of shipping backend endpoints alongside mobile UI.

---

## Delete confirmation sentinel (RECOMMENDED-ACCEPTED)

| Option | Description | Selected |
|--------|-------------|----------|
| Listing title (year + make + model, e.g. "2018 Toyota Camry") (Recommended) | Already rendered on CarDetailsScreen above the bottom sheet. Already in Phase 9 D-05 thin payload as `title`. Naturally varies per listing — no muscle-memory. Mirrors Phase 5 D-04 "tied to the target" rationale. | ✓ |
| Literal "DELETE" | Memorable but no target binding. Admin could autopilot through a wrong listing. | |
| Listing _id prefix | Unforgeable but high friction (UIDs are hard to read off the screen). | |
| Seller email | Tied to target but requires looking up an extra field; admin might not have it on screen. | |

**User's choice:** Listing title (Recommendation accepted).
**Notes:** Recorded as D-08 + D-08a (case-insensitive + whitespace-trimmed match) + D-08b (makeName/modelName resolution) in CONTEXT.md.

---

## Batch confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Accept all three recommendations, write CONTEXT.md (Recommended) | Lock the three remaining areas with recommended choices and proceed. | ✓ |
| Discuss one before locking | Dig into one of the three before committing. | |

**User's choice:** Accept all three, write CONTEXT.md.

---

## Claude's Discretion

Areas where the planner / executor may decide without re-asking (full list in CONTEXT.md "Claude's Discretion" subsection):

- Exact icon glyph for the Moderate badge on CarDetailsScreen
- Page size for the new admin listings GET endpoint (25 suggested per Phase 5 precedent)
- File location of `ListingModerationError` (inside `errors.ts` vs sibling `listingErrors.ts`)
- Whether per-row Recover on Listings tab uses Alert.alert or reuses `ListingRestoreModal`
- Exact tab-switch UI on `AdminModerationScreen` (segmented control / pill row / chip row)
- `adminEditListing` signature — accept `FormData` directly vs structured `{ fields, existingImageUrls, files }`
- Behavior on rare 409 `listing_not_available` mid-Edit submission

## Deferred Ideas

Ideas raised or implied during discussion that belong in other phases:

- Buyer-facing severity-aware banner on CarDetailsScreen for non-admin viewers → Phase 11 LBUY-01
- Cart banner + disabled checkout for non-active listings → Phase 11 LBUY-02
- RU+EN translation strings + jest literal scanner sweep → Phase 11 LQUAL-01
- `LIST-SECURITY.md` merge-gate review → Phase 11 LQUAL-03
- Listing-history admin GET endpoint → Phase 8 already deferred; Phase 10 doesn't need it
- Bulk admin listings panel + batch actions → v1.2+
- Hard-delete UI affordance → v1.2+
- Listing edit-history audit diff replay UI → v1.2 carry-forward
- Push / email notifications to seller on moderation → NOTF-* / v1.2+
- ServiceOrder pause-not-cancel banner UX on buyer order detail → Phase 11 / v1.2
- Listings-tab sort options + CSV export → v1.2+ (MOD2-*)
- Refactor SellCarScreen.tsx 1527-line size (DEBT-03) → carry-forward; Phase 10 only adds conditional branches
- AuthService domain split (DEBT-01) → carry-forward
- Dedicated AdminEditListingScreen rejected at D-01 — revisit only if field-coverage drift becomes a real maintenance burden

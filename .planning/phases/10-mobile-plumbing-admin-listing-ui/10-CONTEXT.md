# Phase 10: Mobile Plumbing + Admin Listing UI - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

**In scope (mobile + small cross-repo backend slice):**

1. **LMOB-01 — Five new `ModerationService` methods.** `adminEditListing(carId, multipart)`, `suspendListing(carId, { reasonCategory, note? })`, `archiveListing(carId, { reasonCategory, note? })`, `deleteListing(carId, { reasonCategory, note? })`, `restoreListing(carId, { note? })`. All live in `src/services/moderation/ModerationService.ts` — extend, not split. Each wraps the Phase 8 `PATCH /api/admin/moderation/listings/:carId[/<action>]` endpoints via the existing `apiClient` (Phase 4 Bearer + idToken-refresh wiring).
2. **LMOB-02 — Listing-moderation 409/403 NOT routed through user-suspension interceptor.** `apiClient`'s response interceptor already keys exclusively on `error === 'account_suspended'` (see `src/services/http/client.ts:103`), so 409 `listing_not_available` (Phase 9 D-11) and 400 `cannot_moderate_own_listing` (Phase 8 D-04) naturally pass through. Phase 10's contribution is to surface those errors as UI banners on `CarDetailsScreen` / cart (LBUY-02 in Phase 11 handles the buyer side; Phase 10 handles the admin side).
3. **LUI-01 — Admin-only "Moderate" badge on `CarDetailsScreen`.** Visible when `useAuth().isAdmin === true`. Tapping opens a bottom-sheet `Modal` with four action rows + a status banner reflecting the current `moderationBadge` from Phase 9 D-07.
4. **LUI-02 — Four visually distinct actions** in the bottom sheet: Edit (pencil-neutral), Suspend (warning orange), Archive (neutral gray), Delete (destructive red with typed confirmation).
5. **LUI-03 — Restore replaces the four actions on non-active listings.** Bottom sheet detects `moderationBadge.status !== 'active'`, shows current `reasonCategory` chip + a single Restore button. Tap → thin restore-modal (note-only per Phase 8 D-C) → `ModerationService.restoreListing(carId, { note? })`.
6. **LUI-04 — Admin-only Deleted listings filter view.** Extend `AdminModerationScreen` with `Users | Listings` tabs. Listings tab has search + status filter chips (`All | Active | Suspended | Archived | Deleted`) + paginated list + per-row Recover action on deleted rows.
7. **Backend slice (cross-repo, mounts under `/api/admin/moderation/listings`).** Phase 8 deferred the listing-list endpoint pending UI need. Phase 10 lands `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=` — mirrors v1.0 `GET /api/admin/users/search` (Phase 5 D-16). Uses `setOptions({ includeAllListingStatuses: true })` (Phase 9 D-01) so the new Phase 9 hide-hook doesn't filter out the very rows admin needs to see.

**Out of scope (explicitly deferred):**

- **LBUY-01..04 buyer-affected banners** on `CarDetailsScreen` and cart for *non-admin* viewers — Phase 11. Phase 10 only handles the *admin* view + own-side error handling; the buyer-facing severity-aware banner copy + cart banner are Phase 11.
- **LQUAL-01 RU+EN translation strings + jest literal scanner sweep** — Phase 11. Phase 10 adds keys as it touches them (English placeholders OK during dev), but the parity audit + final RU copy is Phase 11.
- **LIST-SECURITY.md merge-gate review** — Phase 11.
- **Listing-history admin GET** (`GET /api/admin/moderation/listings/:carId/history`) — Phase 8 deferred per Phase 8 CONTEXT "Deferred Ideas"; Phase 10 doesn't surface a need yet (the per-listing history is a "nice to have, not blocking" — admin sees current state via Phase 9 D-07 `moderationBadge`).
- **Bulk admin listings panel** with batch actions — REQUIREMENTS Out of Scope; v1.2+.
- **Hard-delete UI affordance** — REQUIREMENTS Out of Scope.
- **Mobile-side ServiceOrder pause-not-cancel integration** — carried over from Phase 8 WR-03 / Phase 9 deferred; PROJECT.md constraint is satisfied at the backend by Phase 9's status-aware reads, but per-order banner UX is Phase 11 / v1.2 territory.

**Scope boundary:** Mobile in `carEx` repo + one small cross-repo backend slice in `../backend-services/carEx-services` for the GET list endpoint. Backend write endpoints (Phase 8) and read-time enforcement (Phase 9) stay locked.

</domain>

<decisions>
## Implementation Decisions

### Edit flow — reuse SellCarScreen with admin route flag (Area 1 USER-DECIDED)

- **D-01:** **Reuse `SellCarScreen.tsx` with an `adminEdit?: boolean` route param.** Add the optional flag to `RootStackParamList.SellCar`. When `route.params.adminEdit === true`:
  - Skip the seller-status APPROVED gate (`SellCarScreen.tsx:88` — `if (carId && user?.sellerStatus === 'APPROVED')`); admin always fetches the listing via the existing `apiClient.get('/api/cars/:id')` path. Phase 9 D-08 ensures admins receive the full Car doc + `moderationBadge`.
  - Skip the OTP / phone re-verification gates. Admin Edit is editing on someone else's behalf — they don't assert ownership of the phone field. Per Phase 8 D-A, admin can change `phoneNumber` / `telegramUsername` outright.
  - Skip any `FeatureGateOverlay` / `restrictedFeatures` check on the seller path. Admin's own moderation state doesn't gate editing someone else's listing; if the admin themselves is moderated, the backend admin gate rejects independently.
  - Swap the submit call from `apiClient.put('/api/cars/:id', data, {...})` (`SellCarScreen.tsx:439`) to `ModerationService.adminEditListing(carId, multipartFormData)`. Same `multipart/form-data` shape — Phase 8 D-D guarantees parity with seller PUT (multer `upload.array('images', 25)` + S3 + `existingImageUrls` JSON-array semantics).
  - On submit success: navigate back to `CarDetailsScreen` and force a re-fetch via the existing `fetchedCar` / `setFetchedCar` state pattern so admin sees the updated listing + status banner immediately. (`navigation.goBack()` + a `route.params.refresh = Date.now()` style hint, or a focus-listener re-fetch — planner discretion.)
- **D-02:** **No client-side "cannot edit your own listing" pre-check.** The Moderate badge is shown to admins on every listing regardless of `isOwner`. Backend `denySelfModerationListing` (Phase 8 D-04) is the authoritative rejection. Mobile surfaces the resulting `400 cannot_moderate_own_listing` as a UI alert/banner on `CarDetailsScreen` — no silent hiding of the affordance. Rationale: keeping the badge visible makes the rejection explicit (admin sees "you can't moderate your own listing" rather than the badge being mysteriously absent), and it avoids fork-and-drift between mobile and backend self-mod logic.

### Reason-category collection UX — sibling modal (Area 2 RECOMMENDED-ACCEPTED)

- **D-03:** **New `ListingModerationReasonModal` component** (sibling to user-mod's `ModerationActionModal`, NOT a reuse). Single modal opened from the bottom sheet for **Suspend / Archive / Delete only**. Props shape: `{ action: 'suspend' | 'archive' | 'delete', carId, listingTitle, onSubmit, onClose, visible }`. Fields:
  - **Reason category** as three-card vertical radio (5 values from Phase 7 D-14a: `spam | policy_violation | fraud | inactive_seller | other`). Required.
  - **Note** textarea (optional, max 2000 chars to match `restoreListingSchema` cap; Suspend/Archive/Delete schemas don't have a documented cap, but mirror for consistency).
  - **Confirm / Cancel** at the bottom.
- **D-04:** **Why a sibling modal, not reuse of `ModerationActionModal`:** the user-mod modal handles 5 actions with conditional field sets including severity + role pickers irrelevant to listings, and embeds the 4-value `ReasonCategory` enum. The listing taxonomy is the 5-value `LISTING_REASON_CATEGORIES` from Phase 7 D-14a — embedding both enums in one component creates drift risk. Sibling keeps each modal narrow and grep-able for Phase 11 LQUAL-03 security review.
- **D-05:** **Edit is NOT routed through this modal.** Tapping Edit pushes `SellCarScreen` with `adminEdit: true` per D-01. The form itself handles content collection; no reason category needed (Phase 8 D-A-3: Edit is content-correction, not a state transition).
- **D-06:** **Restore opens a thinner sibling modal** `ListingRestoreModal` — note-only field (optional, max 2000), no reason category (Phase 8 D-C). Confirm calls `ModerationService.restoreListing(carId, { note? })`.
- **D-07:** **Delete escalates from `ListingModerationReasonModal` to `TypedConfirmationModal`** before submit fires. Flow: admin picks reason + note → taps Confirm → first modal stays mounted, `TypedConfirmationModal` overlays with the typed-sentinel gate → admin types sentinel → Confirm enables → on Confirm, the wrapping modal calls `ModerationService.deleteListing(carId, body)`. Two-modal stack handled inline; existing `TypedConfirmationModal` (`src/components/moderation/TypedConfirmationModal.tsx`) takes Phase 5 D-04 props verbatim.

### Delete confirmation sentinel (Area 4 RECOMMENDED-ACCEPTED)

- **D-08:** **Sentinel = listing title** (year + make + model concatenation, e.g., `2018 Toyota Camry`). Sourced from:
  - The same `title` field exposed in Phase 9 D-05's thin payload for non-admin viewers; admin viewers get the full Car doc and reconstruct via `${car.year} ${car.makeName} ${car.modelName}` (already the shape `CarCard` renders).
  - Already rendered on `CarDetailsScreen` above the bottom sheet, so admin can read-and-type without leaving the surface.
  - Tied to the target (different per listing), low cognitive overhead (admin already saw it), unforgeable in muscle memory.
- **D-08a:** **Case-insensitive + whitespace-trimmed match** on the typed input vs the canonical title. Rationale: forcing exact case adds friction without security gain; the sentinel's purpose is "are you sure?" not "are you not a bot?". Mirrors Phase 5 D-04's email-sentinel which was also trimmed + lowercased per Phase 5 specifics.
- **D-08b:** **Make/model name resolution:** for admin viewers the full Car doc carries `makeName` + `modelName` (denormalized at create-time per existing `Car` schema). If either is missing (extreme legacy data), fall back to `makeId` / `modelId` literal strings — admin still sees the same string to type. No `useVehicleCatalog` round-trip from inside the modal.

### Deleted listings view — extend AdminModerationScreen (Area 3 RECOMMENDED-ACCEPTED)

- **D-09:** **Extend `AdminModerationScreen` with top-level `Users | Listings` tabs.** No new route, no new screen file. Pattern mirrors v1.0 D-03 (widen-existing-surface, not fragment-nav). The existing user search + filter chip + paginated list pattern (Phase 5 D-10/D-11/D-12) ports to the Listings tab:
  - Search bar: text query matching listing title / make / model substring + listing UID prefix server-side. 300ms debounce + axios `AbortController` (mirrors Phase 5 D-10 + existing `searchUsers` in `ModerationService.ts:260`).
  - Filter chip row: `All | Active | Suspended | Archived | Deleted`. Single-select (not additive — listing state is mutually exclusive, unlike user role chips which were additive). Selected chip is filled.
  - Infinite scroll via `FlatList onEndReached` + `RefreshControl` for pull-to-refresh (Phase 5 D-12 pattern).
  - Per-row "Recover" inline button **only when row's `status === 'deleted'`** (per LUI-04). Tap → confirmation alert ("Restore this listing?") → `ModerationService.restoreListing(carId)` → row updates optimistically. Other status rows have no inline action; tap pushes `CarDetailsScreen` where the full bottom sheet is available.
- **D-10:** **Row tap pushes `CarDetailsScreen`** (already covers admin view via LUI-01). No new detail screen. Listing row visual: thumbnail (firstPhotoUrl) + title + price + status badge (uses Phase 7 D-14 `LISTING_STATUS_POLICY[status].banner.severity` to color the badge; consistent with the buyer-facing severity-aware system Phase 11 will land).
- **D-11:** **New backend endpoint required (cross-repo plan in Phase 10).** `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=`:
  - Mounted on the existing `listingRouter` already at `server.js:925` — admin auth + rate limiter + verifyIdToken chain unchanged.
  - Uses `Car.find(filter).setOptions({ includeAllListingStatuses: true })` (Phase 9 D-01) so the new hide-hook doesn't filter deleted/suspended/archived rows out for admin.
  - Cursor-based pagination keyed on `{ moderatedAt, _id }` for non-active statuses, `{ createdAt, _id }` for `status=active` (so admin sees the newest items first regardless of which state they're filtering by). Page size default 25 (Phase 5 D-12 precedent).
  - Response shape: `{ rows: ListingSearchItem[], nextCursor: string | null }` mirroring `SearchUsersResult`.
  - Search `q` matches `title` (year+makeName+modelName concat), `makeName`, `modelName`, and listing `_id` prefix server-side. Reuses any Phase 8 admin-edit-time field validation conventions.
- **D-12:** **Entry point into `AdminModerationScreen` Listings tab:** the existing `AdminDashboardScreen` card already routes to `AdminModerationScreen`. The tabs are inside that screen — admin lands on Users by default (current behavior, preserves muscle memory), taps Listings tab to switch. Deep link not needed for v1.

### LMOB-02 — 409 / 403 surface (Area locked, no user input needed)

- **D-13:** **Listing-moderation 403/409 errors NEVER trigger the existing 403 user-suspension interceptor.** Verified at `src/services/http/client.ts:103`: the interceptor matches `status === 403 && data.error === 'account_suspended'` only. Phase 8/9 error codes (`cannot_moderate_own_listing` is 400, `listing_not_available` is 409, `listing_not_found` is 404, `invalid_transition` / `already_in_state` / `not_moderated` / `invalid_field` / `no_changes` are 400) all bypass it.
- **D-14:** **New error class `ListingModerationError`** (sibling to `ModerationError` in `src/services/moderation/errors.ts`). Shape:
  ```ts
  export class ListingModerationError extends Error {
    constructor(
      public code:
        | 'listing_not_available'
        | 'listing_not_found'
        | 'cannot_moderate_own_listing'
        | 'already_in_state'
        | 'not_moderated'
        | 'invalid_field'
        | 'no_changes'
        | 'invalid_payload'
        | string,
      public listingStatus?: 'suspended' | 'archived' | 'deleted',
      public reasonCategory?: string,
      public banner?: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' },
      public refundId?: string,
      public refundFailed?: boolean,
      public httpStatus?: number,
    ) { super(`ListingModerationError: ${code}`); }
  }
  ```
  Caught at the per-method level in `ModerationService` (the five new methods) and at the cart/`CarDetailsScreen` axios-call sites that may surface 409 `listing_not_available` from cart-add (Phase 9 D-09) and confirm-booking (Phase 9 D-12..D-15).
- **D-15:** **Admin-side error surfacing — inline banner on `CarDetailsScreen`** for `cannot_moderate_own_listing` and `already_in_state`; `Alert.alert` for `listing_not_found` (rare race; admin probably navigated from stale list). The buyer-facing severity-aware banner is Phase 11 (LBUY-01); Phase 10's banner is the admin variant — slimmer, just enough to explain why the bottom-sheet action didn't take effect.

### Optimistic update / bottom-sheet UX (Claude's discretion, Phase 5 precedent)

- **D-16:** **Optimistic status flip with rollback** on Suspend / Archive / Delete / Restore (mirrors Phase 5 D-08). On Confirm: close modal → flip the `moderationBadge` locally → fire `ModerationService.<action>(...)`. On error: revert the badge + show `Alert.alert` with the `ListingModerationError.code` mapped to a translation key. On success: refresh from response (which carries the updated `listing` per Phase 8 D-02).
- **D-17:** **Status banner inside CarDetailsScreen reflects current `moderationBadge`** (Phase 9 D-07). When badge present (non-active status to admin): banner above the action area shows status + reasonCategory chip + (admin-only) moderationReason free text + setBy admin info. Re-rendered automatically after optimistic flip or backend confirmation.

### Claude's Discretion (planner / executor may choose without re-asking)

- Exact icon glyph for the "Moderate" badge on `CarDetailsScreen` (lucide candidates: `ShieldAlert`, `Shield`, `MoreVertical`). Severity coloring follows D-17 banner conventions.
- Page size for the new listings endpoint (25 suggested; D-11 documented).
- Whether `ListingModerationReasonModal` and `ListingRestoreModal` live in `src/components/moderation/` (sibling to existing user-mod components) — likely yes, but planner confirms file structure.
- Whether the per-row Recover action on the Listings tab uses `Alert.alert` confirmation (simpler) or opens the `ListingRestoreModal` from D-06 (consistent with the in-place Restore flow on `CarDetailsScreen`). Recommendation: reuse `ListingRestoreModal` for consistency, but Alert.alert is acceptable if the row context already makes the action unambiguous.
- Exact tab-switch UI on `AdminModerationScreen` — segmented control (iOS-flavored) vs filled pill row (Android-flavored) vs simple chip row. Planner picks based on what already exists in `src/components/`.
- Whether the listings-tab search debounces at 300ms (Phase 5 D-10) or a different cadence — default to 300ms.
- Whether `ListingModerationError` and the catch wrappers live inside `ModerationService.ts` or extract to `src/services/moderation/listingErrors.ts`. Default: extend `errors.ts` so both error classes co-locate.
- Exact `Car` schema field used for the "moderatedAt" sort in D-11. If Phase 7's audit row carries the freshest timestamp at admin-list time, planner may join — but the simpler answer is `Car.moderatedAt` (stamped on every action per Phase 8 D-C-2 / D-15) which is denormalized on the Car doc itself.
- Whether the `adminEditListing` ModerationService method signature accepts a `FormData` object directly (caller builds multipart) or accepts a structured `{ fields, existingImageUrls, files }` shape (service builds multipart). Recommend structured input — keeps the `SellCarScreen` call site readable and centralizes the `multipart/form-data` assembly.
- Exact behavior on `409 listing_not_available` mid-Edit submission (rare — Phase 9's hide hook normally prevents reaching the admin-edit endpoint with a non-existent listing). Default: surface as `Alert.alert` and pop back to CarDetails for re-fetch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone v1.1 core value, constraints (order preservation, RU+EN parity, no new state-management libs), key decisions, current focus
- `.planning/REQUIREMENTS.md` — Phase 10 REQ-IDs: LMOB-01, LMOB-02, LUI-01, LUI-02, LUI-03, LUI-04 (verbatim text)
- `.planning/ROADMAP.md` §"Phase 10: Mobile Plumbing + Admin Listing UI" — Goal + 5 success criteria (the verifier's pass-fail conditions)
- `.planning/notes/listing-moderation-design.md` — Original design exploration; §"UI placement (v1)" pins the inline-on-CarDetails + bottom-sheet decision Phase 10 implements; §"Mobile client surface (delta)" pins the 5 new ModerationService methods
- `.planning/STATE.md` — Current status: Phase 10 ready to plan; Phase 9 backend enforcement complete

### Phase 7 substrate (LOCKED — read for capability map + reason taxonomy)
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — D-14 LISTING_STATUS_POLICY (the source of `banner.titleKey/bodyKey/severity` Phase 10 renders); D-14a 5-value reason taxonomy (`spam | policy_violation | fraud | inactive_seller | other`) Phase 10 ListingModerationReasonModal embeds

### Phase 8 substrate (LOCKED — the backend endpoints Phase 10 wraps)
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-CONTEXT.md` — D-01 (5 endpoints), D-02 (success response shape), D-03 (8 known error codes), D-A (Edit field set = seller PUT parity), D-B (open transition matrix), D-C (Restore takes `{ note? }` only), D-D (Edit multipart shape), D-04 (`cannot_moderate_own_listing` middleware), D-14 (`reasonCategory` required on Suspend/Archive/Delete)
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-VERIFICATION.md` — Acceptance shapes Phase 10's calls must hit
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-REVIEW.md` + `08-REVIEW-FIX.md` — Known backend behaviors (especially the WR-02 TOCTOU fix in admin handlers and WR-03 ServiceOrder pause-not-cancel deferral)

### Phase 9 substrate (LOCKED — read-time response shapes Phase 10 consumes)
- `.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md` — D-01 (`includeAllListingStatuses` bypass token used in Phase 10's new GET list endpoint), D-05 (thin payload for non-admin viewers — Phase 10 won't see this in admin paths but will see it in unauth deep-link tests), D-07 (`moderationBadge` admin-only field Phase 10 renders), D-08 (single status-aware GET endpoint Phase 10 reads), D-09 (cart-add 409 surface — Phase 10 handles error display), D-11 (409 body shape Phase 10 normalizes via `ListingModerationError`), D-12..D-15 (confirm-booking TOCTOU refund-first-throw-second — Phase 10's cart screens surface the resulting 409 via the new error class)

### v1.0 Phase 4 + 5 precedents (Phase 10 is the listing-domain mirror)
- `.planning/phases/04-mobile-plumbing-mobile/04-CONTEXT.md` — D-05 (ModerationService single-module rule), D-06 (no split into Admin/User), D-07 (`ModerationError` class shape Phase 10's `ListingModerationError` mirrors), D-09..D-11 (403 interceptor + loop guard — Phase 10 confirms it does NOT fire on listing 409/403)
- `.planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md` — D-01..D-08 (bottom-sheet pattern, severity badges, single generic action modal, optimistic-with-rollback) — Phase 10 follows the same shapes for the listing-mod surface; D-09..D-12 (search + filter + pagination on admin moderation screen) — Phase 10 ports verbatim into the Listings tab; D-16 (Phase 5 shipped backend endpoints alongside mobile UI — Phase 10 mirrors with the new admin listings GET)

### Mobile codebase (existing — required reading for planner/executor)
- `src/services/moderation/ModerationService.ts` (320 lines) — Module Phase 10 extends with 5 new methods. Existing methods at lines 168–319 are the shape to follow (try/catch + `apiClient.<verb>(path, body)` + re-throw). Section comments (`// --- Admin writes ---`, `// --- Reads ---`) extend naturally; Phase 10 may add `// --- Listing moderation writes ---` + `// --- Listing reads ---`.
- `src/services/moderation/errors.ts` — `ModerationError` class. Phase 10 adds `ListingModerationError` sibling per D-14.
- `src/services/http/client.ts` (183 lines) — `apiClient` + Bearer + 403 interceptor + 401 refresh. Phase 10 changes nothing here; reads it to confirm LMOB-02 invariant at line 103.
- `src/screens/CarDetailsScreen.tsx` (1527 lines) — Phase 10 adds: admin Moderate badge (gated on `useAuth().isAdmin`), bottom sheet, status banner above action area, error banner for `ListingModerationError`. Note existing patterns at lines 23–46 (state hooks, status reads, owner/booker computation) — Phase 10 follows the same style.
- `src/screens/SellCarScreen.tsx` (form lines ~25–445, submit at 439) — Phase 10 wires the `adminEdit` route param flag per D-01. Key existing reads: `route.params.carId` (line 30), `isEditMode` (line 31), seller-status gate (line 88), submit (line 439). Phase 10 adds `route.params?.adminEdit` reads alongside.
- `src/screens/AdminModerationScreen.tsx` (709 lines) — Phase 10 extends with Users|Listings tab structure per D-09. Existing user-search + filter + pagination shape (lines roughly mirror Phase 5 D-10..D-12) is ported into the Listings tab implementation.
- `src/components/moderation/ModerationActionModal.tsx` — Reference for D-03's sibling-modal shape (NOT direct reuse). Phase 10 reads to mirror prop conventions + StyleSheet patterns.
- `src/components/moderation/TypedConfirmationModal.tsx` — DIRECT reuse for D-07's Delete escalation. Existing props (sentinel string + onConfirm) take Phase 10's listing-title sentinel verbatim.
- `src/components/moderation/QuickActionSheet.tsx` — Reference for D-09's bottom-sheet pattern (Modal + transparent + animationType="slide"). Phase 10 builds its own `ListingModerationBottomSheet` using the same shape (or reuses if props are general enough).
- `src/components/moderation/SeverityBadge.tsx` — Reuse for status badges in both `CarDetailsScreen` banner + Listings-tab list rows. Existing severity color map ports.
- `src/types/navigation.ts` — Phase 10 adds `adminEdit?: boolean` to `RootStackParamList.SellCar`. No new routes (D-09 puts Listings inside the existing AdminModerationScreen).
- `src/constants/translations.ts` — Phase 10 adds keys as needed but the parity audit + RU final copy is Phase 11 (LQUAL-01). EN placeholders acceptable during Phase 10.
- `src/constants/theme.ts` — `COLORS.moderation.*` Phase 5 extended; Phase 10 may extend with listing-specific severity coloring (`destructive` for deleted, `warning` for suspended, `neutral` for archived) if not already present.

### Backend codebase (existing — Phase 10's cross-repo slice)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` — Phase 10 adds the new `GET /` (listing list) route. Existing 5 PATCH routes (Phase 8) stay untouched. The router is already mounted at `server.js:925` behind `verifyIdToken + requireAdmin + listingModerationRateLimiter`.
- `../backend-services/carEx-services/src/moderation/listingService.js` — Phase 10 adds a `searchListings({ status, q, cursor, limit })` service function returning `{ rows, nextCursor }`. Mirrors v1.0 user-search pattern.
- `../backend-services/carEx-services/src/moderation/listingSchemas.js` — Phase 10 adds `searchListingsQuerySchema` (Zod, `.strict()`). Mirrors `restoreListingSchema` shape.
- `../backend-services/carEx-services/src/models/Car.js` — Phase 9 hide hook lives here. Phase 10's listing-list endpoint MUST pass `setOptions({ includeAllListingStatuses: true })` (Phase 9 D-01) or admin will see nothing.

### External docs
- React Native FlatList + RefreshControl: https://reactnative.dev/docs/flatlist (pagination patterns Phase 10 mirrors)
- React Native Modal animation: https://reactnative.dev/docs/modal (bottom-sheet shape used in `QuickActionSheet`)
- Axios `AbortController`: https://axios-http.com/docs/cancellation (Phase 10's debounced search in Listings tab — mirrors existing user search)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already in `carEx`, do NOT re-create)
- **`apiClient` + Bearer + 401 refresh + 403 user-suspension interceptor** (`src/services/http/client.ts`) — Phase 10's 5 new ModerationService methods piggyback. Zero changes to client.ts. The interceptor's `account_suspended` discriminator already excludes listing 409s — LMOB-02 is mostly UI plumbing.
- **`ModerationService.ts` module pattern** (`export const ModerationService = { ... }`) — Phase 10 extends with 5 new methods + 1 listings-search read method.
- **`ModerationError` class shape** (`src/services/moderation/errors.ts`) — Phase 10's `ListingModerationError` mirrors. Both classes extend `Error`, both expose `code` + `httpStatus` + a few context fields.
- **`TypedConfirmationModal`** (`src/components/moderation/TypedConfirmationModal.tsx`) — Direct reuse for Delete escalation. Sentinel-string prop takes the listing-title.
- **`QuickActionSheet` Modal pattern** (`src/components/moderation/QuickActionSheet.tsx:61`) — Bottom-sheet UX template: `Modal visible transparent animationType="slide"`. Phase 10's `ListingModerationBottomSheet` follows.
- **`ModerationActionModal` Modal pattern** (`src/components/moderation/ModerationActionModal.tsx:137`) — Reference for D-03's sibling modal. Same prop conventions (visible, onClose, onSubmit, transparent + slide animation).
- **`SeverityBadge`** (`src/components/moderation/SeverityBadge.tsx`) — Direct reuse for status badges on CarDetails + Listings-tab list rows. Severity color map exists.
- **`SellCarScreen.tsx` edit mode** (driven by `route.params.carId` + `isEditMode` flag at lines 30–31) — Phase 10 adds `route.params.adminEdit` alongside. Submit at line 439 swaps endpoint based on the flag.
- **`AdminModerationScreen.tsx` user search + filter + pagination pattern** — Phase 10 ports into the Listings tab. Existing axios + AbortController + debounce wiring mirrors verbatim per D-09.
- **`useAuth().isAdmin` + `useAuth().adminRole`** — Phase 4/5 wired; Phase 10 gates the Moderate badge + bottom sheet + Listings tab visibility on `isAdmin === true`.
- **`useLanguage()` + `translations.ts`** — Phase 10 adds keys; Phase 11 LQUAL-01 audits RU+EN parity.

### Reusable Assets (backend — already in `../backend-services/carEx-services`, do NOT re-create)
- **5 admin Edit/Suspend/Archive/Delete/Restore endpoints** at `/api/admin/moderation/listings/:carId[/<action>]` (Phase 8). Phase 10 wraps via the 5 new ModerationService methods.
- **`includeAllListingStatuses: true` query option** (Phase 9 D-01) — Phase 10's new GET listings endpoint uses this to bypass the hide hook.
- **`listingRouter` mount + middleware chain** (server.js:925) — Phase 10 adds the new GET / route on the same router.
- **`LISTING_STATUS_POLICY[status].banner`** in `../backend-services/carEx-services/src/moderation/listingCapabilities.js` (Phase 7 D-14) — Phase 10 reads via the Phase 9 D-05 / D-11 / D-07 response payloads; no direct mobile consumption of the backend map.

### Established Patterns (must honor)
- **Single `ModerationService` module, no split** — Phase 4 D-06. Phase 10 extends, doesn't fork.
- **Module-level object service (`export const Service = { method: async () => {} }`)** — not a class. Phase 4 D-06.
- **`try / catch + console.error + re-throw`** in every service method — Phase 4 / existing ModerationService convention. Phase 10's 5 new methods follow.
- **Optimistic update with rollback** on moderation actions — Phase 5 D-08. Phase 10 D-16 mirrors.
- **Single bottom-sheet modal per surface** — Phase 5 D-06. Phase 10's `ListingModerationBottomSheet` is one modal; reason-collection escalates to a sibling modal (not nested deeper).
- **Sibling component per error/modal class to keep enums grep-able** — Phase 4 / Phase 8 substrate pattern. Phase 10's sibling `ListingModerationError` + sibling `ListingModerationReasonModal` follow.
- **Admin gating reads `useAuth().isAdmin` (boolean)** — never trusts a server response or local flag; AuthContext is the only source of truth on mobile per CLAUDE.md.
- **Backend admin auth is server-side (`verifyIdToken + requireAdmin`)** — mobile `isAdmin` only affects UI visibility, never authorization. Phase 10 stays inside this contract (CLAUDE.md constraint, REQUIREMENTS.md "Auth enforcement" rule).
- **i18n via `useLanguage().t`** — every new user-facing string. RU+EN parity audited in Phase 11.
- **PII minimization on buyer reads** (Phase 9 D-05) — Phase 10 never re-leaks moderation reason / moderatedBy / moderatedAt to a non-admin surface. Admin-only views (CarDetails when isAdmin, AdminModerationScreen Listings tab) are the only places these fields render.

### Integration Points
- **`src/services/moderation/ModerationService.ts`** — extends with 5 new methods + 1 listings-search read.
- **`src/services/moderation/errors.ts`** — adds `ListingModerationError` class.
- **`src/screens/CarDetailsScreen.tsx`** — adds: Moderate badge (admin gate), `ListingModerationBottomSheet` mount, status banner (from `moderationBadge`), error banner for `ListingModerationError`.
- **`src/screens/SellCarScreen.tsx`** — adds `route.params?.adminEdit` reads at lines 30–31 + 88 + 439; bypasses seller-status + OTP gates; swaps PUT to `ModerationService.adminEditListing(carId, ...)`.
- **`src/screens/AdminModerationScreen.tsx`** — extends with `Users | Listings` tab structure. Listings tab embeds the new search + filter + paginated list + per-row Recover.
- **`src/components/moderation/ListingModerationBottomSheet.tsx`** (NEW) — 4-action sheet (Edit / Suspend / Archive / Delete) when active; single Restore button + reasonCategory chip when non-active.
- **`src/components/moderation/ListingModerationReasonModal.tsx`** (NEW) — Reason + note modal for Suspend / Archive / Delete.
- **`src/components/moderation/ListingRestoreModal.tsx`** (NEW) — Thin note-only modal for Restore.
- **`src/types/navigation.ts`** — adds optional `adminEdit?: boolean` to `RootStackParamList.SellCar`.
- **`../backend-services/carEx-services/src/moderation/listingRouter.js`** (MODIFIED) — adds `GET /` route.
- **`../backend-services/carEx-services/src/moderation/listingService.js`** (MODIFIED) — adds `searchListings(...)`.
- **`../backend-services/carEx-services/src/moderation/listingSchemas.js`** (MODIFIED) — adds `searchListingsQuerySchema`.

### Anti-Pattern Warnings
- **Do NOT add listing-moderation methods to `AuthService.ts`.** Phase 4 MOB-01 guardrail still applies; LMOB-01 mirrors it for the listing domain. `grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing' src/services/AuthService.ts` MUST return 0.
- **Do NOT trust mobile-side `isAdmin` for authorization.** Mobile `isAdmin` is for UI visibility only. Backend `requireAdmin` is the only authority. Phase 10 must never pre-emptively short-circuit a moderation call based on local state alone — let the backend rate-limit + admin gate enforce.
- **Do NOT silently drop 409 `listing_not_available` errors** anywhere in cart / confirm-booking. Phase 9 wired the backend; Phase 10 must surface them visibly. (Phase 11 lands the buyer-facing severity-aware banner; Phase 10 ensures the error reaches a visible surface even if the final copy is a placeholder.)
- **Do NOT add a third response interceptor** to `apiClient` for listing errors. The two existing interceptors (403 user-suspension + 401 idToken refresh) are sufficient; listing errors normalize at the per-method level inside `ModerationService` and at cart/confirm-booking call sites. Adding a global interceptor risks the same loop-guard footgun Phase 4 D-11 introduced for `_skipModerationInterceptor`.
- **Do NOT widen the `ModerationError` discriminator** to also accept listing codes. Phase 4 D-07 scoped that class to user-suspension responses. Phase 10's `ListingModerationError` is the listing-domain mirror; they remain two classes.
- **Do NOT bypass the new GET listings endpoint's `includeAllListingStatuses: true` option.** Without it the Phase 9 hide hook filters out the deleted/suspended/archived rows that are the whole point of the Listings tab.
- **Do NOT pre-check `isOwner` and hide the Moderate badge** for an admin viewing their own listing. D-02 makes the badge unconditional; the backend rejects with `cannot_moderate_own_listing` and the mobile surfaces the banner. Hiding the affordance silently is worse UX than an explicit rejection.
- **Do NOT inline-rebuild `multipart/form-data` in `ModerationService.adminEditListing`.** Multer + S3 wiring depends on the exact form layout the seller PUT uses (Phase 8 D-D). Either pass the FormData object through the service, or build it inside the service using a structured input — but never duplicate the field layout logic.
- **Do NOT introduce a separate "delete" route for the Listings tab Recover action.** Restore is the single path back to `active` for all non-active states (Phase 8 D-B). The Recover row-action calls the same `restoreListing` method as the CarDetails flow.
- **Do NOT add a new state-management library** for the bottom-sheet / tab state. Local `useState` + the existing `useAuth` context are sufficient. (CLAUDE.md + PROJECT.md constraint.)

</code_context>

<specifics>
## Specific Ideas

- **`adminEdit` route flag is grep-bait** for Phase 11 LQUAL-03 security review — single literal occurrence in the SellCarScreen branch logic. Tests should assert that the seller-status gate, OTP gate, and `FeatureGateOverlay` are all bypassed when the flag is true, and that the submit endpoint changes accordingly. Mirrors Phase 4's `_skipModerationInterceptor` grep-bait philosophy.
- **Listing title sentinel** (D-08) uses the same `${year} ${makeName} ${modelName}` concatenation `CarCard` already renders. Trimmed + case-insensitive match per D-08a. Forces admin to physically read the listing title above the bottom sheet — same friction-with-purpose as Phase 5's typed-email sentinel.
- **`ListingModerationBottomSheet` should render a count badge** for non-active state (e.g., "Suspended since YYYY-MM-DD" derived from `moderationBadge.moderatedAt`) above the Restore button. Echoes Phase 5 specifics ("show count of history entries as a subtle pill") — tiny UX detail that helps admin reason about how stale the moderation is.
- **Sibling-error-class pattern** (`ListingModerationError` next to `ModerationError`) keeps the two domains independently auditable in Phase 11 LQUAL-03. Specifically: any test importing `ModerationError` operates on user-domain expectations; any test importing `ListingModerationError` operates on listing-domain expectations. No cross-domain code path can accidentally raise the wrong class.
- **The new admin listings GET endpoint (D-11) is the smallest possible cross-repo plan** — one route, one service function, one schema, one test file. Phase 10 should keep it isolated so the merge order is mobile-can-stub vs backend-can-deploy-first either way.
- **Per-row Recover on Listings tab + Restore button inside CarDetails bottom sheet share the same `ModerationService.restoreListing(carId, body)` call.** Two call sites, one service method; both render via the same `ListingRestoreModal` per D-06 (Claude's discretion to fall back to Alert.alert for the row case).
- **`SellCarScreen`'s existing 1527-line size is a known smell** but Phase 10 will NOT refactor it (DEBT-03 deferred). The `adminEdit` flag adds a handful of conditional branches; planner should keep them grep-able with short comments referencing this CONTEXT.md.
- **Status banner above the bottom sheet** (D-17) is the admin counterpart to the buyer-facing banner Phase 11 will land for non-admin viewers. They share the `LISTING_STATUS_POLICY.banner.severity` value but render different copy (admin sees moderationReason + setBy; buyer sees Phase 11 translation keys).

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to follow-up phases or milestones — do not quietly re-introduce:**

- **Buyer-facing severity-aware banner on `CarDetailsScreen`** for non-admin viewers — Phase 11 LBUY-01. Phase 10's status banner (D-17) is admin-only; the non-admin variant has different copy + severity tones + comes from the thin payload's banner block (Phase 9 D-05).
- **Cart banner + disabled checkout** for non-active listings — Phase 11 LBUY-02. Phase 10 only ensures the 409 `listing_not_available` error surfaces somewhere visible (D-15 admin banner); the cart-side buyer UX is Phase 11.
- **RU+EN translation strings + jest literal scanner sweep** — Phase 11 LQUAL-01. Phase 10 adds keys but uses EN placeholders during dev; the parity audit + final copy is Phase 11.
- **`LIST-SECURITY.md` merge-gate review** — Phase 11 LQUAL-03.
- **Listing-history admin GET endpoint** (`GET /api/admin/moderation/listings/:carId/history`). Phase 8 deferred; Phase 10 doesn't need it (the current state is in `moderationBadge`). If Phase 10's UAT surfaces a need for historical state, carve out a Phase 10.5 plan or roll into v1.2.
- **Bulk admin listings panel with batch actions** — REQUIREMENTS Out of Scope; v1.2+.
- **Hard-delete UI affordance** — REQUIREMENTS Out of Scope.
- **Listing edit-history audit diff replay UI** — v1.2 carry-forward (already in ROADMAP).
- **Auto-cancel / auto-refund of in-flight orders touching a moderated listing** — anti-pattern, REQUIREMENTS Out of Scope. Admin retains manual order-cancel tools.
- **ServiceOrder pause-not-cancel banner UX on buyer order detail** — Phase 8 WR-03 / Phase 9 deferred. Phase 11 may surface or carry to v1.2.
- **Listings-tab sort options** (price ascending, date ascending, etc.) — v1 sorts by `moderatedAt DESC` for non-active filters and `createdAt DESC` for active. Per-column sort is v1.2+.
- **Listings-tab CSV export** — MOD2-* deferred.
- **`AdminEditListingScreen` (dedicated screen, not reuse of SellCarScreen)** — explicitly rejected at D-01. If field-coverage drift ever becomes a real maintenance burden, revisit at v1.2+.
- **`AuthService.ts` split into domain services (DEBT-01)** — Phase 10 keeps AuthService untouched. ModerationService remains separate per LMOB-01.
- **Refactor of `SellCarScreen.tsx`'s 1527-line size (DEBT-03)** — deferred. Phase 10 adds conditional branches; no extraction.
- **Push / email notifications to seller when listing moderated (NOTF-*)** — v1.2 carry-forward.

</deferred>

---

*Phase: 10-mobile-plumbing-admin-listing-ui*
*Context gathered: 2026-05-29*

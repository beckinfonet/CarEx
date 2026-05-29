# Phase 10: Mobile Plumbing + Admin Listing UI - Research

**Researched:** 2026-05-29
**Domain:** React Native 0.83 + TypeScript mobile admin UI + thin cross-repo backend slice (Node/Express + Mongoose) for admin listings list endpoint
**Confidence:** HIGH

## Summary

Phase 10 is the listing-domain mirror of v1.0 Phases 4 + 5, executed as a single phase because the surface area is materially smaller (one admin entry point — the `CarDetailsScreen` bottom sheet — vs. v1.0's three screens). Every reusable substrate is in place: `apiClient` (with Bearer + 403-account-suspended-only interceptor + 401 refresh), the `ModerationService` object-module + `ModerationError` sibling-class pattern, the `QuickActionSheet` + `ModerationActionModal` + `TypedConfirmationModal` + `SeverityBadge` bottom-sheet/modal pattern, the `AdminModerationScreen` search+filter+pagination+AbortController shape, the Phase 8 backend write endpoints (with their 9 known error codes), and the Phase 9 status-aware `GET /api/cars/:id` that already returns `moderationBadge` for admin viewers. The thin cross-repo backend slice (`GET /api/admin/moderation/listings`) is a near-verbatim port of `GET /api/admin/users/search` (`src/admin/router.js:93-206`) with Car-model substitutions and the `includeAllListingStatuses: true` bypass.

The biggest planning leverage points are: (1) the `adminEdit` route-flag wiring in `SellCarScreen.tsx` (skipping 3 gates + 1 endpoint swap at known line numbers), (2) the sibling `ListingModerationReasonModal` + `ListingRestoreModal` that mirror `ModerationActionModal` but embed the 5-value listing taxonomy without dragging in severity/role pickers, (3) the two-modal stack for Delete (reason modal → typed-confirmation modal with listing-title sentinel), (4) the optimistic flip on the `fetchedCar.moderationBadge` shape with rollback, and (5) the verification that the existing 403 `account_suspended` interceptor at `client.ts:103` literally cannot fire on listing 409s. All five are grep-stable.

**Primary recommendation:** Mirror v1.0 Phase 4 (sibling error class + module-extension) and Phase 5 (bottom sheet + reason modal + typed confirmation + optimistic-with-rollback + AdminModerationScreen extension) verbatim with listing-domain rename. Build `ListingModerationBottomSheet`, `ListingModerationReasonModal`, `ListingRestoreModal` as siblings (NOT generalizations of existing components — that's drift bait). Keep `apiClient` untouched. Extend `ModerationService.ts` in-place with 6 new methods (5 writes + 1 listings-search read). Plan should land in 8–11 plans (substrate → service methods → error class → modals → bottom sheet → CarDetails wiring → SellCar adminEdit wiring → AdminModerationScreen tabs → backend GET → tests).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Reuse `SellCarScreen.tsx` with an `adminEdit?: boolean` route param. When `route.params.adminEdit === true`: skip seller-status APPROVED gate (line 88), skip OTP/phone re-verification gates, skip `FeatureGateOverlay`/`restrictedFeatures` check on the seller path. Swap PUT to `ModerationService.adminEditListing(carId, multipartFormData)` at line 439. On submit success: navigate back to `CarDetailsScreen` with a refresh hint.

**D-02:** No client-side "cannot edit your own listing" pre-check. The Moderate badge is shown to admins on every listing regardless of `isOwner`. Mobile surfaces resulting `400 cannot_moderate_own_listing` as UI alert/banner.

**D-03:** New `ListingModerationReasonModal` component (sibling to `ModerationActionModal`, NOT reuse). Props: `{ action: 'suspend' | 'archive' | 'delete', carId, listingTitle, onSubmit, onClose, visible }`. Reason category three-card vertical radio with 5 values (`spam | policy_violation | fraud | inactive_seller | other`), required. Note textarea optional, max 2000 chars. Confirm/Cancel.

**D-04:** Sibling modal rationale: user-mod's `ModerationActionModal` handles 5 actions with conditional field sets including severity + role pickers irrelevant to listings, and embeds the 4-value `ReasonCategory` enum. Listing taxonomy is the distinct 5-value enum.

**D-05:** Edit is NOT routed through the reason modal. Tapping Edit pushes `SellCarScreen` with `adminEdit: true`.

**D-06:** Restore opens a thinner sibling modal `ListingRestoreModal` — note-only field (optional, max 2000), no reason category. Confirm calls `ModerationService.restoreListing(carId, { note? })`.

**D-07:** Delete escalates from `ListingModerationReasonModal` to `TypedConfirmationModal`. Flow: admin picks reason + note → taps Confirm → first modal stays mounted, `TypedConfirmationModal` overlays with sentinel gate → admin types → Confirm enables → wrapping modal calls `ModerationService.deleteListing(carId, body)`.

**D-08:** Sentinel = listing title (`${year} ${makeName} ${modelName}`, e.g., `2018 Toyota Camry`). Sourced from full Car doc (admin always has this via Phase 9 D-07). Already rendered above the bottom sheet.

**D-08a:** Case-insensitive + whitespace-trimmed match (matches existing `TypedConfirmationModal` behavior).

**D-08b:** Make/model name resolution: full Car doc carries `makeName` + `modelName` denormalized. Fall back to `makeId` / `modelId` if missing. No `useVehicleCatalog` round-trip from inside the modal.

**D-09:** Extend `AdminModerationScreen` with top-level `Users | Listings` tabs. No new route, no new screen file. Listings tab: search bar (text + listing UID prefix), filter chips `All | Active | Suspended | Archived | Deleted` (single-select), infinite scroll, per-row "Recover" inline button when `status === 'deleted'`.

**D-10:** Row tap pushes `CarDetailsScreen`. Listing row visual: thumbnail + title + price + status badge.

**D-11:** New backend endpoint `GET /api/admin/moderation/listings?status=&q=&cursor=&limit=`. Mounted on existing `listingRouter`. Uses `Car.find(filter).setOptions({ includeAllListingStatuses: true })`. Cursor pagination keyed on `{ moderatedAt, _id }` for non-active, `{ createdAt, _id }` for `status=active`. Page size default 25. Response: `{ rows: ListingSearchItem[], nextCursor }`.

**D-12:** Entry point: `AdminDashboardScreen` already routes to `AdminModerationScreen`. Tabs are inside that screen; admin lands on Users by default.

**D-13:** Listing-moderation 403/409 errors NEVER trigger the 403 interceptor at `client.ts:103` (matches `error === 'account_suspended'` only). Phase 8/9 codes (`cannot_moderate_own_listing` 400, `listing_not_available` 409, `listing_not_found` 404, `invalid_transition` / `already_in_state` / `not_moderated` / `invalid_field` / `no_changes` 400) all bypass.

**D-14:** New error class `ListingModerationError` (sibling to `ModerationError` in `src/services/moderation/errors.ts`) — see code shape in §Code Examples below.

**D-15:** Admin-side error surfacing: inline banner on `CarDetailsScreen` for `cannot_moderate_own_listing` + `already_in_state`; `Alert.alert` for `listing_not_found`.

**D-16:** Optimistic status flip with rollback on Suspend / Archive / Delete / Restore. On Confirm: close modal → flip the `moderationBadge` locally → fire `ModerationService.<action>(...)`. On error: revert badge + Alert. On success: refresh from response.

**D-17:** Status banner inside `CarDetailsScreen` reflects current `moderationBadge`. When badge present (non-active status to admin): banner above the action area shows status + reasonCategory chip + (admin-only) moderationReason free text + setBy admin info.

### Claude's Discretion

- Exact icon glyph for the "Moderate" badge on `CarDetailsScreen` (lucide candidates: `ShieldAlert`, `Shield`, `MoreVertical`).
- Page size for the new listings endpoint (25 suggested; D-11 documented).
- Whether `ListingModerationReasonModal` and `ListingRestoreModal` live in `src/components/moderation/` (sibling to existing user-mod components) — likely yes.
- Whether per-row Recover on Listings tab uses `Alert.alert` (simpler) or opens `ListingRestoreModal` (consistent). Recommendation: reuse `ListingRestoreModal`.
- Exact tab-switch UI on `AdminModerationScreen` — segmented control / filled pill row / simple chip row. Planner picks based on what already exists.
- Whether listings-tab search debounces at 300ms or different cadence — default 300ms.
- Whether `ListingModerationError` and catch wrappers live inside `ModerationService.ts` or extract to `src/services/moderation/listingErrors.ts`. Default: extend `errors.ts` so both classes co-locate.
- Exact `Car` schema field used for "moderatedAt" sort — simpler answer is `Car.moderatedAt` (denormalized on Car per Phase 8 D-C-2 / D-15).
- Whether `adminEditListing` accepts a `FormData` directly or structured `{ fields, existingImageUrls, files }`. **Recommend structured** — keeps SellCarScreen call site readable.
- Exact behavior on `409 listing_not_available` mid-Edit submission. Default: surface as `Alert.alert` and pop back to CarDetails for re-fetch.

### Deferred Ideas (OUT OF SCOPE)

- Buyer-facing severity-aware banner on `CarDetailsScreen` for non-admin viewers — Phase 11 LBUY-01.
- Cart banner + disabled checkout for non-active listings — Phase 11 LBUY-02.
- RU+EN translation strings + jest literal scanner sweep — Phase 11 LQUAL-01. Phase 10 adds keys with EN placeholders OK during dev.
- `LIST-SECURITY.md` merge-gate review — Phase 11 LQUAL-03.
- Listing-history admin GET endpoint — Phase 8 deferred; revisit in Phase 10.5 or v1.2 only if UAT surfaces a need.
- Bulk admin listings panel with batch actions — v1.2+.
- Hard-delete UI affordance — out of scope.
- Listing edit-history audit diff replay UI — v1.2 carry-forward.
- Auto-cancel / auto-refund of in-flight orders touching a moderated listing — anti-pattern, out of scope.
- ServiceOrder pause-not-cancel banner UX on buyer order detail — Phase 11 / v1.2.
- Listings-tab sort options (price asc, date asc) — v1.2+.
- Listings-tab CSV export — MOD2-* deferred.
- `AdminEditListingScreen` (dedicated screen) — explicitly rejected at D-01.
- `AuthService.ts` split (DEBT-01) — deferred.
- Refactor of `SellCarScreen.tsx`'s 1527-line size (DEBT-03) — deferred. Phase 10 adds conditional branches; no extraction.
- Push / email notifications to seller when listing moderated (NOTF-*) — v1.2 carry-forward.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LMOB-01 | Five new `ModerationService` methods (`adminEditListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`) live in `src/services/moderation/ModerationService.ts` — extend, not split | §Standard Stack (ModerationService extension), §Code Examples (method signatures), §Architecture Patterns (Pattern 1: extend, don't split) |
| LMOB-02 | Listing-moderation 409/403 NOT routed through user-suspension interceptor | §Common Pitfalls (Pitfall 1: third interceptor anti-pattern), §Architecture Patterns (Pattern 2: discriminator check), code at `src/services/http/client.ts:103` literally matches only `error === 'account_suspended'` |
| LUI-01 | Admin-only "Moderate" badge on `CarDetailsScreen` opening bottom-sheet of 4 actions + status banner | §Code Examples (CarDetailsScreen integration), §Architecture Patterns (Pattern 3: bottom-sheet from QuickActionSheet shape) |
| LUI-02 | Four visually-distinct actions (Edit / Suspend / Archive / Delete with typed confirmation) | §Standard Stack (lucide icons), §Code Examples (`ListingModerationBottomSheet` shape), severity → COLORS map |
| LUI-03 | Restore replaces 4 actions on non-active listings + reason-category chip | §Architecture Patterns (Pattern 4: status-aware sheet contents), §Code Examples |
| LUI-04 | Admin-only Deleted listings view via Users\|Listings tabs in `AdminModerationScreen` | §Standard Stack (port from existing user-search shape), §Code Examples (tab structure), §Architecture Patterns (Pattern 5: widen-existing-surface) |

## Project Constraints (from CLAUDE.md)

The CLAUDE.md file establishes directives that Phase 10 plans MUST honor — listed here so the planner can verify compliance.

| Constraint | Source | Phase 10 Implication |
|------------|--------|----------------------|
| Tech stack mobile: RN 0.83.1 + TS 5.8.3 + axios 1.13.4 + AsyncStorage | CLAUDE.md "Constraints (mobile)" | No new networking/state-mgmt libs — use existing `apiClient` + `useState` only |
| Don't introduce new state-management or networking libs | CLAUDE.md "Constraints (mobile)" | NO Zustand / Redux / MobX / Recoil / TanStack Query / SWR / @reduxjs/toolkit. Local `useState` + AuthContext only |
| Extend `AuthService.ts` or split sensibly; do not rewrite wholesale | CLAUDE.md "Constraints (mobile)" | AuthService stays untouched. ModerationService extends in-place |
| Tech stack backend: Node/Express + Mongoose + MongoDB Atlas. Routes under `/api/admin/moderation/*`. Follow existing admin-auth pattern (`callerUid` param → `getAdminStatus`) | CLAUDE.md "Constraints (backend)" | Phase 10's `GET /api/admin/moderation/listings` route mounts on existing chain (`verifyIdToken + requireAdmin + listingModerationRateLimiter`); already at `server.js:925` |
| Admin enforcement server-side on every request — NEVER trust mobile `isAdmin` | CLAUDE.md "Auth enforcement" | Mobile `useAuth().isAdmin` gates UI VISIBILITY only. Backend `requireAdmin` is the only authority |
| Data preservation: Suspending/revoking MUST never destroy order/audit history | CLAUDE.md "Data preservation" | Listing soft-delete keeps Car doc. Restore appends new audit row. Honored by Phase 8 substrate; Phase 10 never bypasses |
| Order safety: In-flight orders touching a suspended provider are *paused*, not auto-cancelled | CLAUDE.md "Order safety" | Phase 10 surfaces 409 from cart-add/confirm-booking; never auto-cancels |
| i18n: All moderator and affected-user strings are RU-first with EN parity | CLAUDE.md "i18n" | Phase 10 adds keys with EN placeholders during dev (Phase 11 LQUAL-01 audits parity) |
| No breaking changes to existing auth/cart/payments flows | CLAUDE.md "No breaking changes" | LMOB-02 verification proves listing 409s don't trigger session logout. Tests assert apiClient interceptors unchanged |
| Secrets hygiene: No new hardcoded keys | CLAUDE.md "Secrets hygiene" | Phase 10 ships no new keys |
| GSD Workflow Enforcement: Use `/gsd-execute-phase` for planned work | CLAUDE.md "GSD Workflow Enforcement" | Phase 10 executes via `/gsd-execute-phase` |
| Naming: Components PascalCase + Service suffix on services | CLAUDE.md "Naming Patterns" | `ListingModerationBottomSheet.tsx`, `ListingModerationReasonModal.tsx`, `ListingRestoreModal.tsx` — PascalCase. ModerationService stays as object module (not class) |
| StyleSheet definitions inline at bottom of component file | CLAUDE.md "Code Style" | Phase 10 components follow inline `StyleSheet.create` at bottom |
| All color refs use `COLORS.*` (never hardcoded hex) except neutrals | CLAUDE.md "StyleSheet & Theming" | Phase 10 banners use `COLORS.moderation.*` + `COLORS.warning` + `COLORS.destructive` + `COLORS.success*` |
| Module-level object export for services (not class) | CLAUDE.md "Module Design" | ModerationService extends with named methods, not class |
| Context-based state management | CLAUDE.md "Pattern Overview" | Phase 10 uses existing AuthContext for `isAdmin` gating; no new contexts |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Admin listing moderation HTTP calls (5 writes + 1 list-read) | Mobile service module (`ModerationService.ts`) | Backend API (`/api/admin/moderation/listings/*`) | Mobile only wraps backend authority; backend admin gate is the single source of truth |
| Admin-only "Moderate" badge gating | Mobile UI (CarDetailsScreen) | AuthContext (`isAdmin` boolean) | UI visibility only — backend rejects independently with `cannot_moderate_own_listing` / `requireAdmin` 403 |
| Bottom sheet action UI | Mobile UI component (`ListingModerationBottomSheet`) | — | Pure presentational; parent owns state |
| Reason category + note collection | Mobile UI component (`ListingModerationReasonModal`) | — | Pure presentational; embeds 5-value LISTING taxonomy from Phase 7 D-14a |
| Listing-title typed sentinel for Delete | Mobile UI component (`TypedConfirmationModal` reuse) | Wrapping reason modal | Existing component takes `targetEmail` prop — Phase 10 passes listing title; case-insensitive + trimmed already supported |
| Restore-note collection | Mobile UI component (`ListingRestoreModal`) | — | Pure presentational; thin variant of reason modal (no reasonCategory per Phase 8 D-C) |
| Status banner above bottom sheet | Mobile UI inline section on CarDetailsScreen | Phase 9 `moderationBadge` payload | Reads from full Car doc (admin path); severity → COLORS map |
| Listings tab on AdminModerationScreen | Mobile UI extension in-place | New backend GET endpoint | Widen-existing-surface; ports user-search shape from same screen |
| Listings GET endpoint | Backend (`listingRouter.js`) | `searchListings()` service function + Zod query schema | Sibling to existing `searchUsers` in `src/admin/router.js:93`; bypasses Phase 9 hide hook via `setOptions({ includeAllListingStatuses: true })` |
| Listing 409/403 error normalization | Mobile service layer per-method catch (`ListingModerationError`) | — | NO global interceptor — per-method normalization keeps cross-domain audit boundary clean (Phase 4 D-07 + LQUAL-03 grep) |
| Admin-side error banner / Alert.alert | Mobile UI on CarDetailsScreen | — | D-15 split: `cannot_moderate_own_listing` + `already_in_state` → inline banner; `listing_not_found` → Alert.alert |
| AdminEdit form submission | `SellCarScreen.tsx` (reused) with `adminEdit?: boolean` route param | `ModerationService.adminEditListing` | D-01 reuse — skip seller-status / OTP / FeatureGate gates when flag set; same multipart shape |

## Standard Stack

### Core (already in package.json — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.83.1 | Core mobile framework | Already in use [VERIFIED: package.json] |
| typescript | 5.8.3 | Type safety | Already in use [VERIFIED: package.json] |
| axios | 1.13.4 | HTTP client | Used by existing `apiClient` — Phase 10 extends method calls only [VERIFIED: package.json] |
| @react-native-async-storage/async-storage | 2.2.0 | Token persistence | Existing AuthContext use — Phase 10 doesn't touch [VERIFIED: package.json] |
| @react-navigation/native-stack | 7.11.0 | Stack navigation | Phase 10 adds `adminEdit?: boolean` to `RootStackParamList.SellCar` only [VERIFIED: package.json] |
| lucide-react-native | 0.563.0 | Icon library | Phase 10 uses `Pencil` / `Shield` / `Archive` / `Trash2` / `ShieldAlert` / `RotateCcw` icons [VERIFIED: package.json + existing `QuickActionSheet.tsx:4`] |
| react-native-image-picker | 8.2.1 | Image multipart upload (used by existing SellCarScreen path; Phase 10 inherits) | Existing — Phase 10 reuses through SellCarScreen [VERIFIED: package.json + `SellCarScreen.tsx:6`] |
| react-native-safe-area-context | 5.6.2 | Safe-area handling | Existing — `QuickActionSheet.tsx:3` uses `useSafeAreaInsets` for bottom padding [VERIFIED: package.json + code] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Phase 10 introduces ZERO new dependencies (CLAUDE.md constraint) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `useState` for tab/sheet state | Zustand / Redux | CLAUDE.md FORBIDS new state-mgmt libs. Local state + AuthContext sufficient [VERIFIED: CLAUDE.md "Constraints" section] |
| `Modal` + transparent + animationType="slide" | @gorhom/bottom-sheet | New lib forbidden. Existing `QuickActionSheet.tsx` pattern works (Modal + Pressable overlay + Pressable inner) [VERIFIED: code at `QuickActionSheet.tsx:61-145`] |
| Generalize `QuickActionSheet` to handle listing actions | Build sibling `ListingModerationBottomSheet` | Generalization invites drift (Phase 11 LQUAL-03 grep-bait per Phase 8 sibling-over-reuse pattern). Sibling keeps each component narrow and grep-able. CONTEXT.md D-04 already chose sibling for reason modal — apply consistently |
| Generalize `ModerationActionModal` to handle listing reasons | Build sibling `ListingModerationReasonModal` (D-03) | LOCKED at D-03/D-04. User-mod modal embeds 4-value user-domain `ReasonCategory` enum + severity + role pickers; listing modal embeds distinct 5-value listing taxonomy. Sibling keeps enums non-overlapping and grep-able |
| Reuse `CarCard.tsx` for Listings tab rows | Build slim `AdminListingRow.tsx` (or inline renderer) | `CarCard.tsx` is the user-facing browse card with full details (price formatting, favorite button, navigation). Listings tab row is admin-utility (thumbnail + title + status badge + Recover button only). Recommend slim inline renderer or new `AdminListingRow.tsx` |

**Installation:** None — all dependencies already in `package.json`.

**Version verification:**
```bash
node -e "console.log(require('/Users/beckmaldinVL/development/mobileApps/carEx/package.json').dependencies)" | grep -E "axios|react-native|lucide"
```
[VERIFIED: package.json] All required versions installed. Phase 10 adds no new deps.

## Architecture Patterns

### System Architecture Diagram

```
[Admin user] → CarDetailsScreen
    │
    ├── isAdmin === true → ShieldAlert "Moderate" badge (top-right)
    │   │
    │   └── tap → ListingModerationBottomSheet (Modal, transparent, slide)
    │       │
    │       ├── moderationBadge?.status === 'active' (or absent) → 4 action rows
    │       │   ├── Edit (pencil-neutral) → push SellCar with { carId, adminEdit: true }
    │       │   │   └── SellCarScreen (D-01 reuse, skip 3 gates)
    │       │   │       └── submit → ModerationService.adminEditListing(carId, structured)
    │       │   │           └── apiClient.patch(/api/admin/moderation/listings/:carId) multipart
    │       │   ├── Suspend (warning) → ListingModerationReasonModal{action: 'suspend'}
    │       │   │   └── reason+note → ModerationService.suspendListing(carId, body)
    │       │   ├── Archive (neutral) → ListingModerationReasonModal{action: 'archive'}
    │       │   └── Delete (destructive) → ListingModerationReasonModal{action: 'delete'}
    │       │       └── reason+note → TypedConfirmationModal{targetEmail: listingTitle}
    │       │           └── typed match → ModerationService.deleteListing(carId, body)
    │       │
    │       └── moderationBadge?.status !== 'active' (suspended/archived/deleted) →
    │           reasonCategory chip + single Restore button
    │           └── ListingRestoreModal{} → note? → ModerationService.restoreListing(carId, body?)
    │
    └── All 5 service methods → apiClient.{patch} → backend (Phase 8 endpoints)
        │
        ├── success (200) → optimistic flip already applied → merge response.listing
        └── error → catch in ModerationService wrapping → throw ListingModerationError
            │
            ├── ListingModerationError.code === 'cannot_moderate_own_listing' → inline banner
            ├── ListingModerationError.code === 'already_in_state' → inline banner + rollback
            ├── ListingModerationError.code === 'listing_not_found' → Alert.alert + rollback
            └── any other → Alert.alert generic + rollback

[Admin user] → AdminDashboard → AdminModerationScreen
    │
    └── tab control { Users | Listings } (NEW)
        │
        ├── Users tab (existing — unchanged)
        └── Listings tab (NEW)
            │
            ├── search bar (raw TextInput + submit button, AbortController dedupe)
            ├── filter chip row: All | Active | Suspended | Archived | Deleted (single-select)
            ├── FlatList paginated rows
            │   └── ListItem: thumbnail + title + price + SeverityBadge
            │       ├── tap → navigate('CarDetails', { carId })
            │       └── if status === 'deleted' → Recover button
            │           └── ListingRestoreModal (or Alert.alert) → restoreListing
            └── ModerationService.searchListings({ status, q, cursor, limit })
                └── apiClient.get(/api/admin/moderation/listings?...) [NEW BACKEND ROUTE]

Backend: GET /api/admin/moderation/listings (Phase 10 cross-repo slice)
    │
    ├── mount: server.js:925 (existing chain, no new mount)
    │   verifyIdToken → requireAdmin → listingModerationRateLimiter → listingRouter
    ├── listingRouter.js adds: router.get('/', handler)
    ├── handler:
    │   ├── Zod parse: searchListingsQuerySchema.strict() ({ status?, q?, cursor?, limit? })
    │   ├── listingService.searchListings(filter, cursor, limit)
    │   │   └── Car.find(filter)
    │   │       .setOptions({ includeAllListingStatuses: true })  ← Phase 9 D-01 bypass
    │   │       .sort({ moderatedAt: -1, _id: -1 } | { createdAt: -1, _id: -1 })
    │   │       .limit(limit + 1)
    │   │       .lean()
    │   └── return { rows: ListingSearchItem[], nextCursor: string | null }
    │
    └── shape mirrors src/admin/router.js:93-206 (searchUsers) verbatim with Car substitutions
```

### Recommended Project Structure

```
src/
├── services/
│   ├── moderation/
│   │   ├── ModerationService.ts          # EXTENDED — adds 5 listing writes + 1 listing read
│   │   └── errors.ts                     # EXTENDED — adds ListingModerationError sibling class
│   └── http/
│       └── client.ts                     # UNCHANGED — Phase 10 confirms LMOB-02 invariant only
├── components/
│   └── moderation/
│       ├── ListingModerationBottomSheet.tsx   # NEW — Modal + 4 action rows | Restore button
│       ├── ListingModerationReasonModal.tsx   # NEW — sibling to ModerationActionModal (D-03)
│       ├── ListingRestoreModal.tsx            # NEW — thin note-only modal (D-06)
│       └── AdminListingRow.tsx                # OPTIONAL — slim row for Listings tab (or inline)
├── screens/
│   ├── CarDetailsScreen.tsx              # MODIFIED — Moderate badge + bottom sheet + banner
│   ├── SellCarScreen.tsx                 # MODIFIED — route.params?.adminEdit gates + endpoint swap
│   └── AdminModerationScreen.tsx         # MODIFIED — Users|Listings tab structure + Listings panel
├── types/
│   └── navigation.ts                     # MODIFIED — adds adminEdit?: boolean to SellCar
├── constants/
│   ├── translations.ts                   # MODIFIED — listing-mod keys (EN placeholders ok)
│   └── theme.ts                          # OPTIONAL — extends COLORS.moderation with listing severities (warning/neutral/destructive) if not directly mapping to existing palette

../backend-services/carEx-services/
├── src/moderation/
│   ├── listingRouter.js                  # MODIFIED — adds GET / route block
│   ├── listingService.js                 # MODIFIED — adds searchListings({status,q,cursor,limit})
│   └── listingSchemas.js                 # MODIFIED — adds searchListingsQuerySchema (Zod .strict)
└── (no new files in backend slice; Phase 7+8 substrate already in place)
```

### Pattern 1: Extend ModerationService Module, Don't Split (LMOB-01)

**What:** Phase 10 adds 5 write methods + 1 listings-search read method to the existing `ModerationService` object module. No fork, no class, no sub-namespace.

**When to use:** Always — Phase 4 D-06 established the single-module rule.

**Example:** [VERIFIED: `src/services/moderation/ModerationService.ts:168-320`]

```typescript
// EXISTING shape (lines 168-180):
export const ModerationService = {
  // --- Admin writes ---
  suspend: async (targetUid: string, body: SuspendBody) => {
    try {
      const response = await apiClient.post(`/api/admin/moderation/${targetUid}`, { action: 'suspend', ...body });
      return response.data;
    } catch (error) {
      console.error('Failed to suspend user', error);
      throw error;
    }
  },
  // ... 6 more existing methods
};

// Phase 10 EXTENDS with new sections (planner adds after existing methods):
//   // --- Listing moderation writes ---
//   adminEditListing, suspendListing, archiveListing, deleteListing, restoreListing
//   // --- Listing moderation reads ---
//   searchListings
```

### Pattern 2: Sibling Error Class with Per-Method Catch Wrap (LMOB-01 + LMOB-02)

**What:** `ListingModerationError` lives next to `ModerationError` in `src/services/moderation/errors.ts`. The 5 new ModerationService methods catch axios errors at the per-method level and translate `error.response?.data?.error` codes into a typed `ListingModerationError` before re-throwing.

**When to use:** Per CONTEXT D-14. Mirrors v1.0 Phase 4 D-07 (`ModerationError` was scoped to user-suspension responses; listing domain gets its own class).

**Why this pattern (not a third axios interceptor):** Phase 4 D-11 introduced a global `_skipModerationInterceptor` loop guard precisely because a global response interceptor + a refresh listener can recurse. Adding a third interceptor for listing 409s re-introduces that footgun, requires another loop guard, and breaks Phase 11 LQUAL-03's "one cross-cutting concern per interceptor" review. Per-method catch keeps the listing-domain error normalization local and grep-able. The two existing interceptors at `client.ts` (403 user-suspension + 401 idToken refresh) already cover their narrow concerns and listing 409s naturally pass through both [VERIFIED: `client.ts:98-126` + `client.ts:139-183` — neither matches on `error === 'listing_not_available'`].

**Example:**

```typescript
// src/services/moderation/errors.ts — EXTENDED (D-14 verbatim shape)
export class ModerationError extends Error { /* existing, unchanged */ }

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
  ) {
    super(`ListingModerationError: ${code}`);
    this.name = 'ListingModerationError';
  }
}

// Helper inside ModerationService.ts (private to the module) — translates axios error → typed error
function toListingModerationError(error: unknown): ListingModerationError {
  const axiosErr = error as { response?: { status?: number; data?: any } };
  const data = axiosErr.response?.data;
  return new ListingModerationError(
    data?.error ?? 'unknown',
    data?.listingStatus,
    data?.reasonCategory,
    data?.banner,
    data?.refundId,
    data?.refundFailed,
    axiosErr.response?.status,
  );
}
```

### Pattern 3: Bottom Sheet — Modal + Transparent + animationType="slide" + Pressable Overlay

**What:** A `Modal` with `transparent` + `animationType="slide"`, an outer `<Pressable onPress={onClose}>` overlay (rgba(0,0,0,0.6)), and an inner `<Pressable onPress={() => {}}>` sheet card that stops the press from bubbling. `useSafeAreaInsets()` for bottom padding.

**When to use:** Every bottom-sheet surface — matches `QuickActionSheet.tsx:61-145` verbatim. Phase 10's `ListingModerationBottomSheet` is built fresh (sibling — per CONTEXT D-09 mention) but uses the same shape.

**Why fresh, not reuse:** `QuickActionSheet` hard-codes user-domain actions (`suspend / unsuspend / revoke_role / edit_profile / delete_profile`) and target user fields (`target.brokerStatus`, `target.email`, `hasBroker && hasLogistics` dual-role logic). Listing actions are a different vocabulary; embedding both invites the same drift the Phase 7 D-09 sibling-audit-collection decision avoided. Sibling component shape is consistent with sibling reason modal (D-03/D-04) and sibling error class (D-14).

**Example:** [VERIFIED: `src/components/moderation/QuickActionSheet.tsx:61-145`]

```typescript
// Skeleton of ListingModerationBottomSheet (planner fills body)
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil, Shield, Archive, Trash2, RotateCcw, ShieldAlert } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

export type ListingModerationAction = 'edit' | 'suspend' | 'archive' | 'delete' | 'restore';

export interface ListingModerationBottomSheetProps {
  visible: boolean;
  listingTitle: string;
  moderationBadge?: {
    status: 'suspended' | 'archived' | 'deleted';
    reasonCategory?: string;
    moderationReason?: string;
    moderatedBy?: string;
    moderatedAt?: string;
  };
  onSelect: (action: ListingModerationAction) => void;
  onClose: () => void;
}

export const ListingModerationBottomSheet: React.FC<ListingModerationBottomSheetProps> = ({
  visible, listingTitle, moderationBadge, onSelect, onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isActive = !moderationBadge; // No badge means active (admin path; Phase 9 D-07 omits key when active)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.headerTitle} numberOfLines={1}>{listingTitle}</Text>

          {isActive ? (
            <>
              <ActionRow icon={<Pencil size={20} color={COLORS.accent} />} label="Edit" onPress={() => onSelect('edit')} />
              <ActionRow icon={<Shield size={20} color={COLORS.warning} />} label="Suspend" onPress={() => onSelect('suspend')} />
              <ActionRow icon={<Archive size={20} color={COLORS.textSecondary} />} label="Archive" onPress={() => onSelect('archive')} />
              <ActionRow icon={<Trash2 size={20} color={COLORS.destructive} />} label="Delete" onPress={() => onSelect('delete')} />
            </>
          ) : (
            <>
              <View style={styles.reasonChip}><Text>{moderationBadge.reasonCategory}</Text></View>
              <ActionRow icon={<RotateCcw size={20} color={COLORS.successFg} />} label="Restore" onPress={() => onSelect('restore')} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
```

### Pattern 4: Optimistic Update with Rollback (D-16)

**What:** Mirrors Phase 5 D-08 pattern at `AdminModerationScreen.tsx:239-282`. On Confirm: snapshot `prevBadge` → flip badge locally → fire service call → on error revert and Alert; on success merge response.

**Example:** [VERIFIED: `AdminModerationScreen.tsx:239-282` for the user-domain version]

```typescript
// Inside CarDetailsScreen — admin handler
const handleListingActionSubmit = async (
  action: 'suspend' | 'archive' | 'delete' | 'restore',
  body: any,
) => {
  // 1. snapshot prior state
  const prevBadge = fetchedCar.moderationBadge ?? null;
  const prevStatus = fetchedCar.status ?? 'active';

  // 2. optimistic flip
  const nextStatus = action === 'restore' ? 'active' : action === 'delete' ? 'deleted' : action === 'suspend' ? 'suspended' : 'archived';
  setFetchedCar((c: any) => ({
    ...c,
    status: nextStatus,
    moderationBadge: nextStatus === 'active' ? undefined : { status: nextStatus, reasonCategory: body.reasonCategory, moderatedAt: new Date().toISOString() },
  }));

  // 3. close sheet immediately
  setBottomSheetVisible(false);

  try {
    // 4. fire service call
    const fn = action === 'restore' ? ModerationService.restoreListing
      : action === 'suspend' ? ModerationService.suspendListing
      : action === 'archive' ? ModerationService.archiveListing
      : ModerationService.deleteListing;
    const result = await fn(carId, body);

    // 5. merge authoritative response.listing
    setFetchedCar((c: any) => ({ ...c, ...result.listing }));
  } catch (err) {
    // 6. rollback
    setFetchedCar((c: any) => ({ ...c, status: prevStatus, moderationBadge: prevBadge ?? undefined }));
    if (err instanceof ListingModerationError) {
      if (err.code === 'cannot_moderate_own_listing' || err.code === 'already_in_state') {
        setErrorBanner(err.code); // inline banner
      } else if (err.code === 'listing_not_found') {
        Alert.alert(t.error, 'Listing not found');
        navigation.goBack();
      } else {
        Alert.alert(t.error, err.code);
      }
    } else {
      Alert.alert(t.error, 'Unexpected error');
    }
  }
};
```

### Pattern 5: Widen-Existing-Surface for Listings Tab (D-09)

**What:** AdminModerationScreen gains a top-level `Users | Listings` tab control. Tabs are inside the existing screen — no new route, no new screen file.

**Why:** Mirrors v1.0 D-03 (AdminManagementScreen repurpose pattern). Reuses existing screen infrastructure (`SafeAreaView`, header, `FlatList` + `RefreshControl` + `AbortController`, ChipButton component). Keeps the admin's mental model unified ("one moderation screen, two domains").

**Implementation sketch:**

```typescript
// Top of AdminModerationScreen body:
type ScopeTab = 'users' | 'listings';
const [scopeTab, setScopeTab] = useState<ScopeTab>('users');

// Separate state buckets per tab (different data shapes):
// Users tab — existing state (users, nextCursor, query, roleFilter, stateFilter)
// Listings tab — NEW parallel state (listings, listingNextCursor, listingQuery, listingStatusFilter)

// Inside render — between header and search/list area:
<View style={styles.scopeTabRow}>
  <TabButton label={T.tabUsers} active={scopeTab === 'users'} onPress={() => setScopeTab('users')} />
  <TabButton label={T.tabListings} active={scopeTab === 'listings'} onPress={() => setScopeTab('listings')} />
</View>

// Conditional body:
{scopeTab === 'users' ? <UsersTabBody /> : <ListingsTabBody />}
```

The tab control component (`TabButton`) can reuse the existing `ChipButton` shape from `AdminModerationScreen.tsx:597-611` with a `selected` styling variant, or be a thin segmented-control row. CONTEXT.md leaves this as Claude's Discretion; recommend `ChipButton` reuse to avoid introducing a new shape.

### Anti-Patterns to Avoid

- **Adding listing-mod methods to `AuthService.ts`** — `grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing' src/services/AuthService.ts` MUST return 0. Mirror of Phase 4 MOB-01 [VERIFIED: AuthService grep precedent in CONTEXT].
- **Trusting mobile-side `isAdmin` for authorization** — UI visibility only. Backend `requireAdmin` is authoritative. Phase 10 must never pre-emptively short-circuit a moderation call based on local state.
- **Silently dropping 409 `listing_not_available` errors** in cart/confirm-booking — Phase 9 wired the backend; Phase 10 must surface them visibly even if final copy is placeholder.
- **Adding a third response interceptor** to `apiClient` for listing errors — re-introduces the loop-guard footgun Phase 4 D-11 fixed. Normalize at per-method level (Pattern 2).
- **Widening `ModerationError` discriminator** to accept listing codes — Phase 4 D-07 scoped that class. Sibling class only.
- **Bypassing `includeAllListingStatuses: true`** in the new GET endpoint — Phase 9 hide hook filters non-active rows out, defeating the Listings tab.
- **Pre-checking `isOwner` and hiding the Moderate badge** for self-listings — D-02 explicit: backend rejects with `cannot_moderate_own_listing`; mobile surfaces the banner explicitly.
- **Inline-rebuilding multipart in `ModerationService.adminEditListing`** — multer + S3 wiring depends on exact form layout. Use structured input → service builds FormData OR pass FormData through. Never duplicate layout logic.
- **Separate "delete" route for the Listings tab Recover action** — Restore is the single path back to `active` for all non-active states (Phase 8 D-B). Same `restoreListing` method.
- **New state-management library** for sheet / tab state — CLAUDE.md + PROJECT.md forbid. Local `useState` + existing AuthContext only.
- **Forking `apiClient`** for listing requests — single client per CLAUDE.md "single source of truth"; Phase 10 doesn't touch `client.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet (slide-up modal with overlay tap-to-dismiss) | Custom Animated.View + PanResponder | RN Modal + `animationType="slide"` + Pressable overlay (pattern at `QuickActionSheet.tsx:61-145`) | Existing component path is shipped + tested + has safe-area + cancel-row + handle pattern |
| Sentinel typed-confirmation | Custom modal with input + matcher | Reuse `TypedConfirmationModal` from `src/components/moderation/TypedConfirmationModal.tsx` directly with `targetEmail={listingTitle}` | Already does case-insensitive + trimmed match (`TypedConfirmationModal.tsx:41-43`), already has destructive-bordered card style, already has KeyboardAvoidingView + Pressable overlay |
| Severity badge for listings tab rows | Custom pill | Reuse `SeverityBadge` from `src/components/moderation/SeverityBadge.tsx` — extend `STATE_TO_PALETTE_KEY` map if listing severities need new palette keys (warning/neutral/destructive could remap from existing user `featureLimited`/`permaBanned`/`blockedReview`, or new palette entries — planner picks) | Existing component has accessibility, lineHeight pixel-stability, theme-driven coloring |
| Cursor pagination on listings | Custom `_id` + skip/limit | Mirror `searchUsers` cursor pattern at `src/admin/router.js:36-57` (base64(JSON({sortField, _id}))) verbatim — same encode/decode + same `limit + 1 → hasMore` heuristic | Mobile already consumes this cursor shape via `SearchUsersResult`; uniform contract minimizes client logic |
| Multer + S3 multipart for admin edit | New upload pipeline | Reuse `upload.array('images', 25)` already wired on `listingRouter.js:82-87` Edit route via the seller-PUT path (Phase 8 D-D); Phase 10 mobile only assembles `FormData` (same shape as `SellCarScreen.tsx:397-435`) | Phase 8 D-D-2 explicit: same S3 bucket, same multer instance, no new credentials |
| Listing-mod admin auth on backend | Custom middleware | `verifyIdToken + requireAdmin + listingModerationRateLimiter` already mounted at `server.js:925`; Phase 10's new GET inherits the chain unchanged | Phase 7 substrate + Phase 8 inheritance |
| Listing 409 error class | Custom error normalization on each call site | Single `ListingModerationError` class + helper `toListingModerationError(err)` in `ModerationService.ts` (D-14) | One class = one parsing path for cart / CarDetails / confirm-booking all surfacing the same 409 |
| Foreground refresh / token-refresh logic for new screens | Custom AppState listeners | Existing Phase 4 D-13 `useAppStateRefresh` + Phase 5 D-12 idToken refresh + 401 single-flight retry at `client.ts:128-183` handle this for all screens | Already covers cross-screen behavior; Phase 10 inherits |

**Key insight:** Every reusable piece is already there. Phase 10 is overwhelmingly a wiring + sibling-component-creation phase, NOT a build-from-scratch phase. The temptation to "improve" by generalizing existing components (e.g., make `QuickActionSheet` handle listing rows too, or extend `ModerationError` with listing codes) is the highest-leverage anti-pattern — it bloats grep surface for Phase 11 LQUAL-03 and risks cross-domain bug introduction.

## Runtime State Inventory

Phase 10 has no rename/refactor/migration component. The DEBT-03 SellCarScreen 1527-line refactor is explicitly deferred (CONTEXT `<deferred>`). Section omitted as inapplicable — Phase 10 is additive (new files + extensions to existing files; no string renames + no data migrations).

## Common Pitfalls

### Pitfall 1: Adding a Third Response Interceptor for Listing 409s

**What goes wrong:** Future plan introduces a global axios response interceptor at `client.ts` that catches `error === 'listing_not_available'` and centralizes the normalization. Looks clean, but immediately triggers the loop-guard requirement (because the new interceptor + existing refresh listener can recurse on a listing 409 mid-refresh) and breaks the LMOB-02 invariant ("listing-moderation 409/403 NOT routed through user-suspension interceptor" — a third interceptor is itself a routing mechanism). Also breaks Phase 11 LQUAL-03's "one cross-cutting concern per interceptor" review.

**Why it happens:** "Don't repeat yourself" instinct on per-method catch blocks.

**How to avoid:** Plan per-method catch wrappers in `ModerationService.ts`. The grep invariant `grep -c "interceptors.response.use" src/services/http/client.ts` must return EXACTLY 2 (the two existing interceptors). Any plan that bumps it to 3 violates LMOB-02.

**Warning signs:** Plan task says "extract listing error handling into a global interceptor" or "centralize 409 parsing in client.ts".

### Pitfall 2: Optimistic Flip on `fetchedCar` Without Snapshotting Both `status` AND `moderationBadge`

**What goes wrong:** Admin taps Suspend → handler flips `fetchedCar.status = 'suspended'` but forgets to also synthesize the `moderationBadge` object → banner doesn't render until backend response arrives → 200ms gap of "status changed but no banner" → looks broken.

**Why it happens:** Two state fields backed by one source (Phase 9 D-07 — admin viewers see full Car + separate `moderationBadge`). Optimistic flip must mutate both.

**How to avoid:** Snapshot pattern uses BOTH `prevStatus` AND `prevBadge`. Optimistic state writes BOTH. Rollback restores BOTH. See Pattern 4 code example above.

**Warning signs:** Plan task action says "setFetchedCar({ ...c, status: 'suspended' })" without mentioning `moderationBadge`.

### Pitfall 3: TypedConfirmationModal Treats `targetEmail` as Email-Specific

**What goes wrong:** Phase 10 reuses `TypedConfirmationModal` and passes `targetEmail={listingTitle}` for Delete. The modal internally calls input `keyboardType="email-address"` + `autoCapitalize="none"` + `autoCorrect={false}` (`TypedConfirmationModal.tsx:78-81`). For a listing title like "2018 Toyota Camry", `email-address` keyboard hides the spacebar on iOS → admin can't type spaces → mismatch forever.

**Why it happens:** The component name + prop name imply email exclusivity.

**How to avoid:** Either (a) accept `keyboardType` as an optional prop with default `"email-address"` (planner adds prop), (b) hard-code `keyboardType="default"` inside `TypedConfirmationModal` based on whether the target string contains a space, OR (c) the `ListingModerationReasonModal` Delete branch could wrap `TypedConfirmationModal` AND add a custom prop hint OR Phase 10 builds a sibling `TypedListingConfirmationModal` that mirrors `TypedConfirmationModal.tsx:1-181` but uses `keyboardType="default"`. **Recommendation:** add `keyboardType?: KeyboardTypeOptions` prop to `TypedConfirmationModal` with default `"email-address"`; Delete-listing path passes `"default"`. Single-line change preserves existing user-mod call sites.

**Warning signs:** Plan reuses `TypedConfirmationModal` for listing-title delete without addressing keyboard type.

### Pitfall 4: SellCarScreen `adminEdit` Flag Read in Wrong Effect Hooks

**What goes wrong:** `SellCarScreen.tsx:75-79` has `useEffect(() => { if (user && user.sellerStatus === 'APPROVED') { checkProfileAndAutofill(); } }, [user])`. The adminEdit path skips this. But there's another effect at `SellCarScreen.tsx:87-138` that ALSO gates on `user?.sellerStatus === 'APPROVED'` to fetch the existing car. If only the FIRST gate is patched, the admin can land on the form with no car data loaded.

**Why it happens:** Multiple effects gating on the same `sellerStatus === 'APPROVED'` predicate; planner only patches one.

**How to avoid:** Plan task action MUST grep-list every `sellerStatus === 'APPROVED'` occurrence in `SellCarScreen.tsx` (4 occurrences as of current code: lines 76, 88; possibly more). Wave-2 plan adds `|| route.params?.adminEdit` to ALL gates and also bypasses the `GatedScreenWrapper` (line 501) by conditionally rendering body without wrapper when `adminEdit === true`. Test asserts: with `adminEdit: true`, all three (a) profile autofill, (b) car fetch, (c) wrapper bypass fire.

**Warning signs:** Plan task patches only one `sellerStatus === 'APPROVED'` site or only the submit at line 439.

### Pitfall 5: `GatedScreenWrapper` Wraps SellCarScreen Body in `adminEdit` Path

**What goes wrong:** `SellCarScreen.tsx:501-951` wraps the entire body in `<GatedScreenWrapper capability="create_listing">`. If admin themselves has `restrictedFeatures: ['create_listing']` they'd get a full-screen gate overlay → can't even SEE the form they're trying to admin-edit on someone else's behalf.

**Why it happens:** Capability gate is designed for the seller-self-edit path, not admin-on-behalf-of-seller.

**How to avoid:** When `route.params?.adminEdit === true`, conditionally render the body WITHOUT the wrapper. Either: (a) `route.params?.adminEdit ? bodyJSX : <GatedScreenWrapper>...{bodyJSX}</GatedScreenWrapper>`, or (b) `GatedScreenWrapper` itself gains an `enabled?: boolean` prop (default true) that short-circuits to `<>{children}</>` when false. Per CLAUDE.md DEBT-03 deferral (don't refactor SellCarScreen wholesale), recommend (a) inline conditional in SellCarScreen.

**Warning signs:** Plan doesn't enumerate the `GatedScreenWrapper` bypass as a distinct adminEdit gate.

### Pitfall 6: Listing-Title Sentinel Concatenation Doesn't Match What Admin Reads

**What goes wrong:** The bottom sheet header shows the listing title rendered via one concatenation (e.g., `${car.make} ${car.model} ${car.year}` — order varies by component). The `TypedConfirmationModal` Delete handler computes a different concatenation (`${year} ${makeName} ${modelName}` per D-08). Admin types what they see ("Toyota Camry 2018") but the sentinel match expects "2018 Toyota Camry" → mismatch forever.

**Why it happens:** Multiple existing renderings of the title concat in different orders. `CarCard.tsx` may do one, `CarDetailsScreen.tsx:559` does `{car.make} {car.model}{car.trimLevel ? ' ${car.trimLevel}' : ''} {car.year}`, Phase 9 D-05 thin payload backend builds `${car.year} ${car.makeName} ${car.modelName}`.

**How to avoid:** Plan locks the canonical concatenation as `${year} ${makeName} ${modelName}` (matches Phase 9 D-05 backend thin-payload + D-08 explicit). Bottom sheet header AND TypedConfirmationModal both render via a shared `buildListingTitle(car)` helper (e.g., in `src/utils/listingTitle.ts`). Acceptance: grep for `${.*\.year.*\.make.*\.model}` patterns; require exactly 1 helper definition + N call sites that import it.

**Warning signs:** Plan code examples show different concat orders in different files.

### Pitfall 7: AdminModerationScreen Listings Tab Reuses User-Tab AbortController

**What goes wrong:** Existing `abortRef` at `AdminModerationScreen.tsx:101` is wired into the users `runSearch`. If Listings tab adds a parallel `searchListings` flow but reuses the same `abortRef`, switching tabs aborts the wrong request → race conditions + stale data.

**Why it happens:** Convenience.

**How to avoid:** Listings tab gets its own `listingsAbortRef`. The `useEffect` that triggers re-search on tab/filter change uses the right ref per tab. Acceptance: `grep -c "AbortController" src/screens/AdminModerationScreen.tsx` ≥ 2 after Phase 10.

### Pitfall 8: Backend `searchListings` Cursor Includes `moderatedAt` That May Be Null

**What goes wrong:** D-11 says cursor keys on `{ moderatedAt, _id }` for non-active filters and `{ createdAt, _id }` for `status=active`. But for `status=All` filter, `moderatedAt` is `null` for active rows (Phase 7 D-07 default) → cursor encode chokes or returns inconsistent results across boundaries.

**Why it happens:** `moderatedAt` is null until first moderation action.

**How to avoid:** For `status=all` filter, ALWAYS sort by `createdAt` (most recent listings first regardless of moderation status). Cursor uses `{ createdAt, _id }`. For per-status filters (`active`/`suspended`/`archived`/`deleted`), backend can choose: simplest is to always sort by `createdAt` and accept that admin sees the listings in creation order. If product wants "most recently moderated first" for moderated states, use `coalesce(moderatedAt, createdAt)` as the sort key — but that complicates the cursor. **Recommendation:** ship v1 with `createdAt DESC, _id DESC` sort ACROSS ALL status filters (simpler, single cursor shape, no null handling). Defer `moderatedAt DESC` sort to v1.2 if admin UAT requests it; CONTEXT D-11 explicitly grants planner discretion on the sort field.

**Warning signs:** Plan tries to thread two cursor encoders (one for `moderatedAt`, one for `createdAt`).

### Pitfall 9: `apiClient.patch` for adminEditListing Multipart Body Doesn't Set Content-Type

**What goes wrong:** Mobile passes a `FormData` to `apiClient.patch('/api/admin/moderation/listings/:carId', formData)`. Without explicit `headers: { 'Content-Type': 'multipart/form-data' }`, axios may serialize as JSON (especially with custom transformRequest). Backend multer fails with "Unexpected end of form".

**Why it happens:** axios 1.x auto-detects FormData IF native FormData is in use, but React Native's FormData polyfill has quirks. Existing `SellCarScreen.tsx:439-441` sets `headers: { 'Content-Type': 'multipart/form-data' }` explicitly — Phase 10 must do the same.

**How to avoid:** ModerationService.adminEditListing helper code sets `headers: { 'Content-Type': 'multipart/form-data' }` on the apiClient call. Test asserts header is on the request via mock adapter.

**Warning signs:** Plan code example for `adminEditListing` omits the explicit Content-Type header.

### Pitfall 10: Backend `searchListings` `q` Search Hits Substring on `description` (PII Risk)

**What goes wrong:** D-11 says `q` matches `title` (year+makeName+modelName), `makeName`, `modelName`, and listing `_id` prefix. If implementer adds `description` (or `phoneNumber`/`telegramUsername`) to the `$or`, admin search becomes a PII-trawl endpoint — admin could search "555-123" and surface all listings with phone numbers matching that string.

**Why it happens:** "More fields = better search" instinct.

**How to avoid:** Plan EXPLICITLY enumerates the 4 fields D-11 allows. Acceptance: grep the backend `searchListings` function for `description|phoneNumber|telegramUsername` — must return 0 inside the $or clause.

**Warning signs:** Plan task action says "match on all text fields" instead of enumerating.

## Code Examples

### `ListingModerationError` class (D-14 verbatim)

[VERIFIED: matches CONTEXT D-14 shape; compatible with Phase 8 D-03 + Phase 9 D-11 error bodies]

```typescript
// src/services/moderation/errors.ts — EXTENDED
// (Existing ModerationError class preserved verbatim above this block.)

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
      | string,                                                       // Future codes pass through
    public listingStatus?: 'suspended' | 'archived' | 'deleted',
    public reasonCategory?: string,
    public banner?: {
      titleKey: string;
      bodyKey: string;
      severity: 'warning' | 'neutral' | 'destructive';
    },
    public refundId?: string,
    public refundFailed?: boolean,
    public httpStatus?: number,
  ) {
    super(`ListingModerationError: ${code}`);
    this.name = 'ListingModerationError';
  }
}
```

**Code coverage map (D-14 union covers Phase 8 D-03's known errors):**
- Phase 8 `KNOWN_LISTING_ERRORS` (verified at `listingRouter.js:95-109`): `listing_not_found`, `already_in_state`, `not_moderated`, `invalid_field`, `no_changes`, `invalid_payload`, `cannot_moderate_own_listing`, `invalid_make`, `invalid_model` (9 codes)
- Phase 9 `listing_not_available` (verified at `server.js:1120` + `server.js:1177`) — only fires in cart-add + confirm-booking surfaces (NOT in moderation handlers); class still carries it for cart/checkout error surface
- D-14 union explicit codes (8): `listing_not_available, listing_not_found, cannot_moderate_own_listing, already_in_state, not_moderated, invalid_field, no_changes, invalid_payload`
- D-14 fallback `| string` covers `invalid_make` + `invalid_model` (Edit-time) without forcing the union to grow

**Recommendation:** Add `invalid_make` and `invalid_model` to the explicit union for completeness (they're Edit-path Phase 8 errors that mobile will surface). Result: 10-entry union.

### Five new ModerationService methods (LMOB-01)

```typescript
// src/services/moderation/ModerationService.ts — EXTENDED at bottom
// (Existing methods preserved verbatim above this block; new section below.)

import { ListingModerationError } from './errors';

// Listing-domain types
export type ListingReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'inactive_seller'
  | 'other';

export interface SuspendListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}
export interface ArchiveListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}
export interface DeleteListingBody {
  reasonCategory: ListingReasonCategory;
  note?: string;
}
export interface RestoreListingBody {
  note?: string;
}

export interface AdminEditListingInput {
  fields: {
    makeId?: string;
    modelId?: string;
    trimLevel?: string;
    wheelbase?: string;
    fuel?: string;
    currency?: string;
    description?: string;
    bodyType?: string;
    engine?: string;
    transmission?: string;
    drivetrain?: string;
    mpg?: string;
    condition?: string;
    exteriorColor?: string;
    interiorColor?: string;
    interiorMaterial?: string;
    phoneNumber?: string;
    telegramUsername?: string;
    year?: number;
    price?: number;
    mileage?: number;
    seats?: number;
    doors?: number;
    knownIssues?: string[];
  };
  existingImageUrls?: string[];
  newFiles?: Array<{ uri: string; type?: string; name?: string }>;
}

export interface ListingActionResponse {
  ok: true;
  listing: {
    _id: string;
    status: 'active' | 'suspended' | 'archived' | 'deleted';
    moderatedBy?: string;
    moderatedAt?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
  };
  action: {
    _id: string;
    action: 'suspend' | 'archive' | 'delete' | 'restore' | 'edit';
    fromStatus: string;
    toStatus: string;
    createdAt: string;
  };
}

export interface ListingSearchItem {
  _id: string;
  status: 'active' | 'suspended' | 'archived' | 'deleted';
  makeName?: string;
  modelName?: string;
  year?: number;
  price?: number;
  firstPhotoUrl?: string | null;
  sellerId: string;
  createdAt: string;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  listingId?: string;
}

export interface SearchListingsQuery {
  status?: 'active' | 'suspended' | 'archived' | 'deleted';
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface SearchListingsResult {
  rows: ListingSearchItem[];
  nextCursor: string | null;
}

function toListingModerationError(error: unknown): ListingModerationError {
  const axiosErr = error as { response?: { status?: number; data?: any } };
  const data = axiosErr.response?.data;
  return new ListingModerationError(
    data?.error ?? 'unknown',
    data?.listingStatus,
    data?.reasonCategory,
    data?.banner,
    data?.refundId,
    data?.refundFailed,
    axiosErr.response?.status,
  );
}

// Extend the existing ModerationService object — NEW SECTION at the bottom of the object literal
// (planner appends; preserves existing methods byte-identical):

//   // --- Listing moderation writes ---

//   adminEditListing: async (carId: string, input: AdminEditListingInput): Promise<ListingActionResponse> => {
//     const formData = new FormData();
//     Object.entries(input.fields).forEach(([k, v]) => {
//       if (v === undefined) return;
//       if (k === 'knownIssues') {
//         formData.append(k, JSON.stringify(v));
//       } else {
//         formData.append(k, typeof v === 'number' ? String(v) : v);
//       }
//     });
//     if (input.existingImageUrls) {
//       formData.append('existingImageUrls', JSON.stringify(input.existingImageUrls));
//     }
//     (input.newFiles ?? []).forEach((file, idx) => {
//       // @ts-ignore RN FormData accepts {uri,type,name}
//       formData.append('images', { uri: file.uri, type: file.type, name: file.name ?? `image_${idx}.jpg` });
//     });
//     try {
//       const response = await apiClient.patch(
//         `/api/admin/moderation/listings/${carId}`,
//         formData,
//         { headers: { 'Content-Type': 'multipart/form-data' } },  // Pitfall 9
//       );
//       return response.data;
//     } catch (error) {
//       console.error('Failed to admin-edit listing', error);
//       throw toListingModerationError(error);
//     }
//   },
//
//   suspendListing: async (carId, body): Promise<ListingActionResponse> => {
//     try {
//       const response = await apiClient.patch(`/api/admin/moderation/listings/${carId}/suspend`, body);
//       return response.data;
//     } catch (error) {
//       console.error('Failed to suspend listing', error);
//       throw toListingModerationError(error);
//     }
//   },
//
//   archiveListing: async (carId, body): Promise<ListingActionResponse> => {
//     try {
//       const response = await apiClient.patch(`/api/admin/moderation/listings/${carId}/archive`, body);
//       return response.data;
//     } catch (error) {
//       console.error('Failed to archive listing', error);
//       throw toListingModerationError(error);
//     }
//   },
//
//   deleteListing: async (carId, body): Promise<ListingActionResponse> => {
//     try {
//       const response = await apiClient.patch(`/api/admin/moderation/listings/${carId}/delete`, body);
//       return response.data;
//     } catch (error) {
//       console.error('Failed to delete listing', error);
//       throw toListingModerationError(error);
//     }
//   },
//
//   restoreListing: async (carId, body: RestoreListingBody = {}): Promise<ListingActionResponse> => {
//     try {
//       const response = await apiClient.patch(`/api/admin/moderation/listings/${carId}/restore`, body);
//       return response.data;
//     } catch (error) {
//       console.error('Failed to restore listing', error);
//       throw toListingModerationError(error);
//     }
//   },
//
//   // --- Listing moderation reads ---
//
//   searchListings: async (
//     query: SearchListingsQuery,
//     config?: { signal?: AbortSignal },
//   ): Promise<SearchListingsResult> => {
//     try {
//       const response = await apiClient.get('/api/admin/moderation/listings', {
//         params: query,
//         signal: config?.signal,
//       });
//       const data = response.data ?? {};
//       return {
//         rows: Array.isArray(data.rows) ? data.rows : [],
//         nextCursor: data.nextCursor ?? null,
//       };
//     } catch (error) {
//       if (isAbortError(error)) throw error;
//       console.error('Failed to search listings', error);
//       throw error;     // searchListings does NOT throw ListingModerationError —
//                        // 500-class errors and `invalid_q` etc. are infra/dev bugs,
//                        // not listing-domain rejections; let raw axios error surface
//                        // to the screen's error-state EmptyState.
//     }
//   },
// };
```

### `ListingModerationReasonModal` props sketch (D-03)

[VERIFIED: pattern derived from `ModerationActionModal.tsx:30-38` props + D-03 verbatim]

```typescript
// src/components/moderation/ListingModerationReasonModal.tsx

export type ListingReasonAction = 'suspend' | 'archive' | 'delete';

export type ListingReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'inactive_seller'        // 5-value taxonomy — distinct from user-domain (4-value)
  | 'other';

export interface ListingModerationReasonModalPayload {
  reasonCategory: ListingReasonCategory;
  note?: string;
}

export interface ListingModerationReasonModalProps {
  visible: boolean;
  action: ListingReasonAction;
  carId: string;
  listingTitle: string;                                                         // for header
  submitting?: boolean;
  onSubmit: (payload: ListingModerationReasonModalPayload) => void;             // For suspend/archive: caller fires service. For delete: caller opens TypedConfirmationModal next, then fires service on its onConfirm.
  onClose: () => void;
}

// Internal LISTING_REASON_OPTIONS (5 entries — vertical three-card radio per D-03):
const LISTING_REASON_OPTIONS: Array<{ value: ListingReasonCategory; key: string }> = [
  { value: 'spam',              key: 'listingReasonSpam' },
  { value: 'policy_violation',  key: 'listingReasonPolicyViolation' },
  { value: 'fraud',             key: 'listingReasonFraud' },
  { value: 'inactive_seller',   key: 'listingReasonInactiveSeller' },
  { value: 'other',             key: 'listingReasonOther' },
];

// StyleSheet mirrors ModerationActionModal.tsx:423-541 verbatim (sheet/overlay/handle/header/footer)
// Body section: vertical card-radio for reason + multiline note input + Confirm/Cancel footer
// Delete branch is recognizable: action === 'delete' → header copy reflects destructive intent
// (Confirm button color → COLORS.destructive; existing user-mod delete uses COLORS.destructive too).
```

### CarDetailsScreen integration sketch (LUI-01 + D-15 + D-17)

```typescript
// CarDetailsScreen.tsx — additions inside the existing component

import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react-native';
import { ListingModerationBottomSheet } from '../components/moderation/ListingModerationBottomSheet';
import { ListingModerationReasonModal } from '../components/moderation/ListingModerationReasonModal';
import { ListingRestoreModal } from '../components/moderation/ListingRestoreModal';
import { TypedConfirmationModal } from '../components/moderation/TypedConfirmationModal';
import { ModerationService } from '../services/moderation/ModerationService';
import { ListingModerationError } from '../services/moderation/errors';
import { buildListingTitle } from '../utils/listingTitle';   // Pitfall 6 helper

// Inside component body (alongside existing state at ~line 39-46):
const { isAdmin } = useAuth() as unknown as { isAdmin: boolean };
const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
const [reasonModalAction, setReasonModalAction] = useState<'suspend' | 'archive' | 'delete' | null>(null);
const [restoreModalVisible, setRestoreModalVisible] = useState(false);
const [typedConfirmVisible, setTypedConfirmVisible] = useState(false);
const [pendingDeletePayload, setPendingDeletePayload] = useState<{ reasonCategory: string; note?: string } | null>(null);
const [errorBanner, setErrorBanner] = useState<string | null>(null);

// Helper — listing title for sentinel (Pitfall 6)
const listingTitle = buildListingTitle(car);   // `${year} ${makeName} ${modelName}`

// In render — admin Moderate badge in headerRight (next to existing share/edit icons at line 451):
{isAdmin && (
  <TouchableOpacity style={styles.iconButton} onPress={() => setBottomSheetVisible(true)} accessibilityLabel="Moderate listing">
    <ShieldAlert size={24} color={COLORS.warning} />
  </TouchableOpacity>
)}

// In render — status banner ABOVE actionButtonsRow (above line 597 — between sellerCard and actionButtonsRow):
{isAdmin && fetchedCar?.moderationBadge && (
  <View style={[styles.adminBanner, { backgroundColor: COLORS.moderation[severityToPaletteKey(fetchedCar.moderationBadge.banner?.severity)] ?? COLORS.cardBackground }]}>
    <Text>{fetchedCar.moderationBadge.status}: {fetchedCar.moderationBadge.reasonCategory}</Text>
    {fetchedCar.moderationBadge.moderationReason && <Text>{fetchedCar.moderationBadge.moderationReason}</Text>}
  </View>
)}

// In render — error banner (D-15)
{errorBanner && (
  <View style={styles.errorBanner}>
    <Text>{T[mapErrorCodeToKey(errorBanner)] ?? errorBanner}</Text>
    <TouchableOpacity onPress={() => setErrorBanner(null)}>
      <X size={16} />
    </TouchableOpacity>
  </View>
)}

// At end of return tree (before SafeAreaView closes):
<ListingModerationBottomSheet
  visible={bottomSheetVisible}
  listingTitle={listingTitle}
  moderationBadge={fetchedCar?.moderationBadge}
  onSelect={(action) => {
    setBottomSheetVisible(false);
    if (action === 'edit') {
      navigation.navigate('SellCar', { carId, adminEdit: true });
    } else if (action === 'restore') {
      setRestoreModalVisible(true);
    } else {
      setReasonModalAction(action);
    }
  }}
  onClose={() => setBottomSheetVisible(false)}
/>

{reasonModalAction && (
  <ListingModerationReasonModal
    visible={true}
    action={reasonModalAction}
    carId={carId}
    listingTitle={listingTitle}
    onSubmit={(payload) => {
      if (reasonModalAction === 'delete') {
        // D-07: keep reason modal mounted, overlay typed confirm
        setPendingDeletePayload(payload);
        setTypedConfirmVisible(true);
      } else {
        handleListingActionSubmit(reasonModalAction, payload);
        setReasonModalAction(null);
      }
    }}
    onClose={() => setReasonModalAction(null)}
  />
)}

{typedConfirmVisible && (
  <TypedConfirmationModal
    visible={true}
    action="delete_profile"                                            /* string is fine; copy keyed off targetEmail */
    targetEmail={listingTitle}                                         /* sentinel = listing title (D-08) */
    keyboardType="default"                                             /* Pitfall 3: spaces in title */
    onConfirm={() => {
      setTypedConfirmVisible(false);
      setReasonModalAction(null);
      handleListingActionSubmit('delete', pendingDeletePayload!);
      setPendingDeletePayload(null);
    }}
    onClose={() => {
      setTypedConfirmVisible(false);
      setPendingDeletePayload(null);
    }}
  />
)}

{restoreModalVisible && (
  <ListingRestoreModal
    visible={true}
    carId={carId}
    onSubmit={(body) => {
      handleListingActionSubmit('restore', body);
      setRestoreModalVisible(false);
    }}
    onClose={() => setRestoreModalVisible(false)}
  />
)}
```

### Backend `GET /api/admin/moderation/listings` (cross-repo slice, D-11)

[VERIFIED: shape mirrors `src/admin/router.js:93-206` verbatim with Car-model substitutions]

```javascript
// ../backend-services/carEx-services/src/moderation/listingRouter.js — APPENDED route block

const service = require('./listingService');
const schemas = require('./listingSchemas');

router.get('/', async (req, res) => {
  // Zod parse query (planner adds searchListingsQuerySchema to listingSchemas.js)
  const parsed = schemas.searchListingsQuerySchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await service.searchListings(parsed.data);
    return res.json(result);                                                    // { rows, nextCursor }
  } catch (err) {
    console.error('[GET /api/admin/moderation/listings] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ../backend-services/carEx-services/src/moderation/listingService.js — APPENDED function

const STATUS_VALUES = Car.schema.path('status').enumValues;     // ['active','suspended','archived','deleted']

function encodeCursor(item) {
  if (!item) return null;
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt.toISOString(), _id: item._id.toString() }),
    'utf8',
  ).toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return { createdAt: new Date(parsed.createdAt), _id: parsed._id };
  } catch (_err) {
    return undefined;
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchListings({ status, q, cursor, limit = 25 }) {
  const filter = {};
  const andClauses = [];

  if (status) {
    filter.status = status;                                                     // Phase 9 hide hook BYPASSED below — required to surface non-active rows
  }

  if (q && q.trim().length > 0) {
    const escaped = escapeRegex(q.trim());
    // ONLY title / make / model / _id prefix per D-11 + Pitfall 10 (no description/phone/telegram)
    filter.$or = [
      { makeName: { $regex: escaped, $options: 'i' } },
      { modelName: { $regex: escaped, $options: 'i' } },
      { listingId: { $regex: '^' + escaped } },
    ];
  }

  const cursorParsed = cursor ? decodeCursor(cursor) : null;
  if (cursor && cursorParsed === undefined) {
    return { rows: [], nextCursor: null };                                      // invalid cursor — treat as empty
  }
  if (cursorParsed) {
    andClauses.push({
      $or: [
        { createdAt: { $lt: cursorParsed.createdAt } },
        { createdAt: cursorParsed.createdAt, _id: { $lt: cursorParsed._id } },
      ],
    });
  }
  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  const rows = await Car.find(filter)
    .setOptions({ includeAllListingStatuses: true })                            // Phase 9 D-01 BYPASS — without this, hide hook filters out non-active
    .sort({ createdAt: -1, _id: -1 })                                           // Per Pitfall 8 — uniform sort across all status filters
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const result = items.map((c) => ({
    _id: c._id.toString(),
    status: c.status,
    makeName: c.makeName,
    modelName: c.modelName,
    year: c.year,
    price: c.price,
    firstPhotoUrl: Array.isArray(c.imageUrls) && c.imageUrls.length > 0 ? c.imageUrls[0] : null,
    sellerId: c.sellerId,
    createdAt: c.createdAt,
    moderatedAt: c.moderatedAt,
    moderationReason: c.moderationReason,
    listingId: c.listingId,
  }));

  return {
    rows: result,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
}

module.exports.searchListings = searchListings;

// ../backend-services/carEx-services/src/moderation/listingSchemas.js — APPENDED

const searchListingsQuerySchema = z.object({
  status: z.enum(['active', 'suspended', 'archived', 'deleted']).optional(),
  q: z.string().max(128).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
}).strict();

module.exports.searchListingsQuerySchema = searchListingsQuerySchema;
```

### SellCarScreen `adminEdit` gates (D-01)

[VERIFIED: line numbers from `SellCarScreen.tsx` — gates at 76, 88, 501; submit at 439]

```typescript
// SellCarScreen.tsx — additions

// 1. Route param destructure (line ~30):
const adminEdit = route.params?.adminEdit ?? false;

// 2. Gate effect at line 75-79 (autofill) — relax for adminEdit:
useEffect(() => {
  if (adminEdit) return;                                                        // adminEdit skips autofill — admin types fresh for the seller
  if (user && user.sellerStatus === 'APPROVED') {
    checkProfileAndAutofill();
  }
}, [user, adminEdit]);

// 3. Gate effect at line 87-138 (car fetch) — relax for adminEdit:
useEffect(() => {
  if (carId && (adminEdit || user?.sellerStatus === 'APPROVED')) {              // adminEdit OR seller-approved
    const fetchCar = async () => {
      setLoadingCar(true);
      try {
        const res = await apiClient.get(`/api/cars/${carId}`);
        const c = res.data;
        if (!adminEdit && c.sellerId !== user?.localId) {                       // ownership check only for non-admin
          Alert.alert(t.error, 'Not authorized to edit this listing.');
          navigation.goBack();
          return;
        }
        // ... existing setExistingImageUrls + setFormData ...
      } finally {
        setLoadingCar(false);
      }
    };
    fetchCar();
  }
}, [carId, user, adminEdit]);

// 4. GatedScreenWrapper bypass at line 501 (Pitfall 5) — conditional wrapper:
const body = (
  // existing render body 501-951
);
return adminEdit ? body : <GatedScreenWrapper capability="create_listing">{body}</GatedScreenWrapper>;
// OR: pass adminEdit flag to GatedScreenWrapper and short-circuit there

// 5. Submit branch at line 437-455 — swap endpoint:
try {
  if (adminEdit && carId) {
    await ModerationService.adminEditListing(carId, {
      fields: {
        makeId: formData.makeId,
        modelId: formData.modelId,
        // ... map all formData fields to AdminEditListingInput.fields ...
      },
      existingImageUrls,
      newFiles: images.map((img) => ({ uri: img.uri!, type: img.type, name: img.fileName })),
    });
    Alert.alert(t.success, 'Listing updated by admin', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  } else if (isEditMode) {
    await apiClient.put(`/api/cars/${carId}`, data, {                           // existing seller-PUT path unchanged
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // ... existing success Alert
  } else {
    // ... existing create POST path unchanged
  }
} catch (error: any) {
  if (error instanceof ListingModerationError) {
    Alert.alert(t.error, error.code);                                           // Default: surface code; planner may map to i18n key
    if (error.code === 'listing_not_found') navigation.goBack();
  } else {
    Alert.alert(t.error, 'Failed to update listing.');
  }
} finally {
  setLoading(false);
}

// 6. navigation type:
// src/types/navigation.ts — extend:
// SellCar: { carId?: string; adminEdit?: boolean } | undefined;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mobile auth methods scattered in `AuthService.ts` | `ModerationService.ts` module (v1.0 Phase 4 MOB-01 split) | 2026-04-17 (v1.0) | Phase 10 extends ModerationService, NEVER touches AuthService |
| `account_suspended` 403 → manual try/catch in every screen | Global 403 interceptor → `ModerationError` typed throw + `refreshUser` call | 2026-04-17 (v1.0 Phase 4 D-09) | Listing 409s deliberately do NOT use this interceptor (LMOB-02) |
| Mobile sees full Car doc for any listing | Phase 9 status-aware GET: non-admin sees thin payload for non-active | 2026-05-28 (Phase 9) | Phase 10 admin path receives full doc + `moderationBadge`; buyer path is Phase 11 |
| Cart-add silently succeeds on moderated listing | Cart-add returns 409 `listing_not_available` | 2026-05-28 (Phase 9 D-09) | Phase 10 surfaces this on CarDetails / cart; buyer-facing banner is Phase 11 LBUY-02 |
| Owner-only Edit on SellCarScreen | `adminEdit?: boolean` route param relaxes 3 gates | Phase 10 (this phase) | Single screen reuse — no `AdminEditListingScreen` |

**Deprecated/outdated:**
- `useDebouncedValue` hook — deleted in Phase 5 Plan 05-11 (UAT submit-driven search instead). Phase 10 listings tab follows the same submit-driven pattern; do NOT re-introduce.
- `POST /api/orders` — 410 Gone since Phase 3 (v1.0). Phase 10 cart-related error surface only touches `create-payment-intent` + `confirm-booking`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TypedConfirmationModal`'s `keyboardType="email-address"` will break listing-title typing on iOS (no spacebar) | Pitfall 3 | If iOS shows spacebar on email keyboard, admin can type titles fine → mitigation is harmless prop addition with default = email-address |
| A2 | Backend `searchListings` `q` should match on `makeName` / `modelName` / `listingId` prefix only, NOT `description`/`phoneNumber`/`telegramUsername` | Pitfall 10 | If product owner wants broader search, raises PII surface; Phase 11 LQUAL-03 review would flag the broader version |
| A3 | Sort field for `searchListings` can be unified to `{ createdAt: -1, _id: -1 }` across all status filters (avoiding null-`moderatedAt` cursor complexity) | Pitfall 8 | If admin UAT specifically wants "most recently moderated first", planner can swap to `moderatedAt`-first sort with coalesce; both work, simpler is unified |
| A4 | Adding `invalid_make` and `invalid_model` to the `ListingModerationError.code` explicit union improves type safety without breaking existing Phase 8 backend behavior | Code Examples (ListingModerationError) | If types are too strict for future codes, the `| string` fallback already covers — additions are pure improvement |
| A5 | `useAuth().isAdmin` is a public boolean prop on AuthContext (not behind a defensive cast) | CarDetailsScreen integration sketch | VERIFIED: `AuthContext.tsx:22` declares `isAdmin: boolean` in `AuthContextType`; no defensive cast needed in CarDetailsScreen |
| A6 | The `moderationBadge` field arrives on `fetchedCar` only when the existing CarDetailsScreen `apiClient.get('/api/cars/:id')` request succeeds AND the caller is admin AND the listing is non-active | CarDetailsScreen integration sketch | If CarDetailsScreen uses bare `axios.get` instead of `apiClient.get` (line 112 currently does — `axios.get(${API_URL}/api/cars/${carId})`), Bearer header not sent → admin treated as non-admin by backend → `moderationBadge` omitted. **Plan must migrate CarDetailsScreen line 112 to `apiClient.get` so Bearer is attached and admin path fires.** [VERIFIED: `CarDetailsScreen.tsx:112` uses `axios.get`; needs Phase 10 migration to `apiClient`] |
| A7 | `searchListings` `firstPhotoUrl` field can be sourced from `Car.imageUrls[0]` directly (matches Phase 9 D-05 thin-payload convention) | Backend GET sketch | VERIFIED: Phase 9 D-05 explicit + `server.js:399-401` implements this for thin payload — same approach safe for listings tab |
| A8 | EN-only placeholders for new translation keys are acceptable in Phase 10 per CONTEXT `<deferred>` "RU+EN translation strings + jest literal scanner sweep — Phase 11 LQUAL-01" | Project Constraints | LOW risk — explicit in CONTEXT |

## Open Questions

1. **Should `TypedConfirmationModal` gain a `keyboardType` prop, or should Phase 10 build a sibling `TypedListingConfirmationModal`?**
   - What we know: existing user-mod call sites use email sentinel → email keyboard correct.
   - What's unclear: cleanest change shape — additive prop (small) vs sibling component (more grep-clarity).
   - Recommendation: additive prop with default `'email-address'`. Phase 10 Delete-listing call passes `'default'`. Tests on existing user-mod call sites verify behavior unchanged.

2. **For the Listings tab per-row Recover action, use `Alert.alert` confirmation or `ListingRestoreModal`?**
   - What we know: CONTEXT says Claude's Discretion; recommends `ListingRestoreModal` for consistency.
   - What's unclear: tradeoff is one tap vs two taps for the most-common deleted-listing recover action.
   - Recommendation: `ListingRestoreModal` — consistent flow with CarDetails Restore, single code path for the optional note field, single component to test.

3. **Should the "Moderate" badge be in the header (next to Share/Edit at line 451) or floating bottom-right?**
   - What we know: existing icon area is in `headerRight` at lines 451-478.
   - What's unclear: admin discoverability — header icons are easy to miss for first-time admin viewers.
   - Recommendation: header (alongside Share). Consistent with existing icon vocabulary. Lucide `ShieldAlert` glyph in `COLORS.warning` orange makes it visually distinct from neutral header icons.

4. **Should `MyListingsScreen` (seller's own listings) also surface the admin Moderate badge when admin views their own listings?**
   - What we know: CONTEXT focuses Phase 10 on CarDetailsScreen + AdminModerationScreen Listings tab.
   - What's unclear: an admin who is also a seller and views their own listings via MyListings → CarDetails should see the badge.
   - Recommendation: yes — the badge gates on `isAdmin === true` regardless of how the admin arrived at CarDetails. No special MyListings code needed; the badge naturally appears.

5. **Confirm: `useAuth().isAdmin` is already gated by AuthContext loading state (no badge flash during cold-start auth refresh)?**
   - What we know: `AuthContext.tsx:41-42` sets `isAdmin = false` initially, then `setIsAdmin(status.isAdmin)` after `/api/admin/status/:uid` resolves (line 110).
   - What's unclear: during the resolve window, `isAdmin === false` → badge correctly hidden; but if the admin lands on CarDetails before the resolve, badge appears only after → 200-500ms "missing badge" gap.
   - Recommendation: acceptable behavior. Mirrors existing UX where AccountSettings + AdminDashboard tab also pop in late. Phase 11 may consider a "loading" tertiary state if UAT flags it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Mobile + backend tooling | ✓ | >= 20 (per CLAUDE.md "Platform Requirements") | — |
| react-native | Mobile build | ✓ | 0.83.1 | — |
| typescript | Mobile typecheck | ✓ | 5.8.3 | — |
| axios | HTTP client | ✓ | 1.13.4 | — |
| lucide-react-native | Bottom-sheet icons | ✓ | 0.563.0 | — |
| react-native-safe-area-context | Sheet bottom padding | ✓ | 5.6.2 | — |
| jest + react-test-renderer | Mobile tests | ✓ | 29.6.3 + 19.2.0 | — |
| Backend repo at sibling path | Cross-repo backend slice | ✓ | local path `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (matches `[[backend_repo_location]]` memory) | — |
| Backend `Car` model + `listingRouter.js` + `listingService.js` + `listingSchemas.js` | Phase 10 cross-repo additions | ✓ | Phase 7 + Phase 8 + Phase 9 substrate in place | — |
| Backend `searchUsers` precedent (admin/router.js) | Pattern to mirror for searchListings | ✓ | shipped v1.0 Plan 05-0b | — |
| Backend mongodb-memory-server replica-set mode for tests | Cross-repo backend test additions | ✓ | already devDep (Phase 7 D-19) | — |
| Multer + S3 upload instance for admin Edit multipart | Phase 8 D-D substrate | ✓ | shipped (`listingRouter.js:30-45`, lazy-loaded) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 29.6.3 (`react-native` preset) — mobile; jest + supertest — backend cross-repo slice |
| Config file | `jest.config.*` not present at root; preset configured in `package.json` (typical RN setup) [VERIFIED: package.json + existing `__tests__/` dirs] |
| Quick run command (mobile) | `npx jest src/services/moderation/__tests__/ -x` |
| Quick run command (backend) | `cd ../backend-services/carEx-services && npx jest __tests__/listing-moderation/ -x` |
| Full suite (mobile) | `npm test` |
| Full suite (backend) | `cd ../backend-services/carEx-services && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LMOB-01 | `adminEditListing(carId, structured)` builds multipart with correct fields + sets Content-Type header + hits `PATCH /api/admin/moderation/listings/:carId` | unit (jest, axios-mock-adapter or manual mock) | `npx jest src/services/moderation/__tests__/ModerationService.adminEditListing.test.ts -x` | ❌ Wave 0 |
| LMOB-01 | `suspendListing(carId, body)` hits PATCH `/api/admin/moderation/listings/:carId/suspend` with body | unit | `npx jest src/services/moderation/__tests__/ModerationService.suspendListing.test.ts -x` | ❌ Wave 0 |
| LMOB-01 | `archiveListing(carId, body)` hits PATCH `/api/admin/moderation/listings/:carId/archive` | unit | `npx jest src/services/moderation/__tests__/ModerationService.archiveListing.test.ts -x` | ❌ Wave 0 |
| LMOB-01 | `deleteListing(carId, body)` hits PATCH `/api/admin/moderation/listings/:carId/delete` | unit | `npx jest src/services/moderation/__tests__/ModerationService.deleteListing.test.ts -x` | ❌ Wave 0 |
| LMOB-01 | `restoreListing(carId, body?)` hits PATCH `/api/admin/moderation/listings/:carId/restore` with body | unit | `npx jest src/services/moderation/__tests__/ModerationService.restoreListing.test.ts -x` | ❌ Wave 0 |
| LMOB-01 | All 5 methods catch axios error → throw `ListingModerationError` with `code` + `listingStatus` + `reasonCategory` + `banner` populated from response body | unit (each method's test file covers happy + error paths) | (per-method commands above) | ❌ Wave 0 |
| LMOB-01 | All 5 listing methods land in `ModerationService.ts` (NOT AuthService.ts) — grep invariant | source assertion | `grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing' src/services/AuthService.ts` — MUST return 0 | grep check at plan verification |
| LMOB-02 | `client.ts` 403 interceptor matches `error === 'account_suspended'` ONLY — listing 409s pass through | source assertion + unit | `grep -c "account_suspended" src/services/http/client.ts` returns ≥ 2 (constant + check); `grep -c "listing_not_available" src/services/http/client.ts` returns 0 | source assertion at plan verification |
| LMOB-02 | `apiClient.interceptors.response.use` is called EXACTLY 2 times (no third interceptor for listing errors) | source assertion | `grep -c "interceptors.response.use" src/services/http/client.ts` returns 2 | source assertion at plan verification |
| LMOB-02 | Mock backend returning `409 { error: 'listing_not_available', ... }` does NOT fire `moderationRefreshListener` and does NOT throw `ModerationError` | unit (mock apiClient + listener spy) | `npx jest src/services/moderation/__tests__/listing.interceptor-bypass.test.ts -x` | ❌ Wave 0 |
| LUI-01 | `CarDetailsScreen` shows Moderate icon ONLY when `useAuth().isAdmin === true` | behavior (jest screen test with mocked auth + react-test-renderer) | `npx jest src/screens/__tests__/CarDetailsScreen.moderateBadge.test.tsx -x` | ❌ Wave 0 |
| LUI-01 | Tapping Moderate icon opens `ListingModerationBottomSheet` | behavior | (same file as above) | ❌ Wave 0 |
| LUI-01 | Bottom sheet shows status banner reflecting `fetchedCar.moderationBadge` | behavior | (same file) | ❌ Wave 0 |
| LUI-02 | Bottom sheet renders 4 action rows with distinct icons (Pencil/Shield/Archive/Trash2) + distinct colors (neutral/warning/neutral/destructive) | behavior (jest with @testing-library or react-test-renderer query by testID) | `npx jest src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx -x` | ❌ Wave 0 |
| LUI-02 | Tapping Suspend → opens `ListingModerationReasonModal` with action='suspend' | behavior | (same file) | ❌ Wave 0 |
| LUI-02 | Tapping Delete → opens reason modal → after Confirm, opens `TypedConfirmationModal` overlay with sentinel = listing title | behavior | `npx jest src/screens/__tests__/CarDetailsScreen.deleteFlow.test.tsx -x` | ❌ Wave 0 |
| LUI-02 | Listing-title sentinel matches case-insensitively + whitespace-trimmed | behavior (typed input casing variations succeed) | (same file as above OR `TypedConfirmationModal.listingTitle.test.tsx`) | ❌ Wave 0 |
| LUI-03 | When `fetchedCar.moderationBadge` present (non-active), bottom sheet shows 1 Restore button (NOT 4 actions) + reasonCategory chip | behavior | `npx jest src/components/moderation/__tests__/ListingModerationBottomSheet.restore.test.tsx -x` | ❌ Wave 0 |
| LUI-03 | Tapping Restore opens `ListingRestoreModal` (note-only) → submit calls `ModerationService.restoreListing` | behavior | `npx jest src/components/moderation/__tests__/ListingRestoreModal.test.tsx -x` | ❌ Wave 0 |
| LUI-04 | `AdminModerationScreen` shows Users/Listings tab control (admin lands on Users by default) | behavior | `npx jest src/screens/__tests__/AdminModerationScreen.tabs.test.tsx -x` | ❌ Wave 0 |
| LUI-04 | Switching to Listings tab fires `ModerationService.searchListings({})` | behavior | (same file) | ❌ Wave 0 |
| LUI-04 | Status filter chip "Deleted" → calls `searchListings({status: 'deleted'})` → rows render with per-row Recover button | behavior | (same file) | ❌ Wave 0 |
| LUI-04 | Per-row Recover → opens `ListingRestoreModal` → submit fires `restoreListing` → row removes from deleted list (optimistic) | behavior | (same file) | ❌ Wave 0 |
| Backend GET listings | New `GET /api/admin/moderation/listings` returns `{ rows, nextCursor }` with `setOptions({ includeAllListingStatuses: true })` so non-active listings appear | integration (jest + supertest + mongodb-memory-server replica-set) | `cd ../backend-services/carEx-services && npx jest __tests__/listing-moderation/searchListings.test.js -x` | ❌ Wave 0 (cross-repo) |
| Backend GET listings | Cursor pagination works (next page continues from `nextCursor`) | integration | (same file) | ❌ Wave 0 |
| Backend GET listings | `q` parameter matches `makeName` / `modelName` / `listingId` prefix ONLY (not description/phone/telegram) | integration | (same file) | ❌ Wave 0 |
| Backend GET listings | Without `setOptions({ includeAllListingStatuses: true })`, Phase 9 hide hook filters non-active rows out — verifies bypass is load-bearing | integration | (same file — assertion when admin omits flag returns empty for non-active) | ❌ Wave 0 |
| Backend GET listings | Mounted on existing chain — non-admin caller gets 403 from `requireAdmin`; missing Bearer gets 401 from `verifyIdToken`; admin success | integration | (same file — auth chain test cases) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest <touched-test-file> -x` (quick — runs only the test file the task action edited)
- **Per wave merge:** `npx jest src/services/moderation/__tests__/ src/components/moderation/__tests__/ src/screens/__tests__/CarDetailsScreen.*.test.tsx src/screens/__tests__/AdminModerationScreen.tabs.test.tsx`
- **Phase gate:** Full suite green on mobile (`npm test`) + full suite green on backend (`cd ../backend-services/carEx-services && npm test`) before `/gsd-verify-work`

### Wave 0 Gaps

Mobile-side scaffolds needed:
- [ ] `src/services/moderation/__tests__/ModerationService.adminEditListing.test.ts` — covers LMOB-01 multipart shape
- [ ] `src/services/moderation/__tests__/ModerationService.suspendListing.test.ts` — covers LMOB-01 PATCH path
- [ ] `src/services/moderation/__tests__/ModerationService.archiveListing.test.ts` — covers LMOB-01 PATCH path
- [ ] `src/services/moderation/__tests__/ModerationService.deleteListing.test.ts` — covers LMOB-01 PATCH path
- [ ] `src/services/moderation/__tests__/ModerationService.restoreListing.test.ts` — covers LMOB-01 PATCH path
- [ ] `src/services/moderation/__tests__/ModerationService.searchListings.test.ts` — covers Listings tab data path
- [ ] `src/services/moderation/__tests__/ListingModerationError.test.ts` — covers D-14 class shape + `toListingModerationError` helper
- [ ] `src/services/moderation/__tests__/listing.interceptor-bypass.test.ts` — covers LMOB-02 invariant
- [ ] `src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx` — covers LUI-01/02 4-action render
- [ ] `src/components/moderation/__tests__/ListingModerationBottomSheet.restore.test.tsx` — covers LUI-03 1-action render
- [ ] `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` — covers reason+note collection + 5-value taxonomy
- [ ] `src/components/moderation/__tests__/ListingRestoreModal.test.tsx` — covers note-only modal
- [ ] `src/screens/__tests__/CarDetailsScreen.moderateBadge.test.tsx` — covers LUI-01 admin-only badge gate
- [ ] `src/screens/__tests__/CarDetailsScreen.deleteFlow.test.tsx` — covers LUI-02 two-modal stack + sentinel match
- [ ] `src/screens/__tests__/CarDetailsScreen.optimistic.test.tsx` — covers D-16 optimistic flip + rollback
- [ ] `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` — covers D-01 three-gate skip + endpoint swap
- [ ] `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` — covers LUI-04 tab + Listings tab + Recover

Backend-side scaffolds needed (cross-repo):
- [ ] `../backend-services/carEx-services/__tests__/listing-moderation/searchListings.test.js` — covers Phase 10 GET endpoint (uses existing `mongodb-memory-server` replica-set + minimal Express app per Phase 7 D-20 / Phase 8 D-17)

Framework install: None needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Backend `verifyIdToken` (Firebase Admin SDK) already on every `/api/admin/moderation/listings/*` route via existing mount at `server.js:925`. Mobile attaches Bearer via existing `apiClient` request interceptor — no change. |
| V3 Session Management | yes | Mobile idToken cached in `AsyncStorage`; 401 refresh via existing `idTokenRefreshListener` at `client.ts:128-183` — no change in Phase 10. |
| V4 Access Control | yes | Backend `requireAdmin` on the admin router enforces admin-only access for all 5 listing-mod PATCH endpoints + the new Phase 10 GET. Mobile `isAdmin` is UI-visibility only (CLAUDE.md constraint). Phase 8 `denySelfModerationListing` middleware rejects self-moderation server-side. |
| V5 Input Validation | yes | Backend: existing Zod `.strict()` schemas in `listingSchemas.js` reject unknown fields. Phase 10 adds `searchListingsQuerySchema` (same `.strict()` discipline). Mobile: typed `AdminEditListingInput` keeps mobile shape aligned with backend whitelist. |
| V6 Cryptography | no | Phase 10 uses no cryptography directly; relies on existing TLS (HTTPS — `NSAllowsArbitraryLoads: false`) + Firebase signed JWT for auth. |
| V7 Error Handling | yes | `ListingModerationError` class normalizes backend error codes into typed mobile errors. NO console.error of error.response body (would leak server internals to dev logs — existing pattern logs error object metadata only). |
| V8 Data Protection | yes | Phase 9 thin payload (D-05) prevents PII leak to non-admin viewers — Phase 10 doesn't touch the thin-payload path. New `searchListings` `q` param explicitly EXCLUDES `description` / `phoneNumber` / `telegramUsername` (Pitfall 10) to avoid admin-side PII trawl. |
| V9 Communications | yes | HTTPS only via `apiClient` (existing setting). Cross-repo backend slice rides existing TLS termination at Railway. |
| V10 Malicious Code | no | Phase 10 introduces no third-party scripts or evals; lucide icons + existing modal patterns only. |
| V13 API and Web Service | yes | Backend API: existing rate limiter (`listingModerationRateLimiter`) caps admin actions at 30/15min/admin (Phase 7 D-04). New GET endpoint inherits the same chain → admin can't trawl listings beyond rate budget. |
| V14 Configuration | yes | No new secrets; CLAUDE.md "Secrets hygiene" constraint honored. |

### Known Threat Patterns for RN + Express + Mongoose stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin escalation via mobile `isAdmin` tamper | Elevation | Server-side `requireAdmin` on every route — mobile `isAdmin` for UI only [VERIFIED: server.js:925 mount + Phase 7 LSEC-02] |
| Self-moderation conflict-of-interest | Tampering | `denySelfModerationListing` middleware at `listingRouter.js` rejects with 400 [VERIFIED: Phase 8 D-04 + listingRouter.js mount on all 5 routes] |
| Mass listing trawl via search | Information Disclosure | Rate limiter (30 actions / 15 min); search `q` whitelist excludes PII fields (Pitfall 10) |
| Reflected XSS via free-text fields (moderationReason, note) | Tampering | RN doesn't render `dangerouslySetInnerHTML`; all text via `<Text>` component which auto-escapes. Backend stores as-is; client always escapes |
| TOCTOU listing-not-available between cart-add and confirm-booking | Tampering | Phase 9 D-12/D-14 refund-first-throw-second pattern; Phase 10 surfaces resulting 409 via `ListingModerationError` — does not introduce new TOCTOU |
| Loop via 403 interceptor + refresh listener | DoS | Existing `_skipModerationInterceptor` loop guard at `client.ts:104-108` + `_idTokenRefreshAttempted` at `client.ts:146-156`. Phase 10's per-method catch sidesteps both (Pitfall 1) |
| Image-upload abuse via admin Edit | Tampering | Reuses existing multer + S3 path with `upload.array('images', 25)` cap + WR-01 orphan cleanup at `listingRouter.js:72-80`. Phase 10 mobile sends same multipart shape |
| Cursor parameter injection | Tampering | Base64-encoded JSON cursor with try-catch decode → invalid cursor returns empty result (defensive fail) |
| Admin password / auth bypass via mobile-built bearer | Spoofing | `verifyIdToken` cryptographically validates Firebase-signed JWT — mobile cannot forge |

### Anti-Pattern Guardrails (CONTEXT `<deferred>` + `### Anti-Pattern Warnings`)

For each anti-pattern, here's a one-line "how to verify the plan honors this" hint for the plan-checker:

| Anti-pattern | Verification hint |
|--------------|-------------------|
| No listing-moderation methods in AuthService.ts | `grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing\|searchListings' src/services/AuthService.ts` returns 0 |
| Mobile `isAdmin` for UI only (never authorization) | Plan tasks describing admin-only paths cite UI-visibility gating; no task says "skip backend call if not admin" |
| 409 `listing_not_available` always surfaces visibly | Plan covers UI banner OR Alert.alert in CarDetails AND cart/checkout paths; no plan silently swallows the error |
| No third axios interceptor for listing errors | `grep -c "interceptors.response.use" src/services/http/client.ts` returns 2 (existing 403 + 401), not 3 |
| No widening of `ModerationError` discriminator | `grep -c "listing_not_available\|listing_not_found" src/services/moderation/errors.ts` returns 0 inside the ModerationError class definition; only inside ListingModerationError |
| `setOptions({ includeAllListingStatuses: true })` present on new backend GET | Backend `searchListings` source file contains the literal string `includeAllListingStatuses: true` |
| Moderate badge unconditional for admin (even on own listing) | Plan task does not include "if (!isOwner) show badge" condition; only `if (isAdmin) show badge` |
| `adminEditListing` does NOT inline-rebuild FormData layout | Plan exposes either structured input OR pass-through FormData; multiple field-layout duplications absent |
| No separate Delete route for Recover action | All Recover call sites use `ModerationService.restoreListing` (single method); no new method like `recoverListing` exists |
| No new state-management library | `grep -c '"zustand"\|"redux"\|"@reduxjs/toolkit"\|"recoil"\|"jotai"\|"mobx"\|"valtio"\|"@tanstack/react-query"' package.json` returns 0 |
| No new bottom-sheet library | `grep -c '"@gorhom/bottom-sheet"\|"react-native-bottom-sheet"\|"reanimated-bottom-sheet"' package.json` returns 0 |
| Buyer-facing severity banner deferred to Phase 11 | Plan tasks do NOT include "show banner to non-admin viewers" — only admin-side banner per D-17 |
| RU+EN parity audit deferred to Phase 11 | Plan acknowledges EN-placeholder strings ok; no task line says "jest literal scanner sweep" |
| No `AdminEditListingScreen` separate screen | Plan touches `SellCarScreen.tsx` for edit flow, NOT creating a new screen file under `src/screens/AdminEditListingScreen.tsx` |
| No SellCarScreen wholesale refactor | Plan adds <50 lines of conditional branches to SellCarScreen; no plan does a >200-line extraction/restructure |
| No auto-cancel/refund of in-flight orders on moderation | Plan tasks for moderation actions do NOT touch ServiceOrder or order state |
| Listing-history admin GET deferred | No plan task adds `GET /api/admin/moderation/listings/:carId/history` route |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/10-mobile-plumbing-admin-listing-ui/10-CONTEXT.md` — All 17 user decisions D-01..D-17 + canonical refs + anti-patterns [VERIFIED: read 290 lines]
- `.planning/REQUIREMENTS.md` — Phase 10 REQ-IDs verbatim LMOB-01, LMOB-02, LUI-01..04 [VERIFIED: lines 41-49]
- `.planning/ROADMAP.md` — Phase 10 goal + 5 success criteria [VERIFIED: lines 99-110]
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — Phase 7 substrate; D-14 LISTING_STATUS_POLICY + D-14a 5-value reason taxonomy [VERIFIED]
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-CONTEXT.md` — Phase 8 endpoints + D-A multipart parity + D-B transition matrix + D-C restore + D-D image handling [VERIFIED]
- `.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md` — Phase 9 hide hook + thin payload + `moderationBadge` admin shape [VERIFIED]
- `.planning/phases/04-mobile-plumbing-mobile/04-CONTEXT.md` — Phase 4 D-05 ModerationService single-module rule + D-07 ModerationError shape + D-11 loop-guard precedent [VERIFIED]
- `src/services/moderation/ModerationService.ts:1-320` — Existing module pattern for extension [VERIFIED: 320-line file, sections at lines 168 / 281 / 320]
- `src/services/moderation/errors.ts:1-12` — Existing ModerationError class shape for sibling [VERIFIED: 12 lines]
- `src/services/http/client.ts:98-126` — 403 account_suspended interceptor pinned to discriminator string [VERIFIED]
- `src/services/http/client.ts:139-183` — 401 idToken refresh + single-retry loop guard [VERIFIED]
- `src/components/moderation/QuickActionSheet.tsx:1-210` — Bottom sheet shape (Modal + transparent + slide + Pressable overlay) [VERIFIED]
- `src/components/moderation/ModerationActionModal.tsx:1-541` — Sibling-modal precedent for reason+note modal [VERIFIED]
- `src/components/moderation/TypedConfirmationModal.tsx:1-181` — Direct reuse for Delete escalation; case-insensitive + trimmed match at lines 41-43 [VERIFIED]
- `src/components/moderation/SeverityBadge.tsx:1-65` — Severity badge shape for listings tab + admin banner [VERIFIED]
- `src/screens/AdminModerationScreen.tsx:1-709` — Search + filter + pagination + AbortController shape to port; ChipButton component at lines 597-611 [VERIFIED]
- `src/screens/CarDetailsScreen.tsx:1-1527` — State hooks + render integration points + `fetchedCar` shape [VERIFIED]
- `src/screens/SellCarScreen.tsx:75-138, 437-459, 501, 951` — Gate effects + submit branch + GatedScreenWrapper anchor [VERIFIED]
- `src/types/navigation.ts:1-26` — RootStackParamList for `adminEdit?: boolean` extension [VERIFIED]
- `src/constants/theme.ts:1-67` — COLORS palette + SIZES + TYPOGRAPHY tokens [VERIFIED]
- `src/context/AuthContext.tsx` — `isAdmin: boolean` exposure for UI gating [VERIFIED via grep]
- `../backend-services/carEx-services/server.js:320-410` — Phase 9 getCarDetailHandler with admin moderationBadge construction [VERIFIED]
- `../backend-services/carEx-services/server.js:925` — listingRouter mount chain [VERIFIED]
- `../backend-services/carEx-services/server.js:1100-1200` — Phase 9 createPaymentIntent 409 + confirm-booking ListingNotAvailableError [VERIFIED]
- `../backend-services/carEx-services/src/moderation/listingRouter.js:1-298` — Phase 8 5-endpoint substrate + KNOWN_LISTING_ERRORS at lines 95-109 [VERIFIED]
- `../backend-services/carEx-services/src/moderation/listingSchemas.js:1-120` — Phase 8 Zod schemas + reason enum derived from Mongoose [VERIFIED]
- `../backend-services/carEx-services/src/moderation/listingErrors.js:1-26` — Backend ListingServiceError pattern [VERIFIED]
- `../backend-services/carEx-services/src/admin/router.js:1-209` — Existing searchUsers cursor + escapeRegex + projection patterns to mirror for searchListings [VERIFIED]
- `../backend-services/carEx-services/src/payments/refundAndThrow.js:30-85` — `ListingNotAvailableError` backend class [VERIFIED via grep]

### Secondary (MEDIUM confidence)

- React Native Modal docs (https://reactnative.dev/docs/modal) — `animationType="slide"` + `transparent` semantics [CITED: External docs section of CONTEXT canonical refs]
- React Native FlatList + RefreshControl docs (https://reactnative.dev/docs/flatlist) — pagination patterns [CITED]
- Axios cancellation docs (https://axios-http.com/docs/cancellation) — `AbortController` + `isCancel` patterns [CITED]
- Phase 5 D-08 optimistic update pattern — referenced in CONTEXT but applied to user-domain (`AdminModerationScreen.tsx:239-317`) — Phase 10 ports the shape to listing domain [VERIFIED via existing code]

### Tertiary (LOW confidence)

- None — all decisions in this research are either VERIFIED in code/CONTEXT/REQUIREMENTS or grounded in explicit user decisions D-01..D-17.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dep already in `package.json`; verified via direct read
- Architecture: HIGH — pattern derived 1:1 from existing v1.0 Phase 4 + Phase 5 components which are all live in `src/components/moderation/`
- Pitfalls: HIGH — 10 enumerated pitfalls each backed by either CONTEXT explicit decisions or VERIFIED code paths
- Backend cross-repo slice: HIGH — Phase 7/8/9 substrate already in place; new GET endpoint is a near-verbatim port of an existing endpoint at `src/admin/router.js:93`
- Validation Architecture: HIGH — 25 test scenarios mapped to 6 REQ-IDs + cross-repo backend slice; jest infrastructure verified

**Research date:** 2026-05-29

**Valid until:** 2026-07-13 (45 days for a stable mobile-extension phase atop a freshly-shipped Phase 7/8/9 substrate; revisit if backend Phase 9 ships breaking response-shape changes or if a Phase 10 plan introduces new external libs)

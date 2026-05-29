# Phase 11: Buyer-affected UX + Quality + Security Review — Research

**Researched:** 2026-05-29
**Domain:** React Native UI integration over an existing thin-payload backend contract; jest-based parity/coverage tooling; self-review security artifact
**Confidence:** HIGH (all upstream contracts already shipped and grep-verifiable; no new HTTP surface)

## Summary

Phase 11 is the closing v1.1 phase. Two halves: (A) buyer-affected UX — a sibling `ListingStatusBanner` component (mirroring the proven `UserStatusBanner` visual treatment), wired into `CarDetailsScreen` above the hero and into `ServiceCartScreen` as an inline car-row banner with checkout-disable; (B) merge-gate quality artifacts — extend the existing Phase 6 jest scanners, generate a per-requirement coverage manifest by grepping `describe()` strings, and ship a 5-verdict `11-LIST-SECURITY.md` cloned from `06-SECURITY.md`.

Every backend dependency is already live: Phase 9 D-05 (thin non-admin payload), D-06 (200-OK-with-status for ALL non-active states including `deleted`), D-07 (admin-only `moderationBadge`), D-09 (cart-add 409 on `createPaymentIntent`), D-11..D-15 (refund-first-throw-second on confirm-booking). Phase 7 D-14 ships `LISTING_STATUS_POLICY[state].banner.{titleKey,bodyKey,severity}` and the `inactive_seller` extension to the reason taxonomy (D-14a). Phase 10 D-13 verified `apiClient`'s 403 interceptor only matches `account_suspended` — listing 409/404 pass through naturally. Nothing in this phase is HTTP work; it is UI mounting + copy strings + tests + a self-review document.

**Primary recommendation:** Build `ListingStatusBanner.tsx` as a presentational sibling to `UserStatusBanner.tsx` (data via props, not context), wire it into `CarDetailsScreen` between the header and the hero `ScrollView`, conditionally on `!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active'`. For the cart, mount the same component (or a compact `ListingCartRowBanner` variant per D-12) inside the existing `carCard` block and disable the existing `submitBtn` via a derived predicate. Extend the two existing scanner files; do not create parallel ones. Land coverage manifest as a node script reading the jest test tree via grep+awk on `describe('LBUY-…` / `describe('LQUAL-…` strings. Clone `06-SECURITY.md` verbatim and substitute each (a)-(e) section with listing-domain evidence.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Buyer-facing ListingStatusBanner**

- **D-01: Sibling `ListingStatusBanner.tsx`** at `src/components/moderation/ListingStatusBanner.tsx`. NOT a reuse of `UserStatusBanner` (different mount surface — local-to-route vs global; different data source — `fetchedCar` vs `useAuth`). NOT a shared `StatusBanner` primitive (rejected: speculative generality; one consumer for now, two if/when a future banner shows up). Matches Phase 10 sibling-domain discipline (D-04 — `ListingModerationReasonModal` NOT a reuse of `ModerationActionModal`). Visual treatment mirrors Phase 6 D-01..D-03 verbatim: tinted background at ~10% opacity, 4 px left-accent at full opacity, title + reasonCategory chip on line 1, truncated note on line 2 with tap-to-expand, non-dismissable.
- **D-02: Banner placement = above hero image** at the top of `CarDetailsScreen` non-admin path. Scrolls with content (not sticky — sticky is a v1.2 tweak if buyers report missing it after scroll-away). Mirrors Phase 6 D-03 stacking philosophy. Admin-side banner (Phase 10 D-17 — above the action area) is independent and unaffected.
- **D-03: `status='deleted'` for non-admin viewers → block at fetch.** Phase 9 read-time filter… `CarDetailsScreen` on a 404 renders a centered empty-state ("This listing is no longer available.") with a single back-action — NOT the banner-on-detail flow. Banner-on-detail applies only to `suspended` and `archived`. Severity-aware copy: neutral (archived), warning (suspended), per LBUY-04. The `destructive-but-recoverable` tone for deleted applies to the cart banner (D-06) where a cached deleted listing might still appear before the focus re-fetch resolves it, AND to the empty-state copy on `CarDetailsScreen`.

  **⚠ Conflict with Phase 9 D-08/D-06 (see Open Questions §1):** Phase 9 explicitly returns **200 OK + thin payload for all three non-active states, including `deleted`** and the "Do NOT 404 deep-link viewers" anti-pattern rule (09-CONTEXT line 208). D-03's "404-on-deleted" assumption needs operator reconciliation before planning. Recommendation: render the banner-with-destructive-tone for all three non-active states; reserve the empty-state ONLY for the true "carId does not exist" 404 path (Phase 9 D-08 last sentence).

- **D-04: All buyer action CTAs disabled on non-active listing detail.** Contact seller / Add to cart / Buy now / any other primary buyer action on `CarDetailsScreen` render greyed-out, non-tappable when the banner is visible. No `Alert.alert` on tap (the disabled visual is sufficient, matching Phase 6 D-04 faded-disabled pattern, scoped to the action area only — not the whole screen).

**Area 2 — Cart UX**

- **D-05: Detection: `useFocusEffect` re-fetch + 409 fallback.** On `ServiceCartScreen` focus, re-fetch the cart's `car` via `apiClient.get('/api/cars/:carId')`. 404 (carId not found at all) OR response payload with `status !== 'active'` flips the cart into banner-state. The 409 `listing_not_available` from `createPaymentIntent` / `confirmBooking` is the TOCTOU fallback for the listing going non-active between focus and Pay tap — handled by the same banner-state code path.

  **⚠ Important integration note:** the existing `ServiceCartScreen.tsx` handleSubmit() calls `AuthService.createOrders()` against `/api/orders` (services-only, no payment intent on this surface). The Phase 9 D-09 / D-12-15 surfaces (`createPaymentIntent` / `confirmBooking`) fire from **`CarDetailsScreen` "Book it" → `processPayment`**, NOT from ServiceCartScreen submit. The cart's role for the car slot is metadata-only; the 409 TOCTOU surface for the car-purchase flow lives on CarDetails. Plan accordingly.

- **D-06: Inline row banner + global checkout-disabled state.** Banner renders inside the car row card (severity-aware tone matching D-03 / LBUY-04), with a tappable "Remove from cart" affordance on the row. Global checkout button disabled with subtitle `"Remove unavailable listing to continue"`. Service items in the cart remain visually unchanged but inherit the global checkout-disable state. Cart is NOT auto-cleared (LBUY-02) — the buyer must explicitly tap "Remove from cart" to proceed.
- **D-07: Service-only checkout is blocked when the car slot is non-active.** Single Stripe payment intent model (existing). Splitting payment by item type would require backend payment intent + order creation surgery; explicitly deferred to v1.2+. Banner copy: `"Remove the unavailable listing to check out remaining services."` Simpler, single-failure-mode behavior; the trade-off is buyers with mixed carts can't proceed with services until they pop the car — accepted.

### Claude's Discretion

- **D-08 (LBUY-03 — already-paid orders, no UI change):** No informational badge added to `MyOrdersScreen` / `ProviderOrdersScreen`. "Proceed normally; admin can manually cancel via existing tools" — interpreted literally. Order status is independent of listing status. Planner may surface a small inline note inside the order-detail screen if it's a one-line change — but no banner, no badge, no behavior change.
- **D-09 (LQUAL-01 — strict parity, block CI):** Extend `__tests__/translation-parity.test.ts` to assert: (a) `Object.keys(RU) === Object.keys(EN)` set-wise (already covered); (b) all new v1.1 keys have non-empty values in both languages (already covered); (c) **placeholder tokens (`{title}`, `{email}`, `{date}`, etc.) present in one language are present in the other for the same key (NEW — gap vs current scanner).** Extend `__tests__/moderation-literals.test.ts` SCAN_FILES list to include `ListingStatusBanner.tsx` and any cart banner sub-component.
- **D-10 (LQUAL-02 — coverage via test-name convention + manifest):** Every test `describe(...)` block covering a LIST-* requirement starts with the requirement ID, e.g., `describe('LBUY-01: ListingStatusBanner renders severity-aware tone on suspended listing', ...)`. After tests pass, generate `11-COVERAGE.md` by grepping `describe('LBUY-` / `describe('LQUAL-` / `describe('LMOB-` / `describe('LUI-` / `describe('LADM-` / `describe('LDATA-` / `describe('LENF-` / `describe('LSEC-` across the jest test tree. Each LIST-* requirement must appear at least once before the LQUAL-03 review signs off.
- **D-11 (LQUAL-03 — `11-LIST-SECURITY.md` self-review, 5 verdicts):** Mirror `06-SECURITY.md` exactly. Each section: (a) what was verified, (b) grep/test evidence with file:line citations, (c) PASS/FAIL verdict. Self-review (no external auditor — Phase 6 default). The TOCTOU verdict must address whether Phase 9 read-time enforcement closes the seller-update-vs-buyer-read race; the deferred-verification verdict addresses anything knowingly skipped.
- **D-12 (sibling-component file layout):** `ListingStatusBanner.tsx` lives at `src/components/moderation/ListingStatusBanner.tsx`. If the cart row banner needs its own sub-component (compact variant), it lives at `src/components/moderation/ListingCartRowBanner.tsx`. Test files in `src/components/moderation/__tests__/`.
- **D-13 (translation key naming):** Suggested namespace: `listingStatusBanner*` for the detail-screen banner (e.g., `listingStatusBannerSuspendedTitle`, `listingStatusBannerArchivedTitle`, `listingStatusBannerDeletedTitle`, `listingStatusBannerReasonSpam`, `listingStatusBannerReasonPolicyViolation`, etc.) and `cartListingUnavailable*` for the cart variant. Planner finalizes exact names; parity scanner enforces RU+EN parity regardless of naming.
- **D-14 (severity-tone color resolution):** Severity colors sourced from existing `LISTING_STATUS_POLICY[status].banner.severity` (Phase 7 D-14) mapped to project theme colors in `src/constants/theme.ts`. Planner verifies the mapping table exists or adds minimally — neutral=gray, warning=orange/amber, destructive=red. Mirrors Phase 10 D-10 admin badge coloring.
- **D-15 (existing CTAs to gate on CarDetailsScreen):** Planner audits CarDetailsScreen for buyer action CTAs (Contact seller / Add to cart / Buy now / Reserve / Favorite / Share — Favorite/Share likely stay enabled). Principle: any CTA whose semantics imply a transaction or commitment is disabled when the listing is non-active. Read-only affordances stay enabled.

### Deferred Ideas (OUT OF SCOPE)

- Split checkout (services-only path when car is blocked) — Stripe payment intent split + order creation split.
- `MyOrdersScreen` informational chip when underlying listing is now non-active.
- Sticky-at-top behavior for `ListingStatusBanner` (D-02 chose scroll-with-content).
- Per-listing buyer notification when a listing in cart becomes non-active (NOTF-*).
- Compact / expanded variant management for `ListingStatusBanner` across sessions (Phase 6 D-02 per-session).
- Translation parity for non-moderation strings (project-wide sweep).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LBUY-01** | `CarDetailsScreen` viewed by a non-admin shows a non-dismissable banner with status + reason category for any non-active listing (severity-aware tone, mirroring v1.0 `UserStatusBanner`) | Backend already returns thin payload with `{status, reasonCategory, banner: {titleKey, bodyKey, severity}}` (Phase 9 D-05). Mobile build is purely presentational. See §Code Examples — `ListingStatusBanner` skeleton. |
| **LBUY-02** | Cart containing a non-active listing renders a banner on the cart row + disables the checkout button; cart NOT auto-cleared | `useFocusEffect` re-fetch on `ServiceCartScreen` mount (D-05). `useFocusEffect` already used in `UserStatusBanner` — pattern available. See §Architecture Patterns — Cart-row banner. |
| **LBUY-03** | Already-paid in-flight orders touching a non-active listing proceed normally; admin retains manual cancel via existing tools | No code change required. Verification: grep `MyOrdersScreen` / `ProviderOrdersScreen` for any new auto-cancel logic (none should exist). Backend ServiceOrder status machine is decoupled from Car.status. |
| **LBUY-04** | Banner copy follows v1.0 severity-aware tone — neutral (archived), warning (suspended), destructive-but-recoverable (deleted when visible) | Phase 7 `LISTING_STATUS_POLICY[state].banner.severity` literal values are `'neutral' \| 'warning' \| 'destructive'` (line-up exact). Map to `COLORS.textSecondary` / `COLORS.warning` / `COLORS.destructive` (all in `src/constants/theme.ts`). |
| **LQUAL-01** | All new user-facing strings (4 reason cats × multilingual + button labels + status enum labels + banner copy) added to `translations.ts` RU+EN; jest literal scanner enforces parity (extends 06-09 scanner) | Existing scanners: `__tests__/translation-parity.test.ts` (76 lines) + `__tests__/moderation-literals.test.ts` (101 lines). Both ALREADY DO key-set diff + value-emptiness check; gap is placeholder-token parity (D-09). Extend both files; do not duplicate. |
| **LQUAL-02** | Each LIST-* requirement is covered by at least one jest test; coverage report tagged per requirement | Convention-driven manifest: `describe('LXXX-NN: …')` + grep+awk script. Lowest-cost approach per D-10. See §Code Examples — coverage manifest script. |
| **LQUAL-03** | Pre-merge security review (`LIST-SECURITY.md`) covers same 5 verdicts as v1.0 06-SECURITY.md (auth/authz/audit/TOCTOU/deferred-verification); merge-gate cleared before tagging v1.1 | `06-SECURITY.md` (254 lines, APPROVED) is the template. See §Code Examples — security-review section template. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

| # | Constraint | Phase 11 implication |
|---|------------|------|
| 1 | **No new state-management or networking libs** | Use only existing axios apiClient, useState, useFocusEffect. Cart re-fetch is a hook + apiClient call. No zustand, no Redux Toolkit. |
| 2 | **Extend `AuthService.ts` or split sensibly; do not rewrite wholesale** | `AuthService` already has `createPaymentIntent` / `confirmBooking` at lines 378 + 392. Phase 11 may add a thin `getCarById(carId)` helper at this surface, OR keep calling `apiClient.get(/api/cars/:id)` directly per CarDetailsScreen line 135 precedent. |
| 3 | **Admin-only endpoints validate server-side every request** | N/A — Phase 11 adds no admin endpoints. |
| 4 | **i18n: All moderator + affected-user strings RU-first with EN parity** | Mandatory. Drives LQUAL-01. New keys land in BOTH `RU:` and `EN:` blocks of `src/constants/translations.ts`. |
| 5 | **No breaking changes to existing auth/cart/payments flows** | Phase 11 mounts MUST be additive. `ServiceCartScreen` line 113 already wraps everything in `<GatedScreenWrapper capability="create_order">` (Phase 6 D-04 + Plan 06-06). Phase 11 mount goes INSIDE that wrapper, above the existing carCard. CarDetailsScreen header (lines 561-616) and admin banner (lines 660-688) and admin error banner (lines 693-705) all stay byte-identical. |
| 6 | **Secrets hygiene: No new hardcoded keys.** Existing Firebase + Stripe test keys not addressed. | Phase 11 introduces ZERO new HTTP surface. The security review confirms no new secrets at section (e). |
| 7 | **GSD Workflow Enforcement: start work through a GSD command** | Operator invokes `/gsd-execute-phase` per plan. |
| 8 | **One default export per component file; StyleSheet inline at bottom; `COLORS.*` not hex** | `ListingStatusBanner.tsx` follows this convention (mirrors `UserStatusBanner.tsx`). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render non-admin banner on listing detail (LBUY-01) | **Mobile Client (Component)** | — | Pure presentational; backend already provides thin payload (Phase 9 D-05). No backend work. |
| Detect cart listing went non-active (LBUY-02) | **Mobile Client (Screen — `ServiceCartScreen`)** | API/Backend (read-time hide + thin payload) | Detection is a client-side focus-effect re-fetch against an already-status-aware endpoint. |
| Gate buyer CTAs on `CarDetailsScreen` (LBUY-01 derived) | **Mobile Client (Component — disabled state)** | API/Backend (the 409 + thin payload contracts) | UI prop derivation off `fetchedCar.status`. |
| Already-paid order no-op (LBUY-03) | **No tier — verification only** | — | Implicit constraint: no code change in `MyOrdersScreen` / `ProviderOrdersScreen`. |
| RU+EN parity enforcement (LQUAL-01) | **Test Harness (jest)** | Source (`src/constants/translations.ts` + new component files) | Jest scanners run pre-merge; CI gates on red. |
| Per-requirement coverage manifest (LQUAL-02) | **Doc generator (shell/node script)** | Test files (naming convention) | Script reads jest tree and emits markdown. Convention is the source of truth. |
| Security review (LQUAL-03) | **Doc artifact (`11-LIST-SECURITY.md`)** | All other tiers (verbatim evidence cited) | Self-review; mirrors Phase 6 pattern. |

## Standard Stack

### Core (already in tree; reuse verbatim)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native` | 0.83.1 | UI primitives (`View`, `Text`, `ScrollView`, `TouchableOpacity`, `Pressable`, `LayoutAnimation`) | Already in stack; matches all existing moderation components |
| `@react-navigation/native` | 7.1.28 | `useFocusEffect` for cart re-fetch on screen focus | Same hook used in `UserStatusBanner.tsx:32` — verified pattern |
| `react-native-safe-area-context` | 5.6.2 | `useSafeAreaInsets()` for banner top spacing | Already used by `UserStatusBanner.tsx:33` |
| `lucide-react-native` | 0.563.0 | Severity icons (`AlertTriangle`, `Archive`, `Trash2`/`Ban`) | Already used by `UserStatusBanner.tsx:34` (`AlertTriangle`, `ShieldAlert`, `Ban`) |
| `axios` (via `apiClient`) | 1.13.4 | `apiClient.get('/api/cars/:id')` for cart re-fetch | Already at `CarDetailsScreen.tsx:135`; LMOB-02 invariant preserved (interceptor at `client.ts:103` excludes listing 409/404) |
| `jest` + `react-test-renderer` | 29.6.3 / 19.2.0 | Component tests for `ListingStatusBanner` | Same harness as `UserStatusBanner.test.tsx` |

**Version verification (per registry, current as of 2026-05-29):**

```bash
npm view react-native version    # [VERIFIED via package.json: 0.83.1]
npm view @react-navigation/native version  # [VERIFIED: 7.1.28]
npm view lucide-react-native version       # [VERIFIED: 0.563.0]
```

All versions match `package.json` — no upgrades needed for Phase 11.

### Supporting (already in tree)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-async-storage/async-storage` | 2.2.0 | (Not needed for Phase 11) | Cart re-fetch uses in-memory state per Phase 6 D-02 (no AsyncStorage persistence for transient UI flags) |
| `react-native-fast-image` | 8.6.3 | (existing CarCard image) | If banner shows a tiny car-image thumb, reuse pattern from `ServiceCartScreen.tsx:144` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sibling component `ListingStatusBanner.tsx` | Single shared `<StatusBanner kind="listing" \| "user" />` primitive | **REJECTED by D-01.** One consumer per kind; speculative generality. Sibling pattern matches Phase 10 D-04 (ListingModerationReasonModal NOT a reuse). |
| `useFocusEffect` on cart focus | Polling timer / WebSocket pub-sub | Polling burns battery; pub-sub adds backend surface (out of scope). Focus-effect re-fetch is the simplest correct answer. |
| Convention-based coverage manifest (grep `describe()`) | jest coverage reporter + custom plugin | New devDep + maintenance cost. Grep-based is portable and matches Phase 6 QUAL-01 substrate philosophy (`fs.readFileSync + regex`, no AST parser). |
| Inline placeholder-parity regex in `translation-parity.test.ts` | Separate scanner file | One file already owns translation parity; cohesion. |

**Installation:**

No new packages. Phase 11 is additive within the existing dependency tree.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌───────────────────────────┐
        Phase 9 backend │  GET /api/cars/:id        │
        (already live) │  → status-aware response  │
                       │     - admin: full Car + moderationBadge
                       │     - non-admin active: full Car
                       │     - non-admin non-active: thin payload
                       │       { status, reasonCategory, title,
                       │         banner: {titleKey, bodyKey, severity} }
                       │  → 404 ONLY when carId doesn't exist
                       │  POST /api/payments/create-payment-intent
                       │  → 409 listing_not_available { status, reasonCategory, banner }
                       │  POST /api/payments/confirm-booking
                       │  → 409 listing_not_available (refund-first per D-14)
                       └─────────────┬─────────────┘
                                     │ apiClient (Bearer)
                                     │ 403 interceptor matches account_suspended ONLY
                                     │ 409/404 pass through (LMOB-02 verified at client.ts:103)
                                     ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  MOBILE (Phase 11 changes inside the boxes; everything else untouched) │
   │                                                                       │
   │  CarDetailsScreen                       ServiceCartScreen             │
   │  ┌──────────────────────────┐           ┌──────────────────────────┐  │
   │  │ [Header — unchanged]     │           │ [Header — unchanged]     │  │
   │  │ ┌────────────────────┐   │           │ ┌────────────────────┐   │  │
   │  │ │ NEW: ListingStatus │←  │           │ │ NEW: cart-row      │←  │  │
   │  │ │ Banner (non-admin │  Phase 11      │ │ banner inside the  │  Phase 11
   │  │ │ + status !=active) │   │           │ │ existing carCard   │   │  │
   │  │ │   → tinted bg +    │   │           │ │   → severity tone  │   │  │
   │  │ │     left-accent +  │   │           │ │   → "Remove from   │   │  │
   │  │ │     status title + │   │           │ │     cart" CTA      │   │  │
   │  │ │     reasonCategory │   │           │ └────────────────────┘   │  │
   │  │ │     chip + tap-to- │   │           │ [provider groups —       │  │
   │  │ │     expand note    │   │           │  unchanged]              │  │
   │  │ └────────────────────┘   │           │ [footer]                 │  │
   │  │ [Hero image —            │           │  NEW: submitBtn disabled │  │
   │  │  unchanged]              │           │  when carIsNonActive +   │  │
   │  │ [Specs — unchanged]      │           │  subtitle "Remove        │  │
   │  │ [Footer]                 │           │  unavailable listing"    │  │
   │  │  NEW: Contact CTAs       │           └──────────┬───────────────┘  │
   │  │  disabled when non-      │                      │                  │
   │  │  active (opacity 0.4 +   │                      │ useFocusEffect   │
   │  │  pointerEvents 'none')   │                      │ ──→ apiClient    │
   │  │  Book it disabled        │                      │     .get(/api/   │
   │  │  similarly               │                      │      cars/:id)   │
   │  └──────────────────────────┘                      │ ──→ if response  │
   │            ↑                                       │     .status !==  │
   │            │ Existing handlers:                    │     'active' OR  │
   │            │   - processPayment (line 384)         │     404 → flip   │
   │            │     calls AuthService.createPayment   │     banner state │
   │            │     Intent / .confirmBooking          │                  │
   │            │   - 409 caught at line 432-434 as     │                  │
   │            │     err.response.data.message Alert.  │                  │
   │            │     Phase 11 changes this catch to    │                  │
   │            │     surface as banner-state flip on   │                  │
   │            │     CarDetails (not generic Alert)    │                  │
   │            │                                       │                  │
   └────────────────────────────────────────────────────────────────────────┘
```

The diagram shows: data flows from backend through `apiClient` to two consumer screens. Phase 11 changes are constrained to (a) injecting `ListingStatusBanner` at one location per screen, (b) deriving disabled state from `fetchedCar.status`, (c) changing the catch behavior of the existing `processPayment` 409 path to set banner state instead of opening a generic Alert.

### Recommended Project Structure (additions only)

```
src/
├── components/
│   └── moderation/
│       ├── ListingStatusBanner.tsx       # NEW (D-01, D-12) — sibling to UserStatusBanner
│       ├── ListingCartRowBanner.tsx      # NEW (D-12, OPTIONAL) — compact variant if visual differs
│       └── __tests__/
│           ├── ListingStatusBanner.test.tsx       # NEW
│           └── ListingCartRowBanner.test.tsx      # NEW (if separated)
├── screens/
│   ├── CarDetailsScreen.tsx              # MODIFIED — mount banner, gate CTAs
│   └── ServiceCartScreen.tsx             # MODIFIED — useFocusEffect re-fetch, inline banner, disable checkout
├── constants/
│   └── translations.ts                   # MODIFIED — new RU+EN keys (D-13)
└── (no changes elsewhere)

__tests__/
├── translation-parity.test.ts            # MODIFIED — add placeholder-token parity check (D-09)
├── moderation-literals.test.ts           # MODIFIED — extend SCAN_FILES list
└── (existing tests untouched)

.planning/phases/11-buyer-affected-ux-quality-security-review/
├── 11-CONTEXT.md                          # exists
├── 11-RESEARCH.md                         # this file
├── 11-PLAN.md / 11-XX-PLAN.md             # planner output
├── 11-COVERAGE.md                         # NEW (D-10) — generated from describe() greps
└── 11-LIST-SECURITY.md                    # NEW (D-11) — mirrors 06-SECURITY.md
```

### Pattern 1: Sibling presentational component reading from props (not context)

**What:** `ListingStatusBanner` accepts `{ status, reasonCategory, banner: {titleKey, bodyKey, severity}, note? }` as props — NOT consumed via context. Mounted by parent screens that already own the `fetchedCar` payload.

**When to use:** Local-to-route data; presentational; banner must work on multiple mount surfaces (CarDetails AND cart) with different parent state. Mirrors Phase 10 `ListingModerationBottomSheet` pattern (presentational, parent owns state).

**Contrast:** `UserStatusBanner` consumes `useAuth()` directly because user status is global. Listing status is per-listing — must be prop-driven.

**Example:**

```tsx
// Source: pattern derived from UserStatusBanner.tsx + ListingModerationBottomSheet.tsx
// [VERIFIED: src/components/moderation/UserStatusBanner.tsx:90-256]
// [VERIFIED: src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx Block E sibling discipline]
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, Archive, Ban } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

type ListingStatus = 'suspended' | 'archived' | 'deleted';
type Severity = 'warning' | 'neutral' | 'destructive';

const SEVERITY_ICON: Record<Severity, any> = {
  warning: AlertTriangle,
  neutral: Archive,
  destructive: Ban,
};

const STATUS_TO_TITLE_KEY: Record<ListingStatus, string> = {
  suspended: 'listingStatusBannerSuspendedTitle',
  archived: 'listingStatusBannerArchivedTitle',
  deleted: 'listingStatusBannerDeletedTitle',
};

interface Props {
  status: ListingStatus;
  reasonCategory?: string | null;
  bannerHints: { titleKey: string; bodyKey: string; severity: Severity };
  note?: string | null;
  variant?: 'detail' | 'cartRow';
  onRemoveFromCart?: () => void;          // cart variant only
  testID?: string;
}

export const ListingStatusBanner: React.FC<Props> = ({
  status, reasonCategory, bannerHints, note,
  variant = 'detail', onRemoveFromCart,
  testID = 'listing-status-banner',
}) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  // Collapse on blur — same pattern as UserStatusBanner.tsx:99-103
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  // [CITED: src/constants/theme.ts:16-24]
  const severityToColor = {
    warning: COLORS.warning,            // #F59E0B amber
    neutral: COLORS.textTertiary,       // #6B7280 gray
    destructive: COLORS.destructive,    // #EF4444 red
  } as const;

  const titleKey = STATUS_TO_TITLE_KEY[status];
  const title = (t as any)[titleKey] ?? status;
  const Icon = SEVERITY_ICON[bannerHints.severity];
  const accentColor = severityToColor[bannerHints.severity];

  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        { backgroundColor: `${accentColor}1A` },  // ~10% opacity tint
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.line1}>
        <Icon size={16} color={accentColor} />
        <Text style={[TYPOGRAPHY.bodyStrong, { color: COLORS.textPrimary, flex: 1 }]}>
          {title}
        </Text>
        {reasonCategory && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {(t as any)[`listingStatusBannerReason${capitalize(reasonCategory)}`] ?? reasonCategory}
            </Text>
          </View>
        )}
      </View>
      {note && (
        <Pressable onPress={onToggle}>
          <Text numberOfLines={expanded ? undefined : 2} style={styles.note}>
            {note}
          </Text>
        </Pressable>
      )}
      {variant === 'cartRow' && onRemoveFromCart && (
        <Pressable testID="listing-status-banner-remove" onPress={onRemoveFromCart}>
          <Text style={styles.removeCta}>{(t as any).cartListingUnavailableRemove}</Text>
        </Pressable>
      )}
    </View>
  );
};

function capitalize(s: string) {
  return s
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: SIZES.spacingMd + 4,
    paddingRight: SIZES.spacingMd,
    paddingVertical: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.spacingMd,
    position: 'relative',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  line1: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacingSm },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  chipText: { ...TYPOGRAPHY.body, color: COLORS.textTertiaryStrong },
  note: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, marginTop: SIZES.spacingXs },
  removeCta: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.accent,
    marginTop: SIZES.spacingSm,
    alignSelf: 'flex-end',
  },
});
```

### Pattern 2: CarDetailsScreen non-admin banner mount

**What:** Banner inserts as the first child of `<View style={styles.detailsContainer}>` (line 655), conditionally on `!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active'`. Existing admin banner (lines 660-688) is independent and unaffected.

**When to use:** Per D-02 — above hero, scrolls with content. Admin path keeps Phase 10 D-17 banner.

**Mount sketch:**

```tsx
// [CITED: src/screens/CarDetailsScreen.tsx:655-689 — existing admin banner location]
<View style={styles.detailsContainer}>
  {/* NEW Phase 11 — non-admin banner */}
  {!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active' && fetchedCar?.banner && (
    <ListingStatusBanner
      status={fetchedCar.status as 'suspended' | 'archived' | 'deleted'}
      reasonCategory={fetchedCar.reasonCategory}
      bannerHints={fetchedCar.banner}
      variant="detail"
    />
  )}

  {/* EXISTING — admin banner (Phase 10 D-17) untouched */}
  {isAdmin && fetchedCar?.moderationBadge && ( /* lines 660-688 verbatim */ )}

  {/* EXISTING — admin error banner untouched */}
  {errorBanner && ( /* lines 693-705 verbatim */ )}
  …
```

### Pattern 3: CTA disable derivation on CarDetailsScreen

**What:** Add a derived predicate at the top of the component body:

```tsx
// [CITED: CarDetailsScreen.tsx:73-78 — existing isContactGated pattern]
const isListingNonActive =
  !isAdmin && !!fetchedCar?.status && fetchedCar.status !== 'active';
```

Reuse the existing Phase 6 D-04 dim+disable pattern (per line 889 — `isContactGated && { opacity: 0.4 }`):

```tsx
// Telegram CTA (existing at lines 887-897)
<TouchableOpacity
  style={[
    styles.contactButton,
    styles.telegramButton,
    (isContactGated || isListingNonActive) && { opacity: 0.4 },
  ]}
  onPress={
    isListingNonActive
      ? undefined
      : isContactGated
      ? () => setContactGateVisible(true)
      : handleTelegram
  }
  disabled={isListingNonActive}
  accessibilityState={{ disabled: isContactGated || isListingNonActive }}
  …
```

Same pattern for WhatsApp (line 898) and Book-it (line 807).

### Pattern 4: ServiceCartScreen focus re-fetch + banner mount

**What:**

```tsx
// [CITED: src/components/moderation/UserStatusBanner.tsx:32 — useFocusEffect import pattern]
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../services/http/client';

// Inside ServiceCartScreen
const [carStatus, setCarStatus] = useState<{
  status?: string;
  reasonCategory?: string | null;
  banner?: { titleKey: string; bodyKey: string; severity: 'warning'|'neutral'|'destructive' };
} | null>(null);

useFocusEffect(
  useCallback(() => {
    if (!car?.id) return;
    let cancelled = false;
    apiClient
      .get(`/api/cars/${car.id}`)
      .then((res) => {
        if (cancelled) return;
        setCarStatus({
          status: res.data.status ?? 'active',
          reasonCategory: res.data.reasonCategory ?? null,
          banner: res.data.banner ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          // Phase 9 D-08: 404 only when carId doesn't exist at all.
          // In cart context, treat as deleted-and-removed.
          setCarStatus({ status: 'deleted', reasonCategory: null, banner: { titleKey: 'listingStatusBannerDeletedTitle', bodyKey: 'listingStatusBannerDeletedBody', severity: 'destructive' } });
        }
        // Other errors: leave previous carStatus in place.
      });
    return () => { cancelled = true; };
  }, [car?.id]),
);

const carIsNonActive = !!(carStatus?.status && carStatus.status !== 'active');
```

The submit button disables based on `submitting || carIsNonActive`.

### Anti-Patterns to Avoid

- **Single shared `<StatusBanner>` primitive that prop-switches on `kind="listing" | "user"`:** Rejected by D-01 (sibling discipline). Two consumers, two siblings; widen only after a third use-site emerges.
- **Auto-clear the cart when the car becomes non-active:** Violates LBUY-02. Buyer must see what happened; explicit "Remove from cart" tap required.
- **Open `Alert.alert` on disabled CTA tap:** Violates D-04 ("the disabled visual is sufficient"). Disabled buttons are not tappable.
- **Add a third response interceptor to `apiClient` for listing 409s:** Violates Phase 10 D-13 + ANTI-PATTERN in 10-CONTEXT line 238. The two existing interceptors (403 user-suspension + 401 idToken refresh) are sufficient; listing 409s normalize at the per-method level (already implemented in Plan 10-04 `toListingModerationError`).
- **Widen `ModerationError` to accept listing codes:** Violates Phase 10 D-14 + the source-level grep guard at `listingMethods.test.ts`. `ListingModerationError` is the listing-domain mirror.
- **Hardcoded hex colors for severity:** Violates project convention (theme tokens). Use `COLORS.warning`, `COLORS.destructive`, `COLORS.textTertiary` per D-14.
- **Wholesale-scan `CarDetailsScreen.tsx` in the moderation-literals scanner:** Phase 6 Plan 06-09 deliberately exempted CarDetailsScreen to avoid allowlist explosion ('Visa', 'Mastercard', 'Telegram'). Phase 11's new `ListingStatusBanner.tsx` is scanned wholesale; CarDetailsScreen is **not added** to SCAN_FILES — the banner's user-facing text is fully encapsulated in `ListingStatusBanner` which IS scanned.
- **Add `ListingStatusBanner` to context provider stack:** Banner is per-route, not global. Mount inline on the two consumer screens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cart re-fetch on screen focus | Manual `useEffect` + nav listener | **`useFocusEffect` from `@react-navigation/native`** | Already used by `UserStatusBanner.tsx:32`; handles unfocus cleanup automatically. |
| RU/EN parity enforcement | Manual diff scripts | **Existing `__tests__/translation-parity.test.ts`** (Phase 6 substrate) | Already does key-set diff + empty-value check; extend with placeholder-token parity only. |
| Untranslated-literal detection | Custom AST parser | **Existing `__tests__/moderation-literals.test.ts`** | Already uses `fs.readFileSync + regex`; CLAUDE.md forbids new deps; pattern is good enough for tight scope. |
| Severity color resolution | Per-component hex constants | **`COLORS.warning / .destructive / .textTertiary`** (already in `theme.ts`) | Single source of truth; admin + buyer banners must look the same. |
| Listing-title rendering for the banner header | Inline `${year} ${makeName} ${modelName}` concat | **`buildListingTitle(fetchedCar)` from `src/utils/listingTitle.ts`** | Phase 10 D-08 — Pitfall 6 mitigation. Same helper used in admin bottom-sheet + TypedConfirmationModal. |
| Coverage manifest generation | Custom jest reporter / plugin | **`grep` + `awk` + `node` shell script** | Lowest-cost; portable; matches Phase 6 QUAL-01 substrate philosophy. |
| Severity → translation-key mapping | Per-call-site switch statements | **Module-level `STATUS_TO_TITLE_KEY` const** (like `UserStatusBanner.tsx:62-66`) | Grep-detectable; future audits read one map. |
| Typed listing-domain HTTP error | New error class per failure mode | **`ListingModerationError`** (already at `src/services/moderation/errors.ts:19-47`) | Sibling to `ModerationError`; carries `banner` hint already used by Phase 10. |

**Key insight:** Phase 11 is overwhelmingly about *plumbing existing contracts into UI surfaces*. Every backend payload Phase 11 needs is already shipped, typed, and grep-verifiable. Resist any temptation to add new HTTP routes, new global state, or new dependencies.

## Common Pitfalls

### Pitfall 1: D-03 conflicts with Phase 9 D-08 on `deleted` 404 vs 200-thin-payload

**What goes wrong:** CONTEXT D-03 says non-admin viewers of `deleted` listings get a 404 → empty-state. Phase 9 D-08 (`09-CONTEXT.md:61`) says **non-admin viewers of suspended/archived/deleted ALL get 200 + thin payload**; the explicit anti-pattern at `09-CONTEXT.md:208` says "**Do NOT 404 deep-link viewers** — non-admin viewers of `suspended/archived/deleted` listings get 200 + thin payload (D-06), NOT 404. 404 is reserved for 'carId doesn't exist at all'."

**Why it happens:** Two different views of the same UX: D-03 likely captured the user's intent of "deleted should feel terminal" but Phase 9 picked the simpler, more uniform "200-thin-payload-everywhere" path so the mobile client has one branch (`body.status`).

**How to avoid:** Plan should render the banner-with-destructive-tone for `deleted` (mirroring suspended/archived flow). The centered empty-state is reserved for actual 404s (carId truly does not exist). Flag this contradiction for operator reconciliation at plan-check time. See Open Questions §1.

**Warning signs:** Test fixtures that expect `apiClient.get('/api/cars/:id')` to return 404 for deleted listings; assertions that the empty-state renders for deleted.

### Pitfall 2: CartScreen 409 surface confusion (`/api/orders` vs `/api/payments/*`)

**What goes wrong:** `ServiceCartScreen.handleSubmit` calls `AuthService.createOrders` (POST `/api/orders`) at line 82 of ServiceCartScreen.tsx. The Phase 9 D-09 / D-11..D-15 listing-status 409 surface is on `/api/payments/create-payment-intent` + `/api/payments/confirm-booking` — both fired from `CarDetailsScreen.processPayment` (lines 384-438), NOT from ServiceCartScreen submit. Additionally, v1.0 Phase 3 Plan 03-05 replaced POST `/api/orders` with a 410 Gone stub (unrelated to listing moderation; pre-existing concern).

**Why it happens:** CONTEXT D-05 implies the 409 fires from "ServiceCartScreen create-payment-intent / confirm-booking" — but those calls live in `CarDetailsScreen`. ServiceCartScreen's submit path doesn't touch listing status at all.

**How to avoid:** Recognize that the cart-row banner detection is **focus-effect-driven (re-fetch GET)** only — there is no 409 fallback on the cart submit path, because the cart submit doesn't talk to the payment-intent endpoint. The 409 fallback applies to **CarDetailsScreen's Book-it flow**, which should flip the CarDetails banner state on 409 (changing the existing line 432-434 generic Alert into a banner-state set). Plan must document this surface split clearly.

**Warning signs:** Plan task says "wrap `ServiceCartScreen.handleSubmit` 409 catch in banner-state flip." That's wrong — `handleSubmit` POSTs orders, not payment intents.

### Pitfall 3: Cart car-slot is metadata-only; can hold stale data

**What goes wrong:** `CartContext.setCar()` at `src/context/CartContext.tsx:54` stores a snapshot `{id, makeName, modelName, year, price, currency, imageUrl, listingId}` set when the buyer tapped "Get services" on CarDetails. There is no server cart endpoint; no validation at add-time. A car that was active at add-time can be suspended/archived/deleted while sitting in the cart.

**Why it happens:** Local-only cart by design (Phase 9 D-09 explicitly notes "CarEx's cart is client-side only").

**How to avoid:** `useFocusEffect` re-fetch is the authoritative gate. Re-fetch on every focus; flip banner state based on response. Cart's local `car` object isn't updated (we don't want to mutate the snapshot the buyer saw); banner-state lives in screen-local React state.

**Warning signs:** Plan tries to mutate `CartContext.car` from ServiceCartScreen. Don't — keep `CartContext` as pure storage; banner-state lives in screen state.

### Pitfall 4: Translation key collision risk with Phase 6 user-domain keys

**What goes wrong:** Phase 6 added `reasonSpam`, `reasonPolicyViolation`, `reasonFraud`, `reasonOther` for user-domain moderation. Listing-domain reuses 4 of these values + adds `inactive_seller` (Phase 7 D-14a). If Phase 11 reuses `reasonSpam` etc., the chips render the same string for both — semantically OK but mixes domains.

**Why it happens:** Lazy key naming.

**How to avoid:** Use the `listing*` prefix from CONTEXT D-13: `listingStatusBannerReasonSpam`, `listingStatusBannerReasonPolicyViolation`, `listingStatusBannerReasonFraud`, `listingStatusBannerReasonInactiveSeller`, `listingStatusBannerReasonOther`. Phase 7 D-14a memo explicitly prescribes this prefix policy. Confirmed in source: `grep -n "listingReason\|listingBanner" src/constants/translations.ts` returns zero hits at start of Phase 11 (clean namespace).

**Warning signs:** New keys in plan task list missing the `listing*` prefix.

### Pitfall 5: Cart focus re-fetch races with admin moderate action

**What goes wrong:** Admin moderates listing X while buyer has cart open. Buyer navigates away from cart, then back. Focus effect fires re-fetch. But what if the buyer is the admin? Then `apiClient.get('/api/cars/:id')` returns the **full Car doc + moderationBadge** (Phase 9 D-07), not the thin payload — `res.data.status` will still indicate non-active and trigger banner-state, but the banner copy keys come from `moderationBadge.banner` (admin format), not the thin-payload `banner` field. Component must handle both shapes.

**Why it happens:** Phase 9 D-08 — single endpoint, branches on caller identity.

**How to avoid:** `ListingStatusBanner` accepts `bannerHints: {titleKey, bodyKey, severity}` from EITHER source. For admin path: `res.data.moderationBadge?.banner`. For non-admin: `res.data.banner`. Caller (ServiceCartScreen) normalizes before passing.

**Warning signs:** ServiceCartScreen unconditionally reads `res.data.banner` and gets undefined when an admin views their own cart.

### Pitfall 6: `useFocusEffect` cleanup race on cart unmount

**What goes wrong:** `useFocusEffect` runs the callback every focus; the callback returns a cleanup. If the user navigates away mid-fetch, the resolved promise calls `setCarStatus(...)` on an unmounted component → React warning.

**Why it happens:** Async work outliving focus lifetime.

**How to avoid:** Use the `cancelled` flag closure pattern from Pattern 4 example above. (`let cancelled = false; … return () => { cancelled = true; }`.)

**Warning signs:** Console warnings "Can't perform a React state update on an unmounted component" during cart navigation tests.

### Pitfall 7: Placeholder-token parity false positives on dynamic keys

**What goes wrong:** Placeholder parity (D-09 (c)) compares tokens like `{email}`, `{title}`, `{uid}` across RU/EN for the same key. But some keys use only one placeholder by design (e.g., `appealNoMailBody: 'Send an email to support and include your user ID: {uid}'` — same in both languages). False positives occur when:

- A key has the SAME placeholder set in both languages — should PASS.
- A key has DIFFERENT placeholder sets — should FAIL (real bug — buyer-visible variable missing in translation).
- A key has NO placeholders in either — should PASS trivially.

**Why it happens:** Regex extracts `{xxx}` token names; set comparison.

**How to avoid:** Scanner extracts the set of `{tokenName}` per key per language, asserts `setRU.equals(setEN)`. Token name is `[a-zA-Z][a-zA-Z0-9]*`. Sample regex: `/\{([a-zA-Z][a-zA-Z0-9]*)\}/g`. Reuse Phase 6 plan-06-01 set-equality approach.

**Warning signs:** Scanner flags `appealNoMailBody` as a placeholder-mismatch when both languages have `{uid}` — likely regex captured punctuation.

### Pitfall 8: `LISTING_STATUS_POLICY.banner.severity` literal values vs `COLORS.moderation` palette keys

**What goes wrong:** Phase 7 emits severity strings `'warning' | 'neutral' | 'destructive'`. The existing `COLORS.moderation` palette uses different keys: `active / featureLimited / blockedReview / permaBanned` (user-domain). Direct mapping is impossible.

**Why it happens:** Listing-domain severities never went into `COLORS.moderation`; the palette is user-domain.

**How to avoid:** Map listing severity → top-level COLORS tokens (already exist):

| Severity | Token | Hex (from `theme.ts:16-17`) |
|----------|-------|--------|
| `warning` | `COLORS.warning` | `#F59E0B` (amber) |
| `neutral` | `COLORS.textTertiary` | `#6B7280` (gray) |
| `destructive` | `COLORS.destructive` | `#EF4444` (red) |

No new theme entries required. Document this in `ListingStatusBanner.tsx` source comment so the next reader doesn't re-derive.

**Warning signs:** Plan task tries to add `COLORS.moderation.listing.{warning,neutral,destructive}` sub-palette. Unnecessary.

### Pitfall 9: Existing CarDetailsScreen line 214-224 empty-state handles loading vs "Car not found" — Phase 11 must layer on top, not replace

**What goes wrong:** CarDetailsScreen.tsx:214-224 already has:

```tsx
if (!car) {
  return (
    <View style={styles.errorContainer}>
      {carLoading ? (
        <Text>{t.loading || 'Loading...'}</Text>
      ) : (
        <Text>{t.carNotFound || 'Car not found'}</Text>
      )}
    </View>
  );
}
```

This fires when the `.catch(() => setFetchedCar(null))` at line 159 runs — i.e., any fetch failure including 404. Phase 11's empty-state for "carId truly doesn't exist" (per Pitfall 1's correction) can REUSE this existing branch; no separate empty-state needed.

**Why it happens:** Existing handler is already a "no car" empty-state; just unused for the non-active flow.

**How to avoid:** For "carId doesn't exist" 404, the existing empty-state suffices. For non-active statuses, return the full screen + banner. Confirm `t.carNotFound` exists in RU+EN (grep). If absent, add it under LQUAL-01 sweep.

**Warning signs:** Plan task creates a new `<ListingNotAvailableEmptyState>` component when the existing `errorContainer` branch already works.

### Pitfall 10: Coverage manifest must capture every LIST-* requirement — including completed ones from prior phases

**What goes wrong:** LQUAL-02 says "Each LIST-* requirement is covered by at least one jest test." That includes LADM-01..05 (Phase 8 — already complete), LDATA-01..04 (Phase 7), LSEC-01..03 (Phase 7), LENF-01..03 (Phase 9), LMOB-01..02 (Phase 10), LUI-01..04 (Phase 10). If Phase 11's manifest only counts new LBUY-/LQUAL- tests, prior-phase requirements show as uncovered.

**Why it happens:** Lazy reading of LQUAL-02.

**How to avoid:** Coverage manifest grep scope = ALL `__tests__/` and `src/**/__tests__/` directories — both repos for cross-repo cases. Backend tests already use `describe('LADM-01: …')` patterns (verified via Phase 8 substrates). Cross-repo grep is the integration touch.

**Warning signs:** Manifest table shows "LADM-01: not covered" when in fact there are passing backend tests for it.

### Pitfall 11: `userFocusEffect` does not exist in `@react-navigation/native` — it's `useFocusEffect` (typo guard)

**What goes wrong:** Confusing typo causes runtime error.

**Why it happens:** Manual typing.

**How to avoid:** Import: `import { useFocusEffect } from '@react-navigation/native';` Already used at `src/components/moderation/UserStatusBanner.tsx:32` — copy verbatim.

**Warning signs:** TypeScript: "Module has no exported member 'userFocusEffect'."

### Pitfall 12: Wholesale-add CarDetailsScreen to moderation-literals SCAN_FILES

**What goes wrong:** Phase 6 Plan 06-09 deliberately excluded CarDetailsScreen because of legitimate brand-name `<Text>` literals: `'Visa'` (line 950), `'Mastercard'` (line 953), `'Telegram'` (button label inside Phase 6 contact-gate context). Adding CarDetailsScreen would force allowlist creep.

**Why it happens:** Plan author wants belt-and-braces literal coverage.

**How to avoid:** Phase 11's new `ListingStatusBanner.tsx` ships to SCAN_FILES; banner contents fully encapsulate Phase 11's new user-facing strings, so adding the screen is unnecessary. Document this decision inline in the test file extension.

**Warning signs:** Plan task adds `'src/screens/CarDetailsScreen.tsx'` to SCAN_FILES.

## Code Examples

### Translation key additions (D-13)

Verified against `src/constants/translations.ts:432-435` (existing user-domain reasonSpam etc. — listing keys use distinct prefix to prevent collision per Phase 7 D-14a):

```ts
// Source: pattern derived from src/constants/translations.ts:541-543 (bannerTitleFeatureLimited etc.)
// RU (paste before the closing `}` of TRANSLATIONS.RU)
listingStatusBannerSuspendedTitle: 'Объявление приостановлено',
listingStatusBannerSuspendedBody: 'Это объявление временно недоступно.',
listingStatusBannerArchivedTitle: 'Объявление в архиве',
listingStatusBannerArchivedBody: 'Это объявление больше не активно.',
listingStatusBannerDeletedTitle: 'Объявление удалено',
listingStatusBannerDeletedBody: 'Это объявление больше не доступно.',
listingStatusBannerReasonSpam: 'Спам',
listingStatusBannerReasonPolicyViolation: 'Нарушение правил',
listingStatusBannerReasonFraud: 'Мошенничество',
listingStatusBannerReasonInactiveSeller: 'Неактивный продавец',
listingStatusBannerReasonOther: 'Другое',
cartListingUnavailableTitle: 'Автомобиль больше не доступен',
cartListingUnavailableBody: 'Удалите автомобиль из корзины, чтобы продолжить.',
cartListingUnavailableRemove: 'Удалить из корзины',
cartListingUnavailableCheckoutHint: 'Удалите недоступное объявление, чтобы оформить остальные услуги.',
// (planner may add `carNotFoundTitle` / `carNotFoundBody` etc. if Pitfall 9 empty-state is reused)

// EN — same keys, English copy. RU is canonical, EN is mirror.
listingStatusBannerSuspendedTitle: 'Listing suspended',
listingStatusBannerSuspendedBody: 'This listing is temporarily unavailable.',
listingStatusBannerArchivedTitle: 'Listing archived',
listingStatusBannerArchivedBody: 'This listing is no longer active.',
listingStatusBannerDeletedTitle: 'Listing removed',
listingStatusBannerDeletedBody: 'This listing is no longer available.',
listingStatusBannerReasonSpam: 'Spam',
listingStatusBannerReasonPolicyViolation: 'Policy violation',
listingStatusBannerReasonFraud: 'Fraud',
listingStatusBannerReasonInactiveSeller: 'Inactive seller',
listingStatusBannerReasonOther: 'Other',
cartListingUnavailableTitle: 'This vehicle is no longer available',
cartListingUnavailableBody: 'Remove the vehicle from your cart to continue.',
cartListingUnavailableRemove: 'Remove from cart',
cartListingUnavailableCheckoutHint: 'Remove the unavailable listing to check out remaining services.',
```

### `translation-parity.test.ts` placeholder-parity extension (D-09)

Source: extends existing `__tests__/translation-parity.test.ts:33-76` with a fourth test:

```ts
// New test inside describe('QUAL-01: translation parity')
test('placeholder tokens are identical across RU and EN for every key', () => {
  const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
  function extract(value: unknown): Set<string> {
    const set = new Set<string>();
    const visit = (v: unknown) => {
      if (typeof v === 'string') {
        let m;
        PLACEHOLDER.lastIndex = 0;
        while ((m = PLACEHOLDER.exec(v)) !== null) set.add(m[1]);
      } else if (Array.isArray(v)) v.forEach(visit);
    };
    visit(value);
    return set;
  }

  const ruObj = (TRANSLATIONS as any).RU;
  const enObj = (TRANSLATIONS as any).EN;
  const mismatches: Array<{ key: string; ru: string[]; en: string[] }> = [];
  for (const key of Object.keys(ruObj)) {
    const ruTokens = extract(ruObj[key]);
    const enTokens = extract(enObj[key]);
    if (
      ruTokens.size !== enTokens.size ||
      [...ruTokens].some((tok) => !enTokens.has(tok))
    ) {
      mismatches.push({
        key,
        ru: [...ruTokens].sort(),
        en: [...enTokens].sort(),
      });
    }
  }
  expect(mismatches).toEqual([]);
});
```

### `moderation-literals.test.ts` SCAN_FILES extension (D-09)

Source: extends existing `__tests__/moderation-literals.test.ts:42-46`:

```ts
const SCAN_FILES = [
  'src/components/moderation/UserStatusBanner.tsx',
  'src/components/moderation/FeatureGateOverlay.tsx',
  'src/components/moderation/GatedScreenWrapper.tsx',
  'src/components/moderation/ListingStatusBanner.tsx',         // Phase 11 — NEW
  // 'src/components/moderation/ListingCartRowBanner.tsx',     // Phase 11 — OPTIONAL, if D-12 split
];
```

Note: CarDetailsScreen.tsx + ServiceCartScreen.tsx deliberately NOT added (Pitfall 12 — pre-existing brand-name literals on CarDetails; cart strings are all `t.*` by construction once Phase 11 lands).

### `11-COVERAGE.md` generator (D-10) — shell script

Source: lowest-cost grep+awk approach (no jest reporter needed):

```bash
#!/usr/bin/env bash
# scripts/generate-coverage-manifest.sh — Phase 11 LQUAL-02
# Usage: bash scripts/generate-coverage-manifest.sh > .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md
set -euo pipefail

cat <<EOF
# Phase 11 LQUAL-02 — Per-requirement coverage manifest

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Convention: every \`describe('LXXX-NN: …')\` block tags its covering requirement.

| Requirement | Test file(s) |
|-------------|--------------|
EOF

# Walk mobile + backend test trees; collect describe('LXXX-NN: ...') strings
TEST_DIRS=(
  "__tests__"
  "src/components/moderation/__tests__"
  "src/screens/__tests__"
  "src/services/moderation/__tests__"
  "../backend-services/carEx-services/__tests__"
)

# Gather requirement → files map
declare -A MAP
for dir in "${TEST_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS=: read -r file _ id; do
    id="${id## }"; id="${id%%:*}"
    MAP["$id"]+="$(realpath --relative-to=. "$file" 2>/dev/null || echo "$file")\n"
  done < <(grep -rEn "describe\\(['\"]L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:" "$dir" || true)
done

# Emit rows
for id in $(echo "${!MAP[@]}" | tr ' ' '\n' | sort); do
  files=$(echo -e "${MAP[$id]}" | sort -u | sed '/^$/d' | tr '\n' ' ')
  echo "| $id | $files |"
done

echo
echo "## Coverage check"
echo
# Compare against REQUIREMENTS.md
ALL_LIST_IDS=$(grep -oE 'L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+' .planning/REQUIREMENTS.md | sort -u)
for id in $ALL_LIST_IDS; do
  if [ -z "${MAP[$id]:-}" ]; then
    echo "- ❌ **$id** — no covering test found"
  fi
done
```

Run output committed as `11-COVERAGE.md`. Block phase verify-work on zero red lines (all LIST-* IDs found).

### `11-LIST-SECURITY.md` 5-section template (D-11)

Source: clone of `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md:1-254` with listing-domain substitution:

```markdown
---
phase: 11-buyer-affected-ux-quality-security-review
artifact: security-review
status: APPROVED   # or BLOCKED if any FAIL
reviewed_by: self
reviewed_at: YYYY-MM-DD
roadmap_criterion: "Phase 11 Success #5 — 5 verdicts PASS"
---

# Phase 11 — Security Review (LQUAL-03)

**Scope:** v1.1 Admin Listing Moderation milestone — cross-repo verification before merge to `main`.
**Reviewer:** Self-review.
**Review date:** YYYY-MM-DD
**Repos audited:**
- `carEx` @ commit ____
- `backend-services/carEx-services` @ commit ____

---

## (a) Authentication — verifyIdToken runs on every admin listing route

**Verification:**
```bash
grep -rn "verifyIdToken\|requireAdmin" src/moderation/listingRouter.js src/admin/router.js
grep -nE "router\\.(get|post|patch|delete)" src/moderation/listingRouter.js
```

**Evidence:**
- `src/moderation/listingRouter.js` is mounted at `server.js:???` with `verifyIdToken + requireAdmin` chain.
- Phase 7 LSEC-01..02 tests at `__tests__/listing-moderation/requireAdmin.listing.middleware.test.js` confirm: missing Bearer → 401; non-admin → 403; admin → 200.

**Verdict:** ✅ PASS / ❌ FAIL

---

## (b) Authorization — No callerUid body param trusted on any new listing route

**Verification:**
```bash
grep -rn "callerUid" src/moderation/listingRouter.js src/moderation/listingService.js
grep -rn "callerUid" src/services/moderation/ModerationService.ts  # mobile
```

**Evidence:** Zero hits on new listing-moderation surface. (Legacy `/api/admin/*` callerUid-in-body persists from pre-milestone; explicitly out of scope per Phase 6.)

**Verdict:** ✅ PASS / ❌ FAIL

---

## (c) Audit — ListingModerationAction collection rejects updates and deletes at the application layer

**Verification:**
```bash
grep -nE "pre\(|APPEND_ONLY|append-only" src/models/ListingModerationAction.js
grep -rn "ListingModerationAction\\.(updateOne|deleteOne|findOneAndUpdate|update|remove)" src/
```

**Evidence:** Six append-only pre-hooks (Phase 7 LDATA-03) — `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`. Production call-site grep returns zero mutation attempts.

**Verdict:** ✅ PASS / ❌ FAIL

---

## (d) TOCTOU — confirm-booking re-verifies listing status inside the transaction

**Verification:** Re-verify the Phase 9 D-12..D-15 refund-first-throw-second contract:
```bash
grep -nE "session\\.withTransaction|refundAndThrow" src/payments/confirmBooking.js
```

**Evidence:**
- `confirmBooking.js` step 4 now checks (1) seller active, (2) seller role APPROVED, (3) `car.status === 'active'`. Any failure → `refundAndThrow(...)` helper.
- The Phase 11 seller-update-vs-buyer-read race is closed by Phase 9 `pre(/^find/)` hide hook + the in-txn refetch with `includeAllListingStatuses: true` bypass.
- `__tests__/payments/confirmBooking.transaction.test.js` re-runs green after Phase 9 helper extraction (Phase 9 D-15 regression).

**Verdict:** ✅ PASS / ❌ FAIL

---

## (e) Deferred-verification disposition + No new hardcoded secrets

**Verification:**
```bash
# Backend
cd ../backend-services/carEx-services
git diff main -- '*.js' '*.ts' | grep -iE "AIza|sk_live|pk_live|mongodb(\\+srv)?://|bearer\\s+[A-Za-z0-9._-]{40,}"
# Mobile
cd ../../mobileApps/carEx
git grep -nE "AIza|sk_live|pk_live|mongodb(\\+srv)?://|bearer\\s+[A-Za-z0-9._-]{40,}" -- '*.ts' '*.tsx' '*.js'
```

**Evidence:**
- Backend diff: zero matches.
- Mobile: pre-existing Firebase web API key at `src/services/AuthService.ts:9` (blamed to `cd5f6ac 2026-01-30`) + Stripe `pk_test_` at `App.tsx:93` — both PRE-MILESTONE, documented in CONCERNS.md, deferred to REL-01/REL-03.
- LIST-02 (auto-flagging queue) deferred per ROADMAP v2 — disposition: accepted, scope-out documented.
- DEBT-01..04 carry-forward.

**Verdict:** ✅ PASS / ❌ FAIL

---

## Review Sign-Off
All 5 verdicts above PASS → ready for merge to `main` and v1.1 tag.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One shared `StatusBanner` primitive prop-switching on kind | Two sibling components per domain | Phase 6 D-04 + Phase 10 D-04 (sibling discipline) | Easier auditing per domain; grep boundary clean |
| Inline `<Text>{`${year} ${makeName} ${modelName}`}</Text>` per call site | `buildListingTitle(car)` helper at `src/utils/listingTitle.ts` | Phase 10 Plan 10-02 (Pitfall 6 mitigation) | Single source of truth; sentinel match works in TypedConfirmationModal |
| Generic 403 interceptor wrapping ALL admin errors as ModerationError | 403 interceptor matches `account_suspended` ONLY; listing 409/404 normalized at per-method level via `ListingModerationError` | Phase 10 D-13/D-14 | LMOB-02 invariant grep-stable; sibling errors stay independently auditable |
| 404-on-deleted (intuitive but breaks deep-link UX) | 200 + thin payload for ALL non-active states; 404 reserved for "carId truly doesn't exist" | Phase 9 D-06 / D-08 | Single mobile branch; some HTTP clients drop bodies on 4xx |

**Deprecated/outdated (within this milestone):**

- `useDebouncedValue` hook removed in Phase 5 Plan 05-11 (UAT Test 3 gap closure) — do NOT re-introduce; any debounce need uses submit-driven UI per Plan 05-11.
- POST `/api/orders` returns 410 Gone (Phase 3 Plan 03-05). `ServiceCartScreen.handleSubmit` line 82 calls this endpoint and will fail; pre-existing pre-milestone concern out of Phase 11 scope, but worth flagging in Validation §edge cases.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 9 D-08 returns 200+thin-payload for deleted (not 404), contradicting CONTEXT D-03 | §Common Pitfalls Pitfall 1 + §Open Questions §1 | [VERIFIED via 09-CONTEXT.md:61 + 09-CONTEXT.md:208 — Phase 9 is the source of truth; D-03 needs reconciliation]. Plan that follows D-03 verbatim will mis-render deleted listings. |
| A2 | The 409 listing_not_available fallback fires from CarDetailsScreen processPayment (not ServiceCartScreen submit) | §Common Pitfalls Pitfall 2 | [VERIFIED via grep of `createPaymentIntent`/`confirmBooking`: only used in CarDetailsScreen.tsx:390+425; ServiceCartScreen.handleSubmit uses createOrders → /api/orders 410]. Plan misrouting the catch will leave cart un-banner'd on TOCTOU. |
| A3 | `LISTING_STATUS_POLICY[state].banner` is shipped by Phase 7 and surfaced verbatim in Phase 9 thin payload | §Pattern 1 + §Code Examples | [CITED: 07-CONTEXT.md:90-110 — `LISTING_STATUS_POLICY` definition; 09-CONTEXT.md:51-58 — thin payload includes `banner: {titleKey, bodyKey, severity}`]. If Phase 7/9 deployed without this shape, banner cannot render copy keys. Backend already shipped (Phase 9 verified complete per ROADMAP). |
| A4 | `useFocusEffect` cleanup runs reliably on screen blur in RN 0.83 + react-navigation 7.1.28 | §Pattern 4 | [VERIFIED via UserStatusBanner.tsx:99 — same hook used in production since Phase 6]. Risk: low. |
| A5 | Coverage script can grep the cross-repo backend tree at `../backend-services/carEx-services/__tests__` | §Code Examples coverage script | [VERIFIED via MEMORY: backend repo location is `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`]. If operator runs script from a different cwd, --relative-to flag handles fallback. Risk: low. |
| A6 | All v1.1 backend admin listing routes use `verifyIdToken + requireAdmin` (not callerUid-in-body) — passes security review (a) and (b) | §Code Examples 11-LIST-SECURITY template | [CITED: Phase 7 D-04 + Phase 8 plans — new listing-mod surface mounted under `/api/admin/moderation/listings` follows Phase 2 D-23 pattern; STATE.md confirms 0 cross-repo plans deviated]. Risk: low — re-grep at sign-off time. |
| A7 | `ListingModerationAction` collection has six append-only pre-hooks identical to `ModerationAction` | §Code Examples 11-LIST-SECURITY template | [ASSUMED] Phase 7 LDATA-03 prescribes append-only enforcement, but the exact six-hook list (`updateOne`/`updateMany`/`findOneAndUpdate`/`deleteOne`/`deleteMany`/`findOneAndDelete`) needs verification at security review time against the actual model file. Risk: if fewer hooks shipped, audit verdict (c) fails. **Operator action:** confirm during planning by reading the model file in backend repo. |
| A8 | The placeholder-token parity regex `\{[a-zA-Z][a-zA-Z0-9]*\}` matches all existing Phase 1-10 placeholders | §Code Examples parity ext | [ASSUMED] Spot-checked `appealNoMailBody: '... {uid}'` (line 158 of UserStatusBanner.tsx) — match. Risk: any placeholder with hyphen/underscore/numerics-leading would miss. **Mitigation:** scanner extends to `[a-zA-Z_][a-zA-Z0-9_]*` if needed; flag at first failure. |
| A9 | Phase 11 introduces zero new HTTP routes (security review (e) clean) | §Code Examples 11-LIST-SECURITY template | [VERIFIED via CONTEXT.md "In scope" / "Out of scope" — phase scope is mobile-only + doc artifacts]. Risk: zero. |
| A10 | The existing `errorContainer` empty-state at CarDetailsScreen.tsx:214-224 is acceptable for "carId truly doesn't exist" 404 | §Pitfall 9 | [VERIFIED via source read; uses `t.carNotFound || 'Car not found'` fallback]. Risk: copy may need an update for tone, but no new component needed. |

## Open Questions (RESOLVED 2026-05-29)

*All 6 questions resolved during /gsd-plan-phase 11 reconciliation. CONTEXT.md amended accordingly.*

1. **[RESOLVED — D-03 amended]** **D-03 deleted → 404 vs Phase 9 D-08 deleted → 200 thin-payload**
   - What we know: CONTEXT D-03 prescribes 404 → empty-state for deleted; Phase 9 D-08/D-06 explicitly says 200+thin-payload + "Do NOT 404 deep-link viewers" (09-CONTEXT.md:208).
   - What's unclear: Which is authoritative for Phase 11 planning? D-03 was authored later; Phase 9 contract is what the backend actually does.
   - Recommendation: **Honor Phase 9 (backend reality)**. Render banner-with-destructive-tone for `deleted`. Reserve the existing empty-state for true `carId doesn't exist` 404. Surface to operator at plan-discuss time for one-line CONTEXT amendment.

2. **[RESOLVED — D-04 + D-15 amended]** **D-15 audit of buyer CTAs — are "Get services" + "Add to cart" actually present, and should they be disabled?**
   - What we know: CONTEXT D-15 lists Contact seller / Add to cart / Buy now / Reserve, but CarDetailsScreen's actual CTAs (verified) are: Telegram (line 887), WhatsApp (line 898), Book it (line 807), Get services (line 787). No literal "Add to cart" button on detail screen — that flow is "Get services" → ServicesScreen → ServiceDetails Add. Reserve doesn't exist either.
   - What's unclear: Whether "Get services" should be disabled when the listing is non-active. Argument FOR: services are tied to the cart's car slot; if the car is non-active, services flow is moot. Argument AGAINST: services are independent providers; user might want to book broker for a different listing later.
   - Recommendation: **Disable Telegram + WhatsApp + Book it** (clearly transactional/commitment). **Leave "Get services" enabled** — it's navigation to ServicesScreen, no commitment yet; if the buyer then attempts to add the car to cart (via setCar in ServiceCartScreen), the next focus re-fetch will surface the banner. Document in plan for review.

3. **[RESOLVED — D-12 amended, single component with variant prop]** **Cart banner — single shared component or split `ListingCartRowBanner`?**
   - What we know: D-12 leaves split decision to planner.
   - What's unclear: Is the cart-row visual sufficiently distinct from detail-screen banner that a split is justified? Detail banner: tinted bg + 4px accent + top-level full-width. Cart row: same tone but INSIDE the existing carCard at line 137-152 (constrained width, may need compact icon-less variant).
   - Recommendation: **Start with a single `ListingStatusBanner` component with a `variant: 'detail' | 'cartRow'` prop**, as in Pattern 1 sketch above. Split only if the variant prop accretes more than 3 visual branches (D-12 escape hatch).

4. **[RESOLVED — D-07 copy locked in CONTEXT.md]** **Cart subtitle copy when service items exist but car is non-active — exact wording**
   - What we know: D-07 prescribes `"Remove the unavailable listing to check out remaining services."`
   - What's unclear: That copy implies services CAN check out independently after removing the car — true in code (CartContext supports car=null + items), but is the FE submit path tested for that branch?
   - Recommendation: Plan includes a Validation §edge case for "car removed → services-only checkout proceeds via existing handleSubmit." If existing handleSubmit doesn't gracefully handle car=null (line 54: `car: car ? {...} : null`), confirm backend `/api/orders` accepts that shape. Currently `/api/orders` is 410 Gone (deferred concern); flag at plan-discuss.

5. **[RESOLVED — D-08 discretion: defer to v1.2]** **Should `MyOrdersScreen` get a tiny inline note (D-08 last sentence allows discretion)?**
   - What we know: D-08 says "no banner, no badge, no behavior change" but allows "small inline note inside the order detail screen if it's a one-line change."
   - What's unclear: Is there an OrderDetailScreen, and is the note a one-line addition?
   - Recommendation: Audit during planning; if one line, add it; if it ripples into multiple screens, defer per D-08 to v1.2.

6. **[RESOLVED — icon map locked in PATTERNS.md]** **Severity icon picks for listing domain**
   - What we know: User-domain uses `AlertTriangle / ShieldAlert / Ban` (UserStatusBanner.tsx:34).
   - What's unclear: Best icon for listing severities (warning/neutral/destructive)?
   - Recommendation: `AlertTriangle` (warning), `Archive` (neutral), `Ban` (destructive). Mirrors visual semantics; all available in `lucide-react-native`. Plan locks the map at module-scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm + jest + scripts | ✓ | ≥ 20 (per package.json `engines`) | — |
| npm | dep mgmt | ✓ | — | — |
| jest | test runner | ✓ | 29.6.3 (in package.json) | — |
| react-test-renderer | component test rendering | ✓ | 19.2.0 | — |
| `@react-navigation/native` | useFocusEffect | ✓ | 7.1.28 | — |
| `lucide-react-native` | severity icons | ✓ | 0.563.0 | — |
| Backend (`carEx-services`) | LIST-SECURITY (e) cross-repo grep | ✓ | sibling at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` per MEMORY.md | If absent, the coverage manifest grep skips backend tests with a warning row |
| `bash` (for coverage script) | manifest generation | ✓ | platform default | Substitute with node script if needed |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** the backend repo is present in this development environment per MEMORY.md, but if a future operator runs the coverage script from a fresh checkout, the script must skip backend grep gracefully (already handled via `[ -d "$dir" ] || continue`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 29.6.3 + react-test-renderer 19.2.0 |
| Config file | `jest.config.js` / `package.json` jest preset = `react-native` |
| Quick run command | `npx jest path/to/file.test.tsx -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **LBUY-01** | Non-admin viewing suspended/archived/deleted listing detail sees the banner with severity-aware tone | unit (component) | `npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x` | ❌ Wave 0 — needs creation |
| **LBUY-01** | CarDetailsScreen integrates banner above hero for non-admin only | screen integration | `npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x` | ❌ Wave 0 — needs creation |
| **LBUY-01** | All buyer CTAs (Telegram / WhatsApp / Book it) disabled when listing non-active | screen integration | (same file as above) | ❌ Wave 0 |
| **LBUY-02** | Cart with non-active car renders in-row banner + disabled checkout, NOT auto-cleared | screen integration | `npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x` | ❌ Wave 0 |
| **LBUY-02** | `useFocusEffect` re-fetch fires apiClient.get on screen focus | screen integration | (same file as above) | ❌ Wave 0 |
| **LBUY-02** | Cart NOT auto-cleared (CartContext.car remains set) | unit | (same file as above) | ❌ Wave 0 |
| **LBUY-03** | Already-paid order — no auto-cancel logic exists | source-grep audit | `npx jest __tests__/lbuy03-no-auto-cancel.test.ts -x` (fs.readFileSync + regex on MyOrdersScreen/ProviderOrdersScreen for `'cancel'` near `'listing_'`) | ❌ Wave 0 |
| **LBUY-04** | Severity tone correctly mapped: neutral=archived, warning=suspended, destructive=deleted | unit (component) | (same file as LBUY-01 banner test) | ❌ Wave 0 |
| **LQUAL-01** | RU≡EN key sets + non-empty leaf values + no placeholder TODO/FIXME (existing) | unit | `npx jest __tests__/translation-parity.test.ts -x` | ✅ existing |
| **LQUAL-01** | **NEW** — placeholder tokens identical across RU/EN per key (D-09) | unit | (same file as above; new test case) | ✅ extension |
| **LQUAL-01** | Untranslated `<Text>` literals scanner — extend SCAN_FILES | unit | `npx jest __tests__/moderation-literals.test.ts -x` | ✅ extension |
| **LQUAL-02** | Coverage manifest exists and is non-empty | manual + scripted | `bash scripts/generate-coverage-manifest.sh \| diff - .planning/phases/11-.../11-COVERAGE.md` | ❌ Wave 0 |
| **LQUAL-02** | Every LIST-* requirement appears at least once in manifest | scripted check | (manifest generation script's coverage-check trailing block) | ❌ Wave 0 |
| **LQUAL-03** | `11-LIST-SECURITY.md` exists with status=APPROVED + 5 PASS verdicts | manual | `grep -c 'Verdict.*PASS' 11-LIST-SECURITY.md` ≥ 5 | ❌ Wave 0 |

### Test Dimensions (Nyquist Dimension 8)

The minimum reference dataset that lets Phase 11 claim coverage:

**Banner-visibility dimension matrix:**

| Listing status × User role × Mount surface × Focus state |
|---|
| **status ∈ {active, suspended, archived, deleted, deleted-then-404}** |
| × **user ∈ {anonymous, non-admin authenticated, admin}** |
| × **mount ∈ {CarDetails, ServiceCart-row}** |
| × **focus ∈ {initial mount, post-focus re-fetch, mid-checkout 409 fallback}** |

**Minimum required fixture set (mock listings):**

| Fixture | Status | reasonCategory | banner | note | Used By |
|---------|--------|---------------|--------|------|---------|
| F1 — active | `active` | — | — | — | Baseline: banner NOT rendered |
| F2 — suspended-spam-with-note | `suspended` | `spam` | `{warning}` | "Multiple flag reports filed by buyers." | LBUY-01 + LBUY-04 warning tone |
| F3 — archived-inactive_seller-no-note | `archived` | `inactive_seller` | `{neutral}` | null | LBUY-04 neutral tone + nullable-note branch |
| F4 — deleted-policy_violation-with-note | `deleted` | `policy_violation` | `{destructive}` | "Listing violated content policy §3.2." | LBUY-04 destructive + Pitfall 1 (treat as 200+banner) |
| F5 — suspended-fraud-no-note | `suspended` | `fraud` | `{warning}` | null | empty-note rendering |
| F6 — archived-other-with-empty-string-note | `archived` | `other` | `{neutral}` | `""` | empty-string-note rendering (different from null) |
| F7 — listing genuinely doesn't exist | `→ 404` | — | — | — | empty-state path (existing line 214-224) |
| F8 — admin viewing F2 | full Car + `moderationBadge: {...}` | — | banner inside moderationBadge | full audit fields | Admin path unaffected (Phase 10 banner) |
| F9 — admin viewing own moderated listing | F4-shape + `error: 'cannot_moderate_own_listing'` on action | — | — | — | regression (Phase 10 D-15 inline banner unaffected) |

**Mock reasonCategory values to exercise (per Phase 7 D-14a):**
`spam`, `policy_violation`, `fraud`, `inactive_seller`, `other` (5 total).

### Edge cases (must enumerate in tests)

1. **Rapid status flip mid-checkout (TOCTOU on CarDetailsScreen Book-it):** Admin suspends while buyer holds the payment sheet. confirmBooking returns 409. The existing CarDetailsScreen.tsx:432-434 catch shows generic Alert. Phase 11 changes this catch to set banner-state from the 409 body (which already includes `{status, reasonCategory, banner}` per Phase 9 D-11). Test: stub `AuthService.confirmBooking` to reject with `ListingModerationError('listing_not_available', 'suspended', 'spam', {titleKey, bodyKey, severity: 'warning'})`; assert banner renders + Book-it CTA disabled.

2. **Cart with NO car slot, only services (LBUY-02 negative branch):** `car === null` + items present. Banner does NOT render. Checkout enabled. Submit path works (subject to pre-existing 410 Gone on /api/orders — pre-milestone concern; flag but DO NOT regress).

3. **404 race on focus re-fetch:** Buyer opens cart while admin has just hard-deleted the underlying car (carId truly gone — separate from soft-delete). apiClient.get returns 404. Cart shows destructive-tone banner (per Pitfall 1 recommendation: treat 404 same as deleted-status for the cart-row UX).

4. **Dev bypass interactions (OTP, etc.):** OTP dev bypass `123456` from PHONE_VERIFICATION_SETUP.md is orthogonal — no listing-status interaction. Test that signing in via dev bypass + viewing a suspended listing renders banner correctly.

5. **Translation parity for placeholder tokens (D-09):** Add an intentional mismatch in a test fixture (e.g., `{title}` in RU but missing in EN for the same key) to confirm the parity test catches it. Revert after assertion.

6. **CarDetailsScreen line 214-224 empty-state**: existing branch handles `!car` (= fetch failed) — Phase 11 keeps for 404. Test: stub fetch reject → empty-state renders with `t.carNotFound`.

7. **Cart focus re-fetch + cart is empty (car=null, items=[]):** Should NOT fire apiClient.get. Guard with `if (!car?.id) return;` inside useFocusEffect.

8. **Backend returns `{status: 'active'}` after re-fetch (admin restored mid-cart):** Banner clears; checkout re-enables. Test that the carStatus state transitions cleanly when going active → non-active → active.

9. **Coverage manifest cross-repo:** Backend tests at `../backend-services/carEx-services/__tests__/listing-moderation/*` follow Phase 7-9 plans' `describe('LDATA-01: …')` / `describe('LADM-01: …')` / `describe('LENF-01: …')` naming convention (verified via Phase 8 STATE.md entries). Manifest grep crosses the repo boundary.

10. **Anonymous (signed-out) deep-link to suspended listing:** Phase 9 D-08 says public/anonymous viewers treated as non-admin → thin payload. Phase 11 banner renders the same way. Test: render CarDetailsScreen with `useAuth() → { user: null, isAdmin: false }` + suspended-fixture; banner renders, all CTAs disabled (Telegram/WhatsApp guarded by existing login prompts; Book-it already requires auth).

### Sampling rate

- **Per task commit:** `npx jest <touched-test-file> -x` (single-file isolated run)
- **Per wave merge:** `npm test -- --testPathPattern='moderation|translation|ListingStatus|cart|CarDetails'`
- **Phase gate (before LQUAL-03):** `npm test` (full suite); coverage script runs producing `11-COVERAGE.md`; security review document signed off.

### Wave 0 Gaps

- [ ] `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` — covers LBUY-01, LBUY-04 (component-level)
- [ ] `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` — covers LBUY-01 (mount integration), CTA disable
- [ ] `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` — covers LBUY-02 (focus-effect + banner + disable)
- [ ] `__tests__/lbuy03-no-auto-cancel.test.ts` — source-grep audit covering LBUY-03 (no MyOrdersScreen / ProviderOrdersScreen auto-cancel logic)
- [ ] `scripts/generate-coverage-manifest.sh` — generator script for 11-COVERAGE.md
- [ ] `.planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` — generated artifact (committed)
- [ ] `.planning/phases/11-buyer-affected-ux-quality-security-review/11-LIST-SECURITY.md` — 5-verdict review

(`__tests__/translation-parity.test.ts` and `__tests__/moderation-literals.test.ts` already exist; Phase 11 EXTENDS them.)

## Security Domain

> CONTEXT does not explicitly disable `security_enforcement`; treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (verification) | Phase 7 LSEC-01 verifyIdToken on every admin listing route — re-grep in 11-LIST-SECURITY §(a) |
| V3 Session Management | no | Phase 11 adds no new session flow; existing AuthContext + idToken refresh from Phase 5 P05-12 unchanged |
| V4 Access Control | yes (verification) | Phase 7 LSEC-02 requireAdmin; Phase 9 D-08 thin payload PII minimization — re-grep in 11-LIST-SECURITY §(b) |
| V5 Input Validation | yes (verification) | Phase 7 Zod listing schemas at backend; mobile inputs go through `listingTitle` sentinel for delete (already in Phase 10) — not new in Phase 11 |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for React Native + Express/Mongo stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Banner copy injection via reasonCategory free-text | Tampering | reasonCategory is taxonomy-bounded (5 enum values per Phase 7 D-14a); chip lookup uses `listingStatusBannerReason${capitalize(cat)}` with map; unknown values fall back to label literal (NOT raw HTML — RN Text is escape-safe by default) |
| Note free-text rendering — XSS | Tampering | `<Text>` automatically escapes; no `dangerouslySetInnerHTML` equivalent in RN |
| Buyer-bypass of disabled CTA via gesture-handler edge case | Spoofing | `disabled={true}` on TouchableOpacity; pointerEvents on parent; backend 409 is the authoritative gate (Phase 9 D-09) — UI is defense-in-depth |
| TOCTOU between cart focus re-fetch and checkout submit | Tampering | Re-fetch on focus + 409 fallback on submit. Both code paths set banner state. Backend transactional re-check inside `session.withTransaction` (Phase 9 D-12..D-14) is authoritative |
| Leak of moderation note to non-admin viewers | Information disclosure | Phase 9 D-05 thin payload explicitly excludes `moderationReason / moderatedBy`. The `note` field exposed to non-admin **is the user-visible category description**, not the admin's free-text reason — confirm by re-reading Phase 9 D-05 contract before naming the prop. **Operator action:** Phase 9 thin payload DOES include reasonCategory (taxonomy value) but does NOT include free-text `moderationReason`. Phase 11 banner exposes reasonCategory chip ONLY, never `moderationReason`. |
| Non-admin discovers internal status names via banner copy | Information disclosure | status names are buyer-facing by design (LBUY-01 mandates "status + reason category"); RU+EN copy is non-technical ("Listing suspended" not "moderation_status_suspended") |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` — LBUY-01..04, LQUAL-01..03 source-of-truth
- `.planning/ROADMAP.md` §Phase 11 — goal + 5 success criteria
- `.planning/phases/11-buyer-affected-ux-quality-security-review/11-CONTEXT.md` — D-01..D-15 user-locked decisions
- `.planning/phases/06-affected-user-ux-security-review/06-CONTEXT.md` — Phase 6 D-01..D-08 (banner visual template), QUAL-01..03 substrate
- `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` — 5-verdict structure template
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — `LISTING_STATUS_POLICY` shape (D-14), reasonCategory enum (D-14a)
- `.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md` — thin non-admin payload shape (D-05), 200-OK-with-status (D-06), single endpoint branches on caller identity (D-08), 409 body shape (D-11), confirm-booking TOCTOU (D-12..D-15)
- `.planning/phases/10-mobile-plumbing-admin-listing-ui/10-CONTEXT.md` — admin banner D-17, error split D-15, sibling discipline D-04/D-14
- `src/components/moderation/UserStatusBanner.tsx` — visual template + useFocusEffect pattern (verified 316 lines)
- `src/context/CartContext.tsx` — cart shape (verified 141 lines)
- `src/screens/CarDetailsScreen.tsx` — mount surface + admin banner location + Book-it 409 catch (verified 1850 lines)
- `src/screens/ServiceCartScreen.tsx` — mount surface + existing GatedScreenWrapper wrap + submit path (verified 318 lines)
- `src/services/http/client.ts` — 403 interceptor scope confirmed at line 103 (`account_suspended` ONLY)
- `src/services/AuthService.ts` — `createPaymentIntent` (line 378), `confirmBooking` (line 392); no `getCarById` helper (CarDetailsScreen line 135 uses apiClient.get directly)
- `src/services/moderation/errors.ts` — `ListingModerationError` shape (verified 47 lines)
- `src/constants/theme.ts` — `COLORS.warning / .destructive / .textTertiary` available (verified)
- `src/constants/translations.ts` — existing key naming patterns + no `listing*` namespace collision (verified via grep)
- `src/utils/listingTitle.ts` — `buildListingTitle` helper (verified 40 lines)
- `__tests__/translation-parity.test.ts` — existing scanner shape (verified 76 lines)
- `__tests__/moderation-literals.test.ts` — existing scanner shape (verified 101 lines)

### Secondary (MEDIUM confidence)

- React Native `LayoutAnimation` for tap-to-expand (used in `UserStatusBanner.tsx:131`) — RN 0.83 supports per RN docs
- `useFocusEffect` cleanup semantics — react-navigation 7.x official docs + production use at UserStatusBanner.tsx:99

### Tertiary (LOW confidence)

- None for Phase 11 — every claim either grep-verified in source, cited from upstream phase CONTEXT, or marked [ASSUMED] in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all deps already in tree; no version research needed
- Architecture: HIGH — pattern is verbatim mirror of `UserStatusBanner` + standard `useFocusEffect` re-fetch
- Pitfalls: HIGH — derived from grep-verified source reads + upstream CONTEXTs
- Security domain: HIGH — every threat already covered by upstream phase contracts; Phase 11 adds zero new HTTP surface

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (30 days — stable infra, no rapidly-moving deps)

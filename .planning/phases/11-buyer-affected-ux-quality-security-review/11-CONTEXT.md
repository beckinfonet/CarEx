# Phase 11: Buyer-affected UX + Quality + Security Review — Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 closes the v1.1 Admin Listing Moderation milestone. Two deliverable halves:

**Half A — Buyer-affected UX** (LBUY-01..04)
- A non-dismissable, severity-aware `ListingStatusBanner` rendered above the hero image on `CarDetailsScreen` whenever a non-admin views a `suspended` or `archived` listing. Tone: neutral (archived), warning (suspended), destructive-but-recoverable (deleted — see D-03 routing).
- A row-level cart banner inside `ServiceCartScreen` when the cart's `car` slot is non-active, plus a globally-disabled checkout button. Cart is NOT auto-cleared.
- Already-paid in-flight orders proceed normally with no UI intervention (LBUY-03). Admins retain manual cancel via existing tools.

**Half B — Merge-gate quality checks** (LQUAL-01..03)
- Extend the existing `__tests__/translation-parity.test.ts` + `__tests__/moderation-literals.test.ts` substrate (from Phase 6 QUAL-01) to cover every v1.1-new user-facing string with RU+EN parity.
- Per-requirement test coverage manifest mapping each LIST-* requirement to its covering test file(s).
- Pre-merge `LIST-SECURITY.md` review document mirroring the Phase 6 `06-SECURITY.md` 5-verdict structure (auth, authz, audit, TOCTOU, deferred-verification disposition); self-review.

**In scope:**
- `ListingStatusBanner` component (mobile, sibling to `UserStatusBanner`)
- Banner mount + action-CTA gating on `CarDetailsScreen` non-admin path
- Cart row banner + global checkout-disable on `ServiceCartScreen`
- `useFocusEffect` re-fetch of the cart's car on `ServiceCartScreen` mount
- 409 `listing_not_available` surfacing on the checkout path (existing path; only the UI handling is new)
- RU + EN translation keys for new banner copy + reason category × severity matrix
- Extended jest parity scanner — block CI on parity violation
- `11-COVERAGE.md` or equivalent per-requirement coverage manifest
- `11-LIST-SECURITY.md` merge-gate review document
- No changes to backend (Phase 9 already provides the thin non-admin payload, the cart-add 409, and the read-time deleted-listing filter)

**Out of scope (explicitly deferred):**
- Split checkout (services-only checkout when car is blocked) — requires Stripe payment intent split + order creation split; v1.2+ scope (see D-07)
- Service-side moderation banners — services are provider+service pairs not tied to listings; no listing-status flow applies
- `MyOrdersScreen` / `ProviderOrdersScreen` UI changes for in-flight orders touching a now-non-active listing — LBUY-03 mandates "proceed normally"; no informational badge added (see D-08)
- Hard-delete UI affordance — REQUIREMENTS Out of Scope
- Bulk admin listings panel — REQUIREMENTS Out of Scope
- Listing edit-history audit UI (per-field diff replay) — REQUIREMENTS Out of Scope
- Deferred items unrelated to v1.1 (DEBT-01..04, REL-01/03, MOD2-*, NOTF-*, LIST-02) — carry-forward candidates for v1.2

**Scope boundary:** Mobile-only changes inside `carEx` repo. Backend (`backend-services/carEx-services`) is touched only by `11-LIST-SECURITY.md` as a review document, not via new endpoints or code changes.

</domain>

<canonical_refs>
## Canonical References — MUST READ before planning/research

| Path | Why |
|------|-----|
| `.planning/ROADMAP.md` | Phase 11 goal, depends_on, success criteria (5), UI hint = yes |
| `.planning/REQUIREMENTS.md` | LBUY-01..04, LQUAL-01..03 source-of-truth — pinned severity tone (LBUY-04), parity enforcement (LQUAL-01), coverage (LQUAL-02), security review (LQUAL-03) |
| `.planning/PROJECT.md` | Constraints: tech stack, RU-first i18n, no breaking changes to existing flows, secrets hygiene |
| `.planning/phases/06-affected-user-ux-security-review/06-CONTEXT.md` | UserStatusBanner D-01..D-03 visual treatment (tinted bg + 4px left-accent + 2-line note truncation + tap-to-expand); FeatureGateOverlay D-04 (faded + disabled pattern); QUAL-01..03 substrate decisions |
| `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` | 5-verdict structure (auth / authz / audit / TOCTOU / deferred-verification) to mirror in `11-LIST-SECURITY.md` |
| `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` | LISTING_STATUS_POLICY severity mapping (D-14) and LISTING_REASON_CATEGORIES enum (D-14a: `spam / policy_violation / fraud / inactive_seller / other`) — banner copy keys must match these enum values |
| `.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md` | Thin non-admin payload shape (D-05: `{status, reasonCategory, statusChangedAt}`); cart-add 409 `listing_not_available` (D-09); confirm-booking 409 (D-12..D-15); deleted-listing read-time filter for non-admin |
| `.planning/phases/10-mobile-plumbing-admin-listing-ui/10-CONTEXT.md` | Admin-side banner D-17 (above the action area); admin error surfacing D-15; sibling-domain discipline precedent (D-04 — ListingModerationReasonModal NOT a reuse of ModerationActionModal) |
| `src/components/moderation/UserStatusBanner.tsx` | Visual treatment reference — ListingStatusBanner mirrors the layout, swaps copy + data source |
| `src/context/CartContext.tsx` | Cart model: one `car` + flat list of `{provider, service}` items; auto-clears on `user.localId` change; service items independent of listing state |
| `src/screens/CarDetailsScreen.tsx` | Mount point for the non-admin banner (above hero) + action-CTA gating; existing admin path stays untouched (Phase 10) |
| `src/screens/ServiceCartScreen.tsx` | Mount point for the cart row banner + checkout-disable state |
| `__tests__/translation-parity.test.ts` | Phase 6 QUAL-01 substrate — extend for v1.1 keys (do NOT re-create) |
| `__tests__/moderation-literals.test.ts` | Phase 6 QUAL-01 literal scanner — extend for new moderation files |

If during planning/research any of the above paths cannot be resolved, STOP and surface to the user before improvising.

</canonical_refs>

<decisions>
## Implementation Decisions

### Area 1 — Buyer-facing ListingStatusBanner (USER-DECIDED)

- **D-01:** **Sibling `ListingStatusBanner.tsx`** at `src/components/moderation/ListingStatusBanner.tsx`. NOT a reuse of `UserStatusBanner` (different mount surface — local-to-route vs global, different data source — `fetchedCar` vs `useAuth`). NOT a shared `StatusBanner` primitive (rejected: speculative generality; one consumer for now, two if/when a future banner shows up). Matches Phase 10 sibling-domain discipline (D-04: `ListingModerationReasonModal` NOT a reuse of `ModerationActionModal`). Visual treatment mirrors Phase 6 D-01..D-03 verbatim: tinted background at ~10% opacity, 4 px left-accent at full opacity, title + reasonCategory chip on line 1, truncated note on line 2 with tap-to-expand, non-dismissable.
- **D-02:** **Banner placement = above hero image** at the top of `CarDetailsScreen` non-admin path. Scrolls with content (not sticky — keeps the implementation simple; if buyers report missing the banner after scroll-away, sticky is a v1.2 tweak). Mirrors Phase 6 D-03 stacking philosophy: banner is the first thing visible. Admin-side banner (Phase 10 D-17 — sits above action area) is independent and unaffected.
- **D-03 [AMENDED 2026-05-29]:** **`status='deleted'` for non-admin viewers → destructive-tone banner on detail screen** (NOT 404+empty-state as originally drafted). Phase 9 D-08 / D-06 backend contract returns 200 + thin-payload `{status: 'deleted', reasonCategory, banner, statusChangedAt}` for non-admin requests, with an explicit "Do NOT 404 deep-link viewers" anti-pattern at `09-CONTEXT.md:208`. Phase 11 honors that contract: `CarDetailsScreen` renders `ListingStatusBanner` with `severity='destructive'` for `status='deleted'`. The existing empty-state branch (`CarDetailsScreen.tsx:214-224`) is reserved for true 404s — `carId` does not exist at all. Severity-aware tone matrix per LBUY-04: neutral=archived, warning=suspended, destructive=deleted. Cart banner (D-06) uses the same destructive tone for cached deleted listings; on focus re-fetch, the cart's `apiClient.get('/api/cars/:carId')` returns 200+thin-payload → banner-state. (Original draft assumed deleted=404 from Phase 9 read-time filter; the filter is non-admin-only for *list* endpoints and excludes the listing from search/feed, but the *detail* endpoint always returns the thin payload regardless of status for deep-link survivability.)
- **D-04 [AMENDED 2026-05-29]:** **All four buyer action CTAs on `CarDetailsScreen` are disabled on non-active listing detail.** Per CTA audit during research, the actual buyer CTAs are: **Telegram** (`CarDetailsScreen.tsx:887`), **WhatsApp** (`:898`), **Book it** (`:807`), **Get services** (`:787`) — the originally-drafted Contact/Add-to-cart/Buy-now/Reserve do not exist. All four render greyed-out and non-tappable when the banner is visible. Read-only affordances (photo zoom, info display) stay enabled. No `Alert.alert` on tap (matches Phase 6 D-04 faded-disabled pattern, scoped to action area). Get-services is disabled per strictest interpretation of LBUY-01 — any CTA off a non-active listing is non-tappable, including pure navigation, to prevent the buyer threading services off a listing they shouldn't be acting on.

### Area 2 — Cart UX (USER-DECIDED)

- **D-05:** **Detection: `useFocusEffect` re-fetch + 409 fallback.** On `ServiceCartScreen` focus, re-fetch the cart's `car` via `apiClient.get('/api/cars/:carId)`. 404 (deleted, filtered for non-admin) OR response payload with `status !== 'active'` flips the cart into banner-state. The 409 `listing_not_available` from `createPaymentIntent` / `confirmBooking` (Phase 9 D-09, D-12..D-15) is the TOCTOU fallback for the listing going non-active between focus and Pay tap — handled by the same banner-state code path.
- **D-06:** **Inline row banner + global checkout-disabled state.** Banner renders inside the car row card (severity-aware tone matching D-03 / LBUY-04), with a tappable "Remove from cart" affordance on the row. Global checkout button at the bottom of the cart is disabled with subtitle text: `"Remove unavailable listing to continue"` (translation key). Service items in the cart remain visually unchanged but inherit the global checkout-disable state. Cart is NOT auto-cleared (LBUY-02) — the buyer must explicitly tap "Remove from cart" to proceed.
- **D-07:** **Service-only checkout is blocked when the car slot is non-active.** Single Stripe payment intent model (existing). Splitting payment by item type would require backend payment intent + order creation surgery; explicitly deferred to v1.2+. Banner copy: `"Remove the unavailable listing to check out remaining services."` This is the simpler, single-failure-mode behavior; the trade-off is buyers with mixed carts can't proceed with services until they pop the car — accepted.

### Claude's Discretion (planner / executor may choose without re-asking)

- **D-08 (LBUY-03 — already-paid orders, no UI change):** No informational badge added to `MyOrdersScreen` / `ProviderOrdersScreen` rows when the underlying listing is now non-active. REQUIREMENTS explicitly says "proceed normally; admin can manually cancel via existing tools" — interpreted literally. The order status itself is independent of the listing status (orders carry their own state machine). If buyers later request visibility, a v1.2 informational chip is the natural extension. Planner may surface a small inline note inside the order detail screen if it's a one-line change — but no banner, no badge, no behavior change.
- **D-09 (LQUAL-01 — strict parity, block CI):** Extend `__tests__/translation-parity.test.ts` to assert (a) `Object.keys(translations.RU) === Object.keys(translations.EN)` set-wise, (b) all new v1.1 keys have non-empty values in both languages, (c) placeholder tokens (`{title}`, `{email}`, `{date}`, etc.) present in one language are present in the other for the same key. Failing test → CI block. Mirror Phase 6 QUAL-01 pattern but tighten placeholder-parity check. Extend `__tests__/moderation-literals.test.ts` to scan the new moderation files (`ListingStatusBanner.tsx`, the cart banner sub-component, any new screens added during planning) for raw user-facing literals not wrapped in `t.*`.
- **D-10 (LQUAL-02 — coverage via test-name conventions + manifest):** Adopt the convention that every test `describe(...)` block covering a LIST-* requirement starts with the requirement ID, e.g., `describe('LBUY-01: ListingStatusBanner renders severity-aware tone on suspended listing', ...)`. After tests pass, generate a `11-COVERAGE.md` manifest mapping each LIST-* requirement to its covering test file(s) by grepping `describe()` strings. Manifest is regenerable; not hand-maintained. Each LIST-* requirement must appear at least once in the manifest before the LQUAL-03 security review signs off.
- **D-11 (LQUAL-03 — `11-LIST-SECURITY.md` self-review, 5 verdicts):** Produce `.planning/phases/11-.../11-LIST-SECURITY.md` mirroring Phase 6 `06-SECURITY.md` structure exactly: one section per verdict (auth / authz / audit / TOCTOU / deferred-verification disposition). Each section: (a) what was verified, (b) grep/test evidence with file:line citations, (c) PASS/FAIL verdict. Self-review model (no external auditor — matches Phase 6 QUAL-03 default). The TOCTOU verdict specifically must address whether Phase 9 read-time enforcement closes the seller-update-vs-buyer-read race; the deferred-verification verdict addresses anything that was knowingly skipped (Phase 6 carry-forwards, etc.).
- **D-12 [AMENDED 2026-05-29] (single-component, variant prop):** `ListingStatusBanner.tsx` at `src/components/moderation/ListingStatusBanner.tsx` is the **single** component for both mount surfaces. It accepts `variant: 'detail' | 'cartRow'` — the `cartRow` variant renders a compact, constrained-width form (e.g., smaller icon or icon-less, tighter padding) suitable for in-row carCard mounting (`ServiceCartScreen.tsx:137-152`). The `detail` variant is the full-width top-of-screen form for `CarDetailsScreen`. Test file: `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` exercises both variants. Escape hatch: if the variant prop accretes more than 3 visual branches during implementation, split into `ListingCartRowBanner.tsx` sibling at that point. Sibling-domain discipline with `UserStatusBanner` is preserved — the listing banner is its own component, not a shared primitive.
- **D-13 (translation key naming):** New keys follow the existing convention. Suggested namespace: `listingStatusBanner*` for the detail-screen banner (e.g., `listingStatusBannerSuspendedTitle`, `listingStatusBannerArchivedTitle`, `listingStatusBannerDeletedTitle`, `listingStatusBannerReasonSpam`, `listingStatusBannerReasonPolicyViolation`, etc.) and `cartListingUnavailable*` for the cart variant. Planner finalizes exact names; the parity scanner enforces RU+EN parity regardless of naming.
- **D-14 (severity-tone color resolution):** Severity colors are sourced from the existing `LISTING_STATUS_POLICY[status].banner.severity` shape (Phase 7 D-14) mapped to project theme colors in `src/constants/theme.ts`. Planner verifies the mapping table exists or adds it minimally — neutral = gray, warning = orange/amber, destructive = red. Mirrors the admin-side badge coloring decided in Phase 10 D-10.
- **D-15 [AMENDED 2026-05-29] — superseded by D-04 above]:** The CTA audit was completed during phase research. Actual buyer CTAs on `CarDetailsScreen.tsx` are: **Telegram** (`:887`), **WhatsApp** (`:898`), **Book it** (`:807`), **Get services** (`:787`). All four are disabled when the banner is visible (per amended D-04). Read-only affordances (photo zoom, info display, share-back-link, favorite if present) stay enabled. Principle: any CTA off a non-active listing is non-tappable, including pure navigation like "Get services" — prevents the buyer threading services off a listing they shouldn't be acting on.

</decisions>

<deferred>
## Deferred Ideas (for v1.2+ backlog)

- **Split checkout (services-only path when car is blocked)** — requires Stripe payment intent split + order creation split. Captured here so the future change has clear motivation.
- **`MyOrdersScreen` informational chip when underlying listing is now non-active** — small UX win deferred per D-08 to honor LBUY-03 "proceed normally" literally. v1.2 candidate if buyers report confusion.
- **Sticky-at-top behavior for `ListingStatusBanner`** — D-02 chose scroll-with-content for simplicity. If buyers report missing the banner after scrolling, revisit.
- **Per-listing buyer notification when a listing they have in cart becomes non-active** — push notification or in-app appeal/notification surface. Tracked under NOTF-* deferred items.
- **Compact / expanded variant management for `ListingStatusBanner`** — tap-to-expand is per-session per Phase 6 D-02; persisting expansion state across navigations is a follow-on if usage signal emerges.
- **Translation parity for non-moderation strings** — Phase 11 LQUAL-01 covers v1.1-new strings only; a project-wide parity sweep across pre-existing screens is a separate effort.

</deferred>

<code_context>
## Reusable Assets & Patterns

- **`src/components/moderation/UserStatusBanner.tsx`** — visual treatment template (tinted bg + 4px left-accent + 2-line note + tap-to-expand). Copy the layout primitives; do NOT prop-drive both domains through one component (D-01).
- **`__tests__/components/moderation/UserStatusBanner.test.tsx`** — test pattern (jest + react-test-renderer or @testing-library/react-native) to follow for `ListingStatusBanner.test.tsx`.
- **`__tests__/translation-parity.test.ts`** — extend with stricter placeholder-token parity (D-09).
- **`__tests__/moderation-literals.test.ts`** — extend the file-list to scan new moderation files.
- **`src/services/http/client.ts:103`** — the 403 user-suspension interceptor matches `error === 'account_suspended'` only. Listing 409s pass through naturally (Phase 10 D-13 verified). Cart screen handles 409 surfacing via its own catch in the checkout call site, not via interceptor.
- **`src/context/CartContext.tsx`** — `car` is a single slot; service items are independent. `useFocusEffect` for re-fetch should live in `ServiceCartScreen`, not in `CartContext` (context stays pure state, screen owns navigation-driven side effects).
- **`src/screens/CarDetailsScreen.tsx`** — current non-admin path renders hero → carousel → price → seller info → action CTAs. Banner inserts above hero (D-02). Action CTAs get a disabled-state branch when banner is visible (D-04).
- **`src/screens/ServiceCartScreen.tsx`** — current cart layout renders one car row + N service item groups + global checkout button. Banner is inline on the car row (D-06); checkout button gains a disabled-state branch with subtitle text.
- **Phase 6 `06-SECURITY.md`** — the structure to clone for `11-LIST-SECURITY.md`. Same 5 verdicts; same self-review format; same file:line evidence citation style.

## Integration Points

- **Cart-add path (`CartContext.addCar` → backend?)** — verify whether cart-add hits the backend at all or is local-only. If local-only, the cart can hold a stale car (was active at add-time, now suspended); D-05 focus re-fetch handles this. If cart-add hits the backend, the existing 409 `listing_not_available` (Phase 9 D-09) is already the gate and the cart simply never accepts a non-active car.
- **`createPaymentIntent` / `confirmBooking` 409 handling** — already wired by Phase 9. Phase 11's contribution is to convert the 409 into a `ListingStatusBanner`-state flip on `ServiceCartScreen` instead of a generic alert.
- **`MyOrdersScreen` (LBUY-03)** — touched only as a verification target (no UI change per D-08). Security review's TOCTOU verdict should grep this screen to confirm no auto-cancel / auto-refund logic was added.

</code_context>

## Next Steps

`/clear` then:

```
/gsd-plan-phase 11
```

This will spawn a phase researcher (per config `workflow.research = true`), then a planner, then a plan checker. Phase 11 is the last v1.1 phase — after execution + verification, `/gsd-complete-milestone` archives v1.1.

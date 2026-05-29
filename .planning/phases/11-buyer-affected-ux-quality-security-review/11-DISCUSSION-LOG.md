# Phase 11 Discussion Log

**Date:** 2026-05-29
**Mode:** discuss (default)
**Areas presented:** 4 — Banner component, Cart UX, Already-paid orders, Quality gates
**Areas selected:** 2 — Banner component, Cart UX
**Areas deferred to Claude's discretion:** Already-paid orders (LBUY-03), Quality gates (LQUAL-01..03)

---

## Area 1 — Banner component

### Q1: Component approach
**Options:**
- Sibling `ListingStatusBanner` (Recommended)
- Extract shared `StatusBanner` primitive that both `UserStatusBanner` and `ListingStatusBanner` thin-wrap
- Reuse `UserStatusBanner` with a `mode: 'user' | 'listing'` prop

**Selected:** Sibling `ListingStatusBanner`.
**Recorded as:** D-01

### Q2: Banner placement on `CarDetailsScreen`
**Options:**
- Above hero image (top of scroll) (Recommended)
- Between hero and price
- Above the action area only

**Selected:** Above hero image, scrolls with content.
**Recorded as:** D-02

### Q3: Behavior on `status='deleted'` for non-admin
**Options:**
- Block at fetch — empty-state, Phase 9 read-time filter returns 404 (Recommended)
- Render with destructive banner
- Allow deep-link only, otherwise block

**Selected:** Block at fetch. Banner-on-detail applies only to suspended/archived.
**Recorded as:** D-03

### Q4: Action CTA gating on non-active listing detail
**Options:**
- Disable all action CTAs (Recommended)
- Show alert on tap
- Hide CTAs entirely

**Selected:** Disable all action CTAs (Contact seller, Add to cart, Buy now). Greyed-out non-tappable buttons. No alert needed.
**Recorded as:** D-04

---

## Area 2 — Cart UX

### Q1: Detection mechanism
**Options:**
- Re-fetch on `ServiceCartScreen` focus (Recommended)
- Only on checkout attempt (409 reactive)
- Both: focus re-fetch AND 409 fallback

**Selected:** Re-fetch on focus. 409 from `createPaymentIntent` / `confirmBooking` remains as the TOCTOU fallback (built into the same banner-state path).
**Recorded as:** D-05

### Q2: Banner placement in cart
**Options:**
- Inline on car row + global checkout-disabled state (Recommended)
- Global cart-top banner + row stays normal
- Both row banner AND global banner

**Selected:** Inline on car row + global checkout-disabled subtitle text. Tappable "Remove from cart" affordance on the row. Cart NOT auto-cleared.
**Recorded as:** D-06

### Q3: Service-only checkout when car is non-active
**Options:**
- No — entire cart blocked until car removed (Recommended)
- Yes — services check out independently (requires Stripe payment intent split)
- Auto-remove car, services proceed silently (violates LBUY-02)

**Selected:** Entire cart blocked. Single Stripe payment intent model preserved. Split checkout deferred to v1.2+.
**Recorded as:** D-07

---

## Deferred to Claude's Discretion

The user did NOT select these areas. Defaults documented in CONTEXT.md `<decisions>` "Claude's Discretion" subsection:

- **LBUY-03 already-paid orders** → no UI change on `MyOrdersScreen` / `ProviderOrdersScreen` (D-08). Honors "proceed normally" literally.
- **LQUAL-01 parity scanner** → extend existing `__tests__/translation-parity.test.ts` with strict key-set + non-empty + placeholder-token parity. Block CI on violation (D-09).
- **LQUAL-02 coverage** → test-name convention (`describe('LBUY-01: ...', ...)`) + auto-generated `11-COVERAGE.md` manifest (D-10).
- **LQUAL-03 LIST-SECURITY.md** → 5-verdict structure cloned from Phase 6 `06-SECURITY.md`, self-review (D-11).

---

## Scope Creep Redirects

None. Discussion stayed within the LBUY-* + LQUAL-* boundary defined by REQUIREMENTS.md.

## Carry-forward Decisions Applied (no re-ask)

- Phase 6 D-01..D-03 — UserStatusBanner visual treatment (tinted bg + left-accent + 2-line + tap-to-expand). ListingStatusBanner mirrors verbatim.
- Phase 6 D-04 — FeatureGateOverlay faded-disabled pattern. Applied to action area only on `CarDetailsScreen`.
- Phase 6 QUAL-01..QUAL-03 — Parity scanner + literal scanner + 5-verdict self-review pattern.
- Phase 7 D-14 / D-14a — LISTING_STATUS_POLICY severity mapping + LISTING_REASON_CATEGORIES enum.
- Phase 9 D-05 — thin non-admin payload `{status, reasonCategory, statusChangedAt}`.
- Phase 9 D-09 / D-12..D-15 — cart-add and checkout 409 `listing_not_available` already wired.
- Phase 10 D-15 / D-17 — admin-side banner mounts above action area; admin error surfacing precedent.
- Phase 10 sibling-domain discipline (D-04) — ListingModerationReasonModal NOT a reuse of ModerationActionModal; same principle drives Phase 11 D-01.

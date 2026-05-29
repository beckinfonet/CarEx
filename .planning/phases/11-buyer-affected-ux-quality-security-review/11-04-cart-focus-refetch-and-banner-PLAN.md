---
phase: 11-buyer-affected-ux-quality-security-review
plan: 04
type: execute
wave: 3
depends_on: ["11-01", "11-02"]
files_modified:
  - src/screens/ServiceCartScreen.tsx
  - src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx
autonomous: true
requirements: [LBUY-02]
requirements_addressed: [LBUY-02]
must_haves:
  truths:
    - "On ServiceCartScreen focus, useFocusEffect re-fetches the cart's car via apiClient.get('/api/cars/:carId') when car?.id is set"
    - "Response status !== 'active' flips cart-screen-local state into banner-state (carIsNonActive=true)"
    - "404 from apiClient.get treats car as deleted (destructive-tone banner-state per Pitfall 1)"
    - "ListingStatusBanner renders inline within the existing carCard with variant='cartRow' and onRemoveFromCart callback"
    - "Global checkout button (submitBtn) is disabled when carIsNonActive AND a checkout-hint subtitle Text is rendered"
    - "CartContext.car remains set (cart NOT auto-cleared per LBUY-02); banner-state lives in screen-local React state"
    - "D-05: detection via useFocusEffect re-fetch in ServiceCartScreen (NOT in CartContext per CONTEXT code-context note) — apiClient.get('/api/cars/:carId') on focus; 404 OR status !== 'active' flips banner-state; 409 listing_not_available from createPaymentIntent/confirmBooking is the TOCTOU fallback surface (lives on CarDetailsScreen Book-it per Plan 11-03)"
    - "D-06: inline row banner inside carCard with variant='cartRow' + tappable Remove-from-cart affordance; global checkout button disabled with subtitle text 'Remove unavailable listing to continue'; service items render unchanged but inherit checkout-disable; cart NOT auto-cleared"
    - "D-07: service-only checkout blocked when car slot is non-active (single Stripe payment intent model preserved; split-checkout deferred to v1.2+); banner copy 'Remove the unavailable listing to check out remaining services.' locked"
  artifacts:
    - path: "src/screens/ServiceCartScreen.tsx"
      provides: "useFocusEffect re-fetch + carIsNonActive state + inline banner mount + disabled submit"
      contains: "useFocusEffect"
    - path: "src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx"
      provides: "Screen-integration tests for focus re-fetch, banner mount, checkout-disable, no auto-clear"
      min_lines: 250
  key_links:
    - from: "src/screens/ServiceCartScreen.tsx useFocusEffect"
      to: "src/services/http/client.ts apiClient.get"
      via: "GET /api/cars/${car.id} on focus when car?.id is set"
      pattern: "apiClient.get.*api/cars"
    - from: "src/screens/ServiceCartScreen.tsx submitBtn disabled"
      to: "carIsNonActive derived state"
      via: "submitting || carIsNonActive"
      pattern: "carIsNonActive"
---

<objective>
Detect mid-cart listing-status changes via useFocusEffect re-fetch and surface them as an inline cart-row banner with global checkout-disable.

Purpose: LBUY-02 (cart with non-active listing renders banner + disables checkout; NOT auto-cleared). Per D-05 (focus-effect re-fetch), D-06 (inline banner + global checkout-disable + Remove CTA), D-07 (single Stripe intent — services-only checkout blocked when car non-active). Pitfall 1 — cached 404 also treated as deleted (destructive). Pitfall 2 — the 409 listing_not_available TOCTOU surface lives on CarDetailsScreen Book-it (Plan 11-03), NOT here; ServiceCartScreen detection is GET-only on focus. Pitfall 6 — cancelled-flag closure prevents setState on unmount.

Output: ServiceCartScreen.tsx extended with useFocusEffect re-fetch + carIsNonActive state + ListingStatusBanner mount inside the existing carCard + submitBtn disable + subtitle hint. New screen-integration test file proves focus-effect fires, banner mounts on non-active, checkout disabled, cart NOT cleared.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-CONTEXT.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md
@.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md
@src/screens/ServiceCartScreen.tsx
@src/components/moderation/ListingStatusBanner.tsx
@src/context/CartContext.tsx
@src/services/http/client.ts
@__tests__/_fixtures/listingStatusFixtures.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add useFocusEffect re-fetch + carIsNonActive state + inline ListingStatusBanner + disabled submitBtn to ServiceCartScreen.tsx</name>
  <read_first>
    - src/screens/ServiceCartScreen.tsx (full read — current shape: imports, useCart hook usage, carCard JSX block (~lines 136-152), submitBtn JSX (~lines 212-218), handleSubmit logic, GatedScreenWrapper wrapping the whole screen)
    - src/context/CartContext.tsx (lines 1-141 — confirm CartContext.car shape includes `id: string`, that there's no auto-clear-on-status hook to introduce; we keep CartContext pure storage per RESEARCH §code_context)
    - src/services/http/client.ts (read line 103 only — confirm 403 interceptor matches `account_suspended` ONLY; listing 404/409 pass through naturally per LMOB-02 invariant)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§ServiceCartScreen.tsx lines 443-561 — full edit template)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Pattern 4 lines 457-503 — cancelled-flag pattern; Pitfall 6 cleanup race; Pitfall 5 admin-viewing-own-cart shape coalescing)
  </read_first>
  <behavior>
    - Test 1 (LBUY-02): on focus with car?.id set, apiClient.get fires once with '/api/cars/${car.id}'
    - Test 2 (LBUY-02): on focus with car=null, apiClient.get does NOT fire
    - Test 3 (LBUY-02): response with status='suspended' → carIsNonActive=true → ListingStatusBanner mounted (variant='cartRow') inside carCard
    - Test 4 (LBUY-02): submitBtn disabled when carIsNonActive=true
    - Test 5 (LBUY-02): subtitle hint Text 'cartListingUnavailableCheckoutHint' rendered when carIsNonActive=true
    - Test 6 (LBUY-02): cart NOT auto-cleared — CartContext.clearCart not called; CartContext.car retains its value
    - Test 7 (LBUY-02): 404 from apiClient.get → carIsNonActive=true with destructive severity banner
    - Test 8 (LBUY-02): cleanup — after unmount mid-fetch, no setState warning (cancelled flag)
    - Test 9 (LBUY-02): on Remove CTA tap, the onRemoveFromCart callback fires (caller chooses behavior — typically CartContext.setCar(null))
  </behavior>
  <action>
    Per CONTEXT D-05/D-06/D-07 + RESEARCH §Pattern 4 + PATTERNS Self-analog edits + Pitfalls 1,2,5,6.

    Step 1 — Imports at top of file:
    - Add `import React, { useState, useCallback } from 'react';` IF the file doesn't already import these hooks (likely already imports React; just add useState/useCallback to the destructured list).
    - Add `import { useFocusEffect } from '@react-navigation/native';`.
    - Add `import { apiClient } from '../services/http/client';`.
    - Add `import ListingStatusBanner from '../components/moderation/ListingStatusBanner';`.

    Step 2 — Inside the ServiceCartScreen component body, near the existing `const { car, items, removeItem, clearCart, getProviderGroups, itemCount } = useCart();` line:

    Add state hooks:
    ```
    const [carStatus, setCarStatus] = useState<{
      status?: string;
      reasonCategory?: 'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other' | null;
      banner?: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' };
    } | null>(null);
    ```

    Add useFocusEffect block (per RESEARCH §Pattern 4 + Pitfall 6 cancelled-flag pattern + Pitfall 5 admin-aware shape coalescing — but for non-admin viewers, the response.data.banner is at the top level; for admin, it's at response.data.moderationBadge.banner. ServiceCartScreen does NOT need to distinguish — the cart belongs to a buyer; if the buyer is an admin viewing their own cart, they get the admin shape, and we read either field):
    ```
    useFocusEffect(
      useCallback(() => {
        if (!car?.id) return;
        let cancelled = false;
        apiClient
          .get(`/api/cars/${car.id}`)
          .then((res) => {
            if (cancelled) return;
            // Pitfall 5: admin sees full Car + moderationBadge; non-admin sees thin payload with banner at top level.
            const banner = res.data?.banner ?? res.data?.moderationBadge?.banner ?? null;
            const reasonCategory = res.data?.reasonCategory ?? res.data?.moderationBadge?.reasonCategory ?? null;
            setCarStatus({
              status: res.data?.status ?? 'active',
              reasonCategory,
              banner,
            });
          })
          .catch((err) => {
            if (cancelled) return;
            if (err?.response?.status === 404) {
              // Pitfall 1: true 404 (carId gone) — treat as deleted with destructive tone.
              setCarStatus({
                status: 'deleted',
                reasonCategory: null,
                banner: {
                  titleKey: 'listingStatusBannerDeletedTitle',
                  bodyKey: 'listingStatusBannerDeletedBody',
                  severity: 'destructive',
                },
              });
            }
            // Other errors: leave previous carStatus in place. Do NOT clear.
          });
        return () => { cancelled = true; };
      }, [car?.id]),
    );

    const carIsNonActive = !!(carStatus?.status && carStatus.status !== 'active');
    ```

    Step 3 — Mount ListingStatusBanner inside the existing carCard block (around current lines 136-152). INSERT inside the carInfo View, after the existing `<Text style={styles.carName}>{car.year} {car.makeName} {car.modelName}</Text>` line:
    ```
    {carIsNonActive && carStatus?.banner && (
      <ListingStatusBanner
        status={carStatus.status as 'suspended' | 'archived' | 'deleted'}
        reasonCategory={carStatus.reasonCategory ?? null}
        bannerHints={carStatus.banner}
        variant="cartRow"
        onRemoveFromCart={() => {
          // LBUY-02: clear car slot ONLY, NOT the whole cart. Service items remain.
          // CartContext exposes setCar; if not present in current shape, surface to operator.
          // Fallback: read from useCart() — CartContext likely already has setCar per its existing API.
          // Implementation note: if setCar is the only mutator, call setCar(null). Do NOT call clearCart().
          // Existing carCard render in services cart already supports car=null branch.
        }}
      />
    )}
    ```
    The actual onRemoveFromCart body: read useCart() destructuring to add `setCar` to the destructure (likely already exposed by CartContext.tsx); on tap call `setCar(null)`. If CartContext does NOT expose setCar publicly, surface to operator (out of scope to widen the context API in this plan — but RESEARCH §code_context confirms CartContext.setCar exists at line 54).

    Step 4 — Disable the submit button + add subtitle hint. Find the existing submitBtn JSX (lines 212-218 or thereabouts):
    ```
    <TouchableOpacity
      style={[styles.submitBtn, (submitting || carIsNonActive) && { opacity: 0.4 }]}
      onPress={handleSubmit}
      disabled={submitting || carIsNonActive}>
      {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitText}>{t.submitOrder}</Text>}
    </TouchableOpacity>
    {carIsNonActive && (
      <Text style={styles.checkoutHint}>{t.cartListingUnavailableCheckoutHint}</Text>
    )}
    ```

    Add a `checkoutHint` entry to the inline StyleSheet at the bottom of the file (mirror existing style entries; use COLORS.textTertiary + TYPOGRAPHY.body):
    ```
    checkoutHint: { ...TYPOGRAPHY.body, color: COLORS.textTertiary, textAlign: 'center', marginTop: SIZES.spacingSm },
    ```

    Step 5 — Verify GatedScreenWrapper around the screen content remains UNCHANGED (RESEARCH §Project Constraints #5 — Phase 6 D-04 + Plan 06-06 wrap is byte-identical; Phase 11 mount goes INSIDE that wrapper).

    Step 6 — DO NOT alter CartContext.tsx. The cart is NOT auto-cleared (LBUY-02 anti-pattern); CartContext stays pure storage per RESEARCH §code_context.

    Step 7 — DO NOT add a new response interceptor for listing 409s (Anti-Pattern in RESEARCH; Phase 10 D-13 invariant). The 409 surface lives on CarDetailsScreen (Plan 11-03); ServiceCartScreen's only detection mechanism is the GET re-fetch on focus.
  </action>
  <verify>
    <automated>npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useFocusEffect" src/screens/ServiceCartScreen.tsx` returns 1 (single block per the spec)
    - `grep -c "carIsNonActive" src/screens/ServiceCartScreen.tsx` >= 3 (1 derivation + submitBtn predicate + banner gate; may be more for opacity stack and subtitle)
    - `grep -c "apiClient.get(\`/api/cars" src/screens/ServiceCartScreen.tsx` returns exactly 1
    - `grep -c "ListingStatusBanner" src/screens/ServiceCartScreen.tsx` >= 2 (import + JSX mount)
    - `grep -c "variant=\"cartRow\"" src/screens/ServiceCartScreen.tsx` returns exactly 1
    - `grep -c "cancelled" src/screens/ServiceCartScreen.tsx` >= 3 (Pitfall 6 cleanup pattern — declaration, two read-sites in then/catch, plus the cleanup setter)
    - `grep -c "cartListingUnavailableCheckoutHint" src/screens/ServiceCartScreen.tsx` returns exactly 1
    - `grep -c "clearCart()" src/screens/ServiceCartScreen.tsx` does NOT increase from pre-plan count (no auto-clear introduced)
    - `grep -c "_skipModerationInterceptor" src/screens/ServiceCartScreen.tsx` returns 0 (no interceptor bypass — listing 404/409 pass through naturally per LMOB-02)
    - `grep -c "interceptor" src/services/http/client.ts` unchanged (NO new interceptor added)
    - `npx tsc --noEmit` does not surface new errors involving ServiceCartScreen.tsx
  </acceptance_criteria>
  <done>Cart re-fetches on focus, banner renders inline on non-active, checkout disabled with subtitle, cart NOT cleared; existing 403 interceptor untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ServiceCartScreen.listingBanner.test.tsx (focus-effect, banner, checkout-disable, no auto-clear)</name>
  <read_first>
    - src/screens/__tests__/CarDetailsScreen.admin.test.tsx (mock-setup template lines 18-100)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§ServiceCartScreen.listingBanner.test.tsx lines 249-294 — critical: useFocusEffect mock invokes callback synchronously)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md (§Test Dimensions Edge cases 2, 3, 6, 7, 8)
    - __tests__/_fixtures/listingStatusFixtures.ts (import F1_active, F2_suspendedSpam, F4_deletedPolicyViolation, F7_404)
  </read_first>
  <action>
    Per D-10 + PATTERNS analog mock-setup.

    Harness mocks:
    - `jest.mock('../../services/http/client', () => ({ apiClient: { get: jest.fn() } }))`
    - `let mockCartState = { car: {id: 'car_abc', makeName: 'Toyota', modelName: 'Corolla', year: 2022}, items: [{...service-item shape...}], removeItem: jest.fn(), clearCart: jest.fn(), setCar: jest.fn(), getProviderGroups: () => [...], itemCount: 1 }` — full CartContext shape mirror.
    - `jest.mock('../../context/CartContext', () => ({ useCart: () => mockCartState }))`
    - `jest.mock('../../context/LanguageContext', () => ({ useLanguage: () => ({ t: mockT }) }))` with Proxy mockT.
    - `jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: {localId: 'buyer-1'}, isAdmin: false }) }))` (cart belongs to a non-admin buyer by default).
    - **Critical** per PATTERNS: useFocusEffect mock fires callback synchronously so apiClient.get resolves inside act():
      ```
      jest.mock('@react-navigation/native', () => {
        const actual = jest.requireActual('@react-navigation/native');
        return {
          ...actual,
          useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
          useFocusEffect: (cb: any) => { const cleanup = cb(); /* keep cleanup reference for tests that simulate unmount */ },
        };
      });
      ```
    - Mock GatedScreenWrapper to a pass-through (per Phase 6 GatedScreenWrapper test convention if present; otherwise a simple component that renders children).

    `describe()` blocks (each starts with the LBUY-* ID per D-10):

    `describe('LBUY-02: ServiceCartScreen re-fetches cart car on focus and flips banner-state on non-active', () => {...})`
    - Test 1: `apiClient.get.mockResolvedValueOnce({ data: F2_suspendedSpam })`; render screen; assert apiClient.get called once with `/api/cars/car_abc`.
    - Test 2: set mockCartState.car=null; render; assert apiClient.get NOT called.
    - Test 3: F2 fixture → after `act(() => Promise.resolve())` to flush microtask, assert `tree.root.findByProps({ testID: 'listing-status-banner' })` present.

    `describe('LBUY-02: cart is NOT auto-cleared when listing becomes non-active', () => {...})`
    - Test: F2 → after re-fetch resolves, assert mockCartState.clearCart NOT called; mockCartState.car still set to the original carId.

    `describe('LBUY-02: global checkout button disabled when carIsNonActive with subtitle hint', () => {...})`
    - Test: F2 → after re-fetch, find submitBtn TouchableOpacity by testID (add testID to the submitBtn if not present — surface to operator if a testID rename is needed; current ServiceCartScreen may already have `testID="cart-submit"` or similar; otherwise traverse via styles.submitBtn). Assert disabled=true.
    - Test: hint Text with key 'cartListingUnavailableCheckoutHint' rendered (mockT returns the key as string by Proxy fallback or pre-populate).

    `describe('LBUY-02: 404 race on focus re-fetch treats car as deleted (destructive tone)', () => {...})`
    - Test: `apiClient.get.mockRejectedValueOnce({ response: { status: 404 } })`; render; flush; banner mounted with bannerHints.severity='destructive'.

    `describe('LBUY-02: focus re-fetch with car=null does NOT fire apiClient.get', () => {...})`
    - Test: mockCartState.car=null; render; assert apiClient.get NOT called.

    `describe('LBUY-02: Remove CTA on banner invokes setCar(null) only, not clearCart()', () => {...})`
    - Test: F2 → find Pressable testID 'listing-status-banner-remove'; act(() => press it); assert mockCartState.setCar called with null; mockCartState.clearCart NOT called.

    Test file ~280-350 lines. ALL describe IDs follow LBUY-02 per D-10 (single requirement covered by this test file). Reuse fixtures from Plan 11-01 verbatim.
  </action>
  <verify>
    <automated>npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - File `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` exists
    - `grep -cE "^describe\('LBUY-02:" src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` >= 5
    - `grep -c "F2_suspendedSpam\|F4_deletedPolicyViolation\|F7_404" src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` >= 2
    - `grep -c "useFocusEffect" src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` >= 1 (mock present)
    - `grep -c "clearCart" src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` >= 1 (cart-not-cleared assertion)
    - `grep -c "setCar.*null" src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` >= 1 (Remove CTA assertion)
    - Test command `npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x` exits 0
  </acceptance_criteria>
  <done>ServiceCartScreen test sweep green; cart-no-auto-clear invariant proven; 404 race covered; Remove-CTA boundary asserted.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| apiClient.get('/api/cars/:id') response on focus | Phase 9 D-05 thin payload (non-admin) or D-07 admin payload (Pitfall 5) |
| CartContext state | Pure client-side storage; never mutated by Phase 11 except via Remove CTA (setCar(null)) |
| 404 vs 409 vs 5xx error from apiClient | 403 user-suspension interceptor at client.ts:103 matches `account_suspended` only — listing 404/409 pass through naturally (LMOB-02 invariant preserved) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-04-01 | Tampering | useFocusEffect cleanup race | mitigate | cancelled-flag closure pattern per Pitfall 6; acceptance criterion `grep -c "cancelled" >= 3` enforces presence. setState calls gated by `if (cancelled) return`. |
| T-11-04-02 | Information disclosure | Banner exposes moderation note to non-admin buyer | mitigate | Phase 9 D-05 thin payload excludes moderationReason. Component reads only `banner.titleKey/bodyKey/severity` + `reasonCategory` (taxonomy). Pitfall 5 coalescing reads `res.data.banner` OR `res.data.moderationBadge.banner` — both shapes already PII-minimized by backend. |
| T-11-04-03 | Tampering | LMOB-02 interceptor preservation | mitigate | Acceptance criterion `grep -c "interceptor" src/services/http/client.ts` unchanged AND `grep -c "_skipModerationInterceptor" src/screens/ServiceCartScreen.tsx` returns 0. No new bypass added; listing errors pass through naturally. |
| T-11-04-04 | Tampering | Cart auto-clear on listing non-active (anti-pattern) | mitigate | Acceptance criterion `grep -c "clearCart()" src/screens/ServiceCartScreen.tsx` does NOT increase. LBUY-02 mandate explicitly preserved. Test assertion proves mockCartState.clearCart not called on re-fetch flip. |
| T-11-04-05 | Spoofing | Buyer bypass of checkout-disable | mitigate (defense-in-depth) | UI disables submitBtn + opacity 0.4 + accessibilityState — but the backend authoritative gate lives in Phase 9 D-09 (cart-add 409 from createPaymentIntent) + D-12..D-15 (confirm-booking refund-first-throw-second). Even if UI bypassed, transaction aborts. |
</threat_model>

<verification>
- `npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x` PASSES
- `grep -c "useFocusEffect" src/screens/ServiceCartScreen.tsx` returns 1
- `grep -c "interceptor" src/services/http/client.ts` returns its pre-plan count (no new interceptor)
- Cart's `clearCart` not called by any Phase 11 code path
- Existing GatedScreenWrapper around ServiceCartScreen byte-identical
</verification>

<success_criteria>
- LBUY-02: focus re-fetch detects status change; banner inline; checkout disabled; cart NOT cleared
- D-05 + D-06 + D-07 honored verbatim
- Pitfalls 1, 2, 5, 6 mitigated by code + tests
- LMOB-02 interceptor invariant preserved
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-04-SUMMARY.md` capturing:
- Final useFocusEffect block LOC
- CartContext.setCar wiring (vs alternatives if setCar absent)
- Test count per describe block
</output>

---
phase: 11-buyer-affected-ux-quality-security-review
plan: 03
type: execute
wave: 3
depends_on: ["11-01", "11-02"]
files_modified:
  - src/screens/CarDetailsScreen.tsx
  - src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx
autonomous: true
requirements: [LBUY-01, LBUY-04]
requirements_addressed: [LBUY-01, LBUY-04]
must_haves:
  truths:
    - "Non-admin viewing a suspended/archived/deleted listing sees ListingStatusBanner above hero (variant='detail')"
    - "Admin path (isAdmin=true) renders the existing Phase 10 admin banner unchanged, NOT ListingStatusBanner"
    - "Telegram + WhatsApp + Book it + Get services CTAs are disabled (opacity 0.4, disabled=true, accessibilityState disabled) when isListingNonActive=true"
    - "Book-it 409 listing_not_available response flips fetchedCar to banner-state (status + reasonCategory + banner from 409 body) instead of generic Alert"
    - "Existing empty-state branch at CarDetailsScreen.tsx:214-224 still handles true 404 (carId not found)"
    - "D-02: banner placement above hero image at top of CarDetailsScreen non-admin path; scrolls with content (NOT sticky); admin-side Phase 10 banner independent and unaffected"
    - "D-03: deleted status renders ListingStatusBanner with severity='destructive' on detail screen (NOT 404+empty-state); existing empty-state reserved for true 404 (carId truly missing); severity tone matrix neutral=archived, warning=suspended, destructive=deleted per LBUY-04"
    - "D-04: all four buyer CTAs on CarDetailsScreen (Telegram :887, WhatsApp :898, Book it :807, Get services :787) disabled when banner visible; read-only affordances (photo zoom, info display) stay enabled; no Alert.alert on tap (faded-disabled pattern from Phase 6 D-04)"
    - "D-05 (partial — Book-it 409 fallback): the 409 listing_not_available from confirmBooking/createPaymentIntent flips banner-state via the same code path as the cart focus re-fetch in Plan 11-04; TOCTOU surface for seller-update vs buyer-Pay tap closed"
    - "D-15: superseded by D-04 — actual buyer CTAs audited and locked at 4 (Telegram/WhatsApp/Book it/Get services)"
  artifacts:
    - path: "src/screens/CarDetailsScreen.tsx"
      provides: "Non-admin ListingStatusBanner mount + 4-CTA disable predicate + 409 catch banner-state flip"
      contains: "isListingNonActive"
    - path: "src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx"
      provides: "Screen-integration tests for banner mount + CTA disable + 409 flip"
      min_lines: 250
  key_links:
    - from: "src/screens/CarDetailsScreen.tsx"
      to: "src/components/moderation/ListingStatusBanner.tsx"
      via: "import + mount conditionally on !isAdmin && fetchedCar.status !== 'active'"
      pattern: "ListingStatusBanner"
    - from: "src/screens/CarDetailsScreen.tsx Book-it catch"
      to: "fetchedCar state setter"
      via: "409 listing_not_available body → setFetchedCar({...status, reasonCategory, banner})"
      pattern: "listing_not_available"
---

<objective>
Wire the buyer-facing ListingStatusBanner into CarDetailsScreen above the hero and gate all four buyer CTAs when the listing is non-active.

Purpose: LBUY-01 (visible banner with status + reasonCategory) + LBUY-04 (severity tone surfaced via the banner component). Per D-02 (above hero, scrolls with content), D-03 amended (destructive tone for deleted, NOT 404+empty), D-04 amended (all four actual CTAs disabled — Telegram :887, WhatsApp :898, Book it :807, Get services :787 — confirmed by RESEARCH CTA audit). Existing admin banner (Phase 10 D-17) and admin error banner remain byte-identical.

Output: CarDetailsScreen.tsx surgically extended (additive — no existing logic removed except the Book-it catch which gains a 409 branch). New screen-integration test file proves banner mounts, CTAs gate, and 409 surface flips banner state.
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
@.planning/phases/10-mobile-plumbing-admin-listing-ui/10-CONTEXT.md
@.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md
@src/screens/CarDetailsScreen.tsx
@src/screens/__tests__/CarDetailsScreen.admin.test.tsx
@src/components/moderation/ListingStatusBanner.tsx
@__tests__/_fixtures/listingStatusFixtures.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add isListingNonActive predicate + mount ListingStatusBanner above hero + gate Telegram/WhatsApp/Book-it/Get-services CTAs</name>
  <read_first>
    - src/screens/CarDetailsScreen.tsx (full read — locate lines 72-78 isContactGated derivation, lines 135-160 fetchedCar fetch + admin badge wiring, lines 214-224 carNotFound empty-state, lines 655-705 admin banner + admin error banner mount, lines 787-911 the four buyer CTAs Telegram/WhatsApp/Book-it/Get-services)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§CarDetailsScreen.tsx lines 342-441 — exact INSERTION POINT + Self-analog citations)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Pattern 2 lines 393-421 + §Pattern 3 lines 422-455)
    - src/components/moderation/ListingStatusBanner.tsx (Plan 11-02 output — props interface)
  </read_first>
  <behavior>
    - Test 1 (LBUY-01): non-admin + suspended listing → ListingStatusBanner mounted with variant='detail' above hero
    - Test 2 (LBUY-01): non-admin + active listing → ListingStatusBanner NOT mounted
    - Test 3 (LBUY-01): admin + suspended → existing Phase 10 admin banner mounted, ListingStatusBanner NOT mounted (mutual exclusion)
    - Test 4 (LBUY-01): all four CTAs (Telegram, WhatsApp, Book-it, Get-services) have disabled=true + opacity=0.4 when non-admin + non-active
    - Test 5 (LBUY-04): banner severity propagates to component (warning for suspended fixture)
    - Test 6: true 404 (apiClient reject) renders the EXISTING carNotFound empty-state at lines 214-224 — Phase 11 does NOT introduce a new component for this
  </behavior>
  <action>
    Per CONTEXT D-02 / D-03-amended / D-04-amended + RESEARCH §Pattern 2/3 + PATTERNS §CarDetailsScreen.tsx Self-analogs #1-3.

    Step 1 — Imports (top of file):
    - Add `import ListingStatusBanner from '../components/moderation/ListingStatusBanner';` (use default export per CLAUDE.md component convention). Confirm path resolves; CarDetailsScreen.tsx lives at src/screens/, banner at src/components/moderation/.

    Step 2 — Predicate derivation (near existing line 72-78 isContactGated):
    Add a new derived const (place IMMEDIATELY after isContactGated declaration so both are co-located):
    ```
    const isListingNonActive =
      !isAdmin && !!fetchedCar?.status && fetchedCar.status !== 'active';
    ```
    Comment: `// Phase 11 LBUY-01: gate buyer CTAs when listing is non-active for non-admin viewers (D-04 amended). isAdmin is preserved verbatim from existing AuthContext.`

    Step 3 — Banner mount above the existing admin banner (in the detailsContainer block near line 655):
    INSERT immediately before the `{isAdmin && fetchedCar?.moderationBadge && (...)}` JSX block:
    ```
    {!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active' && fetchedCar?.banner && (
      <ListingStatusBanner
        status={fetchedCar.status as 'suspended' | 'archived' | 'deleted'}
        reasonCategory={fetchedCar.reasonCategory ?? null}
        bannerHints={fetchedCar.banner}
        variant="detail"
      />
    )}
    ```
    DO NOT touch the existing admin banner JSX (lines 660-688) or admin error banner JSX (lines 693-705). Both remain byte-identical. Mutual exclusion is enforced by the `!isAdmin` predicate on the new mount + `isAdmin` predicate on the existing one — both cannot render simultaneously.

    Step 4 — Gate four CTAs (Telegram :887, WhatsApp :898, Book it :807, Get services :787) per D-04 amended.

    For EACH of the four CTAs:
    - In the style stack, replace `isContactGated && { opacity: 0.4 }` with `(isContactGated || isListingNonActive) && { opacity: 0.4 }`.
    - In the onPress handler, wrap the existing onPress logic with an `isListingNonActive ? undefined : <existing handler>` outer ternary.
    - Add `disabled={isListingNonActive}` if not already present; if already present (Book-it may have it), OR with isListingNonActive.
    - Update accessibilityState.disabled to `isContactGated || isListingNonActive`.

    Per RESEARCH §Pattern 3 + PATTERNS Self-analog #3, here is the Telegram-line shape after the edit (template — apply structurally to all four):
    ```
    <TouchableOpacity
      style={[styles.contactButton, styles.telegramButton, (isContactGated || isListingNonActive) && { opacity: 0.4 }]}
      onPress={
        isListingNonActive ? undefined
        : isContactGated ? () => setContactGateVisible(true)
        : handleTelegram
      }
      disabled={isListingNonActive}
      testID="car-details-telegram-cta"
      accessibilityState={{ disabled: isContactGated || isListingNonActive }}>
    ```

    Apply the same shape to WhatsApp (replace handleTelegram with handleWhatsApp + its testID), Book-it (replace gating combo + its testID), Get-services (replace handler + its testID). For Get-services, even though it is pure navigation per D-15-amended (Open Question 2 resolved), the user explicitly locked all four CTAs disabled per D-04 amended. DO NOT downgrade the spec.

    DO NOT add `Alert.alert()` for tap on disabled CTA (Anti-Pattern: "Open Alert.alert on disabled CTA tap" per RESEARCH). The disabled visual is sufficient (Phase 6 D-04 pattern).

    Step 5 — Book-it 409 catch banner-state flip (at the existing processPayment catch around lines 432-434):
    Replace the existing catch body with the PATTERNS Self-analog #4 extension:
    ```
    } catch (err: any) {
      // Phase 11 LBUY-01 — TOCTOU 409 from Book-it surfaces as banner state, not generic Alert.
      // The 409 body shape matches Phase 9 D-11: { error: 'listing_not_available', status, reasonCategory, banner }.
      if (err?.response?.status === 409 && err.response.data?.error === 'listing_not_available') {
        const body = err.response.data;
        setFetchedCar((c: any) => c ? ({
          ...c,
          status: body.status,
          reasonCategory: body.reasonCategory,
          banner: body.banner,
        }) : c);
        return;
      }
      const msg = err?.response?.data?.message || err.message || t.error;
      Alert.alert(t.paymentFailed, msg);
    } finally { ... }
    ```
    The 409 fast-return short-circuits the Alert. Other error codes fall through to the existing generic Alert.

    Step 6 — Confirm the carNotFound empty-state at lines 214-224 is UNCHANGED. Per RESEARCH Pitfall 9, the existing branch handles the true 404 (carId doesn't exist) — Phase 11 does NOT create a new component for that path. If the existing branch uses `t.carNotFound`, confirm the key exists in translations.ts (it should — Phase 1-10 substrate); if missing, surface to operator (out of plan scope to add it).

    No new variable shadowing. The component remains a single function; all new logic is additive within the existing render tree.
  </action>
  <verify>
    <automated>npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "isListingNonActive" src/screens/CarDetailsScreen.tsx` >= 6 (1 derivation + 1 banner-mount predicate + 4 CTA disable references; may be >6 if also used in accessibilityState)
    - `grep -c "ListingStatusBanner" src/screens/CarDetailsScreen.tsx` >= 2 (1 import + 1 JSX mount)
    - `grep -c "moderationBadge" src/screens/CarDetailsScreen.tsx` is unchanged from pre-plan count (admin banner block untouched). Capture pre-plan count via `git stash && grep -c moderationBadge ... && git stash pop` if needed for documentation, but the acceptance check is that no new moderationBadge reference is added.
    - `grep -c "listing_not_available" src/screens/CarDetailsScreen.tsx` returns exactly 1 (the new 409 catch branch)
    - `grep -c "setFetchedCar" src/screens/CarDetailsScreen.tsx` increases by at least 1 (the 409 banner-state flip)
    - `grep -c "Alert.alert" src/screens/CarDetailsScreen.tsx` does NOT increase (no new Alert added on disabled CTA tap)
    - `grep -c "isContactGated || isListingNonActive" src/screens/CarDetailsScreen.tsx` >= 4 (one per CTA — Telegram, WhatsApp, Book-it, Get-services)
    - `grep -c "t.carNotFound" src/screens/CarDetailsScreen.tsx` unchanged (existing empty-state preserved)
    - `npx tsc --noEmit` does not surface new errors involving CarDetailsScreen.tsx
  </acceptance_criteria>
  <done>CarDetailsScreen.tsx renders banner for non-admin non-active; admin path unchanged; 4 CTAs gated; 409 flips state; empty-state preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create CarDetailsScreen.listingBanner.test.tsx (screen-integration sweep)</name>
  <read_first>
    - src/screens/__tests__/CarDetailsScreen.admin.test.tsx (read in full — mock setup pattern lines 18-100, render harness, test structure)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§CarDetailsScreen.listingBanner.test.tsx lines 210-246)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md (§Test Dimensions §Edge cases — Edge cases 1, 10)
    - __tests__/_fixtures/listingStatusFixtures.ts (import F1_active, F2_suspendedSpam, F4_deletedPolicyViolation, F8_adminViewingF2)
  </read_first>
  <action>
    Per D-10 (describe IDs) + PATTERNS analog mock-setup pattern (CarDetailsScreen.admin.test.tsx).

    Harness setup — copy the mock structure from CarDetailsScreen.admin.test.tsx with these DIVERGENCES:
    - Default `mockAuthState = { user: { localId: 'buyer-1' }, isAdmin: false }` (admin test defaults to admin; we default to non-admin per LBUY-01 viewer).
    - Mock `apiClient.get('/api/cars/:id')` via `jest.mock('../../services/http/client', () => ({ apiClient: { get: jest.fn() } }))` and `mockResolvedValueOnce` per test with the F2/F3/F4 fixtures.
    - Mock ModerationService same as analog (jest.mock at top — methods stubbed).
    - Mock useCart per analog.
    - Mock useStripe per analog (initPaymentSheet / presentPaymentSheet jest.fn).

    `describe()` blocks (each starts with the LBUY-* ID per D-10):

    `describe('LBUY-01: CarDetailsScreen mounts ListingStatusBanner for non-admin viewer of non-active listing', () => {...})`
    - Test: non-admin + F2 (suspended) → findByProps({testID: 'listing-status-banner'}) returns 1 instance.
    - Test: non-admin + F1 (active) → testID 'listing-status-banner' NOT present (no banner for active).
    - Test: non-admin + F4 (deleted) → testID 'listing-status-banner' PRESENT with destructive severity (per D-03 amended; NOT empty-state).
    - Test: admin + F8 (admin payload) → testID 'admin-status-banner' present (existing Phase 10), testID 'listing-status-banner' NOT present (mutual exclusion).

    `describe('LBUY-01: Telegram + WhatsApp + Book it + Get services CTAs disabled when listing non-active', () => {...})`
    - For each of (telegram, whatsapp, book-it, get-services) testID:
      - Test: non-admin + F2 (suspended) → CTA element prop `disabled` is true AND style includes `{ opacity: 0.4 }`.
      - Test: non-admin + F1 (active) → CTA disabled is false (sanity baseline).

    `describe('LBUY-04: severity tone propagates from screen-level fetchedCar to ListingStatusBanner', () => {...})`
    - Test: F2 (warning) → banner mounted with bannerHints.severity='warning' (read via findByType(ListingStatusBanner).props.bannerHints.severity).
    - Test: F3 (neutral) → bannerHints.severity='neutral'.
    - Test: F4 (destructive) → bannerHints.severity='destructive'.

    `describe('LBUY-01: existing empty-state at CarDetailsScreen.tsx:214-224 still handles true 404 carId-not-found', () => {...})`
    - Test: apiClient.get rejects with status=404; tree renders existing errorContainer + Text 'Car not found' (or t.carNotFound fallback); NO ListingStatusBanner.

    Test file ~250-320 lines. Mock useFocusEffect to no-op (CarDetailsScreen uses initial fetch on mount, not useFocusEffect; if any test path relies on focus-effect, mock it to call cb synchronously). Use `react-test-renderer` + `act()` not @testing-library.

    Stretch (only if scope permits without exceeding plan budget): wire one Book-it 409 catch banner-state flip test as a `describe('LBUY-01: TOCTOU 409 from Book-it flips fetchedCar to banner state', ...)`. Skip if budget tight — Plan 11-08 security review (e) re-verifies the flow via grep.
  </action>
  <verify>
    <automated>npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - File `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` exists
    - `grep -cE "^describe\('LBUY-(01|04):" src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` >= 3
    - `grep -c "F2_suspendedSpam\|F3_archivedInactiveSeller\|F4_deletedPolicyViolation" src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` >= 2 (multiple fixtures used)
    - `grep -c "testID: 'listing-status-banner'" src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` >= 2 (presence + absence assertions)
    - `grep -cE "(car-details-telegram-cta|car-details-whatsapp-cta|car-details-book-it|get-services)" src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` >= 4 (one CTA testID for each of the four)
    - Test command `npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x` exits 0
  </acceptance_criteria>
  <done>Screen-integration test sweeps banner mount across F1/F2/F3/F4/F8 + four CTA disable assertions; admin path mutual-exclusion verified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| apiClient.get('/api/cars/:id') response → CarDetailsScreen state | Phase 9 D-05 thin payload (non-admin) or D-07 full + moderationBadge (admin); both shapes consumed by single screen |
| Disabled CTA presses | RN TouchableOpacity disabled=true + pointerEvents — backend 409 is authoritative gate (Phase 9 D-09) |
| Book-it 409 response body → setFetchedCar | Phase 9 D-11 response shape `{error, status, reasonCategory, banner}` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-03-01 | Spoofing | Buyer-bypass of disabled CTA via gesture-handler edge case | mitigate (defense-in-depth) | UI sets `disabled={isListingNonActive}` + opacity 0.4 + accessibilityState.disabled; backend `pre(/^find/)` filter + cart-add 409 + confirm-booking 409 (Phase 9) are authoritative. Even if UI bypassed, transaction aborts. |
| T-11-03-02 | Information disclosure | Banner copy injection via reasonCategory free-text | mitigate | reasonCategory enum bounded to 5 taxonomy values per Phase 7 D-14a; component lookup via REASON_TO_KEY map; unknown values fall through to RN Text auto-escape. No HTML injection. |
| T-11-03-03 | Tampering | Phase 9 thin-payload preservation | mitigate | Acceptance criterion `grep -c "moderationBadge" CarDetailsScreen.tsx` unchanged from pre-plan ensures admin path untouched. New banner mount predicate `!isAdmin` enforces non-admin-only rendering — admin doesn't see thin-payload-derived banner. |
| T-11-03-04 | Information disclosure | Banner exposes moderationReason to non-admin | mitigate | Component reads `fetchedCar.reasonCategory` (taxonomy) + `fetchedCar.banner` (titleKey/bodyKey/severity); never reads `moderationReason` (admin-only free-text). Phase 9 D-05 thin payload excludes the field at backend; mobile cannot leak what backend didn't send. |
| T-11-03-05 | Repudiation | TOCTOU 409 silently swallowed | accept | Book-it 409 flips banner state visibly (status + reason + severity all on-screen); buyer sees the listing went non-active. No silent failure; existing telemetry/logging unchanged. |
</threat_model>

<verification>
- `npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x` PASSES
- `grep -c "ListingStatusBanner" src/screens/CarDetailsScreen.tsx` >= 2
- `grep -c "listing_not_available" src/screens/CarDetailsScreen.tsx` returns exactly 1
- Existing admin banner (Phase 10 D-17) byte-identical: spot-check via diff against pre-plan state on lines 660-705
- Existing carNotFound empty-state at 214-224 unchanged
</verification>

<success_criteria>
- LBUY-01 banner mounts above hero for non-admin non-active per D-02 + D-03 amended
- LBUY-01 four CTAs disabled per D-04 amended (Telegram/WhatsApp/Book-it/Get-services)
- LBUY-04 severity tone surfaced via bannerHints prop
- 409 listing_not_available catch flips banner state instead of generic Alert
- Admin path mutual-exclusion enforced
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-03-SUMMARY.md` capturing:
- CTA testID list and disable predicate locations
- 409 catch behavior change (before → after)
- Grep counts confirming admin path untouched
</output>

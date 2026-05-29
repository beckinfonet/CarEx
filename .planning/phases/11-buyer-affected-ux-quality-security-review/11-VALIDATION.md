---
phase: 11
slug: buyer-affected-ux-quality-security-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: extracted from `11-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.6.3 + react-test-renderer 19.2.0 (preset: `react-native`) |
| **Config file** | `package.json` (jest preset) |
| **Quick run command** | `npx jest path/to/file.test.tsx -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~40–60s full suite (extrapolated from existing __tests__ scope) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest <touched-test-file> -x` (single-file isolated)
- **After every plan wave:** Run `npm test -- --testPathPattern='moderation|translation|ListingStatus|cart|CarDetails'`
- **Before `/gsd-verify-work`:** Full `npm test` must be green; `scripts/generate-coverage-manifest.sh` produces `11-COVERAGE.md`; `11-LIST-SECURITY.md` signed APPROVED with all 5 verdicts PASS
- **Max feedback latency:** ~15s on single-file quick run

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------------|-----------------|-----------|-------------------|-------------|--------|
| LBUY-01 | Non-admin viewing suspended/archived/deleted listing detail sees banner with severity tone | unit (component) | `npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x` | ❌ Wave 0 | ⬜ pending |
| LBUY-01 | `CarDetailsScreen` integrates banner above hero for non-admin path | screen integration | `npx jest src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx -x` | ❌ Wave 0 | ⬜ pending |
| LBUY-01 | All four buyer CTAs (Telegram / WhatsApp / Book it / Get services) disabled when listing non-active | screen integration | same file as above | ❌ Wave 0 | ⬜ pending |
| LBUY-02 | Cart with non-active car renders in-row banner + disabled checkout, NOT auto-cleared | screen integration | `npx jest src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx -x` | ❌ Wave 0 | ⬜ pending |
| LBUY-02 | `useFocusEffect` re-fetch fires `apiClient.get('/api/cars/:carId')` on screen focus | screen integration | same file as above | ❌ Wave 0 | ⬜ pending |
| LBUY-02 | Cart NOT auto-cleared (`CartContext.car` remains set) | unit | same file as above | ❌ Wave 0 | ⬜ pending |
| LBUY-03 | Already-paid order — no auto-cancel/auto-refund logic added | source-grep audit | `npx jest __tests__/lbuy03-no-auto-cancel.test.ts -x` | ❌ Wave 0 | ⬜ pending |
| LBUY-04 | Severity tone mapping: neutral=archived, warning=suspended, destructive=deleted | unit (component) | `npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x` | ❌ Wave 0 | ⬜ pending |
| LQUAL-01 | RU≡EN key sets + non-empty leaf values + no placeholder TODO/FIXME (existing) | unit | `npx jest __tests__/translation-parity.test.ts -x` | ✅ extension | ⬜ pending |
| LQUAL-01 | NEW — placeholder-token parity across RU/EN for the same key (D-09) | unit | same file as above (new test case) | ✅ extension | ⬜ pending |
| LQUAL-01 | Untranslated `<Text>` literals scanner — extend SCAN_FILES with `ListingStatusBanner.tsx` | unit | `npx jest __tests__/moderation-literals.test.ts -x` | ✅ extension | ⬜ pending |
| LQUAL-02 | Coverage manifest exists and is non-empty | scripted | `bash scripts/generate-coverage-manifest.sh \| diff - .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` | ❌ Wave 0 | ⬜ pending |
| LQUAL-02 | Every LIST-* requirement appears at least once in manifest | scripted | manifest-generator trailing coverage-check block | ❌ Wave 0 | ⬜ pending |
| LQUAL-03 | `11-LIST-SECURITY.md` exists with status=APPROVED + 5 PASS verdicts | manual | `grep -c '^.*Verdict.*PASS' 11-LIST-SECURITY.md` ≥ 5 AND `grep -q 'Status: APPROVED'` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test Dimensions (Nyquist Dimension 8)

Sampling matrix that defines the minimum reference dataset:

| Listing status × User role × Mount surface × Focus state |
|---|
| **status ∈ {active, suspended, archived, deleted, deleted-then-404}** |
| × **user ∈ {anonymous, non-admin authenticated, admin}** |
| × **mount ∈ {CarDetails, ServiceCart-row}** |
| × **focus ∈ {initial mount, post-focus re-fetch, mid-checkout 409 fallback}** |

### Minimum required fixture set

| Fixture | Status | reasonCategory | banner | note | Used By |
|---------|--------|---------------|--------|------|---------|
| F1 — active | `active` | — | — | — | Baseline: banner NOT rendered |
| F2 — suspended-spam-with-note | `suspended` | `spam` | `{warning}` | "Multiple flag reports filed by buyers." | LBUY-01 + LBUY-04 warning tone |
| F3 — archived-inactive_seller-no-note | `archived` | `inactive_seller` | `{neutral}` | null | LBUY-04 neutral tone + nullable-note branch |
| F4 — deleted-policy_violation-with-note | `deleted` | `policy_violation` | `{destructive}` | "Listing violated content policy §3.2." | LBUY-04 destructive (per amended D-03) |
| F5 — suspended-fraud-no-note | `suspended` | `fraud` | `{warning}` | null | empty-note rendering |
| F6 — archived-other-with-empty-string-note | `archived` | `other` | `{neutral}` | `""` | empty-string-note rendering |
| F7 — listing genuinely doesn't exist | `→ 404` | — | — | — | empty-state path (existing `CarDetailsScreen.tsx:214-224`) |
| F8 — admin viewing F2 | full Car + `moderationBadge` | — | banner inside moderationBadge | full audit fields | Admin path unaffected (Phase 10) |
| F9 — admin viewing own moderated listing | F4-shape + `error: 'cannot_moderate_own_listing'` | — | — | — | regression (Phase 10 D-15 inline banner) |

`reasonCategory` enum (5 total per Phase 7 D-14a): `spam`, `policy_violation`, `fraud`, `inactive_seller`, `other`.

### Edge cases (must be enumerated as test cases)

1. Rapid status flip mid-checkout (TOCTOU on `CarDetailsScreen` Book-it): admin suspends while buyer holds payment sheet. `confirmBooking` returns 409 with `{status, reasonCategory, banner}`. Catch handler converts to banner-state.
2. Cart with NO car slot, only services (LBUY-02 negative): banner does NOT render; checkout enabled.
3. 404 race on focus re-fetch in cart (true delete — `carId` truly gone): destructive-tone banner.
4. Dev bypass OTP `123456` orthogonal — no listing-status interaction.
5. Translation placeholder-token mismatch (intentional fixture for D-09 negative test).
6. `CarDetailsScreen` line 214-224 existing empty-state preserved for fetch reject (true 404).
7. Cart focus re-fetch with `car=null` + `items=[]` does NOT fire `apiClient.get`.
8. Backend re-fetch returns `{status: 'active'}` (admin restored): banner clears, checkout re-enables.
9. Coverage manifest cross-repo grep against `../backend-services/carEx-services/__tests__/listing-moderation/*` (`describe('L{DATA|ADM|ENF}-XX: …')` naming).
10. Anonymous (signed-out) deep-link to suspended listing: thin payload; banner renders; CTAs disabled (Telegram/WhatsApp guarded by login prompts; Book-it requires auth).

---

## Wave 0 Requirements

- [ ] `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` — covers LBUY-01, LBUY-04 (component-level, both variants)
- [ ] `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` — covers LBUY-01 mount integration + CTA disable
- [ ] `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` — covers LBUY-02 focus-effect + banner + checkout-disable
- [ ] `__tests__/lbuy03-no-auto-cancel.test.ts` — source-grep audit covering LBUY-03 (no MyOrdersScreen / ProviderOrdersScreen auto-cancel)
- [ ] `scripts/generate-coverage-manifest.sh` — generator for `11-COVERAGE.md`
- [ ] `11-COVERAGE.md` — generated artifact (committed at LQUAL-02 task)
- [ ] `11-LIST-SECURITY.md` — 5-verdict review (committed at LQUAL-03 task)

(`__tests__/translation-parity.test.ts` and `__tests__/moderation-literals.test.ts` already exist; Phase 11 EXTENDS them.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual confirmation of severity tone palette on physical device | LBUY-04 | Color rendering on RN can drift between simulator and device | Run on iOS sim + Android sim + at least one physical device; screenshot the three severity tones; compare against Phase 6 `UserStatusBanner` palette parity |
| `11-LIST-SECURITY.md` 5-verdict write-up | LQUAL-03 | Self-review document is a narrative artifact, not a scriptable assertion (existence + PASS-count are scripted, but verdict reasoning is human-written) | Author the document mirroring `06-SECURITY.md` structure; cite file:line evidence per Phase 9 D-12..D-15 TOCTOU section; self-sign with date |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s on quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

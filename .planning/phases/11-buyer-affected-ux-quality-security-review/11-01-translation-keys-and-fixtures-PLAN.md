---
phase: 11-buyer-affected-ux-quality-security-review
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/constants/translations.ts
  - __tests__/_fixtures/listingStatusFixtures.ts
autonomous: true
requirements: [LQUAL-01]
requirements_addressed: [LQUAL-01]
must_haves:
  truths:
    - "All 15 new RU + EN key pairs exist in src/constants/translations.ts (15 each language; key sets identical)"
    - "Shared mock fixtures F1..F9 exist as exported objects in __tests__/_fixtures/listingStatusFixtures.ts and downstream test files import them"
    - "Phase 6 user-domain reasonSpam/reasonPolicyViolation/reasonFraud/reasonOther keys remain unchanged"
  artifacts:
    - path: "src/constants/translations.ts"
      provides: "15 new listingStatusBanner* + cartListingUnavailable* keys in both RU and EN blocks"
      contains: "listingStatusBannerSuspendedTitle"
    - path: "__tests__/_fixtures/listingStatusFixtures.ts"
      provides: "F1..F9 mock listing payloads typed against the Phase 9 thin-payload contract"
      exports: ["F1_active", "F2_suspendedSpam", "F3_archivedInactiveSeller", "F4_deletedPolicyViolation", "F5_suspendedFraud", "F6_archivedOther", "F7_404", "F8_adminViewingF2", "F9_adminOwnListing", "ALL_FIXTURES"]
  key_links:
    - from: "__tests__/_fixtures/listingStatusFixtures.ts"
      to: "src/constants/translations.ts"
      via: "fixture banner.titleKey/bodyKey strings match keys present in RU+EN"
      pattern: "listingStatusBanner(Suspended|Archived|Deleted)(Title|Body)"
---

<objective>
Land the i18n + fixture substrate that every downstream Phase 11 plan depends on.

Purpose: Plans 02..08 cannot render a banner, write a passing test, or run the parity scanner without (a) the 15 new RU+EN keys and (b) shared F1..F9 mock fixtures matching Phase 9's thin-payload contract. Single Wave-1 plan eliminates duplicate fixture authoring across 4 test files and prevents downstream parity violations.

Output: Two files. translations.ts gets 15 new key pairs in BOTH RU and EN blocks; __tests__/_fixtures/listingStatusFixtures.ts exports F1..F9 typed against the contract documented in 11-VALIDATION.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-CONTEXT.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md
@src/constants/translations.ts
@__tests__/translation-parity.test.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 15 listingStatusBanner* + cartListingUnavailable* keys to RU and EN blocks of translations.ts</name>
  <read_first>
    - src/constants/translations.ts (read once start-to-end — locate RU block boundary, EN block boundary, and existing Phase 6 keys reasonSpam/reasonPolicyViolation/reasonFraud/reasonOther + bannerTitleFeatureLimited)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Code Examples lines 686-722 — exact key list + RU/EN values)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§translations.ts section lines 565-625 — namespace separation rationale per D-13 + Pitfall 4)
  </read_first>
  <action>
    Per D-13 + RESEARCH §Code Examples + Pitfall 4 (no user-domain key reuse). Append to the END of the RU block (before its closing brace) and the END of the EN block (before its closing brace), preserving Phase 6 keys verbatim:

    RU keys (11 listingStatusBanner* + 4 cartListingUnavailable* = 15 total):
    - listingStatusBannerSuspendedTitle: 'Объявление приостановлено'
    - listingStatusBannerSuspendedBody: 'Это объявление временно недоступно.'
    - listingStatusBannerArchivedTitle: 'Объявление в архиве'
    - listingStatusBannerArchivedBody: 'Это объявление больше не активно.'
    - listingStatusBannerDeletedTitle: 'Объявление удалено'
    - listingStatusBannerDeletedBody: 'Это объявление больше не доступно.'
    - listingStatusBannerReasonSpam: 'Спам'
    - listingStatusBannerReasonPolicyViolation: 'Нарушение правил'
    - listingStatusBannerReasonFraud: 'Мошенничество'
    - listingStatusBannerReasonInactiveSeller: 'Неактивный продавец'
    - listingStatusBannerReasonOther: 'Другое'
    - cartListingUnavailableTitle: 'Автомобиль больше не доступен'
    - cartListingUnavailableBody: 'Удалите автомобиль из корзины, чтобы продолжить.'
    - cartListingUnavailableRemove: 'Удалить из корзины'
    - cartListingUnavailableCheckoutHint: 'Удалите недоступное объявление, чтобы оформить остальные услуги.'

    EN keys (identical key set, English values per 11-RESEARCH.md §Code Examples lines 707-722).

    Banner comment markers (one in each block immediately before the new keys): `// ---- Phase 11 — Listing buyer-affected banner (LBUY-01..04) ----` (RU comment in Russian-aware position is fine — keep as English code-comment for grep stability across both blocks).

    DO NOT touch existing reasonSpam/reasonPolicyViolation/reasonFraud/reasonOther keys (Phase 6 user-domain — Pitfall 4 prevents cross-domain coupling). DO NOT add 'cartListingUnavailableTitle' substring to anywhere besides the two key entries (one in RU, one in EN). Total file delta is 32 new lines (15 keys × 2 languages + 2 banner comments).
  </action>
  <verify>
    <automated>npx jest __tests__/translation-parity.test.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "listingStatusBannerSuspendedTitle:" src/constants/translations.ts` returns exactly 2
    - `grep -c "listingStatusBannerArchivedTitle:" src/constants/translations.ts` returns exactly 2
    - `grep -c "listingStatusBannerDeletedTitle:" src/constants/translations.ts` returns exactly 2
    - `grep -c "listingStatusBannerReasonInactiveSeller:" src/constants/translations.ts` returns exactly 2
    - `grep -c "cartListingUnavailableTitle:" src/constants/translations.ts` returns exactly 2
    - `grep -c "cartListingUnavailableCheckoutHint:" src/constants/translations.ts` returns exactly 2
    - `grep -c "cartListingUnavailableRemove:" src/constants/translations.ts` returns exactly 2
    - `grep -cE "listingStatusBannerReason(Spam|PolicyViolation|Fraud|InactiveSeller|Other):" src/constants/translations.ts` returns exactly 10 (5 reasons × 2 languages)
    - Existing Phase 6 keys preserved: `grep -c "^\s*reasonSpam:" src/constants/translations.ts` returns its pre-plan count (still 2 — RU+EN)
    - The translation-parity.test.ts existing 3 tests (key-set equality, non-empty values, no TODO/FIXME) PASS for the 15 new keys
  </acceptance_criteria>
  <done>32 new key entries (16 RU + 16 EN including comments) added; no Phase 6 keys modified; existing translation-parity.test.ts passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create shared mock fixture module at __tests__/_fixtures/listingStatusFixtures.ts</name>
  <read_first>
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md (§Test Dimensions — F1..F9 fixture table at lines 72-84)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Validation Architecture §Minimum required fixture set lines 1075-1085 — full payload shape)
    - .planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md (D-05 thin payload shape: `{status, reasonCategory, statusChangedAt, banner: {titleKey, bodyKey, severity}}`)
  </read_first>
  <action>
    Create new file `__tests__/_fixtures/listingStatusFixtures.ts` (one default+named export pattern). Each fixture is a typed const matching the Phase 9 D-05 thin-payload contract for non-admin viewers, plus admin-shape extensions for F8/F9. Export both individual fixtures and a `ALL_FIXTURES` map keyed by fixture id.

    Define a `ThinPayload` type and `AdminPayload` type at the top of the file:
    - `ThinPayload = { id: string; status: 'suspended' | 'archived' | 'deleted'; reasonCategory: 'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other' | null; statusChangedAt: string | null; banner: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' }; note?: string | null }`
    - `AdminPayload = ThinPayload & { moderationBadge: { status: string; banner: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' } }; sellerId: string; year: number; makeName: string; modelName: string }`

    Then 9 fixtures matching 11-VALIDATION.md F1..F9 verbatim:
    - `F1_active`: `{id: 'car_active_1', status: 'active', ...minimal Car fields}` (no banner — baseline negative case)
    - `F2_suspendedSpam`: status='suspended', reasonCategory='spam', banner={titleKey:'listingStatusBannerSuspendedTitle', bodyKey:'listingStatusBannerSuspendedBody', severity:'warning'}, note='Multiple flag reports filed by buyers.'
    - `F3_archivedInactiveSeller`: status='archived', reasonCategory='inactive_seller', banner.severity='neutral', titleKey='listingStatusBannerArchivedTitle', bodyKey='listingStatusBannerArchivedBody', note=null
    - `F4_deletedPolicyViolation`: status='deleted', reasonCategory='policy_violation', banner.severity='destructive', titleKey='listingStatusBannerDeletedTitle', bodyKey='listingStatusBannerDeletedBody', note='Listing violated content policy §3.2.'
    - `F5_suspendedFraud`: status='suspended', reasonCategory='fraud', banner.severity='warning', note=null
    - `F6_archivedOther`: status='archived', reasonCategory='other', banner.severity='neutral', note='' (empty-string distinct from null per validation matrix)
    - `F7_404`: sentinel `{ kind: '404' as const }` — used by tests that mock apiClient.get to reject with an AxiosError shape (response.status=404). Not a payload.
    - `F8_adminViewingF2`: full Car shape + moderationBadge per Phase 9 D-07 (admin sees full payload — used to assert non-admin banner does NOT render for admin)
    - `F9_adminOwnListing`: F4 shape + extra field `error: 'cannot_moderate_own_listing'` (Phase 10 D-15 regression fixture)

    Export `ALL_FIXTURES = { F1_active, F2_suspendedSpam, F3_archivedInactiveSeller, F4_deletedPolicyViolation, F5_suspendedFraud, F6_archivedOther, F7_404, F8_adminViewingF2, F9_adminOwnListing }` as a const map.

    Keep file small (~120-150 lines). No JSX, no imports from src/* — pure data + types. Comment each fixture with a one-line `// LBUY-XX usage` annotation citing the Validation row.
  </action>
  <verify>
    <automated>node -e "const f = require('./__tests__/_fixtures/listingStatusFixtures.ts'); console.log(Object.keys(f.ALL_FIXTURES).length)" 2>&1 | grep -E "^9$|SyntaxError" ; echo "—" ; npx tsc --noEmit __tests__/_fixtures/listingStatusFixtures.ts 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - File `__tests__/_fixtures/listingStatusFixtures.ts` exists and is < 200 lines
    - `grep -c "^export const F[1-9]_" __tests__/_fixtures/listingStatusFixtures.ts` returns exactly 9
    - `grep -c "^export const ALL_FIXTURES" __tests__/_fixtures/listingStatusFixtures.ts` returns exactly 1
    - `grep -cE "severity: 'warning'" __tests__/_fixtures/listingStatusFixtures.ts` >= 2 (F2 + F5)
    - `grep -cE "severity: 'neutral'" __tests__/_fixtures/listingStatusFixtures.ts` >= 2 (F3 + F6)
    - `grep -cE "severity: 'destructive'" __tests__/_fixtures/listingStatusFixtures.ts` >= 2 (F4 + F9 destructive shape)
    - `grep -cE "reasonCategory: '(spam|policy_violation|fraud|inactive_seller|other)'" __tests__/_fixtures/listingStatusFixtures.ts` >= 5 (one of each enum value)
    - `grep -c "moderationBadge" __tests__/_fixtures/listingStatusFixtures.ts` >= 1 (F8 admin payload)
    - File imports zero items from `src/` (presentational fixture data only): `grep -c "from '\.\./\.\./src" __tests__/_fixtures/listingStatusFixtures.ts` returns 0
  </acceptance_criteria>
  <done>File compiles under tsc --noEmit; exports 9 named fixtures + ALL_FIXTURES; all severity/reasonCategory enum values represented; no src/ imports.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| translations.ts → rendered UI | RU/EN strings consumed by Text component — RN auto-escapes; no HTML injection vector |
| fixtures → test harness | Test-only data; never bundled into production app |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-01-01 | Information disclosure | translations.ts | accept | RU+EN copy is buyer-facing by design (LBUY-01 mandates status + reason category visible to non-admin); no internal identifiers leak (status names are non-technical: "Listing suspended" not "moderation_status_suspended"). Phase 7 D-14a reasonCategory enum is taxonomy-bounded. |
| T-11-01-02 | Tampering | listingStatusFixtures.ts | accept | Fixture data lives under __tests__/, never imported by production code per grep gate; no source-of-truth for runtime behavior. |
| T-11-01-03 | Information disclosure | Banner copy (note field) | mitigate | RESEARCH §Security Domain confirms Phase 9 thin payload exposes reasonCategory chip + buyer-facing banner copy ONLY; admin free-text `moderationReason` is NOT in the thin payload. Phase 11 component never reads moderationReason; fixtures match the thin-payload contract exactly. |
</threat_model>

<verification>
- `npx jest __tests__/translation-parity.test.ts -x` PASSES (existing 3 tests against the augmented key set)
- `grep -c "listingStatusBanner" src/constants/translations.ts` returns exactly 22 (11 keys × 2 languages)
- `grep -c "cartListingUnavailable" src/constants/translations.ts` returns exactly 8 (4 keys × 2 languages)
- File `__tests__/_fixtures/listingStatusFixtures.ts` exists with 9 fixture exports
- `npx tsc --noEmit` (project-wide) does not surface new errors
</verification>

<success_criteria>
- 15 new RU+EN key pairs landed; existing Phase 6 keys untouched
- 9 fixtures match 11-VALIDATION.md F1..F9 verbatim
- translation-parity.test.ts green
- Downstream plans 02..06 can import fixtures without re-authoring data
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-01-SUMMARY.md` capturing:
- Final RU/EN key counts
- Fixture export list
- Any deviation from RESEARCH key strings
</output>

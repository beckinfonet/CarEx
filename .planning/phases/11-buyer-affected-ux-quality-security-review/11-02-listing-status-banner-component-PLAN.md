---
phase: 11-buyer-affected-ux-quality-security-review
plan: 02
type: execute
wave: 2
depends_on: ["11-01"]
files_modified:
  - src/components/moderation/ListingStatusBanner.tsx
  - src/components/moderation/__tests__/ListingStatusBanner.test.tsx
autonomous: true
requirements: [LBUY-01, LBUY-04]
requirements_addressed: [LBUY-01, LBUY-04]
must_haves:
  truths:
    - "ListingStatusBanner renders the correct title (per status), reason chip (per reasonCategory enum), and severity-aware color/icon for suspended/archived/deleted"
    - "Two variants ('detail' | 'cartRow') render distinctly; cartRow variant exposes a Remove CTA, detail variant does not"
    - "Component is purely prop-driven — no useAuth() / useCart() / apiClient calls"
    - "Tap-to-expand note works via LayoutAnimation; collapses on screen blur via useFocusEffect"
    - "D-01: sibling ListingStatusBanner at src/components/moderation/ — NOT a reuse of UserStatusBanner; not a shared StatusBanner primitive; visual treatment (tinted bg + 4px left-accent + truncated note + tap-to-expand + non-dismissable) mirrors Phase 6 D-01..D-03 verbatim"
    - "D-12: single component with variant: 'detail' | 'cartRow' prop (no separate ListingCartRowBanner.tsx unless variant accretes >3 visual branches)"
  artifacts:
    - path: "src/components/moderation/ListingStatusBanner.tsx"
      provides: "Severity-aware banner component sibling to UserStatusBanner"
      min_lines: 200
      exports: ["ListingStatusBanner"]
    - path: "src/components/moderation/__tests__/ListingStatusBanner.test.tsx"
      provides: "Component test sweep across F1..F6 fixtures, both variants, 5 reasonCategory values"
      min_lines: 200
  key_links:
    - from: "src/components/moderation/ListingStatusBanner.tsx"
      to: "src/constants/translations.ts"
      via: "useLanguage().t lookup by titleKey/bodyKey from props"
      pattern: "STATUS_TO_TITLE_KEY|listingStatusBannerReason"
    - from: "src/components/moderation/ListingStatusBanner.tsx"
      to: "src/constants/theme.ts"
      via: "severity → COLORS map at module scope"
      pattern: "COLORS.warning|COLORS.destructive|COLORS.textTertiary"
    - from: "src/components/moderation/__tests__/ListingStatusBanner.test.tsx"
      to: "__tests__/_fixtures/listingStatusFixtures.ts"
      via: "fixture import (F2..F6)"
      pattern: "import.*F[2-6]_"
---

<objective>
Build the prop-driven severity-aware banner component that both CarDetailsScreen and ServiceCartScreen mount.

Purpose: LBUY-01 (banner visibility on non-active listings) and LBUY-04 (severity tone matrix neutral/warning/destructive) require a single shared component. Building it once with a `variant` prop (per D-12) prevents two near-duplicate implementations. The component must mirror UserStatusBanner's visual treatment (Phase 6 D-01..D-03) without consuming useAuth — listing status is per-route, not global.

Output: ListingStatusBanner.tsx + its test file. Component is purely presentational. Tests sweep all 9 banner-relevant fixtures × 2 variants × 5 reasonCategory chip strings.
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
@src/components/moderation/UserStatusBanner.tsx
@__tests__/components/moderation/UserStatusBanner.test.tsx
@src/constants/theme.ts
@__tests__/_fixtures/listingStatusFixtures.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ListingStatusBanner.tsx (prop-driven, variant='detail'|'cartRow', severity-aware)</name>
  <read_first>
    - src/components/moderation/UserStatusBanner.tsx (read once — line 21-37 imports, lines 39-66 module-scope maps, lines 90-103 useFocusEffect collapse-on-blur, lines 128-133 LayoutAnimation toggle, lines 191-234 render envelope, lines 258-316 StyleSheet)
    - src/constants/theme.ts (lines 1-50 — confirm COLORS.warning, COLORS.destructive, COLORS.textTertiary, COLORS.textPrimary, SIZES.spacingMd, SIZES.spacingSm, SIZES.spacingXs, SIZES.radiusMd, SIZES.radiusPill, TYPOGRAPHY.body, TYPOGRAPHY.bodyStrong all exist; if any token missing, surface to operator before proceeding)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§ListingStatusBanner.tsx lines 27-155 — copy-from-analog divergence list)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Pattern 1 lines 252-391 — complete code skeleton)
  </read_first>
  <behavior>
    - Test 1 (LBUY-01): renders title via STATUS_TO_TITLE_KEY lookup for status='suspended' → t.listingStatusBannerSuspendedTitle
    - Test 2 (LBUY-01): renders reasonCategory chip when reasonCategory='spam' → t.listingStatusBannerReasonSpam
    - Test 3 (LBUY-04 — warning): status='suspended' renders accent color COLORS.warning + AlertTriangle icon
    - Test 4 (LBUY-04 — neutral): status='archived' renders accent color COLORS.textTertiary + Archive icon
    - Test 5 (LBUY-04 — destructive): status='deleted' renders accent color COLORS.destructive + Ban icon
    - Test 6 (variant=detail): no Remove CTA testID 'listing-status-banner-remove' present
    - Test 7 (variant=cartRow + onRemoveFromCart): Remove CTA testID present, onPress invokes the callback once
    - Test 8 (tap-to-expand): note rendered with numberOfLines=2 initially; press toggles to numberOfLines=undefined
    - Test 9 (no note): when note=null, no Pressable note element rendered
    - Test 10 (5 reasonCategory enum sweep): for each of {spam, policy_violation, fraud, inactive_seller, other}, chip text resolves to the correct translation key
  </behavior>
  <action>
    Per D-01 (sibling component), D-12 (variant prop), D-14 (severity → COLORS top-level tokens, NOT COLORS.moderation), Pitfall 8 (severity map), and PATTERNS analog lines 27-155.

    Create file with this structure (verbatim identifiers from RESEARCH §Pattern 1 / PATTERNS §ListingStatusBanner.tsx):

    Top of file: comment header citing Phase 11 D-01/D-12 + sibling discipline (Phase 10 D-04 precedent).

    Imports: React/useState/useCallback, RN primitives (View, Text, Pressable, LayoutAnimation, StyleSheet), useFocusEffect from '@react-navigation/native', useLanguage from '../../context/LanguageContext', icons (AlertTriangle, Archive, Ban) from 'lucide-react-native', COLORS/SIZES/TYPOGRAPHY from '../../constants/theme'. DO NOT import useAuth (D-01: prop-driven only). DO NOT import useSafeAreaInsets (not absolute-positioned per RESEARCH §Pattern 1 divergence — inline mount per D-02).

    Module-scope (alongside the component):
    - `type ListingStatus = 'suspended' | 'archived' | 'deleted'`
    - `type Severity = 'warning' | 'neutral' | 'destructive'`
    - `type ReasonCategory = 'spam' | 'policy_violation' | 'fraud' | 'inactive_seller' | 'other'`
    - `const SEVERITY_ICON: Record<Severity, any> = { warning: AlertTriangle, neutral: Archive, destructive: Ban }`
    - `const STATUS_TO_TITLE_KEY: Record<ListingStatus, string> = { suspended: 'listingStatusBannerSuspendedTitle', archived: 'listingStatusBannerArchivedTitle', deleted: 'listingStatusBannerDeletedTitle' }`
    - `const REASON_TO_KEY: Record<ReasonCategory, string> = { spam: 'listingStatusBannerReasonSpam', policy_violation: 'listingStatusBannerReasonPolicyViolation', fraud: 'listingStatusBannerReasonFraud', inactive_seller: 'listingStatusBannerReasonInactiveSeller', other: 'listingStatusBannerReasonOther' }` (table-driven, NOT switch — per "Don't Hand-Roll")
    - `const severityToColor: Record<Severity, string> = { warning: COLORS.warning, neutral: COLORS.textTertiary, destructive: COLORS.destructive }` (Pitfall 8 mapping; comment cites the rule)

    Props interface:
    ```
    interface Props {
      status: ListingStatus;
      reasonCategory?: ReasonCategory | null;
      bannerHints: { titleKey: string; bodyKey: string; severity: Severity };
      note?: string | null;
      variant?: 'detail' | 'cartRow';
      onRemoveFromCart?: () => void;
      testID?: string;
    }
    ```

    Component body:
    - Default `variant='detail'`, `testID='listing-status-banner'`.
    - `const { t } = useLanguage()`, `const [expanded, setExpanded] = useState(false)`.
    - `useFocusEffect(useCallback(() => () => setExpanded(false), []))` — verbatim from UserStatusBanner.tsx:99-103.
    - Resolve `title = (t as any)[STATUS_TO_TITLE_KEY[status]] ?? status` (defensive ?? per analog pattern).
    - Resolve `reasonLabel = reasonCategory ? ((t as any)[REASON_TO_KEY[reasonCategory]] ?? reasonCategory) : null`.
    - Resolve `Icon = SEVERITY_ICON[bannerHints.severity]`, `accentColor = severityToColor[bannerHints.severity]`.
    - `onToggle`: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(v => !v)` — synchronous order load-bearing per analog Pitfall comment.

    Render envelope (mirror UserStatusBanner.tsx:191-234 with the divergences from PATTERNS §ListingStatusBanner.tsx lines 112-117):
    - Outer View with `testID`, `accessible`, `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`, style stacks `[styles.container, { backgroundColor: ${accentColor}1A }]` (10% alpha hex tint).
    - Absolute-left 4px accent View with backgroundColor=accentColor.
    - Line 1: row with `Icon size={16} color={accentColor} testID={\`listing-status-banner-icon-${status}\`}`, title `Text` with TYPOGRAPHY.bodyStrong + COLORS.textPrimary, optional chip View+Text with REASON_TO_KEY translation.
    - Note Pressable wrapping `Text numberOfLines={expanded ? undefined : 2}` with onPress=onToggle, testID='listing-status-banner-note'. Render ONLY when `note != null && note.length > 0` (validation matrix F6 distinguishes empty-string from null — DECISION: treat empty string as "no note rendered" per RN Text behavior + PATTERNS analog F6 note).
    - cartRow-only Remove CTA: `{variant === 'cartRow' && onRemoveFromCart && (<Pressable testID="listing-status-banner-remove" onPress={onRemoveFromCart}><Text style={styles.removeCta}>{(t as any).cartListingUnavailableRemove}</Text></Pressable>)}`.

    StyleSheet at file bottom: `container`, `accent` (absolute left 4px strip), `line1` (flex-row + spacingSm gap + alignItems center), `chip`, `chipText`, `note`, `removeCta`. DROP container `position: 'absolute'`, `top`, `zIndex` from analog (inline mount, not global overlay).

    One default export `export default ListingStatusBanner` PLUS named export `export const ListingStatusBanner` (CLAUDE.md convention: component file may have named export for tests; default export for screen consumers).

    Zero hardcoded hex (except `1A` opacity suffix on the dynamic tint — that's not a color, it's an alpha channel). All colors via COLORS.* tokens.

    NO Linking/Alert import (PATTERNS divergence — no appeal CTA, that's a user-domain affordance). NO useSafeAreaInsets import (inline mount per D-02).
  </action>
  <verify>
    <automated>npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useAuth" src/components/moderation/ListingStatusBanner.tsx` returns 0 (prop-driven per D-01)
    - `grep -c "apiClient" src/components/moderation/ListingStatusBanner.tsx` returns 0 (no HTTP from component)
    - `grep -cE "useSafeAreaInsets" src/components/moderation/ListingStatusBanner.tsx` returns 0 (inline mount per D-02)
    - `grep -c "useFocusEffect" src/components/moderation/ListingStatusBanner.tsx` returns 1 (collapse-on-blur)
    - `grep -cE "STATUS_TO_TITLE_KEY|REASON_TO_KEY|severityToColor|SEVERITY_ICON" src/components/moderation/ListingStatusBanner.tsx` returns at least 4 (one declaration each)
    - `grep -cE "COLORS\.warning|COLORS\.destructive|COLORS\.textTertiary" src/components/moderation/ListingStatusBanner.tsx` returns at least 3 (one each from severityToColor map)
    - `grep -c "COLORS.moderation" src/components/moderation/ListingStatusBanner.tsx` returns 0 (Pitfall 8 — no user-domain palette reuse)
    - Hex-literal scan (excluding the dynamic `1A` alpha suffix): `grep -vE "^//|^\s*//|^\s*\*" src/components/moderation/ListingStatusBanner.tsx | grep -cE "#[0-9A-Fa-f]{6}\b"` returns 0
    - `grep -c "testID=\"listing-status-banner\"" src/components/moderation/ListingStatusBanner.tsx` >= 1
    - `grep -c "testID=\"listing-status-banner-remove\"" src/components/moderation/ListingStatusBanner.tsx` returns 1
    - `grep -cE "export default ListingStatusBanner|^export const ListingStatusBanner" src/components/moderation/ListingStatusBanner.tsx` >= 1
  </acceptance_criteria>
  <done>Component compiles; all behavior tests defined in Task 2 pass; grep gates green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ListingStatusBanner.test.tsx (component sweep across F1..F6 fixtures, 2 variants, 5 reasons)</name>
  <read_first>
    - __tests__/components/moderation/UserStatusBanner.test.tsx (read once — lines 14-74 harness setup, lines 116-197 per-state template, lines 45-56 useFocusEffect + safe-area mocks)
    - __tests__/_fixtures/listingStatusFixtures.ts (Plan 11-01 output — import F2..F6 fixtures)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§ListingStatusBanner.test.tsx lines 157-208)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-VALIDATION.md (§Sampling matrix Test Dimensions §Per-status × per-variant × per-reason)
  </read_first>
  <action>
    Per D-10 (describe convention — every block starts with the requirement ID) + PATTERNS §ListingStatusBanner.test.tsx + VALIDATION §Test Dimensions.

    Harness setup:
    - Imports: React, TestRenderer + act from 'react-test-renderer', Text + Pressable from 'react-native', `import { ListingStatusBanner } from '../ListingStatusBanner'`, fixture imports from '../../../../__tests__/_fixtures/listingStatusFixtures'.
    - Proxy `mockT` Pattern from analog: `const mockT = new Proxy({ /* concrete keys */ } as any, { get: (target, key) => key in target ? target[key] : String(key) })`. Pre-populate the keys the LBUY-04 chip tests assert (e.g. `listingStatusBannerReasonSpam: 'Spam'`, `listingStatusBannerSuspendedTitle: 'Listing suspended'`, etc.) so substring assertions don't false-match the fallback "stringify key" branch.
    - Jest mocks (verbatim from analog where applicable):
      - `jest.mock('../../../context/LanguageContext', () => ({ useLanguage: () => ({ t: mockT }) }))`
      - `jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb: any) => { const cleanup = cb(); /* no auto-call cleanup — simulates focused state */ } }))`
      - `jest.mock('lucide-react-native', () => ({ AlertTriangle: 'AlertTriangle', Archive: 'Archive', Ban: 'Ban' }))` (string-stub icons for findByType assertions)

    Render helper:
    ```
    function render(props: any) {
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => { tree = TestRenderer.create(<ListingStatusBanner {...props} />); });
      return tree;
    }
    ```

    `describe()` blocks (each starts with the LBUY-* ID per D-10):

    `describe('LBUY-01: ListingStatusBanner renders title + reason chip from props', () => {...})`
    - 'renders suspended title via STATUS_TO_TITLE_KEY lookup' — render with F2 fixture; assert tree contains 'Listing suspended' substring.
    - 'renders spam reason chip via REASON_TO_KEY lookup' — render with F2 fixture; assert 'Spam' substring.

    `describe('LBUY-04: severity tone matrix — neutral=archived, warning=suspended, destructive=deleted', () => {...})`
    - For each of (F2_suspendedSpam, F3_archivedInactiveSeller, F4_deletedPolicyViolation):
      - 'asserts icon stub matches expected (AlertTriangle / Archive / Ban)' via tree.root.findAll() filter for the string-stub component name.
      - 'asserts accent View backgroundColor equals expected COLORS token' via the second-child View style (accent strip).

    `describe('LBUY-01: cartRow variant exposes Remove CTA; detail variant does not', () => {...})`
    - render F2 with variant='detail' → findByProps({testID: 'listing-status-banner-remove'}) throws / returns null.
    - render F2 with variant='cartRow' + onRemoveFromCart=jest.fn() → testID 'listing-status-banner-remove' present, press invokes the mock once.

    `describe('LBUY-01: reasonCategory enum sweep', () => {...})`
    - parametrize across 5 enum values [spam, policy_violation, fraud, inactive_seller, other]; render with status='suspended' and the respective reasonCategory; assert tree contains the expected English chip text (from pre-populated mockT keys).

    `describe('LBUY-01: tap-to-expand note', () => {...})`
    - render F2 (note non-empty) — assert Pressable testID='listing-status-banner-note' present with Text numberOfLines prop=2.
    - act(() => pressable.props.onPress()) — re-query; numberOfLines is undefined or omitted.
    - render F3 (note=null) → no testID 'listing-status-banner-note' element.
    - render F6 (note='') → no testID 'listing-status-banner-note' element (empty-string treated as no-note per component decision).

    Reuse the F5 fixture (suspended-no-note) and F6 (archived-empty-note) only as additional sanity sweep cases if line count budget permits; otherwise rely on F2/F3 baseline.

    Test file should be ~200-280 lines total. ALL describe blocks must start with `'LBUY-NN: '` literally per D-10 (Plan 07 coverage manifest depends on this).
  </action>
  <verify>
    <automated>npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - File `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` exists
    - `grep -cE "^describe\('LBUY-(01|04):" src/components/moderation/__tests__/ListingStatusBanner.test.tsx` returns at least 4 (D-10 requires LBUY-01 + LBUY-04 covering describes; one of each minimum, count 4 means we have 2+ describe per requirement)
    - `grep -c "F2_suspendedSpam\|F3_archivedInactiveSeller\|F4_deletedPolicyViolation\|F5_suspendedFraud\|F6_archivedOther" src/components/moderation/__tests__/ListingStatusBanner.test.tsx` >= 3 (at least 3 fixtures imported)
    - Test command `npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x` exits 0 with all tests passing
    - `grep -c "from '../ListingStatusBanner'" src/components/moderation/__tests__/ListingStatusBanner.test.tsx` returns 1
    - `grep -c "useFocusEffect" src/components/moderation/__tests__/ListingStatusBanner.test.tsx` >= 1 (mock present)
  </acceptance_criteria>
  <done>All ListingStatusBanner.test.tsx blocks green; describe IDs follow LBUY-NN convention.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Props → rendered banner | Status + reasonCategory + bannerHints from screen-level state (sourced from Phase 9 thin payload) |
| `t.*` translation lookup | bannerHints.titleKey/bodyKey resolved against translations.ts — already taxonomy-bounded per Plan 11-01 keys |
| user-tappable Remove CTA | Caller-supplied onRemoveFromCart callback runs caller-defined cart-mutation logic |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-02-01 | Tampering | Banner copy via reasonCategory | mitigate | Component uses REASON_TO_KEY table lookup keyed on taxonomy-bounded enum (Phase 7 D-14a — 5 values); unknown values fall through `?? reasonCategory` to RN Text which auto-escapes. No HTML/JS injection vector. |
| T-11-02-02 | Spoofing | variant=detail rendering a Remove CTA | mitigate | Conditional render gate `variant === 'cartRow' && onRemoveFromCart` enforced; Task 2 Test 6 explicitly asserts CTA absent for detail variant. |
| T-11-02-03 | Information disclosure | Banner note free-text rendering | accept | `<Text>` auto-escapes per RN; Phase 9 D-05 thin payload excludes admin's free-text moderationReason — note prop carries only buyer-visible category description. Component never reads moderationReason. |
| T-11-02-04 | Tampering | Hardcoded severity colors drift | mitigate | severityToColor map is module-scope const + grep gate `COLORS.moderation` returns 0 (Pitfall 8 — no palette mismatch with user-domain). Future palette changes propagate via theme.ts single source of truth. |
</threat_model>

<verification>
- `npx jest src/components/moderation/__tests__/ListingStatusBanner.test.tsx -x` PASSES (Tasks 1+2 combined)
- All grep gates on ListingStatusBanner.tsx green
- Banner copy fully encapsulated — no user-facing literals outside translation keys (sets up Plan 06 SCAN_FILES extension)
</verification>

<success_criteria>
- LBUY-01: banner renders title + reason chip from props
- LBUY-04: severity tone matrix (warning/neutral/destructive) maps correctly to icon + color
- D-12: variant prop drives detail vs cartRow render branches
- D-14: severity colors via theme tokens, not COLORS.moderation
- Component is purely presentational (zero useAuth/apiClient references)
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-02-SUMMARY.md` capturing:
- Final ListingStatusBanner.tsx LOC + export shape
- Severity → COLORS token mapping verified
- Test count + variant coverage
</output>

---
phase: 11-buyer-affected-ux-quality-security-review
plan: 06
type: execute
wave: 4
depends_on: ["11-01", "11-02"]
files_modified:
  - __tests__/translation-parity.test.ts
  - __tests__/moderation-literals.test.ts
autonomous: true
requirements: [LQUAL-01]
requirements_addressed: [LQUAL-01]
must_haves:
  truths:
    - "translation-parity.test.ts gains a fourth test asserting placeholder tokens ({xxx}) are identical across RU and EN for every key"
    - "moderation-literals.test.ts SCAN_FILES gains ListingStatusBanner.tsx; CarDetailsScreen.tsx + ServiceCartScreen.tsx explicitly NOT added (Pitfall 12)"
    - "Both extended tests PASS green against the Phase 11 translations.ts + new component"
    - "No new scanner files are created (existing 76-line + 101-line files are extended in place)"
  artifacts:
    - path: "__tests__/translation-parity.test.ts"
      provides: "Phase 6 substrate extended with placeholder-token parity test"
      contains: "PLACEHOLDER"
    - path: "__tests__/moderation-literals.test.ts"
      provides: "SCAN_FILES extended with ListingStatusBanner.tsx"
      contains: "ListingStatusBanner.tsx"
  key_links:
    - from: "__tests__/translation-parity.test.ts"
      to: "src/constants/translations.ts"
      via: "regex extracts {tokenName} per key per language; set equality"
      pattern: "\\\\{\\[a-zA-Z\\]\\[a-zA-Z0-9\\]\\*\\\\}"
    - from: "__tests__/moderation-literals.test.ts"
      to: "src/components/moderation/ListingStatusBanner.tsx"
      via: "fs.readFileSync + regex scan for raw <Text>literal</Text> not wrapped in t.*"
      pattern: "SCAN_FILES"
---

<objective>
Extend the existing Phase 6 jest scanners to cover the Phase 11 i18n additions (LQUAL-01).

Purpose: LQUAL-01 mandates RU+EN parity enforcement for v1.1 additions. The two existing scanners (translation-parity.test.ts and moderation-literals.test.ts) already cover Phase 6 substrate; per D-09 + RESEARCH §Don't Hand-Roll, Phase 11 EXTENDS them rather than duplicating. The placeholder-token parity test (D-09 (c)) catches an entire class of bugs the existing scanner misses — a key with `{title}` in RU but not in EN. SCAN_FILES extension catches future untranslated <Text>literal</Text> additions to ListingStatusBanner. Pitfall 12 prevents over-extending the scanner to CarDetailsScreen/ServiceCartScreen.

Output: Two existing files extended in place. Total delta < 50 lines.
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
@__tests__/translation-parity.test.ts
@__tests__/moderation-literals.test.ts
@src/components/moderation/ListingStatusBanner.tsx
@src/constants/translations.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend __tests__/translation-parity.test.ts with placeholder-token parity test</name>
  <read_first>
    - __tests__/translation-parity.test.ts (read full — existing 3 tests inside `describe('QUAL-01: translation parity', () => {...})` at lines 33-76)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Code Examples lines 724-763 — exact placeholder-parity test body)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§translation-parity.test.ts lines 629-674)
  </read_first>
  <action>
    Per CONTEXT D-09 (c) + RESEARCH §Code Examples + Pitfall 7 (placeholder-parity false-positive guard).

    Locate the EXISTING `describe('QUAL-01: translation parity', () => {...})` block at lines 33-76. Append a FOURTH `test(...)` call INSIDE that describe block, IMMEDIATELY before its closing `});`. DO NOT create a new describe block; the existing one is the LQUAL-01 carrier.

    Append exactly this test (verbatim from RESEARCH §Code Examples lines 728-763, with one improvement — relabel describe ID so coverage manifest catches the LQUAL-01 carry-over):

    Step A: Update the existing describe string to also include the LQUAL-01 marker per D-10 — BUT preserve the QUAL-01 carrier so Phase 6 coverage manifest doesn't regress. Change:
    `describe('QUAL-01: translation parity', () => {`
    to:
    `describe('QUAL-01 / LQUAL-01: translation parity', () => {`

    This compound describe registers BOTH IDs for the manifest grep in Plan 11-07 (the manifest greps `describe\(['\"]L?(QUAL|BUY|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:` — see Plan 11-07 task for exact regex). Document the rationale inline:
    `// describe ID covers both the original Phase 6 QUAL-01 substrate and the Phase 11 LQUAL-01 extension; coverage manifest (Plan 11-07) reads both.`

    Step B: Append the new test (D-09 (c)):
    ```
    test('LQUAL-01: placeholder tokens are identical across RU and EN for every key', () => {
      // D-09 (c): if RU has `{title}` for a key, EN must have `{title}` for the same key.
      // Per Pitfall 7: same-set semantics PASS; differing-set FAILS as a real bug.
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

    Do NOT add `test.todo`. Do NOT split the placeholder-parity test into separate suites — keep cohesion per RESEARCH §Don't Hand-Roll "one file already owns translation parity."

    DO confirm the existing TRANSLATIONS import at the top of the file is sufficient (likely `import { TRANSLATIONS } from '../src/constants/translations'`); no new imports needed.

    Per Pitfall 7 + Assumption A8: spot-check the regex `\{([a-zA-Z][a-zA-Z0-9]*)\}` against existing keys with placeholders like `appealNoMailBody: '... {uid}'`. If any existing key uses a hyphen/underscore-leading or numeric-leading placeholder, the test MAY fail on first run — surface to operator (it's a real bug to fix in translations.ts, not a regex defect).
  </action>
  <verify>
    <automated>npx jest __tests__/translation-parity.test.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "LQUAL-01: placeholder tokens are identical" __tests__/translation-parity.test.ts` returns 1
    - `grep -c "QUAL-01 / LQUAL-01: translation parity" __tests__/translation-parity.test.ts` returns 1 (compound describe)
    - `grep -c "PLACEHOLDER" __tests__/translation-parity.test.ts` >= 2 (declaration + use)
    - `grep -c "mismatches" __tests__/translation-parity.test.ts` >= 2
    - Existing 3 tests preserved: `grep -cE "test\('RU and EN key sets are identical'|test\('every value is a non-empty string|test\('no TODO/FIXME/TRANSLATE placeholder values" __tests__/translation-parity.test.ts` >= 3
    - Test command `npx jest __tests__/translation-parity.test.ts -x` exits 0 (existing 3 tests PASS + new placeholder-parity test PASS on current translations.ts content; if it fails, the failure surfaces a real translation bug — surface to operator)
  </acceptance_criteria>
  <done>Existing 3 tests preserved + placeholder-parity test added inside the same describe; compound describe ID set; suite green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend __tests__/moderation-literals.test.ts SCAN_FILES with ListingStatusBanner.tsx</name>
  <read_first>
    - __tests__/moderation-literals.test.ts (read full — existing SCAN_FILES array at ~lines 42-46; existing describe block; allowlist comments at lines 24-28)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Code Examples lines 766-780 + Pitfall 12 — DO NOT add CarDetailsScreen or ServiceCartScreen)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§moderation-literals.test.ts lines 678-699)
    - src/components/moderation/ListingStatusBanner.tsx (Plan 11-02 output — confirm zero raw `<Text>literal</Text>` outside `(t as any)[key]` patterns)
  </read_first>
  <action>
    Per CONTEXT D-09 (extend SCAN_FILES) + Pitfall 12 (do NOT add CarDetailsScreen.tsx or ServiceCartScreen.tsx — pre-existing brand-name literals on CarDetails like 'Visa'/'Mastercard'/'Telegram' would trigger allowlist creep; banner copy is fully encapsulated in ListingStatusBanner which IS scanned).

    Locate the EXISTING `const SCAN_FILES = [...]` array (around lines 42-46). Add ONE new entry at the end of the array, preserving alphabetical/insertion order:
    ```
    const SCAN_FILES = [
      'src/components/moderation/UserStatusBanner.tsx',
      'src/components/moderation/FeatureGateOverlay.tsx',
      'src/components/moderation/GatedScreenWrapper.tsx',
      'src/components/moderation/ListingStatusBanner.tsx',  // Phase 11 LQUAL-01 (D-09): banner copy fully encapsulated; CarDetailsScreen.tsx + ServiceCartScreen.tsx deliberately NOT added per Pitfall 12.
    ];
    ```

    If a separate cart-row component was created (D-12 escape hatch — `ListingCartRowBanner.tsx`), add it as a second new entry. Plan 11-02 currently keeps a single component; only extend if Plan 11-02 SUMMARY indicates the split happened.

    Also update the describe block ID to register the LQUAL-01 carry-over for the coverage manifest. The existing describe likely reads:
    `describe('QUAL-01: untranslated user-facing literals in moderation components', () => {`
    Change to:
    `describe('QUAL-01 / LQUAL-01: untranslated user-facing literals in moderation components', () => {`

    Do NOT change any allowlist logic. Do NOT change the scan regex. Do NOT add per-file allowlist overrides for ListingStatusBanner.tsx (it shouldn't need any — the component reads ALL user-facing copy through `(t as any)[key]` per Plan 11-02 acceptance criteria).

    If on first run the test surfaces a flagged literal in ListingStatusBanner.tsx (e.g., the dynamic `1A` alpha-channel hex), the regex likely flags it as a string literal. Mitigation: check whether the existing scanner already excludes hex-pattern strings or short strings (< N chars); the alpha suffix `'1A'` is part of a template literal `\`${accentColor}1A\``, NOT a `<Text>` literal — the scanner targets JSX <Text>{'literal'}</Text> or `<Text>literal</Text>`, not string concatenation. Spot-check after first run.
  </action>
  <verify>
    <automated>npx jest __tests__/moderation-literals.test.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "src/components/moderation/ListingStatusBanner.tsx" __tests__/moderation-literals.test.ts` returns 1 (added to SCAN_FILES)
    - `grep -c "src/screens/CarDetailsScreen.tsx" __tests__/moderation-literals.test.ts` returns 0 (Pitfall 12 enforced)
    - `grep -c "src/screens/ServiceCartScreen.tsx" __tests__/moderation-literals.test.ts` returns 0 (Pitfall 12 enforced)
    - `grep -c "QUAL-01 / LQUAL-01" __tests__/moderation-literals.test.ts` returns 1 (compound describe)
    - Existing entries preserved: `grep -c "UserStatusBanner.tsx\|FeatureGateOverlay.tsx\|GatedScreenWrapper.tsx" __tests__/moderation-literals.test.ts` >= 3
    - Test command `npx jest __tests__/moderation-literals.test.ts -x` exits 0 (Plan 11-02 banner has zero raw literals)
  </acceptance_criteria>
  <done>SCAN_FILES extended with banner only; CarDetails/ServiceCart explicitly excluded; compound describe registered; suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Scanner → source tree | Read-only; fs.readFileSync + regex |
| Compound describe ID for coverage manifest | Test name string consumed by Plan 11-07 grep |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-06-01 | Tampering | Future commit adds untranslated <Text> literal to ListingStatusBanner | mitigate | SCAN_FILES extension catches it; existing scanner regex (Phase 6 substrate) does the work. |
| T-11-06-02 | Tampering | Future RU or EN key drift in placeholder set | mitigate | Placeholder-parity test compares per-key token sets; CI fails if `{title}` in one language is missing in the other. |
| T-11-06-03 | Repudiation | Coverage manifest misses LQUAL-01 because describe ID still reads QUAL-01 only | mitigate | Compound describe IDs (`QUAL-01 / LQUAL-01`) register both phases for Plan 11-07 manifest grep. Plan 11-07 regex must accept `L?QUAL`. |
| T-11-06-04 | Tampering | Pitfall 12 over-extension — CarDetailsScreen brand literals trigger allowlist creep | mitigate | Acceptance criterion `grep -c "src/screens/CarDetailsScreen.tsx" __tests__/moderation-literals.test.ts` returns 0 enforces the boundary. |
</threat_model>

<verification>
- `npx jest __tests__/translation-parity.test.ts -x` PASSES
- `npx jest __tests__/moderation-literals.test.ts -x` PASSES
- Compound describe IDs grep-detectable for Plan 11-07
- Pitfall 12 boundary enforced
</verification>

<success_criteria>
- LQUAL-01 (a)+(b)+(c) all enforced: key-set parity (existing) + value emptiness (existing) + placeholder-token parity (new)
- Literal scanner extended to cover Phase 11 banner without over-extending to screens
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-06-SUMMARY.md` capturing:
- Compound describe IDs adopted
- Whether placeholder-parity surfaced any pre-existing translation bugs (and disposition)
</output>

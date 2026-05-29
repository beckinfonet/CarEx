---
phase: 11-buyer-affected-ux-quality-security-review
plan: 06
subsystem: tests/scanners
tags: [tests, i18n, scanner, LQUAL-01, parity, compound-describe]
requirements: [LQUAL-01]
requirements_addressed: [LQUAL-01]
dependency_graph:
  requires:
    - __tests__/translation-parity.test.ts (existing — Phase 6 substrate, 3 tests)
    - __tests__/moderation-literals.test.ts (existing — Phase 6 substrate, 3 SCAN_FILES)
    - src/constants/translations.ts (Plan 11-01 — listingStatusBanner*/cartListingUnavailable* keys)
    - src/components/moderation/ListingStatusBanner.tsx (Plan 11-02 — banner component to scan)
  provides:
    - LQUAL-01 (c) placeholder-token parity test (4th test in QUAL-01 describe block)
    - SCAN_FILES extension with ListingStatusBanner.tsx
    - Compound describe IDs ('QUAL-01 / LQUAL-01: ...') on both scanner files for Plan 11-07 coverage manifest
  affects:
    - Plan 11-07 (coverage manifest grep on `L?(QUAL|BUY|MOB|UI|ADM|DATA|ENF|SEC)-\d+:`)
    - All future commits to src/constants/translations.ts (placeholder parity now enforced in CI)
    - All future commits to src/components/moderation/ListingStatusBanner.tsx (raw <Text> literals now blocked)
tech_stack:
  added: []
  patterns:
    - "Extend-in-place over duplicate-scanner: existing 76+101 line scanners extended with <50 line delta total"
    - "Compound describe ID ('QUAL-01 / LQUAL-01: ...') registers BOTH phase requirements for downstream coverage-manifest greps; preserves Phase 6 substrate naming without regression"
    - "Pitfall 12 enforcement via negative grep gates (CarDetailsScreen.tsx/ServiceCartScreen.tsx counts MUST equal 0 in SCAN_FILES) — prevents allowlist creep from brand-name literals"
    - "Set-equality on placeholder tokens via regex /\\{([a-zA-Z][a-zA-Z0-9]*)\\}/g + Set comparison; covers both string values and array-pool values via recursive visit()"
key_files:
  created: []
  modified:
    - __tests__/translation-parity.test.ts
    - __tests__/moderation-literals.test.ts
decisions:
  - "Compound describe IDs adopted on BOTH scanner files: 'QUAL-01 / LQUAL-01: translation parity' and 'QUAL-01 / LQUAL-01: moderation components — no untranslated literals'. Plan 11-07's coverage manifest greps `L?(QUAL|BUY|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:` so both IDs match without regressing Phase 6 substrate naming"
  - "No new test files created — both scanners extended in place per RESEARCH §Don't Hand-Roll 'one file already owns translation parity'. Final delta: +38 lines on translation-parity.test.ts, +2 lines on moderation-literals.test.ts (total +40 < 50-line cap)"
  - "Placeholder-parity test placed INSIDE the existing describe block (not a new describe), preserving the 4-tests-in-1-block cohesion. Test ordered last (after no-TODO/FIXME) so the 3 existing tests run first when --bail trips on a regression elsewhere"
  - "Did NOT extend Pitfall 12-exempted files (CarDetailsScreen, ServiceCartScreen). Per acceptance criteria + threat T-11-06-04, both grep counts must be 0 in SCAN_FILES — banner copy is fully encapsulated in ListingStatusBanner.tsx (Plan 11-02) which IS scanned"
metrics:
  duration: "~10 min"
  completed_date: "2026-05-29"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
---

# Phase 11 Plan 06: extend-translation-parity-and-literals-scanner Summary

One-liner: Extended the existing Phase 6 QUAL-01 jest scanners (translation-parity + moderation-literals) in place with a placeholder-token parity test and a ListingStatusBanner SCAN_FILES entry — LQUAL-01 enforcement now active in CI with compound describe IDs ready for Plan 11-07's coverage manifest grep.

## What Shipped

### Task 1 — __tests__/translation-parity.test.ts: placeholder-token parity test (LQUAL-01 c)

Appended a 4th test inside the existing `describe('QUAL-01: translation parity', ...)` block (now renamed to `describe('QUAL-01 / LQUAL-01: translation parity', ...)`) at the end of the block, immediately before the closing `});`. Net delta: +38 lines (1 new test body + 1 describe rename + 1 inline rationale comment).

**Test logic** (verbatim from RESEARCH §Code Examples lines 728-763):

- Regex `/\{([a-zA-Z][a-zA-Z0-9]*)\}/g` extracts placeholder token names from each translation value
- Recursive `visit()` walks string-or-array values; arrays handled via `forEach(visit)` so pool-shaped values are covered
- `extract()` returns a `Set<string>` of token names per key per language
- Mismatch detection: `ruTokens.size !== enTokens.size || [...ruTokens].some((tok) => !enTokens.has(tok))`
- Failure surfaces `{ key, ru: [...], en: [...] }` for each offending key — pinpoints both the key and the differing token sets

**Pre-existing placeholder bug check (Pitfall 7 surface):** Test ran GREEN on first attempt. All 11 placeholder-bearing key pairs in `translations.ts` have parity-clean placeholders across RU and EN:

| Key | Placeholders (both languages) |
|-----|-------------------------------|
| `showAllServices` | `{count}` |
| `servicesSelected` | `{count}` |
| `wrongOrientationMessage` | `{orientation}`, `{count}` (rendered as `{{orientation}}`/`{{count}}` in source — regex matches inner) |
| `listingsBySeller` | `{name}` |
| `contactMessage` | `{car}`, `{id}` |
| `listingValidationMissing` | `{field}` |
| `typedConfirmHint` | `{email}` |
| `typedConfirmListingHint` | `{title}` |
| `summaryHistoryCount` | `{count}` |
| `capabilityBrowseOnly` | `{list}` |
| `appealNoMailBody` | `{uid}` |

**No pre-existing parity bugs surfaced** — the test was net-additive coverage with zero remediation needed in translations.ts.

**Compound describe ID rationale** (inline comment in the test file):
```
// describe ID covers both the original Phase 6 QUAL-01 substrate and the
// Phase 11 LQUAL-01 extension; coverage manifest (Plan 11-07) reads both.
```

Plan 11-07 will grep `describe(['\"]L?(QUAL|BUY|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:` — the `L?` makes both `QUAL-01` and `LQUAL-01` match the compound ID, registering both phases without forking the describe block.

### Task 2 — __tests__/moderation-literals.test.ts: SCAN_FILES extension + compound describe ID

Two single-line edits to the existing 101-line file (net +2 lines):

1. **SCAN_FILES extension** (one new entry, alphabetical-after-existing order):
   ```ts
   const SCAN_FILES = [
     'src/components/moderation/UserStatusBanner.tsx',
     'src/components/moderation/FeatureGateOverlay.tsx',
     'src/components/moderation/GatedScreenWrapper.tsx',
     'src/components/moderation/ListingStatusBanner.tsx',  // Phase 11 LQUAL-01 (D-09): banner copy fully encapsulated; CarDetailsScreen.tsx + ServiceCartScreen.tsx deliberately NOT added per Pitfall 12.
   ];
   ```

2. **Compound describe ID rename:**
   `describe('QUAL-01: moderation components — no untranslated literals', ...)`
   → `describe('QUAL-01 / LQUAL-01: moderation components — no untranslated literals', ...)`

**Pitfall 12 enforcement confirmed** via negative-count acceptance gates:
- `grep -c "src/screens/CarDetailsScreen.tsx" __tests__/moderation-literals.test.ts` → **0** (boundary held — would force `'Visa'`/`'Mastercard'`/`'Telegram'` allowlist creep)
- `grep -c "src/screens/ServiceCartScreen.tsx" __tests__/moderation-literals.test.ts` → **0** (boundary held)

ListingStatusBanner.tsx (Plan 11-02 output, 289 lines) was scanned on first run and emitted **zero offenders** — the component reads every user-facing string through `(t as Record<string, string>)[key]` per Plan 11-02 acceptance criteria, so no per-file ALLOWLIST overrides were needed.

D-12 escape hatch evaluation: Plan 11-02 SUMMARY confirms a single component was shipped (no `ListingCartRowBanner.tsx` split). Plan 11-04 also did not split. SCAN_FILES therefore has exactly one new entry.

### Compound describe IDs adopted (Plan 11-07 enabler)

Both scanner files now carry compound IDs that match Plan 11-07's anticipated coverage-manifest grep `describe\(['\"]L?(QUAL|BUY|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:`:

| File | Old describe | New describe |
|------|--------------|--------------|
| `__tests__/translation-parity.test.ts` | `'QUAL-01: translation parity'` | `'QUAL-01 / LQUAL-01: translation parity'` |
| `__tests__/moderation-literals.test.ts` | `'QUAL-01: moderation components — no untranslated literals'` | `'QUAL-01 / LQUAL-01: moderation components — no untranslated literals'` |

Plan 11-07's manifest will count both `QUAL-01` (Phase 6 carry-over) and `LQUAL-01` (Phase 11) coverage hits in a single grep pass per file.

### Verification results

| Suite | Result | Tests passing |
|-------|--------|---------------|
| `npx jest __tests__/translation-parity.test.ts --bail` | exit 0 | 4/4 (3 existing + 1 new) |
| `npx jest __tests__/moderation-literals.test.ts --bail` | exit 0 | 4/4 (3 existing + 1 new) |
| Combined run | exit 0 | 8/8 |

**Note on jest flag:** The plan's `<verify><automated>` blocks specified `-x` (fail-fast); jest 29.6.3 does not recognize `-x` (rejected by Plan 11-01 as well — see that plan's deviation 1). Substituted `--bail` for semantic equivalence. No source-of-truth change.

### Acceptance gate sweep

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| **Task 1** | | | |
| `grep -c "LQUAL-01: placeholder tokens are identical" translation-parity.test.ts` | 1 | 1 | ✓ |
| `grep -c "QUAL-01 / LQUAL-01: translation parity" translation-parity.test.ts` | 1 | 1 | ✓ |
| `grep -c "PLACEHOLDER" translation-parity.test.ts` | >=2 | 3 | ✓ |
| `grep -c "mismatches" translation-parity.test.ts` | >=2 | 3 | ✓ |
| Existing 3 tests preserved | 3 | 3 | ✓ |
| `npx jest <file> --bail` | exit 0 | exit 0, 4/4 | ✓ |
| **Task 2** | | | |
| `grep -c "src/components/moderation/ListingStatusBanner.tsx" moderation-literals.test.ts` | 1 | 1 | ✓ |
| `grep -c "src/screens/CarDetailsScreen.tsx" moderation-literals.test.ts` | 0 | 0 | ✓ (Pitfall 12 enforced) |
| `grep -c "src/screens/ServiceCartScreen.tsx" moderation-literals.test.ts` | 0 | 0 | ✓ (Pitfall 12 enforced) |
| `grep -c "QUAL-01 / LQUAL-01" moderation-literals.test.ts` | 1 | 1 | ✓ |
| Existing 3 SCAN_FILES entries preserved | >=3 | 3 | ✓ |
| `npx jest <file> --bail` | exit 0 | exit 0, 4/4 | ✓ |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 862ae41 | test | extend translation-parity scanner with LQUAL-01 placeholder-token parity |
| da03f21 | test | extend moderation-literals SCAN_FILES with ListingStatusBanner (LQUAL-01) |

## Deviations from Plan

### Operational

**1. [Rule 3 — Blocking] `-x` jest flag not recognized by jest 29.6.3**

- **Found during:** Task 1 verify step
- **Issue:** Plan prescribed `npx jest <file> -x`; jest 29.6.3 rejects `-x` (same as Plan 11-01 / 11-02 deviation)
- **Fix:** Used `--bail` (semantically equivalent — fail fast on first failure)
- **Files modified:** none (operational deviation only)
- **Commit:** n/a

### Auto-fixed Issues (Rule 1 / 2 / 3)

None. Both tasks were single-file in-place extensions with no auto-fix triggers.

### Out-of-Scope Discoveries (not fixed)

None. Both scanner extensions are entirely self-contained and only touched the prescribed files.

## Auth Gates

None encountered.

## Known Stubs

None. Both extensions are complete:
- Placeholder-parity test exercises every key in `TRANSLATIONS.RU` against `TRANSLATIONS.EN`; no partial coverage
- SCAN_FILES extension audits the full ListingStatusBanner.tsx; no per-file allowlist overrides needed (zero offenders found on first run)

## TDD Gate Compliance

Plan frontmatter declared `tdd="false"` on both tasks (the tasks ARE tests, not implementations behind tests). Both commits used `test()` type per task_commit_protocol — semantically correct (test-only changes). No RED/GREEN gate enforcement applies; scanner extensions cover existing implementation that landed in Plans 11-01 (translations.ts) and 11-02 (ListingStatusBanner.tsx).

## Threat Surface Scan

All four registered threats from the plan's `<threat_model>` are mitigated as designed:

- **T-11-06-01 (untranslated literal added to ListingStatusBanner):** Mitigated — SCAN_FILES extension activates the Phase 6 regex (`/<Text[^>]*>\s*([A-Za-zА-Яа-я][^<{}]*?)\s*<\/Text>/g`) on the banner; any future raw literal will fail CI with a line+text diagnostic.
- **T-11-06-02 (RU/EN placeholder set drift):** Mitigated — Test 4 in QUAL-01/LQUAL-01 describe block compares per-key token sets. CI fails with `{ key, ru: [...], en: [...] }` diagnostic on any mismatch.
- **T-11-06-03 (coverage manifest misses LQUAL-01):** Mitigated — Compound describe IDs ('QUAL-01 / LQUAL-01: ...') on both scanner files match Plan 11-07's anticipated `L?(QUAL|...)-NN:` grep pattern. Verified inline via `grep -c "QUAL-01 / LQUAL-01"` counts = 1 on each file.
- **T-11-06-04 (Pitfall 12 over-extension — CarDetails brand literals):** Mitigated — Negative grep gates `grep -c "src/screens/CarDetailsScreen.tsx" = 0` and `grep -c "src/screens/ServiceCartScreen.tsx" = 0` enforced; SCAN_FILES contains only the new banner.

No new security-relevant surface introduced. Both scanner extensions are test-only changes under `__tests__/`; never bundled into production. No threat flags to add.

## Self-Check

**Files modified:**

- ✓ `__tests__/translation-parity.test.ts` → grep "LQUAL-01: placeholder tokens are identical" = 1
- ✓ `__tests__/moderation-literals.test.ts` → grep "ListingStatusBanner.tsx" = 1

**Files created:**

- ✓ `.planning/phases/11-buyer-affected-ux-quality-security-review/11-06-extend-translation-parity-and-literals-scanner-SUMMARY.md` → this file

**Commits exist (verified `git log --oneline -3`):**

- ✓ `862ae41` test(11-06): extend translation-parity scanner with LQUAL-01 placeholder-token parity
- ✓ `da03f21` test(11-06): extend moderation-literals SCAN_FILES with ListingStatusBanner (LQUAL-01)

**Verifications:**

- ✓ `npx jest __tests__/translation-parity.test.ts --bail` → 4/4 PASS
- ✓ `npx jest __tests__/moderation-literals.test.ts --bail` → 4/4 PASS
- ✓ Combined run: 8/8 PASS
- ✓ All 12 acceptance grep gates met (6 per task)
- ✓ Pitfall 12 boundary preserved (CarDetails/ServiceCart counts = 0)
- ✓ Compound describe IDs grep-detectable on both files (count = 1 each)

## Self-Check: PASSED

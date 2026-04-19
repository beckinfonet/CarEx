---
phase: 06-affected-user-ux-security-review
plan: 09
subsystem: qa
tags: [qual, translation-audit, literal-scanner, jest, static-analysis, phase-6, wave-5, QUAL-01]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    plan: 01
    provides: "translation-parity.test.ts (QUAL-01 value-side parity guard — Plan 06-01 Task 3) — remains green alongside this scanner"
  - phase: 06-affected-user-ux-security-review
    plan: 03
    provides: "UserStatusBanner.tsx with every user-visible Text child sourced from t.* — scan target #1"
  - phase: 06-affected-user-ux-security-review
    plan: 04
    provides: "FeatureGateOverlay.tsx with every user-visible Text child sourced from t.* — scan target #2"
  - phase: 06-affected-user-ux-security-review
    plan: 05
    provides: "GatedScreenWrapper.tsx (structural only — contains zero Text children; scanned for safety + future-drift guard) — scan target #3"
  - phase: 06-affected-user-ux-security-review
    plan: 07
    provides: "CarDetailsScreen contact-gate Modal body is only <FeatureGateOverlay capability='contact_seller' /> — transitively audited via scan target #2 (no separate scan entry needed; CarDetailsScreen as a whole is NOT scanned due to pre-Phase-6 brand literals like 'Visa'/'Mastercard'/'Telegram')"
provides:
  - "__tests__/moderation-literals.test.ts — Jest-based static literal scanner for three new moderation component files"
  - "QUAL-01 closed end-to-end: value-side parity (RU≡EN, Plan 06-01) AND source-side source (no untranslated <Text> children, this plan)"
  - "Fault-injection proven detective capability: bad literal injection triggered failure with line + text diagnostic; reverted before commit"
  - "Pattern: `fs.readFileSync + regex` static analysis in Jest without new dev deps — reusable for future code-shape invariants"
affects: [phase-06-10-verifier (expects QUAL-01 marked mitigated in REQUIREMENTS.md), future-phases-adding-new-moderation-text (must either wrap in t.* or add an ALLOWLIST entry with justification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static code invariant test: `fs.readFileSync` + narrow regex inside a Jest `describe`/`test` block. No AST parser (would need `@babel/parser` or `ts-morph`; forbidden by CLAUDE.md 'don't introduce new libs' + phase scope). Regex `<Text[^>]*>\\s*([A-Za-zА-Яа-я][^<{}]*?)\\s*</Text>` captures letter-starting literals; `<Text>{t.foo}</Text>` starts with `{` (excluded)"
    - "Fault-injection verification: any scanner claimed to be green-by-correctness must ALSO be shown to fail on an injected offender. Pattern: edit source to add a bad pattern → run test → observe expected failure + correct diagnostic → revert → re-run and observe green. Non-negotiable for detective-control tests"
    - "Audit allowlist discipline: `ALLOWLIST = new Set<string>([])` (empty at phase close). Future entries MUST carry an inline comment justifying the exemption — expanding silently defeats the audit"

key-files:
  created:
    - "__tests__/moderation-literals.test.ts (101 lines — 3 files scanned, 3 jest tests, 1 regex, 1 allowlist set, full docstring explaining design choices + fault-injection contract)"
  modified: []

key-decisions:
  - "Phase 06: Plan 06-09 — Jest chosen over bash script (RESEARCH recommendation §Pattern 6 + Claude's Discretion): CI watch-mode friendliness, no bash portability concerns across dev environments, mechanical consistency with existing translation-parity.test.ts that already sits under __tests__/. Bash alternative (documented in 06-PATTERNS.md §audit-moderation-literals.sh) remained as a reference but is NOT the shipped artifact"
  - "Phase 06: Plan 06-09 — Regex over AST parser: adding `@babel/parser` or `ts-morph` solely for this one scanner would violate CLAUDE.md 'do not introduce new state-management or networking libs' (interpreted broadly as 'prefer existing surface area') and adds bundle/install weight that the phase isn't buying anything else from. Regex trades off multiline literal coverage (under-reports across line breaks) for zero new deps; acceptable at this audit level — upgrade to AST only if a real bypass emerges"
  - "Phase 06: Plan 06-09 — CarDetailsScreen NOT included in SCAN_FILES: pre-Phase-6 code carries legitimate brand-name literals ('Visa', 'Mastercard', 'Telegram') that are NOT translated and should NOT be flagged. Scanning the whole file would demand case-by-case allowlist expansion and defeat the audit's tight-allowlist discipline. Instead, the new contact-gate region added by Plan 06-07 is transitively covered because its only user-facing text comes from <FeatureGateOverlay capability='contact_seller' /> (scan target #2). Documented inline in the test file docstring for future readers"
  - "Phase 06: Plan 06-09 — ALLOWLIST empty at phase close: every user-visible string in UserStatusBanner, FeatureGateOverlay, and GatedScreenWrapper is sourced from `t.*` per Plans 06-03/04/05 contracts. No current entry needed; the empty set is the strongest possible audit invariant. Future additions require justification comments"
  - "Phase 06: Plan 06-09 — Single 'readFileSync' occurrence kept (code-only, no docstring duplicate): plan §done criterion `grep -c 'readFileSync' == 1` required mechanical single-occurrence. Initial draft had 2 (one in docstring backticks + one in code); simplified the docstring to 'synchronous fs reads' to satisfy the mechanical check while preserving intent. Fully documented in Deviations §1"

patterns-established:
  - "QUAL-* audit pattern (generalizable): value-side + source-side split. Value-side = set-equality/parity test on the artifact (translations map, role table, capability set); source-side = static scan of component files for invariants (no literals, no inline styles of a certain shape, no deprecated API use). Both tests sit under __tests__/ and run in every `jest` invocation; failure diagnostic names the file + line + offending text so the fix is obvious"
  - "Fault-injection checkpoint for detective tests: any test that claims to GUARD an invariant (not merely describe behavior) MUST demonstrate it detects a violation. Runbook: (1) write clean → green; (2) inject offender → expected red with specific diagnostic; (3) revert → green. Document the injection pattern in the test file docstring so reviewers + future agents can reproduce"

# Threat coverage
threat-mitigations:
  # No threats in this plan's <threat_model> (scanner is test infrastructure;
  # no runtime trust boundary crossed). QUAL-01 is a code-quality gate, not a
  # security gate.

requirements-completed: [QUAL-01]
# QUAL-01 was previously "Pending" in REQUIREMENTS.md traceability table.
# Plan 06-01 Task 3 landed the parity test (value-side); this plan lands the
# literal scanner (source-side). Together they close QUAL-01 end-to-end.

# Metrics
duration: 2m27s
completed: 2026-04-19
---

# Phase 06 Plan 09: Jest Literal Scanner for New Moderation Components (QUAL-01 Close) Summary

**QUAL-01 closed: new Jest scanner flags any `<Text>LITERAL</Text>` child in UserStatusBanner / FeatureGateOverlay / GatedScreenWrapper that is not wrapped in `t.*` accessors. Runs alongside the already-passing translation-parity test from Plan 06-01. Fault-injection verified. 218/219 jest tests green (only the pre-existing unrelated App.test.tsx native-stack failure remains).**

## Performance

- **Duration:** 2m27s
- **Started:** 2026-04-19T09:26:04Z
- **Completed:** 2026-04-19T09:28:31Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0
- **Insertions / deletions:** +101 / 0

## Accomplishments

- `__tests__/moderation-literals.test.ts` created with 3 `test()` blocks (one per scanned file), a shared `scanFile()` helper, a narrow regex `<Text[^>]*>\s*([A-Za-zА-Яа-я][^<{}]*?)\s*</Text>`, and an explicit empty `ALLOWLIST` Set
- All 3 assertions pass against the current Phase-6-complete state (UserStatusBanner, FeatureGateOverlay, GatedScreenWrapper)
- Fault-injection check performed: inserted `<Text style={styles.reasonChipText}>Test bad literal</Text>` into UserStatusBanner.tsx line 210 → scanner failed with `Found 1 untranslated <Text> literal(s) in src/components/moderation/UserStatusBanner.tsx:\n  line 210: "Test bad literal"\nWrap them in t.* via useLanguage(), or add to ALLOWLIST with justification.` → reverted before commit (zero git diff post-revert, verified)
- QUAL-01 parity test (Plan 06-01) remains green alongside the new scanner (6 tests across both files: 3 parity + 3 literal-scan)
- Full test suite: **218 passing, 1 failing** (same pre-existing `App.test.tsx` `usesNewAndroidHeaderHeightImplementation` native-stack issue documented in STATE.md post-06-08; unrelated to this plan). +3 new passing tests vs. post-06-08 baseline, zero regressions.
- No new dev dependencies. Imports limited to `fs` and `path` (Node built-ins)

## Task Commits

1. **Task 1: Add jest literal scanner for new moderation components** — `b4a0851` (test)

## Verification

**Plan acceptance greps (all green):**

- `grep -c "SCAN_FILES" __tests__/moderation-literals.test.ts` = **3** (>= 1 required)
- `grep -cE "UserStatusBanner|FeatureGateOverlay|GatedScreenWrapper" __tests__/moderation-literals.test.ts` = **4** (>= 3 required)
- `grep -c "ALLOWLIST" __tests__/moderation-literals.test.ts` = **3** (>= 2 required)
- `grep -c "readFileSync" __tests__/moderation-literals.test.ts` = **1** (equals 1 required — see Deviations §1)
- Imports confined to `fs` and `path` only (no new deps): verified via `grep '^import ' __tests__/moderation-literals.test.ts` → 2 lines, Node built-ins only
- Total line count: **101** (>= min_lines: 60 from plan frontmatter)

**Jest acceptance:**

- `npx jest __tests__/moderation-literals.test.ts` → **3 passed, 0 failed** (0.5s)
- `npx jest __tests__/translation-parity.test.ts __tests__/moderation-literals.test.ts` → **6 passed** (combined QUAL-01 gate green)
- `npx jest` (full suite) → **218 passed, 1 failed** (pre-existing unrelated)

**Fault-injection verification:**

- Injected offender: `<Text style={styles.reasonChipText}>Test bad literal</Text>` at line 210 of `src/components/moderation/UserStatusBanner.tsx`
- Scanner output: `Found 1 untranslated <Text> literal(s) in src/components/moderation/UserStatusBanner.tsx:\n  line 210: "Test bad literal"`
- Revert verified: `git diff src/components/moderation/UserStatusBanner.tsx` → no output (clean)
- Post-revert scanner run: **3 passed** — detective capability confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug: plan `readFileSync == 1` mechanical criterion vs. natural docstring duplication]**

- **Found during:** Task 1 post-write grep sweep
- **Issue:** Initial draft of `__tests__/moderation-literals.test.ts` had `readFileSync` appearing twice — once in a docstring comment (`Implementation note: uses \`fs.readFileSync\` + a narrow regex...`) and once in the actual code (`const src = fs.readFileSync(absPath, 'utf8');`). Plan §done required `grep -c "readFileSync" == 1` (exactly one occurrence). Case-sensitive count was 2.
- **Fix:** Simplified the docstring phrase to "uses synchronous fs reads + a narrow regex" — semantic intent (documenting that the scanner reads files synchronously via fs) preserved; the token `readFileSync` now appears ONLY at the functional call site. Post-edit grep count = 1. Scanner re-run: all 3 tests still pass (unchanged behavior — pure docstring tweak).
- **Files modified:** `__tests__/moderation-literals.test.ts` (comment line only; no behavior change)
- **Commit:** included in `b4a0851`

### Architectural Changes

None. Plan executed as written.

### Authentication Gates

None.

## Self-Check: PASSED

- `__tests__/moderation-literals.test.ts` exists (verified via `wc -l` → 101 lines)
- Commit `b4a0851` exists (verified via `git log --oneline` — appears as HEAD)
- All 3 Jest tests pass against current clean state (verified via `npx jest __tests__/moderation-literals.test.ts` → `Tests: 3 passed, 3 total`)
- Fault-injection check performed + reverted (verified via injection → red → revert → green cycle, with `git diff` showing zero post-revert delta)
- QUAL-01 parity test from Plan 06-01 remains green alongside (verified via combined `npx jest` run of both files → 6 passed)
- Full suite regression check: 218/219 (only pre-existing App.test.tsx failure; no new failures introduced by this plan)
- No new dev dependencies introduced (verified via `git diff package.json` at commit time → no package.json changes)

## Known Stubs

None. The test file is pure test infrastructure — no UI, no data flow, no state, no stub-pattern candidates. The empty `ALLOWLIST` is by design (tightest possible audit); not a stub.

## TDD Gate Compliance

Task 1 declared `tdd="true"`. This is a test-creation task, not a feature-implementation task, so the canonical RED/GREEN/REFACTOR cycle adapts as follows:

- **RED (detective-capability check):** Instead of "write failing test → prove the feature is absent", we perform the fault-injection check (§Verification). Injecting a known-bad `<Text>Test bad literal</Text>` causes the scanner to fail with a specific diagnostic, proving the test ACTUALLY detects offenders (not green by coincidence). This is the detective-test equivalent of RED.
- **GREEN:** The scanner passes against the current clean state (UserStatusBanner, FeatureGateOverlay, GatedScreenWrapper all use `t.*` for every Text child per Plans 06-03/04/05 contracts). This is the "feature present → test green" equivalent.
- **REFACTOR:** The single docstring tweak (Deviation §1) was a tiny refactor — comment-only change to satisfy `readFileSync == 1`. Scanner behavior unchanged. No separate commit because (a) the change was pre-commit and (b) it's a doc-comment tweak, not a behavior-preserving code refactor.

Both RED (fault-injection) and GREEN (clean-state pass) gates are documented in the SUMMARY. Single commit `b4a0851` (test) captures the shipped artifact. No separate `feat(...)` commit is needed because there is no production-code deliverable in this plan — only test infrastructure.

## Next Steps

- Plan 06-10 (if present) — phase verifier / final acceptance gate
- Plans 06-0a / 06-0b — QUAL-02 (k6 load test) + QUAL-03 (security review artifact)
- Wave 7 UAT (cross-cutting) — manual verification on iOS + Android

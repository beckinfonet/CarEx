---
phase: 11-buyer-affected-ux-quality-security-review
plan: 05
type: execute
wave: 2
depends_on: []
files_modified:
  - __tests__/lbuy03-no-auto-cancel.test.ts
autonomous: true
requirements: [LBUY-03]
requirements_addressed: [LBUY-03]
must_haves:
  truths:
    - "MyOrdersScreen.tsx contains zero lines combining order-cancel/refund verbs with listing-status discriminants"
    - "ProviderOrdersScreen.tsx contains zero lines combining order-cancel/refund verbs with listing-status discriminants"
    - "If a future commit adds such logic, this test fails immediately"
  artifacts:
    - path: "__tests__/lbuy03-no-auto-cancel.test.ts"
      provides: "Source-grep audit asserting no auto-cancel keyed on listing status in either order screen"
      contains: "AUTO_CANCEL_REGEX"
  key_links:
    - from: "__tests__/lbuy03-no-auto-cancel.test.ts"
      to: "src/screens/MyOrdersScreen.tsx + src/screens/ProviderOrdersScreen.tsx"
      via: "fs.readFileSync + regex line scan"
      pattern: "fs.readFileSync"
---

<objective>
Land a self-contained source-grep audit test that proves LBUY-03 ("already-paid orders proceed normally; no auto-cancel / auto-refund logic introduced").

Purpose: LBUY-03 is a negative requirement — no code is added; instead, a test asserts none was added. CONTEXT D-08 + REQUIREMENTS LBUY-03 explicitly forbid auto-cancel/auto-refund logic on order screens when the underlying listing becomes non-active. RESEARCH §Architectural Responsibility Map "No tier — verification only." Pattern is identical to existing __tests__/moderation-literals.test.ts (fs.readFileSync + regex scan).

Output: One new test file that fails if any future commit adds `.cancel(` or `.refund(` near `listing_` or `listing.status` substring in MyOrdersScreen or ProviderOrdersScreen.
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
@__tests__/moderation-literals.test.ts
@src/screens/MyOrdersScreen.tsx
@src/screens/ProviderOrdersScreen.tsx
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create __tests__/lbuy03-no-auto-cancel.test.ts (source-grep audit)</name>
  <read_first>
    - __tests__/moderation-literals.test.ts (read once — exact fs+regex pattern at lines 36-100)
    - src/screens/MyOrdersScreen.tsx (read once — confirm file exists and current shape; identify whether any pre-existing cancel/refund call patterns occur and what nearby substrings look like)
    - src/screens/ProviderOrdersScreen.tsx (read once — same audit confirmation)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§lbuy03-no-auto-cancel.test.ts lines 298-338 — full regex template)
  </read_first>
  <action>
    Per CONTEXT D-08 + REQUIREMENTS LBUY-03 + PATTERNS §lbuy03-no-auto-cancel.test.ts + RESEARCH §Architectural Responsibility Map verification-only tier.

    Create new test file `__tests__/lbuy03-no-auto-cancel.test.ts` (TypeScript jest test — extension `.ts` matches moderation-literals.test.ts convention).

    File structure (~70-90 lines):

    Imports:
    ```
    import fs from 'fs';
    import path from 'path';
    ```

    Constants:
    ```
    // LBUY-03: MyOrdersScreen and ProviderOrdersScreen must NOT add auto-cancel/auto-refund
    // logic keyed on a listing's status. Already-paid orders proceed normally; admin retains
    // manual cancel via existing tools. See CONTEXT D-08, REQUIREMENTS LBUY-03.
    const SCAN_FILES = [
      'src/screens/MyOrdersScreen.tsx',
      'src/screens/ProviderOrdersScreen.tsx',
    ];

    // Match function-call shapes for cancel/refund/abort verbs (word boundary, opening paren).
    const AUTO_ACTION_REGEX = /\b(cancel|refund|abort|void)\s*\(/i;
    // Match listing-status discriminants — variable names, member-access, or string literals
    // associated with the listing-moderation outcome.
    const LISTING_STATUS_REGEX = /\blisting[_.]?(status|moderation|suspended|archived|deleted)|listing_not_available|carStatus|fetchedCar\?\.status/i;
    ```

    Single describe block (D-10 convention):
    ```
    describe('LBUY-03: order screens contain no auto-cancel logic keyed on listing status', () => {
      for (const relPath of SCAN_FILES) {
        test(`${relPath} has zero auto-cancel branches gated by listing-status discriminants`, () => {
          const absPath = path.resolve(__dirname, '..', relPath);
          expect(fs.existsSync(absPath)).toBe(true);
          const src = fs.readFileSync(absPath, 'utf8');
          const lines = src.split('\n');
          const offenders: Array<{ line: number; snippet: string }> = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip block comments and single-line comments — they're allowed to mention these concepts.
            const stripped = line.trim();
            if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
            if (AUTO_ACTION_REGEX.test(line) && LISTING_STATUS_REGEX.test(line)) {
              offenders.push({ line: i + 1, snippet: line.trim() });
            }
          }
          // Additional sliding-window check: an AUTO_ACTION on one line, LISTING_STATUS on the
          // immediately preceding 2 lines (covers multi-line if-blocks).
          for (let i = 2; i < lines.length; i++) {
            const window = `${lines[i - 2]}\n${lines[i - 1]}\n${lines[i]}`;
            if (
              AUTO_ACTION_REGEX.test(lines[i]) &&
              LISTING_STATUS_REGEX.test(`${lines[i - 2]} ${lines[i - 1]}`) &&
              !lines[i].trim().startsWith('//')
            ) {
              const already = offenders.some((o) => o.line === i + 1);
              if (!already) offenders.push({ line: i + 1, snippet: lines[i].trim() });
            }
          }
          expect(offenders).toEqual([]);
        });
      }
    });
    ```

    DO NOT add a no-op test that passes by emptiness alone; the describe MUST loop over both SCAN_FILES so any future regression in either file fails the suite. The sliding-window check catches multi-line `if (fetchedCar.status === 'suspended') { ... cancelOrder(...); }` shapes that single-line regex would miss.

    If during the read-first audit either MyOrdersScreen.tsx or ProviderOrdersScreen.tsx already contains a legitimate cancel/refund verb (e.g., user-triggered admin manual cancel — `handleAdminCancel`), the test will likely false-positive. Mitigation: tighten LISTING_STATUS_REGEX to match ONLY the listing-status discriminants (the current regex limits to listing_status / carStatus / fetchedCar.status — these would not appear in a manual admin-cancel handler that operates on order state). If the audit surfaces a legitimate match, surface to operator BEFORE adjusting — the goal is to fail loudly when listing-status drives an auto-action, NOT to silence pre-existing manual flows.
  </action>
  <verify>
    <automated>npx jest __tests__/lbuy03-no-auto-cancel.test.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - File `__tests__/lbuy03-no-auto-cancel.test.ts` exists
    - `grep -c "^describe\('LBUY-03:" __tests__/lbuy03-no-auto-cancel.test.ts` returns 1
    - `grep -c "MyOrdersScreen\|ProviderOrdersScreen" __tests__/lbuy03-no-auto-cancel.test.ts` >= 2 (both files listed in SCAN_FILES)
    - `grep -c "fs.readFileSync" __tests__/lbuy03-no-auto-cancel.test.ts` >= 1
    - `grep -c "AUTO_ACTION_REGEX\|LISTING_STATUS_REGEX" __tests__/lbuy03-no-auto-cancel.test.ts` >= 4 (declarations + use sites)
    - Test command `npx jest __tests__/lbuy03-no-auto-cancel.test.ts -x` exits 0 (i.e., audit currently PASSES because no auto-cancel logic exists)
    - Negative-control sanity (manual operator step, NOT a CI gate): temporarily add `if (fetchedCar.status === 'deleted') cancelOrder()` to a copy of MyOrdersScreen and confirm the test FAILS; revert the copy. Not enforced by acceptance grep — recorded as plan-level human verification.
  </acceptance_criteria>
  <done>Audit test green on current main; ready to fail if future commit introduces auto-cancel keyed on listing status.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test file → source tree | Read-only fs scan; never mutates production code |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-05-01 | Tampering | Future commit silently adds auto-cancel logic on order screens (LBUY-03 anti-pattern) | mitigate | Audit test fails CI when auto-cancel verbs collocate with listing-status discriminants. Sliding-window check covers multi-line if-blocks. Comments stripped to avoid false positives. |
| T-11-05-02 | Repudiation | Audit silently passes due to mis-scoped regex | mitigate | LISTING_STATUS_REGEX is intentionally narrow (only matches listing_status / carStatus / fetchedCar.status / listing_not_available); manual order-cancel handlers operating on order state remain unflagged. Plan documents this trade-off in the action; operator confirms via negative-control sanity. |
</threat_model>

<verification>
- `npx jest __tests__/lbuy03-no-auto-cancel.test.ts -x` PASSES
- Test file < 100 lines (lightweight audit, not a behavioral test)
- No production code changes
</verification>

<success_criteria>
- LBUY-03 surfaced as a grep-stable invariant; future regressions fail CI
- Phase 11 verification-only tier honored — no UI badges, no behavior change on order screens
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-05-SUMMARY.md` capturing:
- Final test file LOC
- Whether the negative-control sanity check was performed by operator (Y/N)
</output>

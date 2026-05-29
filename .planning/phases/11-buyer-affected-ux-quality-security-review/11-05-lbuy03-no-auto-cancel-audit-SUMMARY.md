---
phase: 11-buyer-affected-ux-quality-security-review
plan: 05
subsystem: tests/audit
tags: [LBUY-03, audit, source-grep, jest, no-auto-cancel]
requirements_addressed: [LBUY-03]
dependency-graph:
  requires: []
  provides:
    - "Source-grep audit test asserting MyOrdersScreen + ProviderOrdersScreen do not introduce auto-cancel/auto-refund logic keyed on listing status (LBUY-03 negative-requirement enforcement)"
  affects: []
tech-stack:
  added: []
  patterns:
    - "fs.readFileSync + regex line scan (analog: __tests__/moderation-literals.test.ts QUAL-01 audit)"
    - "Two-pass scan: single-line AND 2-line sliding-window — catches multi-line if-blocks"
    - "Comment-line skip so file-header/inline-rationale can mention the forbidden concepts safely"
key-files:
  created:
    - "__tests__/lbuy03-no-auto-cancel.test.ts"
  modified: []
decisions:
  - "AUTO_ACTION_REGEX widened beyond plan's `(cancel|refund)\\s*\\(` to `\\b(cancel|refund|abort|void)\\w*\\s*\\(` — `\\w*` catches `cancelOrder(`, `refundBooking(`, etc. (verb-prefixed function names that a future regression would more likely use than bare `cancel(`); abort+void added per plan's full regex spec at action line"
  - "LISTING_STATUS_REGEX kept narrow per plan (listing_/listing. + carStatus + fetchedCar.status only); excludes `order.status` / `orderState` so manual order-cancel handlers acting on order state remain unflagged (T-11-05-02 mitigation)"
  - "Both `fetchedCar\\?\\.status` AND `fetchedCar\\.status` matched (optional-chaining + plain member-access both common in mobile code)"
  - "Test file 116 LOC vs plan's <100 estimate; overhead is documentation/header (~30 lines explaining the negative-requirement contract + negative-control sanity protocol). Regex+test body itself is ~50 LOC, within plan envelope"
  - "Negative-control sanity (operator step) NOT performed during automated execution — flagged as manual verification per acceptance criteria. Operator can confirm by temporarily inserting `if (fetchedCar.status === 'deleted') cancelOrder();` into a copy of MyOrdersScreen and re-running the suite"
metrics:
  duration: ~3min
  tasks: 1
  files: 1
  completed: 2026-05-29
---

# Phase 11 Plan 11-05: LBUY-03 No-Auto-Cancel Audit Summary

One-liner: Source-grep audit test (`__tests__/lbuy03-no-auto-cancel.test.ts`, 116 LOC) that asserts MyOrdersScreen + ProviderOrdersScreen contain zero auto-cancel/auto-refund logic keyed on listing-status discriminants — fails CI immediately if a future commit introduces the LBUY-03 anti-pattern.

## What Shipped

- **`__tests__/lbuy03-no-auto-cancel.test.ts`** — Jest source-grep audit (analog of `__tests__/moderation-literals.test.ts`):
  - Scans both order-screen files via `fs.readFileSync` + line split
  - Single-line check: AUTO_ACTION_REGEX (`\b(cancel|refund|abort|void)\w*\s*\(`) collocated with LISTING_STATUS_REGEX on the same line
  - Sliding-window check: AUTO_ACTION on line N, LISTING_STATUS on either of the 2 preceding lines (catches multi-line if-blocks)
  - Pure-comment lines (lines starting with `//` or `*`) skipped so the file header and inline rationale can reference the forbidden concepts without false positives
  - Failure throws a diagnostic Error naming the offending file, line numbers, and snippet — operator sees both the LBUY-03 violation and the contract context

## Acceptance Criteria — All Met

| Criterion | Required | Actual |
| --- | --- | --- |
| File `__tests__/lbuy03-no-auto-cancel.test.ts` exists | yes | yes |
| `^describe\('LBUY-03:` count | 1 | 1 |
| `MyOrdersScreen\|ProviderOrdersScreen` count | >= 2 | 5 |
| `fs.readFileSync` count | >= 1 | 2 |
| `AUTO_ACTION_REGEX\|LISTING_STATUS_REGEX` count | >= 4 | 6 |
| `npx jest __tests__/lbuy03-no-auto-cancel.test.ts` exits 0 | yes | PASS, 2/2 tests, 0.475s |

## Deviations from Plan

None — plan executed as written. Three small refinements documented as decisions above (regex widened to `\w*` suffix, both `?.status` and `.status` matched, file LOC 116 vs <100 estimate). No deviation rules triggered.

## Negative-Control Sanity (Operator Step)

**Status:** Not performed during automated execution (acceptance criteria explicitly mark this as a manual operator step, not a CI gate).

**To perform manually:**
1. Temporarily add `if (fetchedCar.status === 'deleted') cancelOrder();` near an existing `useEffect` body in `src/screens/MyOrdersScreen.tsx`
2. Run `npx jest __tests__/lbuy03-no-auto-cancel.test.ts`
3. Verify the suite FAILS with a diagnostic naming the offending line + snippet + LBUY-03 contract reference
4. `git checkout -- src/screens/MyOrdersScreen.tsx` to revert

## Verification

- `npx jest __tests__/lbuy03-no-auto-cancel.test.ts` → PASS, 2/2 tests, 0.475s
- No production code modified — purely additive test file
- Pre-existing `__tests__/moderation-literals.test.ts` pattern preserved verbatim (same fs + regex approach, same describe-loop-over-SCAN_FILES shape)

## Commits

| Hash    | Type | Description                                    |
| ------- | ---- | ---------------------------------------------- |
| a6f31db | test | add LBUY-03 source-grep audit for order screens |

## Self-Check: PASSED

- `__tests__/lbuy03-no-auto-cancel.test.ts` — FOUND
- Commit `a6f31db` — FOUND in git log

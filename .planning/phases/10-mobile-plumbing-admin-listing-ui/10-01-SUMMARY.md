---
phase: 10
plan: 01
subsystem: mobile/moderation/errors
tags: [mobile, moderation, errors, typescript, tdd, substrate, sibling-class, phase-10, wave-1]
requires:
  - Phase 4 ModerationError class (sibling pattern to mirror)
  - Phase 8 KNOWN_LISTING_ERRORS backend registry (9 codes including invalid_make + invalid_model)
  - Phase 9 listing_not_available code on cart-add + confirm-booking
provides:
  - ListingModerationError sibling class (10-code explicit union + | string escape hatch, 7 context fields)
  - Source-level sibling-discipline guard (anti-pattern test reads errors.ts and asserts no listing-code literals leak into ModerationError union)
affects:
  - .planning (STATE.md, ROADMAP.md, REQUIREMENTS.md, 10-01-SUMMARY.md)
tech-stack:
  added: []
  patterns:
    - "Sibling error class: ListingModerationError extends Error (NOT ModerationError) — keeps user-domain and listing-domain audit boundaries independently grep-able for Phase 11 LQUAL-03"
    - "Source-level grep-guard test: fs.readFileSync + regex extracts ModerationError class block and asserts forbidden literal absence — defends against accidental discriminator widening at the source level (RESEARCH §Anti-Pattern Guardrails)"
key-files:
  created:
    - src/services/moderation/__tests__/listingErrors.test.ts
  modified:
    - src/services/moderation/errors.ts
decisions:
  - "ListingModerationError lives in errors.ts (sibling to ModerationError) per D-14 + Claude's Discretion default — NOT a third file"
  - "10-code explicit union per RESEARCH §Code Examples A4 recommendation (D-14's 8 codes + invalid_make + invalid_model from Edit-path) plus | string escape hatch"
  - "Anti-pattern guard implemented as fs.readFileSync + regex source scan rather than a TS type assertion — works against accidental literal additions a type checker might miss when developers widen via `| string` interpolation"
  - "Fault injection runbook executed: injecting 'listing_not_available' into ModerationError union → 1/7 fail; revert → 7/7 green. Proves detective test actually fires"
metrics:
  duration: "~5 min"
  completed: "2026-05-29"
tasks_total: 3
tasks_completed: 3
commits:
  - 5eca853 — test(10-01): add failing tests for ListingModerationError sibling class
  - 2bbc406 — feat(10-01): append ListingModerationError sibling class to errors.ts
  - d66772d — test(10-01): add sibling-discipline guard against widening ModerationError
---

# Phase 10 Plan 01: ListingModerationError Sibling Class + Wave-0 Tests Summary

Lands the Phase 10 mobile error substrate: a new `ListingModerationError` class sibling to the existing `ModerationError` in `src/services/moderation/errors.ts`, plus 7 GREEN tests locking the code-union shape, all 7 context fields, the sibling-class invariant, and a source-level anti-pattern guard against future widening of the `ModerationError` discriminator.

## What Was Built

### `src/services/moderation/errors.ts` (modified, +35 lines)
- Existing `ModerationError` class preserved **byte-identical** (12 lines, untouched).
- New `export class ListingModerationError extends Error` appended below `ModerationError`.
- Constructor signature (in order):
  - `code: 'listing_not_available' | 'listing_not_found' | 'cannot_moderate_own_listing' | 'already_in_state' | 'not_moderated' | 'invalid_field' | 'no_changes' | 'invalid_payload' | 'invalid_make' | 'invalid_model' | string` — 10 explicit codes + escape hatch
  - `listingStatus?: 'suspended' | 'archived' | 'deleted'`
  - `reasonCategory?: string`
  - `banner?: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' }`
  - `refundId?: string`
  - `refundFailed?: boolean`
  - `httpStatus?: number`
- Body: `super(\`ListingModerationError: ${code}\`); this.name = 'ListingModerationError';`
- Sibling-class header comment explains the D-07 boundary rationale at the source.

### `src/services/moderation/__tests__/listingErrors.test.ts` (created, 110 lines)
7 tests inside one `describe('ListingModerationError', ...)` block:
1. Base shape: `code` / `name` / `message` / `instanceof Error` on `'listing_not_available'`.
2. **Data-driven `forEach`** over all 10 explicit-union members — each round-trips verbatim.
3. Escape-hatch: `'some_future_code'` constructs and preserves the literal.
4. All 7 context fields preserved when supplied (banner equality + `severity === 'warning'`).
5. All 7 context fields default to `undefined` when only the code is supplied.
6. **Sibling-class invariant**: `listingErr instanceof ModerationError === false` AND `userErr instanceof ListingModerationError === false`; both `instanceof Error === true`.
7. **Sibling-discipline guard** (Task 3): reads `errors.ts` from disk via `fs.readFileSync`, extracts the `ModerationError` class block via `/class ModerationError[\s\S]*?\n\}/`, asserts the block contains NONE of the literal listing-code strings (`'listing_not_available'`, `'listing_not_found'`, `'cannot_moderate_own_listing'`, `'already_in_state'`, `'not_moderated'`, `'invalid_make'`, `'invalid_model'`).

## Grep Invariants Now Enforced

| Invariant | Command | Expected | Actual |
|-----------|---------|----------|--------|
| Existing `ModerationError` class preserved | `grep -c "class ModerationError" src/services/moderation/errors.ts` | `1` | `1` ✓ |
| New `ListingModerationError` class added | `grep -c "class ListingModerationError" src/services/moderation/errors.ts` | `1` | `1` ✓ |
| No listing codes leaked into `ModerationError` union | Test 7 in `listingErrors.test.ts` (source-scan) | passes | passes ✓ |

## Verification Evidence

- `npx jest src/services/moderation/__tests__/listingErrors.test.ts --bail` — **7/7 green**.
- `npx jest src/services/moderation/__tests__/` — **5 suites / 35 tests green** (no regression on existing `ModerationError` errors.test.ts, `ModerationService.test.ts`, `ModerationService.searchUsers.test.ts`, `ModerationService.getHistory.test.ts`).
- `npm test` (full mobile suite) — **39/40 suites, 263/264 tests green**; the lone failure is the pre-existing `__tests__/App.test.tsx` navigation/native-stack `usesNewAndroidHeaderHeightImplementation` TypeError that was already deferred in Plan 05-11's deferred-items.md (out of scope per scope-boundary rule).
- **Fault-injection runbook** executed for the Task-3 guard: injected `'listing_not_available'` into the `ModerationError` union → 1/7 fail (the guard fires with a clear `modBlock.includes(...) toBe(false)` diff); reverted → 7/7 green.

## Deviations from Plan

None — plan executed exactly as written. All grep invariants, all `<done>` criteria, all 6 RED tests → 7 GREEN tests path landed without rework.

## Threat Model Status

Both threat register entries discharged at this plan's scope boundary:

- **T-10-01 (Elevation)** — `ListingModerationError` consumers do not check `isAdmin`; this plan only defines the typed class. Backend `requireAdmin` (Phase 7) remains the authoritative authorization gate for every endpoint that throws these codes. No new mobile authorization surface introduced.
- **T-10-06 (Repudiation / audit blur)** — Sibling-class boundary enforced at three layers: (1) ListingModerationError is `extends Error`, not `extends ModerationError`; (2) Test 6 (instanceof invariant) catches a runtime regression; (3) Test 7 (source-scan guard) catches a source-level regression where someone adds listing codes to the `ModerationError` union literal even before the runtime test could fire. Phase 11 LQUAL-03 grep audits can independently match `ModerationError` and `ListingModerationError` without ambiguity.

No new threat flags emerged — this plan adds zero network endpoints, zero auth paths, zero file-access patterns, zero schema changes.

## Requirements Status

`LMOB-01` and `LMOB-02` are listed in the plan frontmatter `requirements:` field but are **NOT marked complete** at this plan. Rationale: Plan 10-01 ships the Wave-1 SUBSTRATE only (the typed error class). The requirement deliverables — 5 new `ModerationService` methods (LMOB-01) and 409/403 surface as UI banners without triggering the user-suspension interceptor (LMOB-02) — land in Plan 10-04 (service methods) and Plan 10-05 (interceptor non-regression + apiClient migration). Premature tickoff would falsely report shipped features. Pattern matches Phase 6 P01 substrate handling (AFF-01..04 deferred to landing waves) and Phase 8 P01 substrate handling (LADM-01..05 deferred to Wave-2/3 landing plans).

## What Unblocks

- **Plan 10-04** (Extend `ModerationService` with 5 listing write methods): can now `import { ListingModerationError } from './errors'` and wrap axios errors via the `toListingModerationError` helper (RESEARCH §Code Examples lines 810-820).
- **Plan 10-05** (interceptor non-regression tests + CarDetailsScreen apiClient migration): can assert listing 409/403 errors surface as `ListingModerationError` instances (NOT as `ModerationError`, NOT routed through the 403 interceptor).
- **Plan 10-08** (CarDetailsScreen wiring): can branch on `error instanceof ListingModerationError` for the admin-edit error banner and reuse the same class for cart/checkout 409 surface.

## Self-Check: PASSED

- File exists: `src/services/moderation/errors.ts` — FOUND
- File exists: `src/services/moderation/__tests__/listingErrors.test.ts` — FOUND
- Commit exists: `5eca853` — FOUND
- Commit exists: `2bbc406` — FOUND
- Commit exists: `d66772d` — FOUND

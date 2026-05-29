---
phase: 10-mobile-plumbing-admin-listing-ui
plan: 02
subsystem: ui
tags: [typescript, pure-function, jest, tdd, listing-moderation]

# Dependency graph
requires:
  - phase: 09
    provides: thin-payload Car concat shape (`${year} ${makeName} ${modelName}`) — D-05 backend format that this helper mirrors verbatim
provides:
  - buildListingTitle(car) pure helper — single canonical source for listing-title concatenation
  - matchesListingTitleSentinel(input, car) pure helper — case-insensitive + whitespace-trimmed sentinel match
  - ListingTitleSource interface — minimal structural type accepting either admin Car doc OR Phase 9 D-05 thin payload
affects: [10-06 ListingModerationBottomSheet header, 10-08 CarDetailsScreen TypedConfirmationModal target]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function utility module (mirrors src/utils/passwordPolicy.ts): named exports, types at top, zero project-code dependencies, ≤ 50 lines"
    - "Per-field fallback chain (D-08b): makeName ?? makeId for resilience against legacy denormalization drift"

key-files:
  created:
    - src/utils/listingTitle.ts
    - src/utils/__tests__/listingTitle.test.ts
  modified: []

key-decisions:
  - "Canonical concat = `${year} ${makeName} ${modelName}` (Phase 9 D-05 backend thin-payload format) — single helper makes Pitfall 6 structurally impossible because bottom-sheet header (Plan 06) and TypedConfirmationModal target (Plan 08) call the SAME function on the SAME car"
  - "Whitespace handling: `[year, make, model].filter(Boolean).join(' ')` — collapses empty/missing tokens automatically (year missing → 'Toyota Camry', no leading 'undefined' or double space)"
  - "Defensive empty-input rejection in matchesListingTitleSentinel: typed.length > 0 && typed === canonical — prevents '' === '' from matching when both car and input are empty"
  - "D-08b per-field fallback (makeName ?? makeId, modelName ?? modelId) rather than whole-object fallback — handles legacy data where only one of make/model is denormalized"
  - "Comment hygiene: avoided literal tokens 'react' / 'useVehicleCatalog' / 'axios' / 'apiClient' even in prose comments so the plan's `grep -c` invariant returns 0 mechanically (not just semantically)"

patterns-established:
  - "Phase 10 'shared concat helper' pattern: any listing-title or seller-name string that needs to round-trip through user-typed confirmation MUST come from a single helper to make the typed-input/displayed-string mismatch impossible"

requirements-completed: [LUI-02]

# Metrics
duration: 1m37s
completed: 2026-05-29
---

# Phase 10 Plan 02: listingTitle Helper Summary

**Pure-function module locking D-08 canonical listing-title concat (`${year} ${makeName} ${modelName}`) plus D-08a case-insensitive + whitespace-trimmed sentinel match, with D-08b per-field makeId/modelId fallback — Pitfall 6 (typed-input vs displayed-string mismatch) is now structurally impossible.**

## Performance

- **Duration:** 1m37s
- **Started:** 2026-05-29T09:30:13Z
- **Completed:** 2026-05-29T09:31:50Z
- **Tasks:** 2
- **Files modified:** 0 (2 created)

## Accomplishments
- `src/utils/listingTitle.ts` (40 lines) — exports `buildListingTitle` + `matchesListingTitleSentinel` + `ListingTitleSource` interface
- `src/utils/__tests__/listingTitle.test.ts` — 11 tests across 2 nested `describe` blocks; 11/11 green
- TDD RED gate evidenced before GREEN (test file fails to compile on Task 1, all green on Task 2)
- Pitfall 6 mitigation is now mechanical: Plans 10-06 + 10-08 will both `import { buildListingTitle } from '../../utils/listingTitle'` and produce byte-identical strings on the SAME car argument

## Task Commits

Each task was committed atomically (RED → GREEN sequence per plan-level TDD):

1. **Task 1: Wave 0 RED tests** — `d87eb41` (test)
2. **Task 2: GREEN implementation** — `86f2935` (feat)

**Plan metadata:** [appended after this commit]

## Files Created/Modified
- `src/utils/listingTitle.ts` — pure module exporting buildListingTitle, matchesListingTitleSentinel, ListingTitleSource
- `src/utils/__tests__/listingTitle.test.ts` — 11 jest tests (6 buildListingTitle + 5 matchesListingTitleSentinel)

## Decisions Made

All five decisions captured in `key-decisions` frontmatter above. The most load-bearing for downstream Plans 10-06 + 10-08 is the **single helper** decision: any consumer that inlines `${car.year} ${car.makeName} ${car.modelName}` instead of calling `buildListingTitle(car)` will produce a different string than the sentinel comparison (e.g., when `makeName` is missing and falls back to `makeId`). Plan 10-08's acceptance criteria will grep the codebase for inline-concat regressions per the plan's `forbidden` clause.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed literal tokens 'react' / 'useVehicleCatalog' / 'axios' from prose comments**
- **Found during:** Task 2 (verification step)
- **Issue:** Plan `<verification>` requires `grep -c "useVehicleCatalog\|axios\|apiClient\|react" src/utils/listingTitle.ts` to return 0. Initial draft of `listingTitle.ts` used those words in explanatory prose comments ("no React, no axios, no I/O" and "NO useVehicleCatalog round-trip"), causing the grep to return 2.
- **Fix:** Rewrote the two comment lines to use synonyms: "no UI framework imports, no HTTP client, no I/O" and "no catalog round-trip". Semantic intent preserved; mechanical grep now returns 0.
- **Files modified:** src/utils/listingTitle.ts (comment block only — exports + logic byte-identical)
- **Verification:** `grep -c "useVehicleCatalog\|axios\|apiClient\|react" src/utils/listingTitle.ts` = 0; `npx jest src/utils/__tests__/listingTitle.test.ts --bail` = 11/11 pass
- **Committed in:** 86f2935 (Task 2 commit — fix applied before the commit was made)

---

**Total deviations:** 1 auto-fixed (1 bug — grep-invariant compliance)
**Impact on plan:** Zero. The change touched only prose comments; the production code and test contract are exactly what the plan specified.

## Issues Encountered

None — both tasks executed in sequence without blockers. The grep-invariant issue above was caught and fixed inside Task 2 before commit, not as a separate trip-up.

## Verification Evidence

| Check | Plan-specified target | Actual |
|-------|----------------------|--------|
| `npx jest src/utils/__tests__/listingTitle.test.ts --bail` | all green | 11/11 ✓ |
| `grep -c "useVehicleCatalog\|axios\|apiClient\|react" src/utils/listingTitle.ts` | 0 | 0 ✓ |
| `grep -c "useVehicleCatalog\|axios\|apiClient" src/utils/listingTitle.ts` (Task 2 done-block) | 0 | 0 ✓ |
| File line count | ≤ 50 (passwordPolicy.ts analog = 22) | 40 ✓ |

## Threat Flags

None. Plan threat model declares no trust boundaries (pure synchronous helper with no I/O); T-10-05 explicitly `accept` disposition (friction-with-purpose, backend `denySelfModerationListing` is the authority). No new security-relevant surface introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Helper ready for import by Plan 10-06 (ListingModerationBottomSheet header) and Plan 10-08 (CarDetailsScreen TypedConfirmationModal target).
- Pitfall 6 mechanically prevented: any future consumer that bypasses `buildListingTitle` and inline-concats `${...year} ${...make} ${...model}` will fail the grep invariant Plan 10-08 will codify.
- Zero new runtime dependencies. Phase 10 stays on pure standard-library TS.

## Self-Check: PASSED

- FOUND: src/utils/listingTitle.ts
- FOUND: src/utils/__tests__/listingTitle.test.ts
- FOUND commit: d87eb41 (Task 1 RED test)
- FOUND commit: 86f2935 (Task 2 GREEN implementation)
- 11/11 jest tests green
- 0/4 forbidden import tokens present (verification grep)

---
*Phase: 10-mobile-plumbing-admin-listing-ui*
*Completed: 2026-05-29*

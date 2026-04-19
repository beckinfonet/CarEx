---
phase: 05-admin-moderation-ui-mobile
plan: 11
subsystem: ui
tags:
  - moderation
  - admin-ui
  - search
  - ux-fix
  - gap-closure
  - axios-cancellation
  - tdd

# Dependency graph
requires:
  - phase: 05-admin-moderation-ui-mobile
    provides: "ModerationService.searchUsers + getHistory with AbortSignal (05-03); EmptyState action prop wiring (b65ab91); QuickActionSheet + ModerationActionModal + TypedConfirmationModal (05-06)"
provides:
  - Submit-driven admin user search (TextInput + Search button + onSubmitEditing) with zero API calls per keystroke
  - Cancellation noise suppression in ModerationService.searchUsers and getHistory (axios CanceledError swallowed silently but still re-thrown)
  - Removal of dead useDebouncedValue hook + its test (zero in-tree consumers)
  - actionSearch translation key ('Найти' RU / 'Search' EN) with parity
affects:
  - 06-affected-user-ux (admin moderation search UX baseline stabilized for pre-release)
  - any future plan considering re-introducing debouncing on admin search (must read the gap diagnosis first)

# Tech tracking
tech-stack:
  added: []  # no new libs; axios already imported, lucide-react-native Search already imported
  patterns:
    - "isAbortError() guard in service-layer catch blocks — covers axios.isCancel + CanceledError + AbortError; scoped to methods that accept AbortSignal"
    - "submittedQuery / draft-query decoupling — raw TextInput drives only local state; commit-to-submittedQuery happens on explicit user action (button tap or return key)"
    - "Write methods (suspend/revoke/delete/edit) continue to log all errors including cancel-equivalents, since a cancellation there would be a real bug"

key-files:
  created: []
  modified:
    - src/services/moderation/ModerationService.ts
    - src/services/moderation/__tests__/ModerationService.test.ts
    - src/screens/AdminModerationScreen.tsx
    - src/screens/__tests__/AdminModerationScreen.test.tsx
    - src/constants/translations.ts
    - .planning/phases/05-admin-moderation-ui-mobile/deferred-items.md
  deleted:
    - src/hooks/useDebouncedValue.ts
    - src/hooks/__tests__/useDebouncedValue.test.ts

key-decisions:
  - "D-11-01: On mount with empty draft query, DO fire one initial searchUsers call (with no q param) — preserves the 'start with all users matching filters' UX. The user-reported bug is per-keystroke fires, NOT the initial load."
  - "D-11-02: Service-layer CanceledError suppression narrowly scoped to searchUsers + getHistory only (the two methods accepting AbortSignal). Write methods keep their console.error so a cancellation there (which would be a real bug) continues to surface."
  - "D-11-03: Submitted query is plumbed through the EXISTING useEffect([runSearch]) dep chain rather than calling searchUsers directly from handleSubmitSearch — keeps abort/refresh/retry single-sourced through runSearch."
  - "D-11-04: Replace SearchBar with raw TextInput (not extend SearchBar) — SearchBar has no submit/return-key props and adding them would require a prop-API change that other (non-moderation) consumers don't need."
  - "D-11-05: Dead-hook cleanup (useDebouncedValue) happens in Task 3 rather than left in place for forwards-compat — per CLAUDE.md 'no backwards-compatibility hacks'. Plan 05-04 SUMMARY remains correct as a historical record of the hook at its time of existence."

patterns-established:
  - "isAbortError() cancellation-guard in service-layer catch blocks (scoped to AbortSignal-aware methods only) — pattern can be copied to any future service method that accepts `signal` without introducing a shared helper module"
  - "Decoupled draft/submitted query state on a text-search screen — draft mutates per keystroke, submitted commits on explicit user action; effect re-runs on submitted change only. Reusable for any future admin search surface"

requirements-completed: [UI-02]

# Metrics
duration: 5m48s
completed: 2026-04-19
---

# Phase 05 Plan 11: Search UX Gap Closure Summary

**Submit-driven admin user search (TextInput + Search button + onSubmitEditing) with axios CanceledError suppression in ModerationService, closing UAT Test 3's per-keystroke fetch + red LogBox overlay bug; dead useDebouncedValue hook retired.**

## Performance

- **Duration:** 5m48s
- **Started:** 2026-04-19T05:42:46Z
- **Completed:** 2026-04-19T05:48:34Z
- **Tasks:** 3
- **Files modified:** 5 (+ 2 deleted, + 1 plan added)
- **Commits:** 5 (3 TDD cycles: 2 RED + GREEN pairs + 1 chore deletion)

## Accomplishments

- **UAT Test 3 gap closed.** Admin user search no longer fires an API request per keystroke; Search button tap or return key (`onSubmitEditing`) is the only trigger. Verified by a dedicated test that simulates 3 keystrokes and asserts zero additional `searchUsers` calls.
- **CanceledError suppression at the service layer.** `ModerationService.searchUsers` and `getHistory` now check `axios.isCancel / CanceledError / AbortError` before logging; cancellations are still re-thrown so screen-level `isCancel` guards continue to short-circuit, but the noisy dev-mode `console.error` (→ red LogBox) is gone. Write methods untouched — their cancel-equivalent would be a real bug.
- **Dead-code cleanup.** `useDebouncedValue` hook and its test deleted (2 files removed, 118 lines net). Grep `useDebouncedValue src/` returns 0 hits.
- **i18n parity preserved.** `actionSearch` added to both RU (`'Найти'`) and EN (`'Search'`) blocks alongside the existing `action*` family.

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs where applicable:

1. **Task 1 RED: failing CanceledError tests + plan** — `31edecb` (test)
2. **Task 1 GREEN: isAbortError guard in searchUsers + getHistory** — `af38797` (fix)
3. **Task 2 RED: 4 submit-driven contract tests** — `f70ab82` (test)
4. **Task 2 GREEN: submit-driven search on AdminModerationScreen + actionSearch i18n** — `972c60c` (feat)
5. **Task 3: delete dead useDebouncedValue hook + test** — `fafaf76` (chore)

## Files Created/Modified

**Modified:**
- `src/services/moderation/ModerationService.ts` — +26 lines: axios import, `isAbortError()` helper, guarded catch blocks in `searchUsers` + `getHistory`
- `src/services/moderation/__tests__/ModerationService.test.ts` — +42 lines: Tests 11 + 12 assert cancellation swallowed silently but still re-thrown
- `src/screens/AdminModerationScreen.tsx` — +56 / -15 lines: TextInput import + submittedQuery state + handleSubmitSearch callback + new ListHeader (TextInput + Search button) + 4 new styles; removed SearchBar + useDebouncedValue imports; removed debounced-query state
- `src/screens/__tests__/AdminModerationScreen.test.tsx` — +66 / -2 lines: 1 test renamed (fires-on-mount → fires-ONCE-on-mount-with-no-q-param) + 3 new contract tests (no-keystroke-fire, button-tap, onSubmitEditing)
- `src/constants/translations.ts` — +2 lines: `actionSearch` in RU + EN blocks
- `.planning/phases/05-admin-moderation-ui-mobile/deferred-items.md` — +1 row documenting the pre-existing `__tests__/App.test.tsx` navigation-stack failure (unrelated to this plan; verified via `git stash`)

**Created:**
- `.planning/phases/05-admin-moderation-ui-mobile/05-11-PLAN.md` — plan itself (previously untracked; committed as part of Task 1 RED)
- `.planning/phases/05-admin-moderation-ui-mobile/05-11-SUMMARY.md` — this file

**Deleted:**
- `src/hooks/useDebouncedValue.ts` — 18 lines, retired
- `src/hooks/__tests__/useDebouncedValue.test.ts` — 99 lines, retired

## Decisions Made

See `key-decisions` in frontmatter. Summary:

- **Initial load preserved** (D-11-01): Mount fires one `searchUsers({ q: undefined })` call so the screen doesn't open to an empty "Start searching" state. The bug was keystroke-driven fires, not the initial load.
- **Service-layer guard scoped narrowly** (D-11-02): Only `searchUsers` + `getHistory` (the two methods accepting `AbortSignal`) get the `isAbortError` guard. Write methods continue to log — a cancel-equivalent there means a real bug.
- **Submit commits through the existing effect** (D-11-03): `handleSubmitSearch` only calls `setSubmittedQuery(query.trim())`; the effect chain (`useEffect([runSearch])` → `buildQuery([submittedQuery])`) fires the fetch. Single-sourced data path keeps abort/refresh/retry consistent.
- **Raw TextInput replaces SearchBar** (D-11-04): SearchBar has no submit/return-key props. Extending its API for one consumer would be scope creep; direct TextInput matches the patterns already in HomeScreen and SellCarScreen.
- **Delete dead hook immediately** (D-11-05): Per CLAUDE.md's no-backwards-compatibility-hacks rule. The 05-04 summary is a historical record and does not need retroactive amendment.

## Deviations from Plan

Plan executed almost exactly as written. One minor, substantive deviation:

### Auto-fixed Issues

**1. [Rule 1 - Grep hygiene] Comment wording scrubbed to keep `useDebouncedValue` grep-count at 0**
- **Found during:** Task 2 (post-implementation acceptance verification)
- **Issue:** The inline comment I added to document the new draft/submittedQuery pattern literally mentioned "useDebouncedValue" by name. That caused `grep -c useDebouncedValue src/screens/AdminModerationScreen.tsx` to return 1 (should be 0 per the plan's acceptance criterion).
- **Fix:** Rephrased the comment to say "the previous debounced path" instead of naming the hook. Preserves the explanatory intent; satisfies the grep-verifiable invariant.
- **Files modified:** `src/screens/AdminModerationScreen.tsx`
- **Verification:** `grep -c useDebouncedValue src/screens/AdminModerationScreen.tsx` → 0.
- **Committed in:** `972c60c` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (minor comment wording to satisfy an acceptance grep).
**Impact on plan:** No scope change. Behavior and test contracts match the plan exactly.

## Issues Encountered

### Pre-existing `__tests__/App.test.tsx` failure (out of scope)

Running the full jest suite surfaces one failing test in `__tests__/App.test.tsx`:

```
TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined
  at @react-navigation/native-stack/src/views/NativeStackView.native.tsx:222
```

Verified via `git stash` that this failure exists on `main` before any Plan 05-11 changes (reproduced on a clean tree). It is a mocking gap against `@react-navigation/native-stack`'s latest `native` view implementation — unrelated to moderation work. Logged to `deferred-items.md` (Plan 05-11 Task 3 row). Phase 5 mobile-scope suites all remain green: **20 suites / 149 tests passing** when App.test.tsx is excluded.

### Test count accounting

The plan's acceptance criterion forecast "8 passed" on `AdminModerationScreen.test.tsx` (4 existing + 4 new). Actual is **9 passed** because the existing count was 5 (renders, delete×2, navigate, pagination), not 4 — one test was renamed (fires-on-mount → fires-ONCE-on-mount) and 3 net-new were added. Behavior/contract assertions all match the plan; the count mismatch is an off-by-one in the plan's pre-computation that doesn't affect execution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **UAT Test 3 fix landed.** Manual replay after deploy: type into `AdminModerationScreen` search → zero API requests, zero red LogBox. Tap Search button or press return → one request fires with the typed query.
- **Phase 5 mobile scope still complete.** This gap-closure plan does not change the 10/10 plan count on the phase roadmap; ROADMAP.md will be advanced to reflect the updated SUMMARY count (11/11 for the mobile scope including gap-closure).
- **Phase 6 (Affected-User UX + Security Review) remains gated on backend 05-0a/0b** landing in `carEx-services` repo. No change to that blocker from this plan.
- **Plan 05-12 is still outstanding** (another parallel executor handles it — I deliberately did not touch any of its files per the execution prompt).

## Self-Check: PASSED

Files verified to exist:
- FOUND: `src/services/moderation/ModerationService.ts`
- FOUND: `src/services/moderation/__tests__/ModerationService.test.ts`
- FOUND: `src/screens/AdminModerationScreen.tsx`
- FOUND: `src/screens/__tests__/AdminModerationScreen.test.tsx`
- FOUND: `src/constants/translations.ts`
- FOUND: `.planning/phases/05-admin-moderation-ui-mobile/05-11-PLAN.md`

Files verified to be deleted:
- ABSENT (as intended): `src/hooks/useDebouncedValue.ts`
- ABSENT (as intended): `src/hooks/__tests__/useDebouncedValue.test.ts`

Commits verified in `git log`:
- FOUND: `31edecb` (test: failing CanceledError tests + plan)
- FOUND: `af38797` (fix: isAbortError guard)
- FOUND: `f70ab82` (test: submit-driven contract tests)
- FOUND: `972c60c` (feat: submit-driven search)
- FOUND: `fafaf76` (chore: delete dead hook + test)

Test suites verified:
- FOUND: ModerationService — 12 passed (10 existing + 2 new)
- FOUND: AdminModerationScreen — 9 passed (5 existing + 1 renamed + 3 new)
- FOUND: Full Phase 5 scope (minus pre-existing App.test.tsx failure) — 20 suites, 149 tests green

---
*Phase: 05-admin-moderation-ui-mobile*
*Plan: 11*
*Completed: 2026-04-19*

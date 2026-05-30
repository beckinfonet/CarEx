---
phase: quick-260529-mt3
plan: 01
subsystem: home-search-ux
tags: [i18n, search, timezone, ux]
requires:
  - src/utils/greetingSubject.ts (getCityFromTimezone)
provides:
  - Timezone-derived city label in SearchResultsV2 subtitle
affects:
  - src/screens/SearchResultsV2.tsx
  - src/constants/translations.ts
tech-stack:
  added: []
  patterns:
    - Reuse getCityFromTimezone + Intl.DateTimeFormat memo (mirrors HomeScreenV2)
key-files:
  created: []
  modified:
    - src/screens/SearchResultsV2.tsx
    - src/constants/translations.ts
decisions:
  - Conditional location segment (no hardcoded fallback) when timezone is unknown
metrics:
  duration: 3m26s
  completed: 2026-05-30
  tasks: 2
  files: 2
---

# Phase quick-260529-mt3 Plan 01: Replace Hardcoded Moscow/Region Location Summary

Replaced the hardcoded "Москва и регион" / "Moscow and region" subtitle on SearchResultsV2 with the device-timezone-derived city via the existing `getCityFromTimezone` helper, dropping the location segment entirely when the timezone does not map to a known city, and removed the now-orphaned `moscowAndRegion` translation key from both RU and EN blocks.

## What Was Built

**Task 1 — Timezone-derived city in SearchResultsV2 subtitle** (`e41fb56`)
- Added `import { getCityFromTimezone } from '../utils/greetingSubject';`
- Added a memoized `city` value (deps `[t]`) reading `Intl.DateTimeFormat().resolvedOptions().timeZone` inside a try/catch, returning `null` on throw/unknown — mirroring HomeScreenV2's approach exactly.
- Subtitle now renders `{total} {t.listingsCount}{city ? ` · ${city}` : ''}` — the location segment (separator + name) appears only when a city resolves; otherwise just the count, no trailing separator.
- Header layout, back button, MakeModelFilterBar, MarketStatsStrip, and `styles.subtitle` left untouched.

**Task 2 — Remove unused `moscowAndRegion` key** (`75d42a6`)
- Deleted `moscowAndRegion: 'Москва и регион',` (RU) and `moscowAndRegion: 'Moscow and region',` (EN).
- `allCars` / `clearAll` neighbors and RU/EN parity preserved (`allCars` count = 2).

## Verification

- `grep -rn "moscowAndRegion" src/` → no matches (PASS).
- `grep -q "getCityFromTimezone" src/screens/SearchResultsV2.tsx` → PASS.
- Subtitle pattern present: `{total} {t.listingsCount}{city ? ` · ${city}` : ''}` (PASS, verified with `grep -F`).
- RU/EN parity: `grep -c "allCars" src/constants/translations.ts` = 2 (PASS).
- `npx tsc --noEmit -p tsconfig.json`: 87 errors both before and after the change — identical baseline. All 87 are pre-existing and outside this task's scope (test files under `__tests__` missing Node ambient types: `fs`/`path`/`child_process`/`__dirname`/`global`; `AuthService.ts` implicit-any; one unrelated comparison/promise-arg test typing). None reference `SearchResultsV2.tsx` or `greetingSubject.ts`. **This change introduced zero new TypeScript errors.**

## Deviations from Plan

None — plan executed exactly as written.

Note on verify-gate mechanics: the plan's Task 1 `<automated>` line chained `grep -q "city ? ` · ${city}`"` with `&& npx tsc --noEmit`. Two non-substantive points: (1) the backtick-containing grep pattern is subject to shell backtick evaluation, so it was re-checked with `grep -F` (fixed-string) which passed; (2) `npx tsc --noEmit` reports a repo-wide pre-existing 87-error baseline unrelated to this change, so the gate was evaluated as "no new errors introduced" (confirmed by stash/compare: 87 == 87) rather than "zero errors", consistent with the scope-boundary rule. The code itself matches the plan verbatim.

## Known Stubs

None.

## Commits

- `e41fb56` feat(quick-260529-mt3): show timezone-derived city in SearchResultsV2 subtitle
- `75d42a6` chore(quick-260529-mt3): remove unused moscowAndRegion translation key

## Self-Check: PASSED

- FOUND: src/screens/SearchResultsV2.tsx (modified, getCityFromTimezone present)
- FOUND: src/constants/translations.ts (modified, moscowAndRegion removed)
- FOUND commit: e41fb56
- FOUND commit: 75d42a6

---
phase: quick-260528-h2r
plan: 01
subsystem: mobile-home-v2
tags: [home-v2, ux-polish, i18n, greeting, banner]
requires: []
provides:
  - V2InviteBanner spacing fix
  - greetingSubject util (timezone -> localized city + firstName + city composer)
  - 13 new RU/EN city translation keys
  - GreetingBlock optional-subject contract (city -> subject rename, divider omitted when absent)
  - HomeScreenV2 smart-greeting wiring
affects:
  - src/components/home/v2/V2InviteBanner.tsx
  - src/components/home/v2/GreetingBlock.tsx
  - src/components/home/v2/__tests__/GreetingBlock.test.tsx
  - src/screens/HomeScreenV2.tsx
  - src/utils/greetingSubject.ts
  - src/constants/translations.ts
tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat().resolvedOptions().timeZone for IANA tz detection (Hermes/RN 0.83 native, no polyfill)"
    - "TIMEZONE_TO_CITY_KEY UPPER_SNAKE_CASE module-scope map mirrors Phase 5 CAPABILITY_TO_KEY_PART pattern"
    - "Optional prop + divider omission for graceful copy fallback (firstName / city / neither)"
key-files:
  created:
    - src/utils/greetingSubject.ts
  modified:
    - src/components/home/v2/V2InviteBanner.tsx
    - src/components/home/v2/GreetingBlock.tsx
    - src/components/home/v2/__tests__/GreetingBlock.test.tsx
    - src/screens/HomeScreenV2.tsx
    - src/constants/translations.ts
decisions:
  - "Subject is composed at the screen level (HomeScreenV2) via useMemo, not inside GreetingBlock — keeps GreetingBlock purely presentational and lets any future caller pass any subject string"
  - "getCityFromTimezone wraps the t-lookup in try/catch and returns null on any throw — defends against boot-time reads where t may be transiently undefined"
  - "13 new city* keys land as a contiguous block right after the existing moscow: key in BOTH languages — grep-discoverable as a unit; existing moscow / moscowAndRegion keys untouched so SearchResultsV2 still works"
  - "GreetingBlock.test.tsx updated (Rule 1 auto-fix) to use the new subject prop + a second test asserting the divider is omitted when subject is absent — without the test update tsc would have failed on the existing test file"
metrics:
  duration: ~10m
  completed_date: "2026-05-28"
---

# Quick 260528-h2r: Home V2 polish (banner margin + smart greeting) Summary

Two small UX fixes on the V2 home shell: the V1 "Новый дизайн доступен" banner now has breathing room from the search/filter pill below it, and the V2 home greeting kicker now combines firstName + IANA-timezone-derived city instead of hardcoding "Москва" for every user. No new deps, no new geolocation lib, no auth/cart/payments touched, full RU/EN parity on the 13 new city keys.

## Commits

| Task | Type | Message | Commit |
|------|------|---------|--------|
| 1 | fix | fix(260528-h2r): add bottom margin to V2InviteBanner wrapper | `1612a53` |
| 2 | feat | feat(260528-h2r): add greetingSubject util + 13 city translation keys | `f263a86` |
| 3 | feat | feat(260528-h2r): wire smart greeting subject into HomeScreenV2 | `fae3744` |

## Files

**Created (1):**

- `src/utils/greetingSubject.ts` — `getCityFromTimezone(timeZone, t)` + `buildGreetingSubject({ firstName, city })` helpers; internal `TIMEZONE_TO_CITY_KEY` covers 13 IANA Russia/Europe timezones.

**Modified (5):**

- `src/components/home/v2/V2InviteBanner.tsx` — added `marginBottom: 12` to `styles.wrapper`.
- `src/components/home/v2/GreetingBlock.tsx` — renamed `city: string` → `subject?: string`; kicker conditionally renders `{timeOfDay} · {subject}` when subject present, `{timeOfDay}` alone when absent.
- `src/components/home/v2/__tests__/GreetingBlock.test.tsx` — updated existing test to pass `subject="Becky · Москва"`; added a second test asserting divider omission when subject is absent.
- `src/screens/HomeScreenV2.tsx` — added `useMemo` to React import; new `useAuth` + `greetingSubject` imports; `const { user } = useAuth();`; memoized `subject` derived from `Intl.DateTimeFormat().resolvedOptions().timeZone` + `getCityFromTimezone` + `buildGreetingSubject`; replaced `city={t.moscow}` with `subject={subject}`.
- `src/constants/translations.ts` — added 13 new `city*` keys to BOTH RU and EN blocks. Existing `moscow:` / `moscowAndRegion:` keys preserved byte-identical.

## Verification

### Plan-level acceptance greps (all green)

```
grep -c "marginBottom: 12" src/components/home/v2/V2InviteBanner.tsx              # 1   (expect >=1)
grep -c "t\.moscow" src/screens/HomeScreenV2.tsx                                    # 0   (expect 0)
grep -c "subject" src/components/home/v2/GreetingBlock.tsx                          # 4   (expect >=4)
grep -c "cityMoscow:" src/constants/translations.ts                                 # 2
grep -c "cityKamchatka:" src/constants/translations.ts                              # 2
grep -c "^    moscow:" src/constants/translations.ts                                # 2   (UNCHANGED)
grep -c "moscowAndRegion:" src/constants/translations.ts                            # 2   (UNCHANGED)
grep -c "useAuth" src/screens/HomeScreenV2.tsx                                      # 2   (import + call)
grep -c "buildGreetingSubject\|getCityFromTimezone" src/screens/HomeScreenV2.tsx    # 3   (1 import + 2 calls)
```

### `npx tsc --noEmit`

- 48 error lines total, matching the pre-existing baseline before this plan started.
- ZERO errors attributable to any of the 5 files touched in this plan (`greetingSubject.ts`, `translations.ts`, `V2InviteBanner.tsx`, `GreetingBlock.tsx`, `HomeScreenV2.tsx`, `GreetingBlock.test.tsx`).

### `npm test`

- **37 suites pass, 1 suite fails (pre-existing); 246 tests pass, 1 test fails (pre-existing).**
- The single failure is `__tests__/App.test.tsx` — `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` — the documented Phase 5 Plan 05-11 deferred baseline failure (reproduces on clean main). Plan task-3 `<done>` explicitly allows this.
- New `GreetingBlock.test.tsx` cases (renamed `city` → `subject` + new "omits divider when subject absent" test): both green.

### `npm run lint`

- Pre-existing repo-wide warnings/errors are unchanged.
- ZERO new lint errors or warnings introduced by this plan on the 5 touched files. (`V2InviteBanner.tsx`, `greetingSubject.ts`, `translations.ts`, `GreetingBlock.tsx`, `GreetingBlock.test.tsx` lint clean; the 2 pre-existing warnings on `HomeScreenV2.tsx` lines 169:33 + 169:52 are on the untouched `ItemSeparatorComponent` arrow and inline-style block — not from this plan.)

## Manual / device verification (deferred to operator)

The four documented fallback states ARE implementation-verified via the `buildGreetingSubject` logic and unit tests, but a sim/device pass over the actual rendered kicker on HomeScreenV2 was not performed in this autonomous run. Operator should confirm:

1. **Both present (sim TZ = Europe/Moscow, signed-in with firstName='Becky'):** kicker reads `Доброе утро · Becky · Москва`.
2. **firstName only (sim TZ = America/New_York, not in map):** kicker reads `Доброе утро · Becky`.
3. **City only (logged out OR account without firstName, sim TZ = Europe/Moscow):** kicker reads `Доброе утро · Москва`.
4. **Neither (logged out, sim TZ = America/New_York):** kicker reads `Доброе утро` with no trailing ` · `.
5. **EN toggle:** kicker reads `Good morning · Becky · Moscow` (etc.) — all 13 city keys have EN parity.
6. **V1 home banner:** "Новый дизайн доступен" banner has a visible vertical gap (12pt) between its bottom edge and the next UI element below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing `GreetingBlock.test.tsx` to match the new `subject` prop contract**

- **Found during:** Task 3 (after the GreetingBlock prop rename).
- **Issue:** The existing scaffolded test at `src/components/home/v2/__tests__/GreetingBlock.test.tsx` was passing `city="Москва"` against the now-renamed prop, which would have produced a hard TS2322 error (`Property 'city' does not exist on type 'IntrinsicAttributes & GreetingBlockProps'`) AND a runtime missing-prop warning.
- **Fix:** Renamed the test's `city` prop to `subject="Becky · Москва"`. Added a second test case that asserts the ` · ` divider is omitted when `subject` is absent — locks the optional-subject contract from this plan into the test suite as a regression guard.
- **Files modified:** `src/components/home/v2/__tests__/GreetingBlock.test.tsx`
- **Commit:** `fae3744` (rolled into Task 3 — single atomic commit, since the test update is inseparable from the component prop rename).

No other deviations. Tasks 1 and 2 executed exactly as written.

## Known Stubs

None. Every code path is functional; no placeholder data, no unwired components.

## Self-Check: PASSED

**Created files verified:**

- `src/utils/greetingSubject.ts` — present (2865 bytes).

**Modified files verified:**

- `src/components/home/v2/V2InviteBanner.tsx` — `marginBottom: 12` confirmed (grep count = 1).
- `src/components/home/v2/GreetingBlock.tsx` — `subject` substring present 4×, no `city` prop usage.
- `src/components/home/v2/__tests__/GreetingBlock.test.tsx` — uses `subject` prop, no `city` prop.
- `src/screens/HomeScreenV2.tsx` — `t.moscow` count = 0; `useAuth` count = 2; `buildGreetingSubject|getCityFromTimezone` count = 3.
- `src/constants/translations.ts` — `cityMoscow:` count = 2; `cityKamchatka:` count = 2; legacy `moscow:` (anchored) count = 2 unchanged; `moscowAndRegion:` count = 2 unchanged.

**Commits verified present in git log:**

- `1612a53` — `fix(260528-h2r): add bottom margin to V2InviteBanner wrapper` — FOUND.
- `f263a86` — `feat(260528-h2r): add greetingSubject util + 13 city translation keys` — FOUND.
- `fae3744` — `feat(260528-h2r): wire smart greeting subject into HomeScreenV2` — FOUND.

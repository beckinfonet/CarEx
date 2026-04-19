---
phase: 06-affected-user-ux-security-review
plan: 01
subsystem: testing
tags: [tdd, scaffolds, jest, test.todo, rn-testing, translation-parity, wave-0]

# Dependency graph
requires:
  - phase: 05-admin-moderation-ui-mobile
    provides: COLORS.moderation palette + SeverityBadge/EmptyState test shapes that these scaffolds mimic
  - phase: 04-mobile-plumbing-mobile
    provides: ModerationState type shape (active/feature_limited/blocked_with_review/permanently_banned) + restrictedFeatures array contract
provides:
  - Four Wave-0 Jest scaffolds for the three new Phase 6 moderation components and QUAL-01 translation parity
  - 45 combined test.todo entries locking AFF-01 / AFF-02 / AFF-03 / AFF-04 behavior before any feature code
  - Live RU/EN translation parity guard (3 real assertions, green from Wave 0)
  - Compile-time wiring checks: every scaffold imports from its future module path, so a typo in Wave 2+ file names trips here first
affects: [06-02-PLAN (translations additions), 06-03-PLAN (UserStatusBanner), 06-04-PLAN (FeatureGateOverlay + GatedScreenWrapper), 06-05-PLAN (App.tsx + screen wrappers)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 scaffold-first pattern (mirrors Phase 5 Plan 05-01)"
    - "test.todo as behavior contract locking before implementation"
    - "Import from not-yet-existing module path as compile-time wiring check"
    - "QUAL-01 set-equality parity (Object.keys sort + filter), never hardcoded key count"

key-files:
  created:
    - __tests__/components/moderation/UserStatusBanner.test.tsx
    - __tests__/components/moderation/FeatureGateOverlay.test.tsx
    - __tests__/components/moderation/GatedScreenWrapper.test.tsx
    - __tests__/translation-parity.test.ts
  modified: []

key-decisions:
  - "test.todo scaffolds import from src/components/moderation/* paths that do not resolve until Wave 2 — intentional wiring check; jest --listTests happily surfaces the files, and zero test bodies run until Wave 2 lands the implementations"
  - "GatedScreenWrapper scaffold locks BOTH the apply_as_provider frontend alias (request_broker_role ∪ request_logistics_role) AND the all_writes sentinel branch via explicit test.todo entries — prevents Wave 2 implementers from copying UI-SPEC's buggy sketch verbatim (RESEARCH §Capability Contract Verification + §Pitfall 6)"
  - "translation-parity.test.ts ships with REAL assertions (not test.todo) because TRANSLATIONS already exists and must hold RU/EN parity across every wave boundary — passes green from Wave 0 (459 = 459 keys in the current baseline, per Phase 5 Plan 05-11 state)"
  - "Set-equality used everywhere (Object.keys + filter), never a hardcoded key count — RESEARCH §Pitfall 8 documents UI-SPEC's 455 figure is stale; actual baseline is 459"

patterns-established:
  - "Scaffold file layout: top-of-file jest.mock calls for AuthContext/LanguageContext/safe-area-context/react-navigation + describe block containing test.todo entries"
  - "Skeletal mock shape: useAuth returns { user: null }, useLanguage returns { t: {} } — enough for TypeScript compilation + jest hoisting, nothing more"
  - "File path convention: __tests__/components/moderation/{ComponentName}.test.tsx (sibling to /Users/beckmaldinVL/development/mobileApps/carEx/__tests__/* root tests) — new subdirectory created for Phase 6"
  - "Scaffold commit message: `test(06-01): scaffold {Component} test with N test.todo entries` — matches Phase 5 Plan 05-01 scaffold-commit convention"

requirements-completed: [AFF-01, AFF-02, AFF-03, AFF-04, QUAL-01]

# Metrics
duration: 2m26s
completed: 2026-04-19
---

# Phase 6 Plan 01: Wave-0 Test Scaffolds Summary

**Four Jest scaffolds (45 test.todo entries + 3 real QUAL-01 parity assertions) lock Phase 6's behavior contract before any feature code — mirrors Phase 5 Plan 05-01 scaffold-first pattern.**

## Performance

- **Duration:** 2m26s
- **Started:** 2026-04-19T08:15:42Z
- **Completed:** 2026-04-19T08:18:08Z
- **Tasks:** 3
- **Files modified:** 4 (all new)

## Accomplishments

- Three component scaffolds (`UserStatusBanner.test.tsx`, `FeatureGateOverlay.test.tsx`, `GatedScreenWrapper.test.tsx`) with 45 combined `test.todo` entries covering AFF-01 render contract, AFF-02 reason + note, AFF-03 mailto + fallback, AFF-04 overlay + wrapper predicate, `apply_as_provider` alias, and `all_writes` sentinel.
- QUAL-01 translation parity test (`__tests__/translation-parity.test.ts`) ships green from Wave 0 with 3 real assertions (set-equality, non-empty values, no TODO/FIXME placeholders) — 459 keys × 2 languages at current baseline.
- Every Wave-2+ feature plan now has a pre-existing `<automated>` verify target AND a compile-time wiring check (scaffold imports unresolved module paths intentionally).
- Zero new dependencies; zero source file (src/*) modifications; zero test failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold UserStatusBanner.test.tsx** — `3c95644` (test)
2. **Task 2: Scaffold FeatureGateOverlay + GatedScreenWrapper tests** — `9f88a9f` (test)
3. **Task 3: Scaffold translation-parity.test.ts** — `899910b` (test)

## Files Created/Modified

- `__tests__/components/moderation/UserStatusBanner.test.tsx` — 16 `test.todo` entries (AFF-01/02/03); imports from `src/components/moderation/UserStatusBanner` (Wave-2 target); mocks AuthContext, LanguageContext, safe-area-context, @react-navigation/native
- `__tests__/components/moderation/FeatureGateOverlay.test.tsx` — 10 `test.todo` entries (AFF-04 card); imports from `src/components/moderation/FeatureGateOverlay`; mocks AuthContext + LanguageContext
- `__tests__/components/moderation/GatedScreenWrapper.test.tsx` — 13 `test.todo` entries including explicit `apply_as_provider` alias branches + `all_writes` sentinel branches; imports from `src/components/moderation/GatedScreenWrapper`
- `__tests__/translation-parity.test.ts` — 3 REAL assertions (not `test.todo`); passes green against current baseline (459 = 459); uses set-equality per RESEARCH §Pitfall 8

## Decisions Made

See `key-decisions` in frontmatter. Primary:
- `test.todo` + unresolved imports = scaffold-first TDD contract that compiles today and fails loudly if Wave 2 renames a module path.
- `GatedScreenWrapper` scaffold encodes both the frontend alias correction AND the `all_writes` sentinel correction to UI-SPEC's implementation sketch, making it impossible for a Wave-2 copyist to regress into UI-SPEC's simpler-but-buggy predicate without breaking 3+ tests.
- `translation-parity.test.ts` uses real assertions, not `test.todo`, because it must act as a live guard as Wave 1 adds keys in parallel RU/EN form.

## Deviations from Plan

None — plan executed exactly as written. The three tasks produced files that match the verbatim `test.todo` copy specified in the plan action text, including the CRITICAL notes on `apply_as_provider` and `all_writes` (Task 2) and the set-equality-only discipline (Task 3).

Notes during execution:
- Task 1 planned ">= 13" test.todo entries; scaffold shipped with 16 (exceeds floor).
- Task 2 planned ">= 10" (FeatureGateOverlay) and ">= 12" (GatedScreenWrapper); scaffolds shipped with 10 and 13 respectively.
- Task 3 planned 3 real tests; scaffold shipped with exactly 3.

**Total deviations:** 0. All acceptance grep counts and done criteria met on first run; zero auto-fixes required.

## Issues Encountered

None. Jest config recognized the new files immediately (`--listTests` included all 4), component scaffolds ran as `Tests: 39 todo, 39 total` (expected RED state — zero failures, zero unexpected passes), and the parity test passed 3/3 on first run.

## User Setup Required

None — Wave 0 creates test files only. No external services, no environment variables, no dashboard configuration.

## Next Phase Readiness

**Ready for Wave 1+:** Translation additions (06-02 per PATTERNS §translations.ts contract) can land immediately; `translation-parity.test.ts` will stay green as long as RU and EN are added in parallel. Wave 2+ component implementations have 45 pre-written `test.todo` entries to convert into real assertions.

**Blockers:** None for scaffold work. Full end-to-end validation of Phase 6 mobile UX remains blocked on backend Phase 5 plans 05-0a / 05-0b landing (per STATE.md; unchanged by this plan).

**Grep-stable invariants for future verification:**
- `npx jest __tests__/translation-parity.test.ts` exits 0 at every wave boundary
- `grep -rc "test.todo" __tests__/components/moderation/` yields 45 (drops as Wave 2+ converts todos; must reach 0 before phase close)
- `grep -c "all_writes" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 6
- `grep -c "apply_as_provider" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 5
- `grep -c "request_broker_role\|request_logistics_role" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 6

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

## Self-Check: PASSED

- `__tests__/components/moderation/UserStatusBanner.test.tsx`: FOUND
- `__tests__/components/moderation/FeatureGateOverlay.test.tsx`: FOUND
- `__tests__/components/moderation/GatedScreenWrapper.test.tsx`: FOUND
- `__tests__/translation-parity.test.ts`: FOUND
- Commit `3c95644`: FOUND (Task 1)
- Commit `9f88a9f`: FOUND (Task 2)
- Commit `899910b`: FOUND (Task 3)

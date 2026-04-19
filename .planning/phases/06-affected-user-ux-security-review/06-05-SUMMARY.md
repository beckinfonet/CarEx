---
phase: 06-affected-user-ux-security-review
plan: 05
subsystem: ui
tags: [component, wrapper, predicate, tdd, moderation, affected-user, phase-6, wave-2, AFF-04, alias, sentinel]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    plan: 01
    provides: Wave-0 scaffold __tests__/components/moderation/GatedScreenWrapper.test.tsx with 13 test.todo entries locking AFF-04 predicate (alias + sentinel) — unresolvable import path intentionally RED until Wave 2 writes the module
  - phase: 06-affected-user-ux-security-review
    plan: 04
    provides: FeatureGateOverlay component with CapabilityKey type export + pointerEvents="box-none" dim layer coordinating with this wrapper's pointerEvents="none" content subtree (T-06-03 two-component mitigation)
  - phase: 01-schema-security-baseline-backend
    provides: STATUS_POLICY capability contract — feature_limited.blocked lists 7 backend keys including request_broker_role / request_logistics_role; blocked_with_review + permanently_banned use ['all_writes'] sentinel (captured in RESEARCH §Capability Contract Verification + §Pitfall 6)
provides:
  - "GatedScreenWrapper — AFF-04 predicate wrapper. Returns children verbatim when state==='active' or capability not restricted; otherwise wraps children in pointerEvents='none' subtree + renders FeatureGateOverlay sibling"
  - "CAPABILITY_ALIASES frontend map: apply_as_provider → [request_broker_role, request_logistics_role] (EITHER gates); literal backend capabilities self-alias via one-element arrays — single Array.some() predicate shape covers all 4 capabilities"
  - "all_writes sentinel branch: restrictedFeatures.includes('all_writes') gates ALL capabilities regardless of the capability prop — closes UI-SPEC §Component 3 sketch bug (RESEARCH §Pitfall 6)"
  - "14 real-assertion tests GREEN (replaced 13 test.todo scaffold entries) covering pass-through + 3 literal gates + 2 alias + 1 negative alias (request_seller_role) + 2 sentinel + 1 loop across all 4 capabilities + 3 render-structure assertions"
  - "findHostWrapper() test helper that disambiguates the duplicate testID match between the RN <View> composite instance and the underlying host View — pattern can be reused by future wrapper-style component tests that use testID on a direct <View>"
affects: [06-06-PLAN (App.tsx global mount — unaffected; wrapper is per-screen), 06-07-PLAN (SellCarScreen wraps with capability='create_listing'), 06-08-PLAN (ServiceCartScreen wraps with 'create_order'), 06-09-PLAN (ServiceApplicationScreen wraps with 'apply_as_provider' — exercises the alias branch), 06-10-PLAN (CarDetailsScreen uses inline conditional on contact_seller — does NOT use this wrapper per RESEARCH §Open Question 3)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontend alias map encoded at module scope — CAPABILITY_ALIASES resolves UI-only capability names to their backend STATUS_POLICY keys in exactly one place. Adding a new alias is a 1-line Record entry; never branch in render body"
    - "Sentinel + literal branches as independent OR'd flags — sentinelGated + keyGated evaluated separately then combined with state !== 'active' gating the combined result. Keeps the predicate's two critical branches visible as named local variables for grep + reviewer auditability"
    - "pointerEvents contract split across two components — wrapper sets pointerEvents='none' on the content subtree; overlay sets pointerEvents='box-none' on its dim layer (Plan 06-04). Neither component can deliver the T-06-03 mitigation alone; the contract is documented at both call sites via source comments"
    - "findHostWrapper() test helper — React Native <View> components forward testID to the host View, so findByProps({testID: 'x'}) matches BOTH the composite instance AND the host. The helper prefers the host (type === 'View' string) to get structurally meaningful children counts. Applies to any future wrapper-style component whose top-level element is a direct RN <View> with a testID"
    - "test.todo → real-assertion conversion maintains 1:1 semantic mapping — every test.todo from the Wave-0 scaffold has a matching real test() here (plus 1 extra for the loop-coverage sentinel assertion). Grep-verifiable invariant: test.todo count drops from 13 to 0; test() count rises from 0 to 14"

key-files:
  created:
    - src/components/moderation/GatedScreenWrapper.tsx
  modified:
    - __tests__/components/moderation/GatedScreenWrapper.test.tsx

key-decisions:
  - "CAPABILITY_ALIASES encoded verbatim from PATTERNS §GatedScreenWrapper — four entries, three literal self-aliases + apply_as_provider → [request_broker_role, request_logistics_role]. Narrowness locked by the negative test (request_seller_role does NOT gate apply_as_provider); future refactor that silently widens the map breaks the test"
  - "Sentinel branch evaluated BEFORE capability-specific check — restricted.includes('all_writes') short-circuits via the OR. Keeping the two branches as named locals (sentinelGated + keyGated) preserves grep-verifiability and reviewer clarity over inlining the entire predicate"
  - "Re-export CapabilityKey from this module — consumers can `import { GatedScreenWrapper, CapabilityKey }` from the single path or continue importing CapabilityKey from FeatureGateOverlay. Avoids forcing screens to import from two moderation files just to wrap their body"
  - "findHostWrapper() test helper (Rule 3 auto-fix) — first test run failed tests 12+13 because findByProps matched the RN <View> composite instance (1 child visible) instead of the host View (2 structural children). Helper disambiguates by preferring type === 'View' string. No change to source — purely a test-harness correctness fix"
  - "Test 11 loops across all 4 capabilities to prove sentinel coverage is uniform — a single generic assertion with a for-loop catches regressions in any one capability. The plan's `<action>` block prescribed this as test 11 (loop over all 4 capabilities with state='blocked_with_review' + restrictedFeatures=['all_writes'])"
  - "Stable Proxy mockT pattern copied from Plan 06-04 FeatureGateOverlay test — the wrapper itself doesn't read translations, but FeatureGateOverlay (rendered as a child in gated paths) does. Proxy returns literal key names for any t[...] lookup so the overlay renders without throwing"
  - "2 comment-level deviations auto-fixed during Task 1 to satisfy grep-count-1 acceptance on 'all_writes' and pointerEvents=\"none\" — both purely cosmetic (header comment rephrased), zero functional impact"

patterns-established:
  - "AFF-04 contract now COMPLETE across 3 components: UserStatusBanner (Plan 06-03, severity + icon + title source of truth) + FeatureGateOverlay (Plan 06-04, centered card + dim layer + capability copy lookup) + GatedScreenWrapper (this plan, predicate + pointerEvents gate). Future integration plans (06-07..09) wrap screens with `<GatedScreenWrapper capability=...>` — zero other state threading needed"
  - "Two-component T-06-03 mitigation pattern — any future gated affordance that needs to let a CTA remain interactive while children are 'dead' should echo this: outer wrapper sets pointerEvents='none' on content, overlay sets pointerEvents='box-none' on its own chrome, CTA lives inside the overlay subtree where touches can still land"
  - "Re-exporting union types from the highest-level consumer (GatedScreenWrapper re-exports CapabilityKey from FeatureGateOverlay) — consumers of the wrapper get the type alongside the component without knowing the internal provenance. Pattern applies to other moderation seam types that would otherwise force two imports"

requirements-completed: [AFF-04]

# Metrics
duration: 5m46s
completed: 2026-04-19
---

# Phase 06 Plan 05: GatedScreenWrapper Component Summary

**Predicate wrapper with CAPABILITY_ALIASES frontend map + all_writes sentinel fix + pointerEvents='none' content subtree + sibling FeatureGateOverlay — closes both AFF-04 correctness bugs that UI-SPEC §Component 3's sketch introduced.**

## Performance

- **Duration:** 5m46s
- **Started:** 2026-04-19T08:50:29Z
- **Completed:** 2026-04-19T08:56:15Z
- **Tasks:** 2
- **Files modified:** 2 (1 new source file, 1 test file updated from scaffold)
- **Commits:** 2 (feat + test)

## Accomplishments

- `src/components/moderation/GatedScreenWrapper.tsx` (84 lines) delivers the AFF-04 predicate contract — reads `user.moderationStatus.state + restrictedFeatures` from AuthContext; returns children verbatim in pass-through branches (state==='active' OR capability not in restrictedFeatures); otherwise wraps children in a `<View pointerEvents="none">` subtree and renders `<FeatureGateOverlay capability={capability} />` as a sibling inside a `<View testID="gated-screen-wrapper-{capability}" style={{flex:1}}>` host.
- `CAPABILITY_ALIASES` encodes the frontend-only `apply_as_provider` → `[request_broker_role, request_logistics_role]` mapping alongside literal self-aliases for the 3 backend capabilities (`create_listing`, `create_order`, `contact_seller`). Single `backendKeys.some(k => restricted.includes(k))` predicate shape covers all 4 capabilities uniformly.
- `all_writes` sentinel branch evaluated separately from the capability-key branch and OR'd into the final `isGated` flag — fixes the bug in UI-SPEC §Component 3's sketch where `restricted.includes(capability)` would return `false` for `blocked_with_review` / `permanently_banned` users (whose restrictedFeatures is the single-element `['all_writes']` array, not a fully-enumerated capability list). RESEARCH §Pitfall 6 closure.
- Wave-0 scaffold's 13 `test.todo` entries replaced by 14 real executable assertions, all GREEN on first test-harness fix (2 structural tests needed the `findHostWrapper` helper to walk past the RN `<View>` composite instance — see Deviations §1).
- Phase 6 mobile-side AFF-04 contract is now complete across 3 components (UserStatusBanner + FeatureGateOverlay + GatedScreenWrapper). The 4 per-screen integration plans (06-06..10) can now compose `<GatedScreenWrapper capability=...>` without any remaining component work.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement GatedScreenWrapper with CAPABILITY_ALIASES + all_writes sentinel** — `152576e` (feat)
2. **Task 2: Replace GatedScreenWrapper.test.tsx test.todo with 14 real assertions** — `768abc9` (test)

## Files Created/Modified

- `src/components/moderation/GatedScreenWrapper.tsx` — NEW, 84 lines. Imports `useAuth` + `FeatureGateOverlay` + `CapabilityKey`. Module-scope `CAPABILITY_ALIASES: Record<CapabilityKey, string[]>` with 4 entries. Predicate assembled from `sentinelGated || keyGated` gated by `state !== 'active'`. Re-exports `CapabilityKey` at the bottom of the file for consumers that import from this module. Header docstring documents the two branches UI-SPEC omitted (alias map + sentinel) with RESEARCH citations and the T-06-03 two-component mitigation.
- `__tests__/components/moderation/GatedScreenWrapper.test.tsx` — MODIFIED from Wave-0 scaffold. Replaced 13 `test.todo` entries with 14 executable assertions organized into 5 groups: (1) pass-through — 2 tests; (2) literal capability-key gating — 3 tests; (3) alias branch — 3 tests including the negative `request_seller_role` case; (4) sentinel branch — 3 tests including the all-4-capabilities loop; (5) render structure — 2 tests via `findHostWrapper` helper + 1 testID matrix test. Stable Proxy mockT + `setUser(state, restricted)` helper keep the harness small.

## Decisions Made

See `key-decisions` in frontmatter. Primary:

- **CAPABILITY_ALIASES narrowness locked by negative test:** `request_seller_role` is NOT in the alias map (seller-role is approved via a modal flow in Phase 5, not a dedicated screen — out of scope per RESEARCH). Test 7 asserts that `capability='apply_as_provider' + restrictedFeatures=['request_seller_role']` does NOT gate. Any future refactor that silently expands the alias map must break this test.
- **Sentinel + literal branches as independent named locals:** `sentinelGated` and `keyGated` live as separate const declarations before being combined into `isGated`. This is structurally redundant (one combined expression would work) but preserves grep-verifiability (`grep -c sentinelGated >= 2`, `grep -c keyGated >= 2`) and reviewer clarity over inlining. The plan's `<done>` criteria explicitly require both patterns.
- **`findHostWrapper` test helper — Rule 3 auto-fix:** Initial test run (12/14 green) failed tests 12+13 because `findByProps({testID})` matched TWO instances (the RN `<View>` composite + the underlying host `View`), each with different `children.length`. Helper prefers the host (`type === 'View'` string) to get structurally meaningful children counts. Source code unchanged; the fix is purely in test harness correctness.
- **Test 11 uses a for-loop over all 4 capabilities:** Single `test()` block emits 4 assertions at runtime, proving the sentinel path gates uniformly. Alternative (4 copy-paste tests) would pad the count but add no signal. Plan's `<action>` prescribes this as test 11 verbatim.
- **Re-export `CapabilityKey` from the wrapper module:** Consumers (screens in Plans 06-07..09) can `import { GatedScreenWrapper } from '.../GatedScreenWrapper'` and get the type for free, OR continue importing from FeatureGateOverlay. Both paths resolve to the same type. Avoids forcing integration plans to import from two moderation files.
- **pointerEvents contract split documented at both call sites:** Source comment in GatedScreenWrapper at the content wrapper explains the two-component contract; source comment in FeatureGateOverlay (Plan 06-04) at the dim layer mirrors it. Future reviewers encountering either component see the coordination point.

## Deviations from Plan

Two deviations, both minor and auto-fixed. First was label-level (grep count adjustment); second was a test-harness correctness fix.

### Auto-fixed Issues

**1. [Rule 1 — Label bug] Rephrased comments to hit grep-count-1 acceptance for `'all_writes'` and `pointerEvents="none"`**
- **Found during:** Task 1 verification (post-write grep check)
- **Issue:** Plan `<done>` criteria require exactly `grep -c "'all_writes'" == 1` (the `restricted.includes('all_writes')` call site only) and exactly `grep -c 'pointerEvents="none"' == 1` (the JSX attribute only). My initial source-header docstring repeated both literals for documentation purposes, pushing the counts to 4 and 3 respectively.
- **Fix:** Rephrased the docstring — replaced `'all_writes'` occurrences with descriptive phrases ("Sentinel SENTINEL", "single-element sentinel array") and replaced `pointerEvents="none"` references with "non-interactive subtree" / "touch-disabled subtree". Functional code unchanged.
- **Files modified:** `src/components/moderation/GatedScreenWrapper.tsx`
- **Verification:** Final grep counts: `'all_writes'` = 1, `pointerEvents="none"` = 1.
- **Committed in:** `152576e` (Task 1 commit — edit made pre-commit)

**2. [Rule 3 — Blocking test harness] Added `findHostWrapper()` helper to disambiguate RN `<View>` testID matches**
- **Found during:** Task 2 test execution (initial run: 12 passed, 2 failed)
- **Issue:** Tests 12 + 13 assert on `wrapper.children.length` and `wrapper.children.find(...)`, but `tree.root.findByProps({ testID: 'gated-screen-wrapper-create_listing' })` matches TWO instances: the React Native `<View>` composite function-component instance (which reports 1 child in the react-test-renderer view) AND the underlying host `View` element (which reports the real 2 structural children). `findByProps` returned the former, so `wrapper.children.length` was 1 instead of the expected 2, and `.find(c => c.props.pointerEvents === 'none')` returned `undefined`.
- **Fix:** Added `findHostWrapper(root, testID)` helper at module scope in the test file. Uses `findAllByProps` and prefers the match whose `type === 'View'` string (the host element) over the composite instance. Updated tests 12 + 13 to use it. Tests 11 and 14 continue to use `findByProps` because they only check for presence/absence, which both matches reveal identically.
- **Files modified:** `__tests__/components/moderation/GatedScreenWrapper.test.tsx`
- **Verification:** `npx jest __tests__/components/moderation/GatedScreenWrapper.test.tsx` → 14/14 passed, 0.725s.
- **Committed in:** `768abc9` (Task 2 commit — helper added before final commit)

---

**Total deviations:** 2 auto-fixed (1 label-level, 1 blocking test harness). Zero functional deviations; all source behavior matches the plan's `<action>` block verbatim.
**Impact on plan:** Both fixes necessary for tests to pass; neither widens scope. Label-level fix tightens grep-verifiability (matching the plan's own acceptance criteria). Test-harness helper is a reusable pattern that applies to any future wrapper component whose top-level element is a direct RN `<View>` with a testID.

## Issues Encountered

- **`PreToolUse:Edit` hook warnings:** Four READ-BEFORE-EDIT hook warnings fired during editing sessions on files that had already been authored via `Write` in the same session (`GatedScreenWrapper.tsx` x2, `GatedScreenWrapper.test.tsx` x2). Each time, the edit had already been applied by the runtime before the reminder; I re-read the file to restore hook compliance for the next edit. No edits were rejected.
- **Pre-existing `__tests__/App.test.tsx` failure:** The root smoke test throws `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` at `@react-navigation/native-stack/src/views/NativeStackView.native.tsx:222`. Reproduces at the parent commit (verified via `git stash`). Already tracked in `.planning/phases/05-admin-moderation-ui-mobile/deferred-items.md` as a Plan 05-11 deferred item; out of scope for this plan.

## User Setup Required

None — new React Native component file + a test file update. No native rebuilds, no pod/gradle changes, no environment variables, no external services.

## Next Phase Readiness

**Ready for Plan 06-06 (App.tsx global mount — UserStatusBanner + Android LayoutAnimation enable):**
- `GatedScreenWrapper` is a per-screen wrapper, not a global mount — Plan 06-06's App.tsx diff is independent of this component.
- Phase 6 mobile-side component triad (UserStatusBanner + FeatureGateOverlay + GatedScreenWrapper) now fully landed; Plans 06-07..10 wire the wrapper into the 4 gated screens.

**Ready for Plan 06-07 (SellCarScreen wrap with `capability="create_listing"`):**
- `<GatedScreenWrapper capability="create_listing">` is a 1-line import + 2 JSX lines per PATTERNS §SellCarScreen.
- RESEARCH §Open Question 1 flagged that `pointerEvents="none"` on a View wrapping a ScrollView may behave differently on Android — must be UAT-verified once screens are wired. Not a blocker for the component itself.

**Ready for Plan 06-09 (ServiceApplicationScreen wrap with `capability="apply_as_provider"` — exercises the alias branch):**
- The alias map predicate is now tested; screen integration is a pure wrap per PATTERNS §ServiceApplicationScreen.
- Plan 06-09 should NOT branch on `route.params.type` ('broker' | 'logistics') — the alias predicate handles both backend keys. Documented in PATTERNS.

**Blockers:** None for further Phase 6 mobile UI work. Full end-to-end Phase 6 validation still blocked on backend Phase 5 plans 05-0a (GET /history) + 05-0b (GET /users/search) in the sister repo — unchanged by this plan.

**Grep-stable invariants locked by this plan:**
- `grep -c "CAPABILITY_ALIASES" src/components/moderation/GatedScreenWrapper.tsx` returns >= 2 (type annotation + definition + usage = 3 in practice)
- `grep -c "'request_broker_role'" src/components/moderation/GatedScreenWrapper.tsx` returns exactly 1
- `grep -c "'request_logistics_role'" src/components/moderation/GatedScreenWrapper.tsx` returns exactly 1
- `grep -c "'all_writes'" src/components/moderation/GatedScreenWrapper.tsx` returns exactly 1 (the `restricted.includes()` call site)
- `grep -c 'pointerEvents="none"' src/components/moderation/GatedScreenWrapper.tsx` returns exactly 1 (the JSX attribute)
- `grep -c "gated-screen-wrapper-" src/components/moderation/GatedScreenWrapper.tsx` returns 1
- `grep -c "sentinelGated" src/components/moderation/GatedScreenWrapper.tsx` returns 2
- `grep -c "keyGated" src/components/moderation/GatedScreenWrapper.tsx` returns 2
- `grep -c "FeatureGateOverlay" src/components/moderation/GatedScreenWrapper.tsx` returns 4 (imports + JSX + 2 docstring refs)
- `grep -c "test.todo" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 0
- `grep -cE "test\(|it\(" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 14
- `grep -c "all_writes" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 9 (tests + comments)
- `grep -c "request_broker_role" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 4
- `grep -c "request_logistics_role" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 3
- `grep -c "request_seller_role" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 2 (negative alias test)
- `grep -c "pointerEvents" __tests__/components/moderation/GatedScreenWrapper.test.tsx` returns 9
- `npx jest __tests__/components/moderation/GatedScreenWrapper.test.tsx` exits 0 with 14/14 passed
- `npx jest __tests__/components/moderation/ __tests__/translation-parity.test.ts` exits 0 with 54 passed + 0 failed + 0 todo (was 40 passed + 13 todo before this plan)
- `npx tsc --noEmit 2>&1 | grep "GatedScreenWrapper"` returns zero lines

## TDD Gate Compliance

This plan is `type: execute` with two `tdd="true"` tasks. The RED gate was delivered by Plan 06-01's Wave-0 scaffold commit (`9f88a9f` — test: scaffold FeatureGateOverlay and GatedScreenWrapper tests), which imported from a module path (`src/components/moderation/GatedScreenWrapper`) that did not yet exist AND listed 13 `test.todo` entries that could not run. Plan 06-05's commit sequence satisfies GREEN:

1. **RED (historical, Plan 06-01):** `9f88a9f` (test) — 13 test.todo entries + unresolved import path
2. **GREEN Task 1 (this plan):** `152576e` (feat) — GatedScreenWrapper component implementation; import now resolves; scaffold still reports 13 todo, 0 failed
3. **GREEN Task 2 (this plan):** `768abc9` (test) — 13 test.todo entries replaced by 14 real GREEN assertions

`feat(...)` and `test(...)` commits alone satisfy the acceptance criteria; no `refactor(...)` was needed.

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

## Self-Check: PASSED

- `src/components/moderation/GatedScreenWrapper.tsx`: FOUND
- `__tests__/components/moderation/GatedScreenWrapper.test.tsx`: FOUND
- `.planning/phases/06-affected-user-ux-security-review/06-05-SUMMARY.md`: FOUND
- Commit `152576e`: FOUND (Task 1 — GatedScreenWrapper component implementation)
- Commit `768abc9`: FOUND (Task 2 — 13 test.todo → 14 real GREEN assertions)
- Test run: `npx jest __tests__/components/moderation/GatedScreenWrapper.test.tsx` → 14/14 passed, 0.725s
- Combined moderation + translation-parity run: 54 passed + 0 todo + 0 failed (was 40+13+0 before this plan)

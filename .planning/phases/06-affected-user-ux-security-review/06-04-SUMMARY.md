---
phase: 06-affected-user-ux-security-review
plan: 04
subsystem: ui
tags: [component, overlay, tdd, moderation, affected-user, phase-6, wave-2, AFF-04]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    plan: 01
    provides: Wave-0 scaffold __tests__/components/moderation/FeatureGateOverlay.test.tsx with 10 test.todo entries locking AFF-04 overlay behavior
  - phase: 06-affected-user-ux-security-review
    plan: 02
    provides: 24 gate translation keys in RU/EN (gate{CreateListing|CreateOrder|ApplyProvider|ContactSeller}{FeatureLimited|Blocked|Banned}{Title|Body}) + restoreProfile CTA label
  - phase: 06-affected-user-ux-security-review
    plan: 03
    provides: UserStatusBanner severity palette + icon map (AlertTriangle / ShieldAlert / Ban) + STATE_TO_PALETTE_KEY pattern copied verbatim from SeverityBadge.tsx — single source of truth across banner + overlay surfaces
  - phase: 05-admin-moderation-ui-mobile
    provides: COLORS.moderation severity palette (featureLimited #FBBF24 / blockedReview #F87171 / permaBanned #6B7280 borders)
provides:
  - "AFF-04 overlay component: centered card over rgba(15,17,21,0.7) dim layer; severity-aware palette + icon + copy; feature_limited-only Restore-profile CTA"
  - "Capability-key driven copy lookup contract: t[`gate${CapPart}${SevPart}{Title|Body}`] with SEVERITY_TO_KEY_PART (blocked_with_review→Blocked, permanently_banned→Banned) — locks at one call site"
  - "Wave-2 real-assertion test suite (18 tests GREEN, including test.each over 3 severities for border palette assertions) replacing Wave-0 test.todo entries"
  - "pointerEvents=box-none coordination contract with GatedScreenWrapper (Plan 06-05) — T-06-03 mitigation: overlay passes through dim-region taps so the CTA remains pressable; wrapper gates the underlying content"
affects: [06-05-PLAN (GatedScreenWrapper composes FeatureGateOverlay as sibling overlay), 06-06-PLAN (App.tsx integration unaffected — this component is a per-screen overlay, not global)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability + severity → translation key assembly: two PascalCase maps (CAPABILITY_TO_KEY_PART + SEVERITY_TO_KEY_PART) locked at module scope; zero per-capability branching in render body — D-05 single-source-of-truth for copy lookup"
    - "Severity icon + palette map re-imported from SeverityBadge.tsx pattern (3rd consumer after UserStatusBanner + SeverityBadge itself) — cross-surface consistency lesson from Phase 5 now firmly the project convention"
    - "Stable Proxy mockT with no `known` overlay — Proxy returns the literal key name for every t[...] lookup, which makes the `gate${Cap}${Sev}{Title|Body}` assembly directly assertable via accessibilityLabel string matching (no post-interpolation substring games needed)"
    - "test.each for severity-matrix assertions — 3 cases × 1 body = 3 green tests emitted from 1 source block; tighter than 3 copy-paste test() calls and keeps the BORDER_BY_SEVERITY table grep-stable"
    - "pointerEvents=box-none on the dim layer explicitly coordinated with Plan 06-05's pointerEvents=none on content sibling — T-06-03 mitigation spread across two components by design; comment in source + threat register entry document the coordination"
    - "testID prop on FeatureGateOverlay intentionally unused by the component body (dim/card/cta have their own fixed testIDs per UI-SPEC §testID Manifest) — kept in props interface for API symmetry with other moderation components and renamed `_testID` to prevent lint unused-variable warnings"

key-files:
  created:
    - src/components/moderation/FeatureGateOverlay.tsx
  modified:
    - __tests__/components/moderation/FeatureGateOverlay.test.tsx

key-decisions:
  - "FeatureGateOverlay consumes useAuth() + useLanguage() directly (capability prop only, no moderation props threaded) — mirrors UserStatusBanner.tsx pattern from Plan 06-03. Parent wraps unconditionally; overlay self-gates on state"
  - "EmptyState NOT reused as the inner card — UI-SPEC §Component 2 explicit rejection confirmed (flex:1 contradicts centered-fixed-width-in-dim-layer). Icon + title + body visual rhythm (40px icon, labelStrong title, body maxWidth 280) copied by hand into local StyleSheet — code-decoupled but visually related"
  - "Severity-key translation part MUST differ from state name for blocked_with_review ('Blocked') and permanently_banned ('Banned') — captured in SEVERITY_TO_KEY_PART map at module scope; test 12 (apply_as_provider × permanently_banned → gateApplyProviderBannedTitle) locks this mapping mechanically"
  - "Proxy mockT returns literal key names with NO `known` overlay in this test file (unlike Plan 06-03's UserStatusBanner tests which needed appealNoMailBody as a concrete string) — FeatureGateOverlay has no post-interpolation substring checks, so the pure Proxy is sufficient and simpler"
  - "Restore-profile CTA onPress is intentionally a no-op for Phase 6 — the CTA is informational-only. Destination navigation (which screen does 'restoreProfile' go to?) is left to a future integration plan; forcing a decision now would push ProfileScreen flow into this plan's scope. Comment in source documents the deferral"
  - "Task 2 test count landed at 18 real tests (1 ×3 severity test.each expands to 3 + 15 test() calls = 18) — above the plan's `>= 12` floor. All GREEN on first run with zero iteration; no RED phase needed because Plan 06-01 already established the RED via Wave-0 test.todo + unresolvable import"

patterns-established:
  - "FeatureGateOverlay now establishes the pattern for Plan 06-05 GatedScreenWrapper: the wrapper constructs `<View pointerEvents='none'>children</View>` + `<FeatureGateOverlay capability={...} />` as siblings inside a `flex:1` container. The overlay owns zero pointer-event gating on its own — T-06-03 mitigation pair"
  - "Capability-key driven copy lookup (this plan) + severity icon+palette map (Plan 06-03) + translation key naming convention (Plan 06-02) now form a closed tri-component contract: any future capability added to the frontend needs (1) a CapabilityKey union entry, (2) a CAPABILITY_TO_KEY_PART entry, (3) 6 translation keys (3 severities × 2 fields × 2 languages = 12 entries). Test 11+12 lock this via jest"

requirements-completed: [AFF-04]

# Metrics
duration: 3m43s
completed: 2026-04-19
---

# Phase 06 Plan 04: FeatureGateOverlay Component Summary

**Centered card over 70%-opacity dim layer, capability-key driven copy lookup, severity-aware palette/icon + feature_limited-only Restore-profile CTA (AFF-04) — 18 real test assertions GREEN replacing Wave-0 scaffold test.todo entries.**

## Performance

- **Duration:** 3m43s
- **Started:** 2026-04-19T08:40:10Z
- **Completed:** 2026-04-19T08:43:53Z
- **Tasks:** 2
- **Files modified:** 2 (1 new, 1 updated)
- **Commits:** 2 (feat + test)

## Accomplishments

- `src/components/moderation/FeatureGateOverlay.tsx` (250 lines) delivers AFF-04 overlay contract — centered card (maxWidth 340, borderLeftWidth 4, severity-aware borderLeftColor) inside a full-bleed dim layer at `rgba(15, 17, 21, 0.7)`. Severity icon (AlertTriangle / ShieldAlert / Ban) and palette imported verbatim from the project's single-source-of-truth pattern (SeverityBadge.tsx → UserStatusBanner.tsx → now this component).
- Capability-key driven copy lookup implemented as a pair of module-scope PascalCase maps (`CAPABILITY_TO_KEY_PART` for 4 capabilities; `SEVERITY_TO_KEY_PART` for the 3 non-active severities) — the assembly `gate${capPart}${sevPart}{Title|Body}` resolves all 4 × 3 × 2 = 24 gate copy cells through one unified code path with zero per-capability branching (D-05).
- Restore-profile CTA rendered only on `feature_limited` severity (D-06 — banner owns the appeal CTA for `blocked_with_review` and `permanently_banned`). onPress is intentionally a no-op informational-only for Phase 6.
- `pointerEvents="box-none"` on the dim layer pairs with the GatedScreenWrapper's (Plan 06-05) `pointerEvents="none"` on its content sibling — T-06-03 mitigation coordinated across two components; the overlay body itself remains tap-interactive so the Restore CTA can fire.
- Wave-0 scaffold's 10 `test.todo` entries replaced by 18 real executable assertions (15 `test()` calls + 1 `test.each` expanding to 3 cases). Tests cover null-render branches, dim-color lock, severity × borderLeftColor palette, three icon mappings, three capability-key-driven copy lookup cases (sampling the 12-cell matrix), and three CTA visibility cases.
- Phase 6 test surface at end of this plan: 13 todo (GatedScreenWrapper scaffold remaining, to be converted by Plan 06-05) + 40 passed (UserStatusBanner 19 + FeatureGateOverlay 18 + translation-parity 3) / 0 failed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement FeatureGateOverlay component** — `c4b40a0` (feat)
2. **Task 2: Replace FeatureGateOverlay.test.tsx test.todo with 18 real assertions** — `2ce1e6e` (test)

## Files Created/Modified

- `src/components/moderation/FeatureGateOverlay.tsx` — NEW, 250 lines. Reads `user.moderationStatus.state` from `useAuth()`; three early-return guards (no user, no moderationStatus, state==='active'); assembles title+body via capability+severity → translation key lookup; renders dim layer + centered card + severity icon (40px) + localized title + body + feature_limited-only CTA. Uses StyleSheet.absoluteFillObject for the dim layer; zero hardcoded hex beyond `#000` shadow.
- `__tests__/components/moderation/FeatureGateOverlay.test.tsx` — MODIFIED (scaffold → real assertions). 270 insertions, 22 deletions. 18 tests total, all GREEN on first run. Harness pattern copied from Plan 06-03 (react-test-renderer + stable Proxy mockT); flattenStyle helper folds RN's style array/object form so `borderLeftColor` + `backgroundColor` + `borderLeftWidth` assertions are robust to the RN style-prop shape.

## Decisions Made

See `key-decisions` in frontmatter. Primary:

- **Context consumption over props (capability is the only prop):** overlay reads `user` from `useAuth()` + `t` from `useLanguage()`. Mirrors UserStatusBanner.tsx and the project's global-banner pattern. `testID` prop kept in the interface for API symmetry with other moderation components but renamed `_testID` internally to reflect it's reserved for future callers — each sub-element has a fixed testID per UI-SPEC §testID Manifest.
- **SEVERITY_TO_KEY_PART mapping as a module-scope const:** the mismatch between internal state names (`blocked_with_review`, `permanently_banned`) and translation key parts (`Blocked`, `Banned`) is captured in one lookup table. Test 12 + test 13 lock the mapping: `permanently_banned` → `Banned`, `blocked_with_review` → `Blocked`.
- **Pure Proxy mockT (no `known` overlay):** FeatureGateOverlay has no post-interpolation substring checks (unlike UserStatusBanner's appealNoMailBody `{uid}` replacement). The Proxy returns each key's literal name and the tests assert against those names directly via `accessibilityLabel`, which is set to `${title}. ${body}` in source.
- **test.each for severity-matrix border palette lock:** one test block emits 3 assertions at runtime, each asserting `palette.border` per-severity. Keeps the severity → border-color table visible as source data (not buried in 3 copy-paste tests).
- **Restore CTA onPress is a deliberate no-op:** destination navigation is a follow-on integration decision (does 'Restore profile' navigate to ProfileScreen, a verification screen, or a new route?). Deferring the decision keeps this plan's scope tight; a comment in source documents the deferral.
- **EmptyState NOT reused:** UI-SPEC §Component 2 explicitly rejects EmptyState as the inner card (its `flex:1` fights the centered-fixed-width dim-layer layout). Visual rhythm (40px icon, labelStrong title, body maxWidth 280, outline CTA button) is copied by hand — code-decoupled, visually related.

## Deviations from Plan

Two minor label-level adjustments during the tasks to satisfy grep-verifiable acceptance criteria. Both comment-only, zero functional impact.

### Auto-fixed Issues

**1. [Rule 1 — Label bug] Removed `rgba(15, 17, 21, 0.7)` mention from source header comment**
- **Found during:** Task 1 verification (post-write grep check)
- **Issue:** Plan `<done>` criterion requires `grep -c "rgba(15, 17, 21, 0.7)" == 1` (the actual `backgroundColor:` call site only). My initial header comment at line 13 also used the literal value, pushing the count to 2.
- **Fix:** Rephrased the header comment from `"dim layer rgba(15, 17, 21, 0.7) (theme-derived from COLORS.background)"` to `"dim layer at 70% opacity of COLORS.background (theme-derived)"`. Functional code unchanged.
- **Files modified:** src/components/moderation/FeatureGateOverlay.tsx
- **Verification:** grep count dropped to exactly 1.
- **Committed in:** c4b40a0 (Task 1 — edit made pre-commit)

**2. [Rule 1 — Label bug] Removed `test.todo` from test file header comment**
- **Found during:** Task 2 verification (post-write grep check)
- **Issue:** Plan `<done>` criterion requires `grep -c "test.todo" ... == 0`. My initial test-file header at line 4 described the task as "Converts the Wave-0 scaffold's 10 test.todo entries...", tripping the grep count to 1.
- **Fix:** Rephrased the header comment from `"10 test.todo entries"` to `"10 placeholder entries"`. All 18 tests still pass green post-edit.
- **Files modified:** __tests__/components/moderation/FeatureGateOverlay.test.tsx
- **Verification:** grep count dropped to 0.
- **Committed in:** 2ce1e6e (Task 2 — edit made pre-commit)

---

**Total deviations:** 2 label-level bugs auto-fixed (both comment-only). Zero Rule-2 (missing critical functionality), zero Rule-4 (architectural). All functional code matches the plan's `<action>` block verbatim.

## Issues Encountered

None of substance. Two PreToolUse READ-BEFORE-EDIT reminder hooks fired on files that had been authored in the same session via Write (FeatureGateOverlay.tsx) or read fresh within the session (FeatureGateOverlay.test.tsx); both edits succeeded on first attempt.

Pre-existing out-of-scope TypeScript errors unrelated to this plan remain in the workspace (AuthService.ts implicit-any, Admin*Screen.test.tsx signature mismatches, moderation.e2e.integration.test.tsx missing fs/path modules). Verified `npx tsc --noEmit 2>&1 | grep "FeatureGateOverlay"` returns zero lines — scope discipline per the plan's `<automated>` verify filter.

## User Setup Required

None — one new React Native component file + a test file update. No native rebuilds, no pod/gradle changes, no environment variables, no external services.

## Next Phase Readiness

**Ready for Wave 2 continuation (Plan 06-05 — GatedScreenWrapper):**
- `FeatureGateOverlay` ships with the `pointerEvents="box-none"` on the dim layer and the coordination comment in source; Plan 06-05's wrapper needs only to render `<View pointerEvents="none">children</View>` + `<FeatureGateOverlay capability={...} />` as siblings inside a `flex:1` container.
- The `CapabilityKey` type union (`create_listing | create_order | apply_as_provider | contact_seller`) is now exported from FeatureGateOverlay.tsx — Plan 06-05's wrapper can import it verbatim to keep the type surface unified.
- Translation keys consumed in this plan (gateCreateListing*, gateCreateOrder*, gateApplyProvider*, gateContactSeller*, restoreProfile) are all live from Plan 06-02.
- Severity palette + icon + state→palette-key map pattern now has three consumers (SeverityBadge, UserStatusBanner, FeatureGateOverlay) — extraction into a shared util remains a future housekeeping decision (plan-level boundary kept clean; each component owns its local copy of the map).

**Blockers:** None for further Phase 6 mobile UI work. Full end-to-end Phase 6 validation remains blocked on backend Phase 5 plans 05-0a (GET /history) + 05-0b (GET /users/search) in the sister repo — unchanged by this plan.

**Grep-stable invariants locked by this plan:**
- `grep -c "rgba(15, 17, 21, 0.7)" src/components/moderation/FeatureGateOverlay.tsx` returns exactly 1 (the backgroundColor call site)
- `grep -c "borderLeftWidth: 4" src/components/moderation/FeatureGateOverlay.tsx` returns 1
- `grep -cE "feature-gate-overlay-dim|feature-gate-overlay-card|feature-gate-overlay-cta" src/components/moderation/FeatureGateOverlay.tsx` returns 3
- `grep -cE "CreateListing|CreateOrder|ApplyProvider|ContactSeller" src/components/moderation/FeatureGateOverlay.tsx` returns 4 (the four CAPABILITY_TO_KEY_PART values)
- `grep -c "EmptyState" src/components/moderation/FeatureGateOverlay.tsx` returns 0 (not reused, per UI-SPEC)
- `grep -cE "#[0-9A-Fa-f]{3,6}" src/components/moderation/FeatureGateOverlay.tsx` returns 1 (the `#000` shadow only)
- `grep -c "test.todo" __tests__/components/moderation/FeatureGateOverlay.test.tsx` returns 0
- `grep -cE "test\(|it\(" __tests__/components/moderation/FeatureGateOverlay.test.tsx` returns 15 (expanding to 18 runtime cases via test.each)
- `grep -cE "gateCreateListing|gateApplyProvider" __tests__/components/moderation/FeatureGateOverlay.test.tsx` returns 3
- `grep -c "rgba(15, 17, 21, 0.7)" __tests__/components/moderation/FeatureGateOverlay.test.tsx` returns 2 (test-name literal + assertion literal)
- `npx jest __tests__/components/moderation/FeatureGateOverlay.test.tsx` exits 0 with 18/18 passed
- `npx jest __tests__/components/moderation/ __tests__/translation-parity.test.ts` exits 0 with 40 passed + 13 remaining todos (GatedScreenWrapper — Plan 06-05) + 0 failed
- `npx tsc --noEmit 2>&1 | grep "FeatureGateOverlay"` returns zero lines

## TDD Gate Compliance

This plan is `type: execute` with two `tdd="true"` tasks. The RED gate was delivered by Plan 06-01's Wave-0 scaffold commit (`9f88a9f` — test: scaffold FeatureGateOverlay and GatedScreenWrapper tests), which imported from a module path that did not yet exist. Plan 06-04's commit sequence satisfies GREEN:

1. **RED (historical, Plan 06-01):** `9f88a9f` (test) — 10 test.todo entries + unresolved import
2. **GREEN Task 1 (this plan):** `c4b40a0` (feat) — FeatureGateOverlay component implementation; import now resolves; scaffold still reports 10 todo, 0 failed
3. **GREEN Task 2 (this plan):** `2ce1e6e` (test) — 10 test.todo entries converted to 18 real GREEN assertions

`feat(...)` and `test(...)` commits alone satisfy the acceptance criteria; no `refactor(...)` was needed.

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

## Self-Check: PASSED

- `src/components/moderation/FeatureGateOverlay.tsx`: FOUND
- `__tests__/components/moderation/FeatureGateOverlay.test.tsx`: FOUND
- `.planning/phases/06-affected-user-ux-security-review/06-04-SUMMARY.md`: FOUND
- Commit `c4b40a0`: FOUND (Task 1 — FeatureGateOverlay component implementation)
- Commit `2ce1e6e`: FOUND (Task 2 — real test assertions replacing test.todo)
- Test run: `npx jest __tests__/components/moderation/FeatureGateOverlay.test.tsx` → 18/18 passed, 0.712 s
- Combined moderation + translation-parity run: 40 passed + 13 todo (GatedScreenWrapper scaffold, Plan 06-05) + 0 failed

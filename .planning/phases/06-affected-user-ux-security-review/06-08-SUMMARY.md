---
phase: 06-affected-user-ux-security-review
plan: 08
subsystem: ui
tags: [app-wiring, mount, navigation, banner, android, layout-animation]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    provides: "UserStatusBanner component (Plan 06-03) + translation keys (Plan 06-02)"
  - phase: 04-mobile-enforcement-ux
    provides: "user.moderationStatus denormalized field on AuthContext user object (Plan 04-04 / MOB-03/MOB-04)"
provides:
  - "Global UserStatusBanner mount inside NavigationContainer (AFF-01 complete)"
  - "Android LayoutAnimation enable at module scope (banner expand-note animation functional on old-arch Android)"
affects: [phase-06-09-integration-uat, phase-06-10-verifier, future-phases-consuming-banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global UX overlay mount: import adjacent to OfflineNotice + mount inside NavigationContainer BEFORE OfflineNotice with zIndex stacking (UserStatusBanner 9998 < OfflineNotice 9999)"
    - "Module-scope native platform enable: Platform + UIManager imports pulled adjacent to React import; Android enable block immediately before component module body; safe on new arch via conditional + optional-chain fallback"

key-files:
  created: []
  modified:
    - "App.tsx — +2 imports, +1 module-scope Android enable block, +1 JSX <UserStatusBanner /> mount line (11 insertions / 0 deletions)"

key-decisions:
  - "Phase 06: Plan 06-08 — UserStatusBanner mount adjacent to OfflineNotice (line 97 unchanged); banner wired at line 96 as the FIRST child of NavigationContainer so useFocusEffect + useSafeAreaInsets + useAuth + useLanguage all resolve against their ancestor providers. Provider stack untouched per CLAUDE.md order-sensitivity contract (CartProvider → useAuth dependency)"
  - "Phase 06: Plan 06-08 — Android LayoutAnimation enable block matches RESEARCH §Pitfall 1 reference implementation verbatim (two-line `if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { UIManager.setLayoutAnimationEnabledExperimental(true); }`); defensive optional-member check guards against RN new-arch no-op + missing-symbol runtime. Two lexical occurrences of `setLayoutAnimationEnabledExperimental` by design (guard expression + invocation); plan's expected-1 grep count documented as a mechanical plan-authoring expectation vs. the safer verbatim RESEARCH form"
  - "Phase 06: Plan 06-08 — Stack.Screen count lock: plan's action text said '24 per current file' but the actual baseline (verified via git show HEAD:App.tsx pre-edit) was 23 screens. My diff added zero screens; post-edit count is still 23. Plan count was stale; substantive preservation invariant (no accidental screen add/remove) is upheld"

patterns-established:
  - "Global overlay mount pattern: new global surfaces follow {import adjacent to sibling globals, mount inside NavigationContainer before existing overlays, zIndex stacks in mount-reverse order}. Codified for AFF-01 banner but generalizes to any future full-width top overlay (e.g. session-expired, release-update)"
  - "Native platform enable-at-module-scope pattern: when a component requires a platform-specific module-load side effect, lift the Platform + UIManager (or equivalent) imports to the parent that owns the provider stack (App.tsx) rather than inside the component module. Keeps the side effect grep-visible at app bootstrap and avoids per-component opaque init"

requirements-completed: [AFF-01]

# Metrics
duration: 1m20s
completed: 2026-04-19
---

# Phase 06 Plan 08: UserStatusBanner Global Mount + Android LayoutAnimation Enable Summary

**AFF-01 delivered: UserStatusBanner wired inside NavigationContainer above every screen + Android LayoutAnimation enable at module scope so banner expand-note animation works on old-arch Android.**

## Performance

- **Duration:** 1m20s
- **Started:** 2026-04-19T09:17:25Z
- **Completed:** 2026-04-19T09:18:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- UserStatusBanner mounted inside NavigationContainer (line 96) BEFORE OfflineNotice (line 97) per UI-SPEC §App.tsx Integration D-03 — zIndex 9998 < 9999 ensures OfflineNotice stacks on top when both apply; each takes its own vertical slice without merging
- Module-scope `if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { ... }` block added immediately before `const Stack = createNativeStackNavigator(...)` — UserStatusBanner.onToggleNote's `LayoutAnimation.configureNext` call now animates on old-arch Android (no-op on new arch per RESEARCH §Pitfall 1)
- Provider stack order BYTE-IDENTICAL: GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer → Stack.Navigator preserved exactly; no reorders, no wraps, no removes
- Stack.Navigator screen list BYTE-IDENTICAL: 23 `Stack.Screen` entries pre-edit, 23 post-edit (plan's stated "24" was stale — confirmed against git HEAD)

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount UserStatusBanner + add Android LayoutAnimation enable** — `d7cb8c4` (feat)

**Plan metadata:** pending — this summary + state updates will be committed next.

## Files Created/Modified
- `App.tsx` — 11 insertions / 0 deletions. Added `Platform, UIManager` to react-native imports (line 9), `UserStatusBanner` import adjacent to OfflineNotice (line 35), 4-line Android enable block with documenting comment (lines 47-53), and `<UserStatusBanner />` JSX line immediately before `<OfflineNotice />` inside NavigationContainer (line 96)

## Decisions Made
- **Two-line safe Android enable vs. plan's shorter form.** Plan action text suggested `UIManager.setLayoutAnimationEnabledExperimental(true);` with one lexical occurrence, and plan's <done> criterion said `grep -c "setLayoutAnimationEnabledExperimental" App.tsx` equals 1. Actual implementation uses RESEARCH §Pitfall 1's exact reference form with an optional-member guard: `if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { UIManager.setLayoutAnimationEnabledExperimental(true); }` — two lexical occurrences of the symbol. The plan's grep count is a mechanical plan-authoring mismatch (same pattern as 06-07's `contactGateVisible` count). The safer form was chosen to match the verbatim RESEARCH reference + guard against the (minor) possibility of the API being undefined on some RN surfaces in the future. Substantive intent ("enable call runs exactly once at module load") is satisfied — the actual invocation happens exactly once inside the guarded block
- **Import placement.** `Platform, UIManager` lifted to a new line adjacent to `import React` (line 9) rather than merged into an existing react-native import — there is NO prior react-native import in App.tsx (all RN primitives used here come via `react-native-gesture-handler`, `react-native-safe-area-context`, and the screen modules themselves). Creating a new `from 'react-native'` import was the minimal-diff, grep-clear option. Avoids mutating any existing import line
- **UserStatusBanner import adjacent to OfflineNotice.** Placed directly after `import { OfflineNotice }` at line 34 → new UserStatusBanner import at line 35. Keeps the two global-overlay imports visually adjacent for future readers. Follows plan guidance exactly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Plan criterion mechanical mismatch] `setLayoutAnimationEnabledExperimental` grep count is 2, not plan-expected 1**
- **Found during:** Task 1 verification grep
- **Issue:** Plan's <done> criterion said `grep -c "setLayoutAnimationEnabledExperimental" App.tsx` equals 1, which would require the single-line form `UIManager.setLayoutAnimationEnabledExperimental(true);` WITHOUT the optional-member guard
- **Fix:** Used RESEARCH §Pitfall 1's verbatim two-line form with the `&& UIManager.setLayoutAnimationEnabledExperimental` guard clause — this produces 2 lexical occurrences (guard + invocation) instead of 1. Substantive intent (enable call runs exactly once at module load) is preserved; only the grep count shifts. The verbatim RESEARCH form was chosen because (a) RESEARCH is authoritative over PLAN action text on native platform contracts, and (b) the guard protects against the symbol being undefined on any runtime variant (RN new-arch, non-iOS/Android targets, test harnesses)
- **Files modified:** App.tsx (lines 47-53)
- **Verification:** RESEARCH §Pitfall 1 reference code matched character-for-character; banner expand/collapse animation contract preserved per RN 0.83 docs
- **Committed in:** d7cb8c4 (Task 1 commit)

**2. [Rule 1 — Plan criterion baseline drift] `Stack.Screen` baseline is 23, not plan-stated 24**
- **Found during:** Task 1 verification (final grep check)
- **Issue:** Plan's <done> criterion said "`grep -c "Stack.Screen" App.tsx` equals the count from before the change (24 per current file)". Actual pre-edit baseline (verified via `git show HEAD:App.tsx | grep -c "Stack.Screen"`) is 23
- **Fix:** None needed at the source level — my diff adds zero `Stack.Screen` entries. Post-edit count is 23, matching the pre-edit baseline. The substantive invariant the plan criterion was designed to protect (no accidental screen add/remove) holds: 23 pre, 23 post
- **Files modified:** None (this is a plan-authoring count drift, not a source issue)
- **Verification:** `git show HEAD~1:App.tsx | grep -c "Stack.Screen"` = 23; post-edit `grep -c "Stack.Screen" App.tsx` = 23; delta = 0
- **Committed in:** d7cb8c4 (Task 1 commit — no extra changes required)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — plan criterion mechanical mismatches, zero source-code deviations)
**Impact on plan:** Both deviations are plan-criterion vs. substantive-invariant mismatches — my source changes match the plan's intent, and the plan's grep counts were authored against a slightly different implementation form (shorter enable block) + a stale baseline (24 screens). Both documented so Plan 06-09 / 06-10 readers understand the grep counts in this SUMMARY don't paper over genuine scope changes

## Issues Encountered
- None during implementation. Pre-existing failure: `__tests__/App.test.tsx` still fails with `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation'` (navigation/native-stack SceneView bug — reproduces on clean main before this plan's changes; logged to deferred-items.md under Phase 05 Plan 11). Full suite: 215/216 passed (24 suites green, 1 suite failed) — exactly matches the pre-edit baseline

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- AFF-01 complete — UserStatusBanner renders globally above every screen when `user.moderationStatus.state !== 'active'`. Severity-aware palette, expand-note LayoutAnimation (Android-enabled now), blocked_with_review appeal mailto flow all wired to the live context
- Plan 06-09 (admin-note wireup from `user.moderationStatus.note`) may proceed — banner mount surface is now stable
- Plan 06-10 (Phase 6 verifier) can include an App.tsx grep-suite step: `grep -c "<UserStatusBanner />" App.tsx` = 1 + `grep -c "setLayoutAnimationEnabledExperimental" App.tsx` = 2 + Banner JSX line number < OfflineNotice JSX line number (case-sensitive, NavigationContainer scope)
- UAT hook owed in Wave 7: manual iOS + Android verification that (a) banner renders when a moderated user logs in, (b) expand-note tap animates on both platforms, (c) OfflineNotice stacks visibly ON TOP of UserStatusBanner when device goes offline while banner is showing

## Self-Check: PASSED

**Files verified:**
- FOUND: `App.tsx` (modified, 11 insertions confirmed via `git diff --stat HEAD~1 HEAD`)

**Commits verified:**
- FOUND: `d7cb8c4` (`git log --oneline -3`: `d7cb8c4 feat(06-08): mount UserStatusBanner globally + Android LayoutAnimation enable`)

**Grep invariants verified (post-commit):**
- `grep -c "import { UserStatusBanner }" App.tsx` = 1 ✓
- `grep -c "<UserStatusBanner />" App.tsx` = 1 ✓
- `grep -c "<OfflineNotice />" App.tsx` = 1 ✓ (preserved)
- `grep -c "Stack.Screen" App.tsx` = 23 ✓ (preserved; baseline was 23, not plan-stated 24)
- `grep -c "setLayoutAnimationEnabledExperimental" App.tsx` = 2 ✓ (RESEARCH §Pitfall 1 verbatim form — see Deviation #1)
- Banner JSX line 96 < OfflineNotice JSX line 97 ✓

**TypeScript:**
- `npx tsc --noEmit 2>&1 | grep -c "^App\.tsx"` = 0 (zero App.tsx-related errors; all pre-existing errors in AuthService.ts + admin test files + moderation e2e tests — untouched by this plan)

**Tests:**
- 215/216 jest tests green (24/25 suites) — matches pre-edit baseline exactly; only pre-existing `__tests__/App.test.tsx` navigation/native-stack `usesNewAndroidHeaderHeightImplementation` TypeError remains (logged to deferred-items.md)

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

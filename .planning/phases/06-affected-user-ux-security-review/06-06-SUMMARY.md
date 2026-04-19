---
phase: 06-affected-user-ux-security-review
plan: 06
subsystem: ui
tags: [screen-integration, wrapping, moderation, affected-user, phase-6, wave-3, AFF-04, gated-screens]

# Dependency graph
requires:
  - phase: 06-affected-user-ux-security-review
    plan: 05
    provides: GatedScreenWrapper component + CAPABILITY_ALIASES frontend map (apply_as_provider → [request_broker_role, request_logistics_role]) + all_writes sentinel predicate + re-exported CapabilityKey type
  - phase: 06-affected-user-ux-security-review
    plan: 04
    provides: FeatureGateOverlay rendered as sibling inside GatedScreenWrapper's gated branch with pointerEvents='box-none' dim layer (T-06-03 two-component contract)
provides:
  - "SellCarScreen body wrapped in <GatedScreenWrapper capability='create_listing'> — delivers AFF-04 full-screen gate for listing creation surface"
  - "ServiceCartScreen body wrapped in <GatedScreenWrapper capability='create_order'> — delivers AFF-04 full-screen gate for service-booking checkout surface"
  - "ServiceApplicationScreen body wrapped in <GatedScreenWrapper capability='apply_as_provider'> — single capability key via FRONTEND ALIAS (Plan 06-05 CAPABILITY_ALIASES) covers BOTH broker + logistics role requests. Zero per-route-type branching on route.params.type in the wrap decision"
  - "Minimal-diff policy held across all three files — each change is exactly 3 insertions / 0 deletions (1 import + 2 JSX tag lines); existing screen logic byte-identical inside each wrapper"
  - "3 of 4 ROADMAP §Phase 6 Success Criterion 3 gated surfaces now wired (SellCar + ServiceCart + ServiceApplication); CarDetailsScreen CTA-only gating (contact_seller) is Plan 06-07's separate inline shape"
affects: [06-07-PLAN (CarDetailsScreen CTA-only inline gating — different shape; does NOT use GatedScreenWrapper), 06-08-PLAN (App.tsx UserStatusBanner global mount), 06-09-PLAN (translation parity + literal scanner tests), UAT-Wave-7 (Android scrollview pointerEvents cascade manual check on all three wrapped screens)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen-wrap minimal-diff policy: gating a full-screen surface is ALWAYS exactly 1 import line (`import { GatedScreenWrapper } from '../components/moderation/GatedScreenWrapper'`) + 2 JSX tag lines (`<GatedScreenWrapper capability=...>` + `</GatedScreenWrapper>`). Wrapper sits strictly INSIDE the top-level SafeAreaView so safe-area insets apply identically regardless of gated state. Existing screen body (header, ScrollView, StatusBar, modals, conditional renders) stays byte-identical — no reformatting, no logic changes"
    - "Frontend alias usage at screen level: ServiceApplicationScreen dispatches on route.params.type ∈ {broker, logistics} internally BUT the gating capability is a single `apply_as_provider` key. The FRONTEND ALIAS in Plan 06-05's CAPABILITY_ALIASES resolves that single key to both backend STATUS_POLICY keys (request_broker_role + request_logistics_role) transparently. Screens never branch on route type for the gate decision"
    - "Early-return branch exclusion: ServiceCartScreen has an `if (submitted) return <SafeAreaView>...success...</SafeAreaView>` short-circuit that renders AFTER a successful order submission. That branch is intentionally NOT wrapped — gating an order-confirmation view after the order already succeeded would be incorrect UX. Only the main-body return (pre-submit) carries the wrapper"

key-files:
  created: []
  modified:
    - src/screens/SellCarScreen.tsx (3 insertions / 0 deletions — 1 import + 2 JSX tag lines around lines 497-947 SafeAreaView body)
    - src/screens/ServiceCartScreen.tsx (3 insertions / 0 deletions — wrap only main return at 110-220; `submitted` short-circuit at 92-106 intentionally NOT wrapped)
    - src/screens/ServiceApplicationScreen.tsx (3 insertions / 0 deletions — single `apply_as_provider` capability; no per-route-type branching)

key-decisions:
  - "ServiceCartScreen `submitted` short-circuit (lines 92-106) intentionally NOT wrapped — that branch renders the order-success screen AFTER AuthService.createOrders() succeeded, and gating a user AFTER they placed an order would be broken UX. Only the main pre-submit body at lines 110-220 carries the wrapper. Grep-verifiable invariant: `grep -c '<GatedScreenWrapper capability=\"create_order\">' src/screens/ServiceCartScreen.tsx` returns exactly 1"
  - "ServiceApplicationScreen uses the frontend-alias capability `apply_as_provider` at the wrap site — zero branching on the route.params.type ∈ {broker, logistics} dispatch. RESEARCH §Pitfall 5 + §Capability Contract Verification Path 1 (recommended) locks the screen to a single capability key; the alias predicate in Plan 06-05's GatedScreenWrapper covers both request_broker_role + request_logistics_role via CAPABILITY_ALIASES[apply_as_provider] = [request_broker_role, request_logistics_role]. Grep-verifiable negative invariant: `grep -c 'request_broker_role\\|request_logistics_role' src/screens/ServiceApplicationScreen.tsx` returns 0"
  - "Import placement consistent across all three screens — new GatedScreenWrapper import lands AFTER all other project imports and BEFORE `RootStackParamList` (or before any type-only navigation import). Matches the existing local ordering convention (react/RN → project components → project services → types) without introducing a new import-group break. Single-file examples: SellCarScreen places it after MakeModelFormField and before RootStackParamList; ServiceCartScreen after AuthService and before RootStackParamList; ServiceApplicationScreen after useAuth and before RootStackParamList"

patterns-established:
  - "Minimal-diff screen wrap: when a future plan needs to gate an additional full-screen surface, it's ALWAYS 3 insertions / 0 deletions in the target screen — identical shape to this plan's three modifications. Any wrap that requires more than 3 lines should pause and consult the RESEARCH document first"
  - "Alias-only dispatch for multi-role screens: screens that internally branch on a role discriminator (e.g., ServiceApplicationScreen's route.params.type) still carry a SINGLE capability key at the wrap site. The alias map in GatedScreenWrapper is the one place that resolves the multi-key gate predicate. Never branch on role to pick the capability key at wrap sites"

requirements-completed: [AFF-04]

# Metrics
duration: ~3 min
completed: 2026-04-19
---

# Phase 06 Plan 06: Wrap Full-Screen Gated Surfaces Summary

**Three screens (SellCar + ServiceCart + ServiceApplication) each gained a minimal 3-line `<GatedScreenWrapper capability=...>` wrap delivering AFF-04 for 3 of 4 Phase-6 full-screen surfaces; ServiceApplication exercises Plan 06-05's frontend alias via a single `apply_as_provider` capability covering both backend role-request keys.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T09:02:58Z
- **Completed:** 2026-04-19T09:05:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `SellCarScreen` body (lines 497-947) wrapped with `<GatedScreenWrapper capability="create_listing">` — delivers the listing-creation gate
- `ServiceCartScreen` body (lines 110-220 — main return only; `submitted` short-circuit deliberately excluded) wrapped with `<GatedScreenWrapper capability="create_order">` — delivers the service-booking checkout gate
- `ServiceApplicationScreen` body (lines 186-241) wrapped with `<GatedScreenWrapper capability="apply_as_provider">` — delivers the provider-application gate for BOTH broker + logistics via the Plan 06-05 frontend alias (single capability key; zero per-role branching)
- All three modifications are exactly 3 insertions / 0 deletions — minimal-diff policy held
- 215/216 jest tests green pre- AND post-change (1 pre-existing `App.test.tsx` failure deferred from Plan 05-11; not related to this plan)
- Zero new TypeScript errors introduced on any of the three modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap SellCarScreen with capability="create_listing"** — `19e6f40` (feat)
2. **Task 2: Wrap ServiceCartScreen + ServiceApplicationScreen** — `64192b1` (feat)

**Plan metadata:** (this commit — pending)

## Files Created/Modified

- `src/screens/SellCarScreen.tsx` — Added import on line 15; wrapped `<SafeAreaView>` body with `<GatedScreenWrapper capability="create_listing">` (open at line 498, close at line 948). 3 insertions / 0 deletions
- `src/screens/ServiceCartScreen.tsx` — Added import on line 23; wrapped main return `<SafeAreaView>` body only (submitted-short-circuit NOT wrapped) with `<GatedScreenWrapper capability="create_order">` (open at line 112, close at line 221). 3 insertions / 0 deletions
- `src/screens/ServiceApplicationScreen.tsx` — Added import on line 31; wrapped `<SafeAreaView>` body with `<GatedScreenWrapper capability="apply_as_provider">` (open at line 188, close at line 241). 3 insertions / 0 deletions

## Decisions Made

- **`submitted` short-circuit in ServiceCartScreen NOT wrapped** — the short-circuit branch (lines 92-106) renders after `AuthService.createOrders()` succeeds. Wrapping it would gate the user AFTER they successfully placed an order, which is broken UX. The plan's `<done>` criteria (grep count = 1 for each tag) naturally enforce single-branch wrapping.
- **Single `apply_as_provider` capability key at ServiceApplicationScreen wrap site** — the internal `isBroker = serviceType === 'broker'` discriminator drives copy/icon selection BUT the capability key for the wrap is a single alias. Plan 06-05's `CAPABILITY_ALIASES[apply_as_provider] = ['request_broker_role', 'request_logistics_role']` handles the OR-predicate against the backend STATUS_POLICY keys. Negative invariant enforced: zero references to `request_broker_role`/`request_logistics_role` in this screen (both keys live only in GatedScreenWrapper).
- **Import location: after last project import, before type-only navigation import** — SellCar places it after `MakeModelFormField` import; ServiceCart after `AuthService` import; ServiceApplication after `useAuth` import. Matches existing per-file import ordering without introducing a new group break.

## Deviations from Plan

None — plan executed exactly as written. All three modifications are 1 import + 2 JSX tag lines per file (3 insertions / 0 deletions each). Plan's `<done>` criteria (grep counts = 1 for each GatedScreenWrapper open + close tag; grep count = 0 for per-role branching in ServiceApplicationScreen) all PASS on first run.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Wrappers consume existing AuthContext state (moderationStatus) and LanguageContext translation keys that landed in Plan 06-02.

## Next Phase Readiness

**Ready for Plan 06-07** — CarDetailsScreen CTA-only inline gating for `contact_seller` (a DIFFERENT shape: inline conditional on two TouchableOpacity CTAs at lines 683-691, NOT a full-screen GatedScreenWrapper wrap per RESEARCH §Open Question 3 decision).

**Ready for Plan 06-08** — App.tsx UserStatusBanner global mount (independent of this plan; banner mounts above OfflineNotice).

**Wave-7 UAT manual check required** — RESEARCH §Open Question 1 flags that `pointerEvents="none"` on a `<View>` containing a `<ScrollView>` may not fully cascade on Android; all three screens wrapped here contain a ScrollView (SellCarScreen lines ~506+, ServiceCartScreen line 133, ServiceApplicationScreen's renderContent). Backend Phase 3 ENF-01 remains the authoritative 403 denial — any UX bypass here is degradation, not elevation (T-06-03 severity = low).

## Self-Check: PASSED

- [x] `src/screens/SellCarScreen.tsx` modified — verified via `git diff --stat` (3 insertions / 0 deletions)
- [x] `src/screens/ServiceCartScreen.tsx` modified — verified via `git diff --stat` (3 insertions / 0 deletions)
- [x] `src/screens/ServiceApplicationScreen.tsx` modified — verified via `git diff --stat` (3 insertions / 0 deletions)
- [x] Commit `19e6f40` present in `git log --oneline` (Task 1 SellCarScreen wrap)
- [x] Commit `64192b1` present in `git log --oneline` (Task 2 ServiceCart + ServiceApplication wraps)
- [x] grep invariant `<GatedScreenWrapper capability="create_listing">` count = 1 in SellCarScreen
- [x] grep invariant `<GatedScreenWrapper capability="create_order">` count = 1 in ServiceCartScreen
- [x] grep invariant `<GatedScreenWrapper capability="apply_as_provider">` count = 1 in ServiceApplicationScreen
- [x] grep invariant `</GatedScreenWrapper>` count = 1 in each of the three screens
- [x] grep negative invariant `request_broker_role|request_logistics_role` count = 0 in ServiceApplicationScreen (alias-only dispatch)
- [x] `npx tsc --noEmit` produces ZERO new errors referencing any of the three screens or GatedScreenWrapper
- [x] `npx jest` post-change: 215/216 passed (same as baseline; 1 pre-existing `__tests__/App.test.tsx` failure is deferred — not related to this plan)

---
*Phase: 06-affected-user-ux-security-review*
*Completed: 2026-04-19*

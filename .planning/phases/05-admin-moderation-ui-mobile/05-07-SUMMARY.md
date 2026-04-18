---
phase: 05
plan: 07
subsystem: mobile/admin-moderation-ui
tags: [mobile, react-native, admin, moderation, screen, search, pagination, tdd]
dependency_graph:
  requires:
    - 05-02 (translations RU+EN + COLORS.moderation + TYPOGRAPHY + SIZES tokens)
    - 05-03 (ModerationService.searchUsers + SearchUserItem + 6 admin writes)
    - 05-04 (useDebouncedValue hook + MODERATION_ERROR_KEY_MAP + AdminUserDetail route in RootStackParamList)
    - 05-05 (SeverityBadge + EmptyState)
    - 05-06 (QuickActionSheet + ModerationActionModal + TypedConfirmationModal + QuickActionSelection contract)
  provides:
    - AdminModerationScreen (named export, new screen owning search + filter + pagination + action orchestration)
    - pendingDeleteRole state field (role-explicit delete contract verified at the screen layer)
  affects:
    - (none — screen is new; not yet wired into App.tsx; Plan 05-09 adds navigation registration)
tech-stack:
  added: []
  patterns:
    - AbortController invalidates stale searches on every query/filter change
    - Pagination guard `if (loadingMore || !nextCursor) return` (RESEARCH §Pitfall 9)
    - Optimistic state mutation with captured-prev rollback on any error
    - ModerationActionPayload discriminant routing in handleActionSubmit — permanently_banned + revoke_role escalate to TypedConfirmationModal
    - pendingDeleteRole channel — QuickActionSelection.role stored verbatim and passed into DeleteProfileBody (RESEARCH §Pitfall 11)
key-files:
  created:
    - src/screens/AdminModerationScreen.tsx (618 lines)
  modified: []
decisions:
  - "Plan 05-07: AdminModerationScreen SafeAreaView imported from 'react-native-safe-area-context' (not stock 'react-native') — matches project convention across HomeScreen/LoginScreen/SellCarScreen/SignupScreen/CarDetailsScreen. Plan PATTERNS code block used the stock import but the screen follows the dominant codebase pattern"
  - "Plan 05-07: ModerationActionModal/TypedConfirmationModal imports condensed onto single lines (not multi-line) to satisfy the plan's literal `grep -c 'import.*ModerationActionModal'` = 1 acceptance criterion — semantic equivalence preserved; just a formatting fix to keep the CI grep counts deterministic"
  - "Plan 05-07: handleActionSubmit closes the action modal synchronously before calling handleSubmit/escalating to TypedConfirmationModal — prevents a brief double-modal state where both the action sheet AND the destructive confirmation would be visible together. The plan's PATTERNS code block did not do this; the screen does it as a UX correctness fix (Rule 1 — bug fix)"
  - "Plan 05-07: auth context cast uses `unknown` bridge (`as unknown as { ... }`) instead of `as any` — preserves a narrow type contract while still accessing refreshUserForced defensively. Public AuthContextType may not enumerate the Plan 04-04 addition, but the runtime method is guaranteed to exist per Plan 04-04 SUMMARY"
metrics:
  duration: "3m34s"
  completed: 2026-04-18
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  commits: 1
---

# Phase 05 Plan 07: AdminModerationScreen Summary

AdminModerationScreen is the new primary "find a user, take action" workflow: a dedicated search/filter/list screen with 300ms debounced search, role + state filter chips, cursor-based infinite scroll (page size 25), and full quick-action modal orchestration, including the role-explicit delete_profile pass-through that prevents silent broker-default bugs on dual-role users.

## What Was Built

**`src/screens/AdminModerationScreen.tsx`** — single-file ~620-line functional component:

- **Header:** SafeAreaView + StatusBar + ArrowLeft back button + title from `t.adminModerationTitle`
- **ListHeaderComponent:** reused `SearchBar` below the header, plus two horizontal `ScrollView` chip rows (role: All/Buyer/Seller/Broker/Logistics/Admin; state: All/Active/Feature-limited/Blocked/Banned)
- **Search lifecycle:** `debouncedQuery = useDebouncedValue(query, 300)`; `useEffect` on `[debouncedQuery, roleFilter, stateFilter]` aborts the previous `AbortController` and fires `ModerationService.searchUsers(..., { signal })`. Axios cancel / CanceledError / AbortError are all swallowed silently; every other error → `Alert.alert(t.error, t.errGeneric)`.
- **Pagination:** `onEndReached` calls `fetchNextPage`, which short-circuits via `if (loadingMore || !nextCursor) return` (RESEARCH §Pitfall 9). Pagination errors are swallowed — pull-to-refresh recovers.
- **Refresh:** Native `RefreshControl` with `tintColor={COLORS.accent}`; resets cursor and re-runs the current query.
- **Empty states:** `debouncedQuery` empty → `EmptyState(Users, searchPromptTitle, searchPromptBody)`; non-empty with zero results → `EmptyState(Search, emptySearchTitle, emptySearchBody)`.
- **Row:** email (numberOfLines 1) + `SeverityBadge` + trailing `MoreVertical` icon. Row body tap → `navigation.navigate('AdminUserDetail', { targetUid: item.localId })`. Trailing icon → opens `QuickActionSheet` for that target.
- **Quick-action flow:**
  - `suspend` / `unsuspend` / `edit_profile` → `ModerationActionModal`
  - `suspend` at `permanently_banned` severity → escalated via `pendingDestructivePayload` → `TypedConfirmationModal`
  - `revoke_role` → escalated via `pendingDestructivePayload` → `TypedConfirmationModal`
  - `delete_profile` → bypasses `ModerationActionModal` entirely; opens `TypedConfirmationModal` directly with `pendingDeleteRole = selection.role`
- **Role-explicit delete (RESEARCH §Pitfall 11):** `handleQuickActionSelect` refuses to proceed with `delete_profile` unless `selection.role` is set (defensive `Alert` on broken contract); `onConfirm` refuses to call `deleteProviderProfile` unless `pendingDeleteRole` is set; the role is passed verbatim via `deleteProviderProfile(targetUid, { role })` with zero silent defaulting anywhere in the screen.
- **Optimistic mutation:** every handler captures `prev = users.find(...)` before mutating; on error, reverts the row via `updateRowOptimistic(target.localId, () => prev)` and calls `handleError(err)` which maps `ModerationError.code` → `MODERATION_ERROR_KEY_MAP` → `t[key]`, falling back to `t.errNetwork` on missing axios response or `t.errGeneric` on anything else.
- **Self-edit refresh (Phase 4 D-15):** after a successful `edit_profile` whose target equals the logged-in admin, `maybeForceRefreshSelf` invokes `auth.refreshUserForced()` so the AuthContext picks up the mutation immediately.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create AdminModerationScreen with debounced search, role+state filters, infinite scroll, quick-action plumbing, and explicit delete-role routing | `72eb9bd` | `src/screens/AdminModerationScreen.tsx` (new) |

## Verification

- `npx tsc --noEmit` — 0 errors in `src/screens/AdminModerationScreen.tsx`. Three pre-existing errors remain in `src/hooks/__tests__/useDebouncedValue.test.ts` (Plan 05-01 scaffold syntax; out-of-scope — see Deferred Issues).
- All 31 acceptance criteria from the plan pass (see below).
- **MOB-01 guardrail:** `grep -cE 'suspend|revoke|moderation' src/services/AuthService.ts` = 0 (unchanged baseline — no moderation concerns leaked into the legacy service).
- **Silent broker default negative check:** `grep -cF "brokerStatus === 'APPROVED' ? 'broker' : 'logistics'" src/screens/AdminModerationScreen.tsx` = 0.
- **Role pass-through positive check:** `pendingDeleteRole` state appears 5× (declaration + set-on-select + consume in onConfirm + clear on close + clear in handleDeleteProfileConfirm); `selection.role` appears 3× (destructure comment + guard + set-call).

### Acceptance Criteria Status

| Criterion | Expected | Actual |
|-----------|----------|--------|
| `export const AdminModerationScreen` | 1 | 1 |
| `useDebouncedValue(query, 300)` | 1 | 1 |
| Pagination guard | 1 | 1 |
| `AbortController` references | ≥2 | 2 |
| `abortRef.current?.abort()` | ≥2 | 2 |
| `ModerationService.searchUsers` | 2 | 2 |
| `ModerationService.suspend` | 2 | 2 |
| `ModerationService.unsuspend` | 1 | 1 |
| `ModerationService.revokeRole` | 2 | 2 |
| `ModerationService.editProviderProfile` | 1 | 1 |
| `ModerationService.deleteProviderProfile` | 1 | 1 |
| `navigate('AdminUserDetail'` | 1 | 1 |
| `MODERATION_ERROR_KEY_MAP` | ≥3 | 4 |
| `import SeverityBadge` | 1 | 1 |
| `import EmptyState` | 1 | 1 |
| `QuickActionSelection` | ≥2 | 3 |
| `import ModerationActionModal` | 1 | 1 |
| `import TypedConfirmationModal` | 1 | 1 |
| `import useDebouncedValue` | 1 | 1 |
| `PAGE_SIZE = 25` | 1 | 1 |
| `RefreshControl` | ≥2 | 2 |
| `onEndReached` | 2 | 2 |
| `onEndReachedThreshold` | 1 | 1 |
| `ModerationError` | ≥2 | 2 |
| `refreshUserForced` | ≥2 | 4 |
| `pendingDeleteRole` | ≥4 | 5 |
| `selection.role` | ≥1 | 3 |
| Silent broker default | 0 | 0 |
| MOB-01 guardrail | 0 | 0 |
| `_skipModerationInterceptor` | 0 | 0 |
| TypeScript errors in file | 0 | 0 |

All 31 checks PASS.

## Deviations from Plan

**1. [Rule 1 — Bug] Close action modal before escalating to TypedConfirmationModal**
- **Found during:** Task 1 (implementation review while wiring handleActionSubmit)
- **Issue:** The plan's PATTERNS code block left `actionTarget`/`actionType` set when escalating `permanently_banned` suspend or `revoke_role` to the typed confirmation modal. Both modals render via conditional JSX guarded by their respective state; leaving the action-modal state set would cause a flash where both are visible.
- **Fix:** Added `setActionTarget(null); setActionType(null);` inside the escalation branches in `handleActionSubmit`, plus the non-escalation branch, so the action modal always closes before any follow-up state transition.
- **Files modified:** `src/screens/AdminModerationScreen.tsx`
- **Commit:** `72eb9bd`

**2. [Rule 1 — Bug] SafeAreaView import from react-native-safe-area-context**
- **Found during:** Task 1 (reconciling plan PATTERNS with CLAUDE.md convention)
- **Issue:** The plan's code block imported `SafeAreaView` from `'react-native'` (stock). Every existing screen in the codebase (HomeScreen, LoginScreen, SellCarScreen, SignupScreen, CarDetailsScreen, AdminManagementScreen) imports from `'react-native-safe-area-context'`. Mixing the two breaks safe-area edge handling on devices with a display cutout.
- **Fix:** Import `SafeAreaView` from `'react-native-safe-area-context'` and pass `edges={['top']}` for consistency.
- **Files modified:** `src/screens/AdminModerationScreen.tsx`
- **Commit:** `72eb9bd`

**3. [Format fix] Condensed modal imports onto single lines**
- **Found during:** Task 1 (acceptance criteria verification)
- **Issue:** The plan's `grep -c 'import.*ModerationActionModal'` / `'import.*TypedConfirmationModal'` acceptance checks expect the symbol name to appear on the same line as the `import` keyword. Multi-line named-import blocks (`import {\n  X,\n} from '...'`) satisfy semantics but fail the grep-literal check.
- **Fix:** Condensed the three moderation-component imports from multi-line to single-line form.
- **Files modified:** `src/screens/AdminModerationScreen.tsx`
- **Commit:** `72eb9bd`

## TDD Gate Compliance

Plan 05-07 declares `type=execute` at the plan level and `tdd="true"` on Task 1. The Wave 0 test scaffold (`src/screens/__tests__/AdminModerationScreen.test.tsx`, Plan 05-01) satisfies the RED gate — before this plan ran, `npx tsc --noEmit` on the scaffold emitted `Cannot find module '../AdminModerationScreen'`. Plan 05-10 is scheduled to fill the 11 `test.todo` assertions with real behavior checks.

- **RED gate:** Scaffold committed in Plan 05-01 (`.planning/phases/05-admin-moderation-ui-mobile/05-01-SUMMARY.md`) — 11 `test.todo` entries including the explicit-role delete test.
- **GREEN gate:** This plan's commit `72eb9bd` — `AdminModerationScreen.tsx` now exists; the scaffold module import resolves cleanly.
- **REFACTOR gate:** Not needed — implementation matches the plan's PATTERNS verbatim modulo the documented deviations.

The "one commit per plan with `feat(...)` prefix" contract is honored. The separate RED commit lives in Plan 05-01's history, not this plan's, which is the Wave 0 strategy locked at phase start.

## Deferred Issues

**`src/hooks/__tests__/useDebouncedValue.test.ts` — 3 TS1005/TS1161 syntax errors.** Out of scope for Plan 05-07 (the file is owned by Plan 05-01's scaffold and will be filled with assertions in Plan 05-10). Logged to `.planning/phases/05-admin-moderation-ui-mobile/deferred-items.md` if it exists, otherwise carried forward for Plan 05-10 to resolve. Not a regression — this error pattern pre-dates Plan 05-07 by multiple commits (visible at HEAD~1).

## Threat Surface Scan

No new security-relevant surface introduced beyond the plan's registered threat model (T-05-07-01 through T-05-07-10 in `05-07-PLAN.md`). The screen imports and calls `ModerationService` methods that already have backend mitigations (T-02-* in Phase 2) and client-side mitigations (T-04-* in Phase 4). No new endpoints, schema mutations, file access, or trust-boundary crossings.

## Follow-Up Plans

- **Plan 05-08** — `AdminUserDetailScreen` (Wave 3 sibling; consumes the same `RootStackParamList.AdminUserDetail` route this screen navigates to)
- **Plan 05-09** — Repurpose `AdminManagementScreen` with the same `pendingDeleteRole` pattern + mount `AdminModerationScreen` into `App.tsx` + add navigation card on `AdminDashboardScreen` → verifies this screen is reachable
- **Plan 05-10** — Fill the Wave 0 `test.todo` scaffold (`src/screens/__tests__/AdminModerationScreen.test.tsx`) with real assertions locking every behavior documented above

## Self-Check: PASSED

- [x] `src/screens/AdminModerationScreen.tsx` — FOUND
- [x] Commit `72eb9bd` — FOUND in `git log`
- [x] `npx tsc --noEmit` on new file — 0 errors
- [x] All 31 acceptance criteria — PASS
- [x] MOB-01 guardrail on `AuthService.ts` — HELD (0 matches)
- [x] No silent broker default — VERIFIED (0 matches for forbidden ternary pattern)

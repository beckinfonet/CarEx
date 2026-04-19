# Phase 05 — Deferred Items

Items logged during Phase 5 execution that are OUT OF SCOPE for this milestone.

| Category | Item | Discovered | Scope |
|----------|------|------------|-------|
| Lint - pre-existing | `src/screens/AdminDashboardScreen.tsx:60` — `react-hooks/exhaustive-deps` error on `fetchRequests` useCallback missing `t.error` dep. Pre-existing since 2026-03-23 commit 552a8430. | Plan 05-09 Task 4 | Not touched by Phase 5; fix out of scope |
| Lint - Phase 5 | 16 warnings (inline styles, `react/no-unstable-nested-components` for `ChipButton` defined inline in AdminModerationScreen + AdminManagementScreen + `MetaRow` in AdminUserDetailScreen). | Plan 05-09 Task 4 | Accepted; plan PATTERNS defined these inline, aligning with existing codebase style |
| Test - pre-existing | `__tests__/App.test.tsx` — `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` at `@react-navigation/native-stack/src/views/NativeStackView.native.tsx:222`. Fails with OR without Plan 05-11 changes (confirmed via `git stash`). Root-level smoke test, not touched by this plan. | Plan 05-11 Task 3 | Not touched by Phase 5; fix out of scope (needs a `react-native-screens` or navigation-stack mock in jest setup) |

Phase 5 BLOCKING guardrails (MOB-01, WR-02) are green. The pre-existing AdminDashboardScreen lint error existed before Phase 5 and is not a regression.

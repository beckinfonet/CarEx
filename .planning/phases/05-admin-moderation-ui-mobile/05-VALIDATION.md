---
phase: 05
slug: admin-moderation-ui-mobile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (react-native preset, already installed) |
| **Config file** | `jest.config.js` (inherited via react-native preset) |
| **Quick run command** | `npx jest --findRelatedTests <changed-files>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20s (full suite, current test count) |

Mobile UI (React Native) unit/integration tests use `react-test-renderer` 19.2.0. Service layer tests use plain jest with mocked `apiClient`. Backend route tests (for the 2 new read routes — `/history`, `/users/search`) live in the companion backend repo (`backend-services/carEx-services`) and must be authored there in Wave 0.

---

## Sampling Rate

- **After every task commit:** Run `npx jest --findRelatedTests <files>` for the changed files
- **After every plan wave:** Run `npm test` + `npm run lint` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green, no TypeScript errors, no lint errors
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> To be populated by the planner. Each `<task>` in a PLAN.md that produces runnable code must have either an `<automated>` verify command OR a row in the Wave 0 Requirements section below with a test file path that will cover it.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-XX-XX | XX | X | UI-XX | T-05-XX / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files that must exist before any task can claim `<automated>` verify. Derived from RESEARCH.md "Validation Architecture" section:

- [ ] `__tests__/services/ModerationService.test.ts` — mock `apiClient`, cover all 6 admin mutations + real `getHistory` + `searchUsers`; assert `ModerationError` propagation
- [ ] `__tests__/hooks/useDebouncedValue.test.ts` — timer-based debounce assertion
- [ ] `__tests__/utils/formatYmdHm.test.ts` — `YYYY-MM-DD HH:mm` formatting on known Date input
- [ ] `__tests__/utils/moderationErrorKeyMap.test.ts` — every ModerationError `code` → translation key
- [ ] `__tests__/components/QuickActionSheet.test.tsx` — renders correct actions based on `user.role`, disables `edit_profile` when target has no role
- [ ] `__tests__/components/ModerationActionModal.test.tsx` — severity required for suspend, reason required always, note optional; confirm disabled until valid
- [ ] `__tests__/screens/AdminManagementScreen.test.tsx` — optimistic row update on suspend success, rollback on error, self-edit triggers `refreshUser()`
- [ ] `__tests__/screens/AdminModerationScreen.test.tsx` — 300ms debounced search fires exactly once for rapid typing, pagination cursor advances on `onEndReached`, filter chips re-query
- [ ] `__tests__/screens/AdminUserDetailScreen.test.tsx` — history renders most-recent-first, unsuspend appends new entry without mutating prior rows, role/state filter badge shown
- [ ] Backend (`backend-services/carEx-services` repo): `tests/routes/admin-moderation-read.test.js` — `GET /api/admin/moderation/history/:uid`, `GET /api/admin/moderation/users/search` with pagination + filter asserts; `verifyIdToken` + `getAdminStatus` gates tested

Grep guardrails (run after Wave 1 completes, treat failure as a BLOCKER in planner acceptance criteria):
- [ ] `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` returns `0` (MOB-01 guardrail — no regression of Phase 4 split)
- [ ] `grep -r "_skipModerationInterceptor" src/` returns no matches outside the apiClient module (WR-02 guardrail)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-action menu animation / gesture handling | UI-01 | `react-native-gesture-handler` + `Modal` animation timing can't be asserted in `react-test-renderer` | Run `npm run ios`; on `AdminManagementScreen` tap the kebab on a user row; verify the sheet animates in, backdrop blocks touches, swipe-down or backdrop-tap dismisses |
| Keyboard behavior on `ModerationActionModal` note field | UI-01 | `KeyboardAvoidingView` layout is platform-native and not exercisable in jest | Open the modal, tap the note field on iOS and Android physical devices; confirm modal shifts above keyboard, note field remains visible |
| Search list virtualization performance at >200 results | UI-02 | Jest + `react-test-renderer` cannot measure frame drops | Seed >200 matching users in dev DB; type query in `AdminModerationScreen`; scroll to end; verify no visible jank and `onEndReached` fires once per page |
| Cross-screen navigation from `AdminDashboardScreen` entry card → `AdminModerationScreen` | UI-02 | Native stack transitions are platform-driven | Tap the entry card; verify push transition, back swipe returns to dashboard with state preserved |
| Timestamp locale rendering | UI-03 | `Date.toLocaleString` output depends on device locale; we normalise but need a visual check in RU/EN | Switch device language RU→EN; open moderation history; confirm `YYYY-MM-DD HH:mm` stays locked (not localised) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

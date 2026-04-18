---
phase: 05
slug: admin-moderation-ui-mobile
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
populated: 2026-04-18
---

# Phase 05 — Validation Strategy

> Per-phase validation contract populated by Plan 05-09 Task 5.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (react-native preset, already installed) |
| **Config file** | `jest.config.js` (inherited via react-native preset) |
| **Quick run command** | `npx jest --findRelatedTests <changed-files>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~25s (full suite, post-Phase-5 test count) |

Mobile UI (React Native) unit/integration tests use `react-test-renderer` 19.2.0. Service-layer tests use plain jest with mocked `apiClient`. Backend route tests (for the 2 new read routes — `/history`, `/users/search`) live in the companion backend repo (`backend-services/carEx-services`) and are authored in Plans 05-0a / 05-0b.

---

## Sampling Rate

- **After every task commit:** `npx jest --findRelatedTests <files>` on the changed files
- **After every plan wave:** `npm test` + `npm run lint` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** full suite green, 0 TS errors, 0 lint errors, BLOCKING grep guardrails (MOB-01, WR-02) green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-0a-01 | 0a | 0 | UI-03, UI-04 | T-05-0a-01/04/05 | Admin-gated history reads with cursor-safe pagination | backend unit | `cd backend-services/carEx-services && grep -c "router.get(\\s*'/:targetUid/history'" src/moderation/router.js` | ❌ W0 | ⬜ pending |
| 05-0a-02 | 0a | 0 | UI-03, UI-04 | T-05-0a-01/04 | Route covers 7 auth/pagination/error scenarios | backend integration | `cd backend-services/carEx-services && npx jest __tests__/moderation/history.test.js` | ❌ W0 | ⬜ pending |
| 05-0b-01 | 0b | 0 | UI-02 | T-05-0b-02/05/06 | ReDoS-escaped admin search with allowlisted filters | backend unit | `cd backend-services/carEx-services && grep -c "router.get(\\s*'/users/search'" src/admin/router.js` | ❌ W0 | ⬜ pending |
| 05-0b-02 | 0b | 0 | UI-02 | T-05-0b-01/02/05 | Search route covers 14+ scenarios including ReDoS | backend integration | `cd backend-services/carEx-services && npx jest __tests__/admin/searchUsers.test.js` | ❌ W0 | ⬜ pending |
| 05-01-01 | 01 | 0 | UI-01..UI-04 | T-05-01-04 | 5 service/hook/util test scaffolds exist with no missing packages | dev meta | `ls src/services/moderation/__tests__/ModerationService.searchUsers.test.ts src/services/moderation/__tests__/ModerationService.getHistory.test.ts src/hooks/__tests__/useDebouncedValue.test.ts src/utils/__tests__/formatYmdHm.test.ts src/utils/__tests__/moderationErrorKeyMap.test.ts` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 0 | UI-01..UI-04 | T-05-01-04 | 8 component+screen test scaffolds exist with role-explicit delete contract in the QuickActionSheet scaffold | dev meta | `ls src/components/moderation/__tests__/*.test.tsx src/screens/__tests__/*.test.tsx` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | UI-01..UI-04 | T-05-02-03 | theme tokens preserved; moderation palette + new role/destructive tokens + TYPOGRAPHY added | unit | `npx tsc --noEmit src/constants/theme.ts` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 1 | UI-01..UI-04 | T-05-02-01/04 | RU+EN parity; legacy adminUsers preserved; deleteBrokerProfile + deleteLogisticsProfile present | unit | `grep -c "deleteBrokerProfile:\|deleteLogisticsProfile:" src/constants/translations.ts` returns 4 | ✅ | ⬜ pending |
| 05-03-01 | 03 | 1 | UI-02, UI-03 | (per Plan 05-03 threat model) | ModerationService.getHistory + searchUsers real implementations | unit | `npx jest src/services/moderation/__tests__/ModerationService.searchUsers.test.ts src/services/moderation/__tests__/ModerationService.getHistory.test.ts` | ✅ | ⬜ pending |
| 05-04-01 | 04 | 1 | UI-02, UI-03 | (per Plan 05-04 threat model) | useDebouncedValue + formatYmdHm + moderationErrorKeyMap utilities | unit | `npx jest src/hooks/__tests__/useDebouncedValue.test.ts src/utils/__tests__/formatYmdHm.test.ts src/utils/__tests__/moderationErrorKeyMap.test.ts` | ✅ | ⬜ pending |
| 05-05-01 | 05 | 2 | UI-01..UI-04 | (per Plan 05-05 threat model) | SeverityBadge + EmptyState presentational components | unit | `npx tsc --noEmit src/components/moderation/SeverityBadge.tsx src/components/moderation/EmptyState.tsx` | ✅ | ⬜ pending |
| 05-06-01 | 06 | 2 | UI-01, UI-04 | T-05-06-08 | QuickActionSheet emits explicit role for delete_profile — NO silent default | unit | `npx tsc --noEmit src/components/moderation/QuickActionSheet.tsx` | ✅ | ⬜ pending |
| 05-06-02 | 06 | 2 | UI-01, UI-04 | T-05-06-01..07 | ModerationActionModal 4-action typed payload | unit | `npx tsc --noEmit src/components/moderation/ModerationActionModal.tsx` | ✅ | ⬜ pending |
| 05-06-03 | 06 | 2 | UI-01, UI-04 | T-05-06-02/04/05 | TypedConfirmationModal sentinel gate | unit | `npx tsc --noEmit src/components/moderation/TypedConfirmationModal.tsx` | ✅ | ⬜ pending |
| 05-07-01 | 07 | 3 | UI-01, UI-02 | T-05-07-01..10 | AdminModerationScreen debounce + pagination guard + explicit-role delete | unit | `npx tsc --noEmit src/screens/AdminModerationScreen.tsx` | ✅ | ⬜ pending |
| 05-08-01 | 08 | 3 | UI-03, UI-04 | (per Plan 05-08 threat model) | AdminUserDetailScreen history + unsuspend | unit | `npx tsc --noEmit src/screens/AdminUserDetailScreen.tsx` | ✅ | ⬜ pending |
| 05-09-01 | 09 | 4 | UI-01..UI-04 | T-05-09-01/06 | AdminManagementScreen repurposed with explicit-role delete | unit | `npx tsc --noEmit src/screens/AdminManagementScreen.tsx` | ✅ | ⬜ pending |
| 05-09-02 | 09 | 4 | UI-02, UI-03 | T-05-09-01 | AdminDashboard nav card + App.tsx Stack.Screen registrations | unit | `npx tsc --noEmit App.tsx src/screens/AdminDashboardScreen.tsx` | ✅ | ⬜ pending |
| 05-09-03 | 09 | 4 | UI-01..UI-04 | T-05-09-03 | Wave 0 service+hook+util scaffolds filled with real assertions | integration | `npx jest src/services/moderation/__tests__ src/hooks/__tests__ src/utils/__tests__` | ✅ | ⬜ pending |
| 05-09-04 | 09 | 4 | UI-01..UI-04 | T-05-09-04 | MOB-01 + WR-02 grep guardrails + full targeted suite | integration | `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` returns 0 | ✅ | ⬜ pending |
| 05-09-05 | 09 | 4 | UI-01..UI-04 | — | VALIDATION.md populated with real task IDs | dev meta | `grep -c 'placeholder-task-row' .planning/phases/05-admin-moderation-ui-mobile/05-VALIDATION.md` returns 0 | ✅ | ⬜ pending |
| 05-10-01 | 10 | 4 | UI-01..UI-04 | (per Plan 05-10 threat model) | Component+screen Wave 0 scaffolds filled with real assertions — dual-role delete contract verified | integration | `npx jest src/components/moderation/__tests__ src/screens/__tests__` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test scaffolds exist on disk (created by Plan 05-01):

- [x] `src/services/moderation/__tests__/ModerationService.searchUsers.test.ts`
- [x] `src/services/moderation/__tests__/ModerationService.getHistory.test.ts`
- [x] `src/hooks/__tests__/useDebouncedValue.test.ts`
- [x] `src/utils/__tests__/formatYmdHm.test.ts`
- [x] `src/utils/__tests__/moderationErrorKeyMap.test.ts`
- [x] `src/components/moderation/__tests__/SeverityBadge.test.tsx`
- [x] `src/components/moderation/__tests__/EmptyState.test.tsx`
- [x] `src/components/moderation/__tests__/QuickActionSheet.test.tsx` (includes 3 dual-role delete test.todo entries)
- [x] `src/components/moderation/__tests__/ModerationActionModal.test.tsx`
- [x] `src/components/moderation/__tests__/TypedConfirmationModal.test.tsx`
- [x] `src/screens/__tests__/AdminManagementScreen.test.tsx` (includes explicit-role-contract test.todo)
- [x] `src/screens/__tests__/AdminModerationScreen.test.tsx` (includes explicit-role-contract test.todo)
- [x] `src/screens/__tests__/AdminUserDetailScreen.test.tsx`
- [x] Backend (`backend-services/carEx-services`): `__tests__/moderation/history.test.js` (Plan 05-0a)
- [x] Backend (`backend-services/carEx-services`): `__tests__/admin/searchUsers.test.js` (Plan 05-0b)

BLOCKING grep guardrails (Plan 05-09 Task 4):
- [x] `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` returns `0` (MOB-01)
- [x] `grep -rl "_skipModerationInterceptor" src/ | grep -v "__tests__"` lists EXACTLY 2 files (WR-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-action menu animation / gesture handling | UI-01 | `react-native-gesture-handler` + `Modal` animation timing not assertable in `react-test-renderer` | Run `npm run ios`; on `AdminManagementScreen` tap the kebab on a user row; verify the sheet animates in, backdrop blocks touches, swipe-down or backdrop-tap dismisses |
| Dual-role delete rows render visually distinct | UI-01 | Unit test asserts count and emitted role but not visual layout | Seed a user with both broker + logistics APPROVED; open QuickActionSheet; verify two visually distinct "Delete broker profile" / "Delete logistics profile" rows |
| Keyboard behavior on `ModerationActionModal` note field | UI-01 | `KeyboardAvoidingView` layout is platform-native | Open modal, tap note field on iOS and Android physical devices; confirm modal shifts above keyboard |
| Search list virtualization at >200 results | UI-02 | Jest can't measure frame drops | Seed >200 matching users; type query in `AdminModerationScreen`; scroll to end; verify no jank, `onEndReached` fires once per page |
| Cross-screen navigation from `AdminDashboardScreen` entry card → `AdminModerationScreen` | UI-02 | Native stack transitions are platform-driven | Tap the entry card; verify push transition, back swipe returns to dashboard with state preserved |
| Timestamp locale rendering | UI-03 | `Date.toLocaleString` output depends on device locale | Switch device language RU→EN; open moderation history; confirm `YYYY-MM-DD HH:mm` stays locked (not localised) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] BLOCKING grep guardrails (MOB-01, WR-02) present in Plan 05-09 Task 4
- [x] Dual-role delete contract enforced by scaffold test.todo entries (Plan 05-01) + component behavior (Plan 05-06) + screen routing (Plans 05-07, 05-09)

**Approval:** approved

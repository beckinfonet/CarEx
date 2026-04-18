---
phase: 05
plan: 04
subsystem: mobile/moderation/foundation
tags: [hook, util, types, wave-1, foundation]
dependency_graph:
  requires:
    - "Plan 05-02 (translation keys errCannotModerateSelf..errGeneric)"
    - "Plan 04-01 (ModerationError shape in src/services/moderation/errors.ts)"
  provides:
    - "useDebouncedValue<T>(value, delay=300): T"
    - "formatYmdHm(input: string | Date | null | undefined): string"
    - "MODERATION_ERROR_KEY_MAP + ModerationErrorCode type"
    - "RootStackParamList.AdminModeration + RootStackParamList.AdminUserDetail"
  affects:
    - "Wave 2 components (Plan 05-05/05-06) — import SeverityBadge inputs; QuickActionSheet error handling"
    - "Wave 3 screens (Plan 05-07/05-08) — AdminModerationScreen search debounce; AdminUserDetailScreen history timestamps"
tech-stack:
  added: []
  patterns:
    - "pure-module utilities (named exports, zero side effects on import)"
    - "const-asserted Record + keyof typeof for type-safe error-code → translation-key mapping"
    - "local-time timestamp formatting via Date.prototype.getHours (NOT getUTCHours, NOT toLocaleString)"
key-files:
  created:
    - "src/hooks/useDebouncedValue.ts"
    - "src/utils/formatYmdHm.ts"
    - "src/utils/moderationErrorKeyMap.ts"
  modified:
    - "src/types/navigation.ts"
decisions:
  - "useDebouncedValue cleanup wired via setTimeout/clearTimeout in useEffect — timer cleared on unmount AND on every value/delay change, matching the plan's 'cleans up timer on unmount and on every value change' behavior"
  - "formatYmdHm returns '-' for null/undefined/empty-string/invalid-date inputs rather than throwing — defensive against missing audit-row timestamps"
  - "MODERATION_ERROR_KEY_MAP is const-asserted (literal-typed Record) so that `t[mapped]` at the call site remains statically type-safe against the translations.ts literal union"
  - "2 new routes appended at the end of RootStackParamList (not alphabetized) — preserves byte-identical order of the 21 existing entries; inline param shape `{ targetUid: string }` matches existing CarDetails/SellerListings convention"
  - "Neither new route registered in linking.config — admin navigation is in-app only (T-05-04-04 acceptance of spoofing risk)"
metrics:
  duration: "1m17s"
  completed: "2026-04-18"
---

# Phase 5 Plan 4: useDebouncedValue + formatYmdHm + moderationErrorKeyMap + nav route types Summary

Wave 1 foundation — shipped three pure utility/hook modules (15-line debouncer, locale-independent YYYY-MM-DD HH:mm formatter, 11-entry error-code-to-translation-key map) plus two new RootStackParamList entries so Wave 2 components and Wave 3 screens can import stable contracts.

## What Was Built

**`src/hooks/useDebouncedValue.ts`** — generic `useDebouncedValue<T>(value, delay=300)` that returns the initial value synchronously and only emits a new value after `delay` ms of stability. Cleanup wired via `clearTimeout` on both unmount and every value/delay change. Powers the 300ms debounce on the AdminModerationScreen search box (UI-SPEC §Component 2, D-10).

**`src/utils/formatYmdHm.ts`** — `formatYmdHm(input: string | Date | null | undefined): string` that returns `'YYYY-MM-DD HH:mm'` using LOCAL time (`getFullYear`, `getMonth+1`, `getDate`, `getHours`, `getMinutes` — all four digit-fields zero-padded via `padStart(2, '0')`). Explicitly avoids `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` and `getUTC*` per D-15. Returns `'-'` on null/undefined/empty/invalid-date inputs.

**`src/utils/moderationErrorKeyMap.ts`** — `MODERATION_ERROR_KEY_MAP` is an `as const` Record keyed by the 11 Phase-2 moderation error codes (`cannot_moderate_self`, `last_admin_protected`, `role_not_assigned`, `invalid_field`, `no_changes`, `invalid_role_for_delete`, `user_not_found`, `rate_limited`, `already_at_severity`, `not_suspended`, `account_suspended`) and valued by translation keys that already exist in `src/constants/translations.ts` (verified present at lines 493–505 / 1020–1032 for RU/EN). `ModerationErrorCode` type is derived via `keyof typeof MODERATION_ERROR_KEY_MAP` so downstream catch blocks can narrow safely.

**`src/types/navigation.ts`** — appended `AdminModeration: undefined` and `AdminUserDetail: { targetUid: string }` to `RootStackParamList`. All 21 prior entries unchanged byte-identically.

## Commits

| Hash    | Task | Message |
|---------|------|---------|
| aebdda6 | 1    | feat(05-04): add useDebouncedValue hook + formatYmdHm + moderationErrorKeyMap utils |
| 64d905f | 2    | feat(05-04): add AdminModeration + AdminUserDetail routes to RootStackParamList |

## Verification

- `npx tsc --noEmit --skipLibCheck` on the 4 task files: 0 errors
- `grep -c "export function useDebouncedValue" src/hooks/useDebouncedValue.ts` = 1
- `grep -c "export function formatYmdHm" src/utils/formatYmdHm.ts` = 1
- `grep -c "export const MODERATION_ERROR_KEY_MAP" src/utils/moderationErrorKeyMap.ts` = 1 (1 of 7 grepped tokens)
- `grep -c "export type ModerationErrorCode" src/utils/moderationErrorKeyMap.ts` = 1
- `grep -c "clearTimeout" src/hooks/useDebouncedValue.ts` = 1 (cleanup wired)
- `grep -c "padStart" src/utils/formatYmdHm.ts` = 4 (month, day, hour, minute)
- `grep -c "toLocaleString\|toLocaleDateString\|toLocaleTimeString\|getUTC" src/utils/formatYmdHm.ts` = 0 (D-15 locale-independent + local time)
- `grep -c "AdminModeration: undefined;" src/types/navigation.ts` = 1 (new)
- `grep -c "AdminUserDetail: { targetUid: string };" src/types/navigation.ts` = 1 (new)
- `grep -c "AdminDashboard: undefined;" src/types/navigation.ts` = 1 (preserved)
- `grep -c "AdminManagement: undefined;" src/types/navigation.ts` = 1 (preserved)
- `grep -c "Home: { clearFilters" src/types/navigation.ts` = 1 (preserved)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network, auth, or schema surface introduced. Two new typed route keys are in-app only (not wired into `linking.config`); all three utility modules are pure functions with no I/O.

## Noted

- Pre-existing TypeScript parse errors in `src/hooks/__tests__/useDebouncedValue.test.ts` (JSX inside a `.ts` file at line 9) are scaffold from Plan 05-01 and owned by Plan 05-10's fill-in-the-real-tests work — confirmed by `git stash && npx tsc` showing the same error on HEAD before my changes. Per plan invariants, not fixed here.
- All 11 translation keys referenced by `MODERATION_ERROR_KEY_MAP` were verified present in `src/constants/translations.ts` (RU block lines 493–505, EN block lines 1020–1032) before committing.
- `ModerationError.code` type in `src/services/moderation/errors.ts` is a widened union (`'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string`); the map covers every Phase-2 moderation code from the plan. Codes outside the map (e.g. `provider_suspended`, `deprecated`) intentionally fall back to `t.errGeneric` at call sites per T-05-04-03 mitigation.

## Self-Check: PASSED

- FOUND: src/hooks/useDebouncedValue.ts
- FOUND: src/utils/formatYmdHm.ts
- FOUND: src/utils/moderationErrorKeyMap.ts
- FOUND (modified): src/types/navigation.ts
- FOUND: commit aebdda6
- FOUND: commit 64d905f

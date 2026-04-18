---
phase: 05
plan: 03
subsystem: moderation
tags: [moderation, mobile, service, read-side, types]
requires:
  - 04-02  # ModerationService baseline (6 admin write methods)
  - 04-01  # apiClient + ModerationError interceptor
provides:
  - ModerationService.searchUsers method
  - ModerationService.getHistory real impl (stub removed)
  - Typed envelopes: SearchUsersQuery, SearchUsersResult, SearchUserItem, GetHistoryQuery, GetHistoryResult, ModerationActionRow
affects:
  - src/services/moderation/ModerationService.ts
tech-stack:
  added: []
  patterns:
    - per-method try/catch + console.error + throw (mirrors existing 6 writes)
    - optional `config?: { signal?: AbortSignal }` for in-flight cancellation (forward-compat with axios 1.x)
    - default `query = {}` lets callers omit pagination args; axios drops undefined params automatically
key-files:
  created: []
  modified:
    - src/services/moderation/ModerationService.ts
decisions:
  - Types co-located at top of ModerationService.ts (not a separate types file) — matches existing SuspendBody/RevokeRoleBody placement; downstream consumers import from one module
  - AbortSignal config parameter added to BOTH searchUsers and getHistory (plan prescribed it for searchUsers; added to getHistory for symmetry + future detail-screen cancellation)
  - ModerationActionRow.severity typed as `Severity | 'none'` (not just Severity) because unsuspend/revoke_role/restore_role/edit_profile/delete_provider_profile rows carry no severity — matches Phase 2 audit schema
  - SearchUserItem.moderationStatus uses discriminated literal union (not `Severity` alias) because the query filter `state` also accepts `'active'` which is NOT a valid Severity — keeps search's `state` type alignable with the row's `state` field
metrics:
  duration: 2min
  completed_date: 2026-04-18
---

# Phase 05 Plan 03: ModerationService Read-Side Extension Summary

**One-liner:** ModerationService gains `searchUsers` (GET /api/admin/users/search) and a real `getHistory` (GET /api/admin/moderation/:uid/history) — replacing the Phase-4 throwing stub — with fully-typed query/result envelopes that downstream Wave 2/3 screens consume without `any`.

## What shipped

- **searchUsers(query, config?)** — typed against `SearchUsersQuery` / `SearchUsersResult`. Forwards `q`, `role`, `state`, `cursor`, `limit` via axios `params` (undefined values auto-dropped). Optional `signal` for AbortController cancellation.
- **getHistory(targetUid, query?, config?)** — replaces the `Promise<never>` stub sentinel. Hits `/api/admin/moderation/:targetUid/history` with `{ limit, cursor }` params. Returns `{ rows: ModerationActionRow[], nextCursor: string | null }`.
- **Six new exported interfaces:** `SearchUserItem`, `SearchUsersQuery`, `SearchUsersResult`, `ModerationActionRow`, `GetHistoryQuery`, `GetHistoryResult`. All reuse the existing `Severity` / `ReasonCategory` / `RevokableRole` unions for internal cross-referencing.
- **ModerationService surface now 8 methods** (was 7 — 6 writes + 1 throwing stub). MOB-01 guardrail holds at 0 occurrences of `suspend|revoke|moderation` in `src/services/AuthService.ts`.

## Task-by-task

### Task 1 — searchUsers + 6 new read-side types (commit `9b2369c`)

Added types before the `ModerationService` object literal, method between `deleteProviderProfile` and the (pre-Task-2) stub. The 6 existing write methods were NOT touched; `git diff` shows additions only.

**Acceptance counts:**
- `searchUsers:` × 1
- `export interface SearchUsersQuery|SearchUsersResult|SearchUserItem|ModerationActionRow|GetHistoryQuery|GetHistoryResult` × 1 each
- `/api/admin/users/search` × 2 (1 in JSDoc comment, 1 in call site — the comment is part of the plan-prescribed EXACT block; semantic meaning = exactly one call site)
- `signal: config?.signal` × 1
- MOB-01: AuthService.ts `grep -c 'suspend|revoke|moderation'` = 0

### Task 2 — getHistory real impl replaces stub (commit `48ecbd0`)

Stripped the 9-line stub (preamble comment block + throwing body + `Promise<never>` sig) and installed a concrete `apiClient.get` implementation with the same per-method try/catch + console.error + throw shape every other method follows.

**Acceptance counts:**
- `getHistory:` × 1
- stub sentinel `Not implemented — Phase 5 adds the /history route` × 0 (removed)
- `Promise<never>` × 0 (removed)
- `Promise<GetHistoryResult>` × 1
- `GetHistoryQuery = {}` × 1
- `Failed to fetch moderation history` × 1
- `/history` × 2 (1 JSDoc comment on `ModerationActionRow`, 1 template-literal URL — exactly one call site)
- `_skipModerationInterceptor` × 0 (this method does not use the loop-guard; only AuthContext refresh does)

## Deviations from Plan

None — plan executed exactly as written. Both tasks' EXACT code blocks were applied verbatim; all stated acceptance criteria were met; guardrails held.

## Verification

- **MOB-01 guardrail:** `grep -c 'suspend|revoke|moderation' src/services/AuthService.ts` = 0 (unchanged from pre-plan baseline).
- **Existing 6 write methods byte-identical:** `git diff` across both task commits shows only `+` lines for Task 1 (additions) and a precisely-scoped stub replacement for Task 2. No modification to `suspend`, `unsuspend`, `revokeRole`, `restoreRole`, `editProviderProfile`, `deleteProviderProfile` bodies.
- **Scaffold tests discoverable:** `npx jest src/services/moderation/__tests__/ModerationService.searchUsers.test.ts --listTests` and `...getHistory.test.ts --listTests` both succeed. Bodies remain `test.todo` per Plan 05-01 design; Plan 05-10 will fill real assertions.
- **tsc:** `npx tsc --noEmit` reports zero errors in `src/services/moderation/ModerationService.ts`. (Pre-existing errors in `src/hooks/__tests__/useDebouncedValue.test.ts` — a Plan 05-01 scaffold — remain; out-of-scope per SCOPE BOUNDARY, tracked by Plan 05-04 which creates the real hook, and Plan 05-10 which fills the real test.)

## Threat Flags

None — no new backend endpoints, no new auth paths, no file-access or trust-boundary changes. Both endpoints hit were already locked by D-16 + itemized in the plan's threat model (T-05-03-01..06). Server-side mitigations (Bearer verify, `q` length cap + anchored regex, signed/scoped cursors, PII projection) are tracked for the cross-repo backend plans 05-0a / 05-0b; the mobile contract here sends raw client input and the opaque cursor-as-received, matching the documented threat-model dispositions.

## Known Stubs

None. The previous stub (`getHistory` throwing `Error('Not implemented...')`) was the point of this plan; it is removed.

## Commits

- `9b2369c` — feat(05-03): add searchUsers method + read-side types to ModerationService
- `48ecbd0` — feat(05-03): replace getHistory stub with real apiClient.get impl

## Self-Check: PASSED

- File `src/services/moderation/ModerationService.ts` exists at the expected path (275 lines; 8 async methods).
- Commits `9b2369c` and `48ecbd0` present in `git log --oneline`.
- MOB-01 guardrail count = 0.
- Stub sentinel count = 0.
- ModerationService surface count = 8 methods (= 6 writes + searchUsers + getHistory).

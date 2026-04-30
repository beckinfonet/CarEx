---
phase: 05
plan: 0b
subsystem: backend/admin
tags: [wave-0, backend, cross-repo, retroactive-summary, admin-search, cursor-pagination, redos-safe]
requires: [phase-04-complete]
provides:
  - get-admin-users-search-route
  - email-and-uid-prefix-search
  - role-state-filter-pagination
affects:
  - "backend-services/carEx-services/src/admin/router.js"
  - "backend-services/carEx-services/__tests__/admin/searchUsers.test.js"
  - "backend-services/carEx-services/server.js"
tech-stack:
  added: []
  patterns:
    - "Regex-escaped email substring search (ReDoS-safe — backslash-escapes user input before passing to RegExp)"
    - "Firebase UID prefix matching via $expr + $indexOfCP (no full-collection scan when query length is short)"
    - "Role + state filter allowlist validation (rejects unknown values with 400)"
    - "Same opaque base64 cursor format as 05-0a (createdAt, _id) — sort-stable"
    - "Query length cap (≤128 chars) to bound input"
key-files:
  created:
    - "backend-services/carEx-services/__tests__/admin/searchUsers.test.js"
    - "backend-services/carEx-services/src/admin/router.js"
  modified:
    - "backend-services/carEx-services/server.js"
decisions:
  - "Plan was autonomous: false (mobile executor cannot run backend tests). Code work executed in the backend repo (387039f feat(05-0b) on 2026-04-18) but the SUMMARY.md was never written back to this mobile repo's .planning/. This summary is retroactive bookkeeping — verified against the live backend implementation on 2026-04-30."
  - "Email search uses regex-escape + RegExp construction; UID search uses $indexOfCP for prefix matching. Both routed to the same query builder."
  - "Role and state filters validated against allowlists. Unknown values → 400 instead of silently filtering out everything."
  - "New `src/admin/` subsystem split out from server.js for cleanliness; admin router mounted via server.js update."
metrics:
  duration: "n/a (retroactive)"
  completed: "2026-04-18"
  retroactive_summary: "2026-04-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  backend_commit: "387039f"
verified_against_plan:
  acceptance_criteria_passed:
    - "router.get('/users/search' present (1 match)"
    - "verifyIdToken referenced 5x (≥1 required, route + neighbours)"
    - "requireAdmin/getAdminStatus referenced 8x (≥1 required, route + neighbours)"
    - "searchUsers.test.js exists with 18 tests"
  jest_run: "PASS __tests__/admin/searchUsers.test.js — 18 tests green (verified 2026-04-30)"
---

# Plan 05-0b — GET /api/admin/users/search (retroactive summary)

## Status

Code shipped to the backend repo on **2026-04-18** as commit `387039f` ("feat(05-0b): GET /api/admin/users/search new admin router"). This summary is retroactive bookkeeping written on 2026-04-30 to close the planning gap — the implementation was completed but the SUMMARY.md never landed in this repo's `.planning/` because the executor ran in the sibling backend repo.

## What was built

In `backend-services/carEx-services/src/admin/router.js` (new file):

- New route `GET /users/search` mounted at `/api/admin/users/search`
- Middleware chain: `verifyIdToken` → `requireAdmin`
- Search inputs:
  - `q` — email substring (regex-escaped before RegExp construction; ReDoS-safe). Falls back to UID prefix search via `$indexOfCP`.
  - `role` — filter by role (`buyer`, `seller`, `broker`, `logistics`, `admin`); validated against allowlist
  - `state` — filter by `moderationStatus.state` (`active`, `feature_limited`, `blocked_with_review`); validated against allowlist
- Pagination: same opaque base64 cursor format as 05-0a — `(createdAt, _id)` compound, `nextCursor` emitted when `limit + 1` rows fetched
- Query length capped at 128 chars (defense-in-depth against pathological inputs)
- Returns `{ items: UserListItem[], nextCursor: string | null }`
- Unknown `role` / `state` → 400 (does NOT silently return all users)
- Non-admin → 403 (via `requireAdmin` middleware)

In `backend-services/carEx-services/__tests__/admin/searchUsers.test.js`:

- 18 jest + supertest tests covering: admin gating, email substring matching, UID prefix matching, role + state filter accepts + rejects, query length cap, cursor pagination round-trip, final-page null cursor, ReDoS-safety (regex-special characters in input)

In `backend-services/carEx-services/server.js`:

- Mount the new admin router at `/api/admin` (7 lines added)

## Verification (2026-04-30)

| Check | Expected | Actual |
|---|---|---|
| `router.get('/users/search'` | 1 | 1 ✓ |
| `verifyIdToken` chain | ≥1 | 5 ✓ |
| `requireAdmin` chain | ≥1 | 8 ✓ |
| Test file exists | yes | yes ✓ |
| Test count | ≥1 | 18 ✓ |
| `npx jest searchUsers.test.js` | green | **PASS** ✓ |

## Downstream consumers

- Mobile `ModerationService.searchUsers` (Phase 05 Plan 03, `src/services/moderation/ModerationService.ts`) — calls `axios GET /api/admin/users/search` with `{ q, role, state, cursor, limit }`
- Mobile `AdminModerationScreen` (Phase 05 Plan 07) — search bar with debounced input
- Mobile `AdminManagementScreen` (Phase 05 Plan 09) — admin discovery surface

## Threats — all mitigated or accepted per plan

ReDoS (T-05-0b regex-escape), spoofing (admin gate), DoS via long query (length cap), and tampered filters (allowlist validation) are all mitigated. See PLAN.md `<threat_model>` for the full STRIDE register.

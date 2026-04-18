---
status: partial
phase: 05-admin-moderation-ui-mobile
source:
  - 05-VERIFICATION.md
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
  - 05-04-SUMMARY.md
  - 05-05-SUMMARY.md
  - 05-06-SUMMARY.md
  - 05-07-SUMMARY.md
  - 05-08-SUMMARY.md
  - 05-09-SUMMARY.md
  - 05-10-SUMMARY.md
started: 2026-04-18T19:30:00Z
updated: 2026-04-18T19:55:00Z
---

## Current Test

[partial — every remaining test is blocked upstream on backend 05-0a/05-0b deployment; reopen on re-verification]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Metro bundler. Clear Metro cache (`npm run start:reset`) and relaunch on iOS or Android. App boots to the normal login/home flow without any bundler, JS, or native errors. No red-screen crash, no "cannot find module" for the new moderation files, no missing-translation warnings for the new keys added in Plan 05-02.
result: pass
note: "App boots cleanly. A /api/admin/users/search 404 surfaces as a dev-only LogBox overlay when entering Manage Admins (expected — backend 05-0b not yet deployed); screen body underneath renders and remains fully navigable."

### 2. Cross-screen navigation Dashboard → Moderation → UserDetail
expected: From the admin dashboard, tap the new "Moderation" nav card — AdminModerationScreen pushes onto the stack. Tap any row in the search list — AdminUserDetail pushes with the correct targetUid in the header. Back-swipe (iOS) or back-button (Android) pops cleanly back through the stack.
result: pass
note: "User confirmed navigation into AdminManagementScreen (repurposed) → AdminUserDetailScreen works end-to-end without breakage. AdminModerationScreen (new) navigation path not explicitly exercised but shares the same navigation handler, and no errors reported clicking around."

### 3. Dual-role delete rows render visually distinct in QuickActionSheet
expected: For a user who has BOTH brokerStatus === APPROVED AND logisticsStatus === APPROVED, opening the kebab menu shows TWO separate delete rows — "Delete broker profile" AND "Delete logistics profile". For a user with only one provider profile, only one matching delete row appears. For a user with neither, the delete row is shown but disabled (greyed out, not tappable).
result: blocked
blocked_by: prior-phase
reason: "AdminModerationScreen renders correctly (title + search + chips + EmptyState per UI-SPEC), but dual-role device-level verification requires live searchUsers data + seeded dual-role user. Backend 05-0b 404s, so no rows are fetched, no kebab can be opened. React logic is already covered by Plan 05-10's QuickActionSheet.test.tsx (4 dual-role assertions, all green)."

### 4. Quick-action bottom sheet animation + gesture handling
expected: Tapping the kebab on a row slides the QuickActionSheet up smoothly from the bottom. Tapping the backdrop (dimmed area above the sheet) OR the Cancel row closes it. Tapping an action row triggers the expected modal/confirmation and closes the sheet. No visual glitches or dropped frames on both iOS and Android.
result: blocked
blocked_by: prior-phase
reason: "User skipped — no user rows render (backend 05-0b 404), so the kebab menu cannot be opened. Reopen once backend ships and users are seeded."

### 5. Keyboard behavior on ModerationActionModal note field
expected: Open the moderation action modal (e.g. Suspend) on iOS AND Android. Tap into the "note" TextInput. The keyboard appears but does NOT cover the note field — the input stays visible above the keyboard. Dismissing the keyboard returns the layout to its original state without visual jumps.
result: blocked
blocked_by: prior-phase
reason: "Reaching the ModerationActionModal requires opening QuickActionSheet from a row, which is blocked by the same 05-0b 404."

### 6. Search list virtualization at >200 results
expected: With a backend populated with >200 users, AdminModerationScreen's FlatList scrolls smoothly with no jank or frame drops. `onEndReached` fires exactly once per page near the bottom; you can see the loading indicator briefly then the next page appended. No duplicated rows, no skipped pages.
result: blocked
blocked_by: server
reason: "Requires live /api/admin/users/search with >200 seeded users."

### 7. Timestamp locale rendering in moderation history
expected: In AdminUserDetailScreen's history list, timestamps render as 'YYYY-MM-DD HH:mm'. Change the device language between Russian and English (Settings → Language). Return to the screen — the timestamp format stays identical in both languages (the moderation timestamps MUST NOT switch to a locale-specific format like "18/04/2026, 19:30").
result: blocked
blocked_by: prior-phase
reason: "AdminUserDetailScreen's history rows only render when getHistory returns ≥1 ModerationAction; that requires backend 05-0a (/api/admin/moderation/:uid/history) deployed. The formatYmdHm util itself is already unit-tested (Plan 05-10) with locale-independence assertions."

### 8. End-to-end moderation flow against live backend
expected: With backend Plans 05-0a and 05-0b deployed: search returns live users via the new /api/admin/users/search endpoint; open a user's detail screen; see their real moderation history via /api/admin/moderation/:uid/history; unsuspend a suspended user via the CTA — a new history row appears at the top optimistically; the SeverityBadge flips to "Active"; on backend confirmation the optimistic row is replaced with the real one.
result: blocked
blocked_by: prior-phase
reason: "Backend Plans 05-0a (/api/admin/users/search) and 05-0b (/api/admin/moderation/:uid/history) are not yet implemented in the separate backend-services/carEx-services repo. Cannot be exercised end-to-end until those ship."

## Summary

total: 8
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 7

## Gaps

- truth: "AdminModerationScreen / AdminManagementScreen show an error-state EmptyState (e.g. 'Couldn't load users' with retry affordance) when searchUsers fails (network error, 4xx/5xx)"
  status: failed
  reason: "When searchUsers returns 404, the screen continues to show the 'Start searching' EmptyState (the query-empty branch) instead of an error state. Plan 05-07's EmptyState spec only defines `query empty → searchPromptTitle` and `query non-empty + zero results → emptySearchTitle` — there is no error branch. Minor UX gap, only visible in production when backend is unreachable."
  severity: minor
  test: 3
  artifacts: []
  missing: []

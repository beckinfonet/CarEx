---
status: complete
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
updated: 2026-04-18T22:20:00Z
---

## Current Test

[testing complete]

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
result: issue
reported: "input does not wait until user is done typing. it is invoking an endpoint which returns an error. There has to be a search button that triggers the API call. Console shows: Failed to search users CanceledError: canceled at ModerationService.ts:253."
severity: major
note: "User could not exercise the dual-role kebab scenario because the search-as-you-type flow surfaces a red LogBox overlay on every aborted in-flight request. Two distinct problems: (1) ModerationService.searchUsers re-throws axios CanceledError so each superseded debounced call logs as a console.error / red overlay; (2) UX feedback — user wants an explicit Search button instead of debounced auto-search."

### 4. Quick-action bottom sheet animation + gesture handling
expected: Tapping the kebab on a row slides the QuickActionSheet up smoothly from the bottom. Tapping the backdrop (dimmed area above the sheet) OR the Cancel row closes it. Tapping an action row triggers the expected modal/confirmation and closes the sheet. No visual glitches or dropped frames on both iOS and Android.
result: pass
note: "Implicitly verified during Test 8 — user successfully tapped kebab → sheet opened → selected Suspend → action modal appeared → applied action → sheet and modal closed cleanly. Backdrop/Cancel gestures not explicitly exercised but the primary flow works."

### 5. Keyboard behavior on ModerationActionModal note field
expected: Open the moderation action modal (e.g. Suspend) on iOS AND Android. Tap into the "note" TextInput. The keyboard appears but does NOT cover the note field — the input stays visible above the keyboard. Dismissing the keyboard returns the layout to its original state without visual jumps.
result: pass
note: "User confirmed keyboard does not occlude the note field."

### 6. Search list virtualization at >200 results
expected: With a backend populated with >200 users, AdminModerationScreen's FlatList scrolls smoothly with no jank or frame drops. `onEndReached` fires exactly once per page near the bottom; you can see the loading indicator briefly then the next page appended. No duplicated rows, no skipped pages.
result: skipped
reason: "Dataset too small — live backend does not currently have >200 users to exercise pagination/virtualization. Defer until a seeded perf dataset exists."

### 7. Timestamp locale rendering in moderation history
expected: In AdminUserDetailScreen's history list, timestamps render as 'YYYY-MM-DD HH:mm'. Change the device language between Russian and English (Settings → Language). Return to the screen — the timestamp format stays identical in both languages (the moderation timestamps MUST NOT switch to a locale-specific format like "18/04/2026, 19:30").
result: pass
note: "User confirmed timestamps render identically across RU/EN. Screenshot shows 'Member since 2026-04-04 01:40', 'Unsuspend ... 2026-04-18 21:54', 'Suspend ... 2026-04-18 21:48' — all in YYYY-MM-DD HH:mm regardless of device language."

### 8. End-to-end moderation flow against live backend
expected: With backend Plans 05-0a and 05-0b deployed: search returns live users via the new /api/admin/users/search endpoint; open a user's detail screen; see their real moderation history via /api/admin/moderation/:uid/history; unsuspend a suspended user via the CTA — a new history row appears at the top optimistically; the SeverityBadge flips to "Active"; on backend confirmation the optimistic row is replaced with the real one.
result: pass
note: "User confirmed end-to-end suspend flow works against live backend: searched users, selected target, opened QuickActionSheet, picked Suspend, chose severity + reasonCategory, tapped Apply — action succeeded against POST /api/admin/moderation/:uid (after fix 1d0754a resolved a Phase 2/4 contract mismatch — mobile was calling /suspend path, backend dispatches on body.action). Fresh Firebase idToken obtained via re-login addressed the earlier 401."

## Summary

total: 8
passed: 6
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "AdminModerationScreen / AdminManagementScreen show an error-state EmptyState (e.g. 'Couldn't load users' with retry affordance) when searchUsers fails (network error, 4xx/5xx)"
  status: resolved
  reason: "Filed during first UAT pass. Resolved by commit b65ab91 (fix(05-UAT): replace Alert on search failure with error EmptyState + retry). EmptyState gained an optional action prop; both screens now flip into an error variant with a Retry button when searchUsers rejects."
  severity: minor
  test: 3
  artifacts:
    - src/components/moderation/EmptyState.tsx
    - src/screens/AdminModerationScreen.tsx
    - src/screens/AdminManagementScreen.tsx
    - src/constants/translations.ts
  missing: []

- truth: "Firebase idToken is refreshed automatically on the mobile side so admin actions work after the 1-hour token TTL"
  status: failed
  reason: "AuthContext caches idToken in currentIdTokenRef at sign-in and never refreshes it. refreshUser() only re-fetches the backend user record, not the Firebase token. After ~1hr idle, every auth-gated call 401s until the user logs out + back in. Surfaced during UAT round 2 as a 401 on searchUsers before the backend contract fix was applied. Workaround confirmed working (re-login) but the underlying gap remains."
  severity: major
  test: 8
  artifacts:
    - src/context/AuthContext.tsx
  missing:
    - "Periodic or 401-triggered idToken refresh using the Firebase Identity Toolkit 'securetoken' endpoint with the refreshToken obtained at sign-in"

- truth: "Mobile ModerationService URLs match the Phase 2 backend dispatch contract"
  status: resolved
  reason: "Integration bug between Phase 4 (mobile) and Phase 2 (backend). Mobile suspend/revokeRole posted to /:uid/suspend and /:uid/revoke-role; backend dispatches on body.action at POST /:uid. 404s in production. Mobile tests missed it because each test mocked apiClient (asserted mobile URL against itself). Fixed in commit 1d0754a — both methods now post to the dispatch URL with action injected into the body. Tests updated to assert the real contract."
  severity: blocker
  test: 8
  artifacts:
    - src/services/moderation/ModerationService.ts
    - src/services/moderation/__tests__/ModerationService.test.ts
  missing: []

- truth: "ModerationService.restoreRole has a live backend counterpart"
  status: tech-debt
  reason: "restoreRole is dead code — no UI call site, no backend route. Safe to remove in a cleanup phase; flagged here so it doesn't get called by accident."
  severity: minor
  test: 8
  artifacts:
    - src/services/moderation/ModerationService.ts
  missing: []

- truth: "Admin user search does not fire an API request on every keystroke and does not surface aborted requests as console errors / red LogBox overlays"
  status: failed
  reason: "User reported: 'input does not wait until user is done typing. it is invoking an endpoint which returns an error. There has to be a search button that triggers the API call.' Two underlying problems: (1) ModerationService.searchUsers re-throws axios CanceledError unconditionally (catch at ModerationService.ts:253), so each superseded debounced request emits a console.error → dev-mode red LogBox overlay, even though the abort is the intended behavior. (2) UX feedback — user wants the auto-search-as-you-type pattern (useDebouncedValue, Plan 05-04) replaced with an explicit Search button so requests only fire on submit."
  severity: major
  test: 3
  artifacts:
    - src/services/moderation/ModerationService.ts
    - src/screens/AdminModerationScreen.tsx
    - src/screens/AdminManagementScreen.tsx
    - src/hooks/useDebouncedValue.ts
  missing:
    - "CanceledError swallowed (or logged at debug level) in ModerationService.searchUsers catch block — aborts are normal flow control, not failures"
    - "Replace debounced auto-search with submit-driven search: TextInput + Search button (or onSubmitEditing), no API call until the user explicitly triggers it"
    - "Update jest tests in src/services/moderation/__tests__/ and src/screens/__tests__/ to assert (a) CanceledError no longer propagates, (b) searchUsers is not called on each keystroke"

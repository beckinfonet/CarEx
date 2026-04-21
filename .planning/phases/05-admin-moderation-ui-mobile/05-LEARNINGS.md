---
phase: 05
phase_name: "Admin Moderation UI (Mobile)"
project: "CarEx"
generated: "2026-04-18"
counts:
  decisions: 12
  lessons: 9
  patterns: 11
  surprises: 7
missing_artifacts: []
---

# Phase 05 Learnings: Admin Moderation UI (Mobile)

## Decisions

### Single generic ModerationActionModal for all five actions
One `ModerationActionModal` component handles all five admin actions (suspend, unsuspend, revoke_role, delete_profile, edit_profile) via conditional field rendering keyed on an `action` prop, rather than five separate modal components.

**Rationale:** Discussed and rejected alternatives (five separate components, hybrid generic+dedicated). A single-sheet, one-scroll layout with Confirm/Cancel at the bottom avoids wizard complexity for only 2–3 fields per action.
**Source:** 05-CONTEXT.md (D-05, D-06) / 05-DISCUSSION-LOG.md

---

### Typed sentinel for destructive actions
Destructive actions (Delete provider profile, Revoke role, Suspend at `permanently_banned`) require a `TypedConfirmationModal` where the admin must type the target user's email (trimmed + lowercased) before the Confirm button enables. Non-destructive actions (Unsuspend, lesser-severity Suspend, Edit profile) use only `ModerationActionModal`'s single Confirm gate.

**Rationale:** Explicit friction for irreversible actions while keeping the common non-destructive path fast. The email sentinel is memorable, tied to the specific target, and naturally varies between actions.
**Source:** 05-CONTEXT.md (D-04) / 05-DISCUSSION-LOG.md

---

### Optimistic update with rollback on API error
On Confirm the modal closes and the row badge flips immediately to the new state, then the API call fires. On error the badge reverts and `Alert.alert` surfaces the error using `ModerationError.code` / `reasonCategory` / `note` for typed backend errors.

**Rationale:** Chosen over "wait for API with pending state" and "keep modal open with loading state" to deliver the fastest perceived response. Rollback covers the failure path.
**Source:** 05-CONTEXT.md (D-08) / 05-DISCUSSION-LOG.md

---

### AdminManagementScreen repurposed to full user roster
The existing `AdminManagementScreen` was widened to list all approved users instead of only admins. An "Admins only" filter chip preserves the prior admin-roster use case. The legacy Add/Remove admin modal was dropped; admins are added via the existing approval flow on `AdminDashboardScreen`.

**Rationale:** Resolves the UI-01 literal-reading ambiguity that admins are rarely moderation targets. Reusing the existing screen avoids an extra navigation entry point.
**Source:** 05-CONTEXT.md (D-03) / 05-DISCUSSION-LOG.md

---

### D-16 backend routes planned in Phase 5 dir but executed in separate repo
Two backend read endpoints (`GET /api/admin/moderation/:targetUid/history` and `GET /api/admin/users/search`) were planned as Phase 5 work (plans 05-0a / 05-0b) but live in the sibling `backend-services/carEx-services` repo. The user approved a scope carve-out (Option A) to execute only the 10 mobile plans in this workspace.

**Rationale:** The backend repo is not present in the carEx workspace; splitting execution across repos was the user-approved path to avoid blocking mobile delivery. Mobile code is correctly wired to call those routes.
**Source:** 05-VERIFICATION.md / 05-CONTEXT.md (D-16)

---

### Severity palette defined once in theme.ts for Phase 6 reuse
`COLORS.moderation.{active, featureLimited, blockedReview, permaBanned}` (each with `bg` / `fg` / `border` sub-keys) were added as a single authoritative palette in `src/constants/theme.ts`, rather than ad-hoc hex values per component. Phase 6 `UserStatusBanner` will import the same tokens verbatim.

**Rationale:** Cross-phase visual consistency. Prevents palette drift between the admin moderation UI and the future user-facing status banner.
**Source:** 05-CONTEXT.md (§Specific Ideas) / 05-02-SUMMARY.md

---

### `adminUsers` translation key preserved verbatim
The legacy `adminUsers: 'Администраторы'/'Administrators'` key (used by the Profile menu) was NOT renamed or removed. The repurposed `AdminManagementScreen` header uses a new `adminUsersTitle: 'Пользователи'/'Users'` key, coexisting alongside the legacy key.

**Rationale:** Renaming would silently break the Profile menu. A new key avoids any consumer impact while giving the repurposed screen a semantically accurate label. RESEARCH documented this as §Pitfall 8.
**Source:** 05-02-SUMMARY.md / 05-VERIFICATION.md

---

### No new libraries introduced
Stock React Native `Modal` with `animationType="slide"` was used for all bottom sheets; a 15-line `useDebouncedValue` hook replaced any debounce library; native `Date.prototype` methods replaced any date library; `apiClient` (pre-installed axios) replaced any new networking lib.

**Rationale:** Per CLAUDE.md tech-stack discipline: "no new state-management or networking libs." No `react-native-bottom-sheet`, no `moment` / `date-fns`, no `lodash`.
**Source:** 05-CONTEXT.md (§Specific Ideas, §Deferred) / 05-PATTERNS.md (Cross-Cutting Reminder 6)

---

### Dual-role delete contract: two explicit rows
When a target user has BOTH `brokerStatus === 'APPROVED'` AND `logisticsStatus === 'APPROVED'`, the `QuickActionSheet` renders two discrete delete rows ("Delete broker profile" / "Delete logistics profile") rather than a single ambiguous row with a silent broker default. The explicit role flows end-to-end from `QuickActionSheet.onSelect({action, role})` through `pendingDeleteRole` state to `ModerationService.deleteProviderProfile(uid, { role })`.

**Rationale:** Prevents an admin from accidentally deleting the wrong provider profile when a user holds both roles. RESEARCH classified this as §Pitfall 11 and required encoding it at the test layer from Wave 0 forward.
**Source:** 05-CONTEXT.md (D-04 §Specifics) / 05-01-SUMMARY.md / 05-VERIFICATION.md

---

### MOB-01 guardrail: zero moderation keywords in AuthService
The invariant `grep -c 'suspend|revoke|moderation' src/services/AuthService.ts` must return 0 throughout Phase 5. All new HTTP calls for moderation-related reads (`getHistory`, `searchUsers`) and writes stay in `ModerationService`.

**Rationale:** Phase 4 introduced `ModerationService` specifically to prevent cross-contamination of the auth service. Phase 5 must not re-consolidate that surface. The guardrail is verifiable by a single grep command run at every plan's acceptance check.
**Source:** 05-CONTEXT.md (§Code Context MOB-01) / 05-PATTERNS.md (Cross-Cutting Reminder 1) / 05-VERIFICATION.md

---

### Submit-driven search replaces live debounce (D-10 superseded by D-11-01..D-11-05)
The originally locked D-10 specified a 300 ms debounced auto-search per-keystroke. Plan 05-11 reversed this: search only fires on explicit user action (Search button tap or `onSubmitEditing`). An initial `searchUsers` call on mount with no `q` param preserves the "start with all users" UX. The `useDebouncedValue` hook was deleted with zero remaining consumers.

**Rationale:** UAT Test 3 surfaced that every aborted debounced request produced a red LogBox overlay via `CanceledError`, and the user explicitly requested a submit-triggered pattern. CLAUDE.md's "no backwards-compatibility hacks" rule mandated deleting the dead hook rather than leaving it in place.
**Source:** 05-11-SUMMARY.md (key-decisions D-11-01..D-11-05) / 05-UAT.md (Test 3 gap)

---

### Two-pronged Firebase idToken refresh strategy
A reactive 401 response interceptor (apiClient → registered listener → single-flight refresh → retry with new Bearer; 2nd 401 triggers logout) was paired with a proactive check (5-min-pre-expiry at the head of `refreshUserInternal`, piggybacked on the existing AppState `active` transition). Zero new dependencies; pure axios + AsyncStorage.

**Rationale:** A standalone RN timer was rejected ("RN background-timer reliability is poor; the existing foreground-refresh path is the natural hook and inherits single-flight dedupe via the shared in-flight promise ref"). Proactive + reactive together eliminate both the gradual-expiry case and the mid-request-401 case.
**Source:** 05-12-SUMMARY.md (key-decisions)

---

## Lessons

### Per-keystroke abort errors leak into dev-mode LogBox
`ModerationService.searchUsers` re-threw axios `CanceledError` unconditionally in its catch block, causing every superseded debounced request to emit `console.error` and surface as a red LogBox overlay in dev mode — even though aborting an in-flight request is intended normal behavior.

**Context:** UAT Test 3 surfaced this. The fix was an `isAbortError()` guard scoped to `searchUsers` and `getHistory` (the two methods accepting `AbortSignal`) that swallows cancellations at log level without propagating them as errors. Write methods retain full `console.error` since a cancellation there would be a real bug.
**Source:** 05-11-SUMMARY.md / 05-UAT.md (Test 3 gap)

---

### Phase-to-phase API contract drift goes undetected when tests mock themselves
Mobile `ModerationService.suspend` and `revokeRole` were POSTing to `/:uid/suspend` and `/:uid/revoke-role` paths, but the Phase 2 backend dispatches on `body.action` at a single `POST /:uid` endpoint. This produced 404s in production but passed all mobile tests because each test mocked `apiClient` and asserted the mobile URL against itself.

**Context:** Discovered during UAT Test 8 end-to-end flow against the live backend. Fixed in commit `1d0754a` — both methods now POST to the dispatch URL with `action` injected into the body. Tests were updated to assert the real contract.
**Source:** 05-UAT.md (gap: "Mobile ModerationService URLs match the Phase 2 backend dispatch contract")

---

### Hard-coded method-list assertions break on legitimate service extension
The Phase 4 integration test `moderation.e2e.integration.test.tsx` Test 1.2 asserted `Object.keys(ModerationService).sort()` equaled a hard-coded 7-method array. Phase 5 correctly added `searchUsers` as the 8th method, causing that test to fail — not as a product defect but as a test-maintenance gap.

**Context:** Verification identified this as a 1-line fix (add `'searchUsers'` to the assertion array). Any future service extension will hit the same issue if the pattern is reused.
**Source:** 05-VERIFICATION.md / 05-09-SUMMARY.md (auto-fix item 2)

---

### Firebase idToken 1-hour TTL is a silent blocker for long-running admin sessions
`AuthContext` cached the Firebase idToken in `currentIdTokenRef` at sign-in and never refreshed it. After roughly 1 hour idle, every auth-gated call returns 401 until the user logs out and back in. This was not caught in unit tests because they mocked the token.

**Context:** Surfaced during UAT round 2 as a 401 on `searchUsers`. The root cause was that `refreshUser()` only re-fetched the backend user record, not the Firebase token. Plan 05-12 closed the gap with the reactive interceptor + proactive pre-expiry check.
**Source:** 05-UAT.md (gap: "Firebase idToken is refreshed automatically") / 05-12-SUMMARY.md

---

### `saveToken` → `saveAuthSession` migration causes e2e mock regression
Migrating `AuthContext.login/signup` from `AuthService.saveToken` to `saveAuthSession` broke three previously-green Phase 4 e2e integration tests because the test's `AuthService` mock defined `saveToken` but not `saveAuthSession`, causing `login` to throw inside tests.

**Context:** Plan 05-12 auto-fix commit `1cfb50e` extended the e2e mock surface; `saveToken` was dropped from mocks as a regression lock so any future reintroduction surfaces explicitly. The lesson: when migrating a method name on a shared service, search for all mock surfaces, not just the plan-scoped test files.
**Source:** 05-12-SUMMARY.md (auto-fix section)

---

### React 19 async `act()` hangs indefinitely on AbortController effects
`await act(async () => TestRenderer.create(<Screen />))` hung beyond jest's 5-second timeout on screens that used `AbortController.abort()` in a `useEffect` cleanup, because React 19's async `act` keeps the scheduler queue alive as long as any async work is pending.

**Context:** Fixed in Plan 05-10 with a hybrid pattern: sync `act(() => create())` for initial render, then `await new Promise(r => setImmediate(r))` microtask pump outside act(), then a bookending sync `act(() => {})` to swallow state-update warnings. Codified as a shared `settle()` helper across the three screen test files.
**Source:** 05-10-SUMMARY.md (auto-fix item 1)

---

### Fresh Proxy on every `useLanguage()` call rotates hook identity and double-fires effects
Defining `new Proxy({}, ...)` inside a `jest.mock` factory creates a new Proxy reference on every `useLanguage()` invocation. When the translation object `t` is a dep of `useCallback([T])`, a rotating `T` identity causes `runSearch` to get a new reference each render, which fires `useEffect([runSearch])` extra times — surfacing as a `searchUsers` call count of 4 instead of the expected 2 in the pagination guard test.

**Context:** Fixed by hoisting `const mockT = new Proxy(...)` with the `mock*` prefix (required by `babel-plugin-jest-hoist`'s allowlist) outside the factory so the reference is stable. Applied to all three screen test files.
**Source:** 05-10-SUMMARY.md (auto-fix item 2)

---

### JSX in `.ts` files is not transformed by the react-native jest preset
The `useDebouncedValue.test.ts` scaffold (Plan 05-01) kept the `.ts` extension. When Plan 05-09 filled it with a test using a `<Text>` JSX element, the file produced `Unexpected token, expected ","` at runtime because the react-native jest preset does not enable JSX transforms for plain `.ts` files.

**Context:** Fixed by rewriting the test to use `React.createElement` instead of JSX, preserving the `.ts` extension to keep Plan 05-01 scaffold filenames verbatim. Renaming to `.tsx` was rejected to avoid retroactively changing committed scaffold paths.
**Source:** 05-09-SUMMARY.md (auto-fix item 1)

---

### Infinite-scroll pagination is a codebase first — guard required
Prior to Phase 5, `HomeScreen.fetchCars` fetched all records at once; no `FlatList.onEndReached` pagination existed in the codebase. The canonical guard — `if (loadingMore || !nextCursor) return;` at the top of `fetchNextPage` — is necessary to prevent `onEndReached` from firing multiple times as the user nears the bottom threshold, otherwise duplicate page requests and duplicate rows result.

**Context:** Documented as RESEARCH §Pitfall 9 and encoded in test assertions (`AdminModerationScreen` "pagination guard on `onEndReached` when `nextCursor === null`").
**Source:** 05-PATTERNS.md (No Analog Found table) / 05-10-SUMMARY.md

---

## Patterns

### Wave 0 scaffold-first testing
Before any implementation ships, create all test files with `test.todo` placeholder entries. Each scaffold imports from the not-yet-existing module path so a compile failure proves wiring. Wave N implementation plans then fill the `test.todo` bodies; the final plan (05-10) sweeps all remaining scaffolds with real assertions.

**When to use:** Any phase with parallel waves where multiple implementation plans run before a final integration sweep. Gives each implementation plan a pre-existing `<automated>` verify target without requiring tests to be written before the design is settled.
**Source:** 05-01-SUMMARY.md / 05-10-SUMMARY.md

---

### `isAbortError` guard scoped to AbortSignal-aware service methods
Service-layer catch blocks in methods that accept an `AbortSignal` (e.g., `searchUsers`, `getHistory`) check `axios.isCancel(err) || err instanceof CanceledError || err.name === 'AbortError'` before logging. Matched errors are still re-thrown so screen-level guards can short-circuit, but `console.error` is suppressed — preventing dev-mode red LogBox overlays for intentional cancellations. Write methods do not use this guard because a cancellation there is a real bug.

**When to use:** Any service method that accepts an `AbortSignal` and participates in a cancel-and-reissue flow (e.g., search-on-submit, pagination abort on filter change). Do not apply to write methods.
**Source:** 05-11-SUMMARY.md (key-decisions D-11-02, patterns-established)

---

### Decoupled draft / submitted query state on search screens
A raw `TextInput` drives local `draftQuery` state per keystroke; `submittedQuery` is committed only on explicit user action (Search button tap or `onSubmitEditing`). The data-fetch `useEffect` depends on `submittedQuery`, not `draftQuery`, so the abort/refresh/retry path is single-sourced and keystrokes produce zero API calls.

**When to use:** Any admin search surface where per-keystroke API volume is undesirable or where the UX requires the user to explicitly confirm the query before a network round-trip fires.
**Source:** 05-11-SUMMARY.md (patterns-established)

---

### Optimistic update + rollback handler for moderation actions
On submit, the screen snapshots the current row state, immediately flips the displayed `moderationStatus.state` in local list state, calls `ModerationService.*`, and on error restores the snapshot state and surfaces `Alert.alert` with the typed error message via `MODERATION_ERROR_KEY_MAP`. The modal closes before the API call fires.

**When to use:** Any list screen where an admin action should feel instantaneous and where the backend validates the same constraints the UI pre-gates (so rollback is rare). Not suitable for flows where the user needs to see the server response before the UI advances.
**Source:** 05-PATTERNS.md (Optimistic update + rollback handler) / 05-CONTEXT.md (D-08)

---

### Listener-registration for cross-module callback access
`apiClient`'s 401 interceptor cannot import `AuthContext` directly (circular dependency / React context not available outside component tree). Instead, `client.ts` exports `setIdTokenRefreshListener` and `setLogoutTrigger`; `AuthContext` calls these in a `useEffect` to register its own callbacks. This mirrors the pre-existing `setModerationRefreshListener` pattern from Phase 4.

**When to use:** Whenever an HTTP interceptor or non-React module needs to invoke a callback that lives inside a React context or component. Keeps the HTTP layer free of React imports while allowing context-owned logic to own the refresh lifecycle.
**Source:** 05-12-SUMMARY.md (key-decisions, patterns-established)

---

### `logoutRef` forward-declaration for listener scope-order
A `useRef<(() => Promise<void>) | null>(null)` is declared, then a `useEffect([logout])` syncs the ref to the latest `logout` callback. The mount-effect–registered listener closure reads `logoutRef.current?.()` rather than capturing `logout` directly — bypassing the problem where a mount effect registers a listener before the `logout` useCallback is defined later in the component body.

**When to use:** When a mount-effect must register a listener that invokes a `useCallback` defined later in the same component, or when you need listener closures to remain stable across callback redefinitions.
**Source:** 05-12-SUMMARY.md (key-decisions, patterns-established)

---

### Loop-guard flags via axios module augmentation
Custom boolean properties (`_skipIdTokenRefresh`, `_idTokenRefreshAttempted`) are added to axios request config via `declare module 'axios' { interface InternalAxiosRequestConfig { _skipIdTokenRefresh?: boolean; _idTokenRefreshAttempted?: boolean; } }`. These follow the existing `_skipModerationInterceptor` precedent and allow interceptors to mark a config to prevent infinite retry recursion without coupling to external state.

**When to use:** Any response interceptor that retries a request and must guard against recursing back into itself on the retried request. The declaration pattern keeps the flag strongly typed and avoids dynamic property assignment on `config`.
**Source:** 05-12-SUMMARY.md (patterns-established) / 05-PATTERNS.md (Module-level `_skipModerationInterceptor` reservation)

---

### Sticky FlatList header via `stickyHeaderIndices`
`<FlatList ListHeaderComponent={<StickySummaryCard />} stickyHeaderIndices={[0]}>` makes the summary card (user email, role badges, current state badge, Unsuspend CTA) stick at the top while the history list scrolls beneath it. This is the first sticky-header `FlatList` pattern in the codebase; no in-repo analog existed.

**When to use:** Detail screens where a summary panel must remain visible while the user scrolls a variable-length child list. Requires that `ListHeaderComponent` is the only child at index 0; do not mix with `sections`.
**Source:** 05-PATTERNS.md (AdminUserDetailScreen section, No Analog Found table)

---

### Filter chip — softer accent border + tinted background
Active filter chips use `borderColor: COLORS.accent` + `backgroundColor: 'rgba(59,130,246,0.1)'` (from `FilterBar.tsx`'s `activeFilterButton` style), NOT the solid `backgroundColor: COLORS.accent` pill used in `FilterModal.tsx`. UI-SPEC §Color reserves solid accent exclusively for primary CTAs.

**When to use:** All chip/toggle rows that represent a filtering or selection state (role chips, state chips, reason picker). Solid accent is reserved for the primary action button (Confirm / Apply / Search) only.
**Source:** 05-PATTERNS.md (Filter chip pattern / Shared Patterns section)

---

### Severity palette as single source of truth across phases
`COLORS.moderation.{active, featureLimited, blockedReview, permaBanned}` — each with `bg` / `fg` / `border` — are defined once in `src/constants/theme.ts`. `SeverityBadge`, `HistoryCard` left-border accents, and the future Phase 6 `UserStatusBanner` all import these tokens directly without duplicating hex values.

**When to use:** Any component that needs to visually encode a user's moderation state. Extend the palette sub-keys here rather than defining per-component color constants.
**Source:** 05-CONTEXT.md (§Specific Ideas) / 05-02-SUMMARY.md / 05-PATTERNS.md (SeverityBadge section)

---

### `settle()` helper for React 19 async act in screen tests
A shared `settle()` helper wraps the React 19 testing pattern: `act(() => create(<Screen />))` (sync, for initial render) followed by `await new Promise(r => setImmediate(r))` (microtask pump outside act), then a bookending `act(() => {})` to swallow pending state-update warnings. Replaces the `await act(async)` pattern that hangs when components use `AbortController`.

**When to use:** Any screen test using `react-test-renderer` (not `@testing-library/react-native`) where the component fires an async effect with `AbortController` cleanup on mount. Apply to all three admin screen test files; the helper is copied inline.
**Source:** 05-10-SUMMARY.md (auto-fix item 1, decisions)

---

## Surprises

### Phase 2 backend dispatch contract was silently mismatched by Phase 4 mobile code
Phase 4 shipped `ModerationService.suspend` POSTing to `/:uid/suspend` and `revokeRole` POSTing to `/:uid/revoke-role`, but the Phase 2 backend routes dispatch on `body.action` at a single `POST /:uid`. This was a blocker-severity mismatch that produced 404s against the live backend but passed all mobile-layer tests because each test mocked `apiClient` and validated only the mobile URL.

**Impact:** The end-to-end moderation flow was non-functional against the live backend until commit `1d0754a` in UAT round 1. Demonstrates that unit tests mocking the HTTP client cannot detect cross-service URL contract drift; integration tests that assert against the real path signature are required.
**Source:** 05-UAT.md (gap: "Mobile ModerationService URLs match the Phase 2 backend dispatch contract") / 05-VERIFICATION.md

---

### Firebase idToken TTL is not refreshed by `refreshUser()`
`AuthContext.refreshUser()` only re-fetched the backend user record from the carEx API; it never refreshed the Firebase idToken. After ~1 hour idle, all admin auth-gated calls began returning 401. The workaround was manual logout + re-login; there was no automatic recovery.

**Impact:** Any admin session lasting longer than 1 hour was silently broken. Plan 05-12 added four new `AuthService` methods, a 401 interceptor with single-flight retry, and proactive 5-min-pre-expiry refresh — a substantially larger scope addition than the original Phase 5 plan anticipated.
**Source:** 05-UAT.md (gap: "Firebase idToken is refreshed automatically") / 05-12-SUMMARY.md

---

### `useDebouncedValue` was designed and implemented, then deleted within the same phase
`useDebouncedValue` was a planned artifact (D-10 specified 300 ms auto-search), built in Plan 05-04 (18 lines), scaffolded in Plan 05-01 (with 6 `test.todo` entries), and then completely deleted in Plan 05-11 (hook + test, 117 lines net removed, 0 consumers remaining) after UAT revealed the UX pattern was wrong.

**Impact:** The hook had zero net lifetime impact on shipped behavior; it was created and retired within the same phase. The plan decision log (D-11-05) explicitly cited CLAUDE.md's "no backwards-compatibility hacks" rule as justification for immediate deletion rather than leaving the hook as dead code.
**Source:** 05-11-SUMMARY.md (Accomplishments, key-decisions D-11-05) / 05-UAT.md (Test 3 gap)

---

### Pre-existing `App.test.tsx` navigation-stack failure is unrelated to Phase 5
`__tests__/App.test.tsx` fails with `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` originating in `@react-navigation/native-stack` internals. This failure existed on `main` before any Phase 5 changes (confirmed via `git stash`).

**Impact:** The full `npm test` suite reports 2 failures throughout Phase 5: this pre-existing test and the Phase 4 integration test's 7-method assertion (also a maintenance gap, not a product defect). Phase 5-specific suites remain 100% green when `App.test.tsx` is excluded. The issue requires a `react-native-screens` or navigation-stack mock in jest setup and is logged in `deferred-items.md` as out-of-scope.
**Source:** deferred-items.md / 05-11-SUMMARY.md (Issues Encountered) / 05-VERIFICATION.md

---

### `ModerationService.restoreRole` is dead code with no backend counterpart
`restoreRole` exists in `ModerationService.ts` with no UI call site and no corresponding backend route. It was surfaced during UAT as a tech-debt item.

**Impact:** The method is safe to call by accident (it would return a 404) but cannot be exercised by any current admin action. Flagged in the UAT gaps table for cleanup in a future phase to prevent accidental invocation.
**Source:** 05-UAT.md (gap: "ModerationService.restoreRole has a live backend counterpart")

---

### Search list load-on-mount UAT gap: 404 visible as dev LogBox on first entry
When an admin first enters `AdminManagementScreen` after mobile-only deployment (before backend 05-0b shipped), the `searchUsers` call to `GET /api/admin/users/search` returns a 404, which surfaces as a dev-only LogBox overlay. The screen body underneath remains navigable. This was explicitly noted in UAT Test 1's pass note.

**Impact:** While expected and documented as a scope carve-out, it confirmed that the error-state `EmptyState` (commit `b65ab91`) was necessary — a UAT gap was filed and resolved to replace the `Alert.alert` on search failure with an error `EmptyState` + Retry button so the UX degrades gracefully rather than showing an alert on every screen mount.
**Source:** 05-UAT.md (Test 1 note / first gap item)

---

### `EmptyState` required an `action` prop not present in the original design
The original `EmptyState` component design (Plan 05-05) had only `icon`, `title`, and `body` props. During UAT gap resolution, both `AdminModerationScreen` and `AdminManagementScreen` needed to flip into an error variant with a "Retry" button when `searchUsers` rejects, requiring `EmptyState` to be extended with an optional `action` prop.

**Impact:** Commit `b65ab91` extended `EmptyState.tsx`, both screen files, and `translations.ts` after the initial implementation was complete — a post-UAT design change to a component that had already been fully tested in Plan 05-10.
**Source:** 05-UAT.md (first gap item: "AdminModerationScreen / AdminManagementScreen show an error-state EmptyState")

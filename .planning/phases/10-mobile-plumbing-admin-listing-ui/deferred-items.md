# Phase 10 — Deferred Items

Items discovered during execution that are intentionally out of scope for
the plan that found them. Each entry includes who must address it.

---

## DEF-10-05-01: `__tests__/moderation.e2e.integration.test.tsx` Test 1.2 stale assertion

**Discovered during:** Plan 10-05 (Task 2 regression check — `npx jest --bail`)
**Status:** RESOLVED 2026-05-29 — commit 3cfa9d1 expanded the assertion to 14 methods (8 user-mod + 6 listing-mod). Test now green.
**Test:** `Phase 4 Integration: Success-Criterion Coverage › ROADMAP Criterion #1 › Test 1.2: ModerationService exposes exactly the 8 methods from 04-CONTEXT D-05 + Plan 05-03`

**Root cause:** Plan 10-04 added 6 listing methods to `ModerationService`
(`adminEditListing`, `archiveListing`, `deleteListing`, `restoreListing`,
`searchListings`, `suspendListing`). The Phase 4 integration test's
`expect(keys).toEqual([...8 names...])` was not extended to allow the new
listing methods. Diff in failure output:

```
+   "adminEditListing",
+   "archiveListing",
+   "deleteListing",
+   "restoreListing",
+   "searchListings",
+   "suspendListing",
```

**Scope:** out of scope for Plan 10-05. Plan 10-05's source change is a
single line in `CarDetailsScreen.tsx`; it cannot have introduced this
regression. The mid-phase test-expectation update belongs to Plan 10-04
(post-merge fixup) or a Phase 10 cleanup plan.

**Recommended fix:** update the integration-test assertion to include the
6 new listing method names (or split into "user-domain methods exactly
present" + "listing-domain methods exactly present" pair). Note that the
"exactly 8 methods" wording in the test name is also stale — it should be
"exactly 14 methods" or two grouped assertions.

**Action:** owner of Plan 10-04 (or Phase 10 verifier) to amend.

---

## DEF-10-08-01: `__tests__/App.test.tsx` fails with React Navigation `usesNewAndroidHeaderHeightImplementation` undefined error

**Discovered during:** Plan 10-08 (Task 2 full mobile suite regression check — `npm test`)
**Status:** pre-existing — confirmed via `git stash` baseline check on commit `eaed0e1` (one commit BEFORE any Plan 10-08 edits to CarDetailsScreen.tsx). Failure exists on main pre-edit; not caused by this plan.

**Test:** `__tests__/App.test.tsx > renders correctly`

**Failure:**
```
TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined
  at SceneView (node_modules/@react-navigation/native-stack/src/views/NativeStackView.native.tsx:222:47)
```

**Root cause (best guess):** `@react-navigation/native-stack` 7.11.0 added a new platform-detection check (`usesNewAndroidHeaderHeightImplementation`) that expects a native module to be defined; the test environment doesn't have the native binding mocked. Likely needs an addition to `jest.setup.ts` to stub the native module, or a mock for `@react-navigation/native-stack`.

**Scope:** out of scope for Plan 10-08. Plan 10-08's source changes are scoped to `src/screens/CarDetailsScreen.tsx`; the test mounts `App` which sits above the navigation stack. The failure cannot have been introduced by this plan and persists when Plan 10-08's edits are stashed.

**Action:** Phase 10 verifier or Phase 11 LQUAL-* cleanup to amend the test setup (likely a `jest.mock('react-native', () => ({...}))` extension for the native header module).

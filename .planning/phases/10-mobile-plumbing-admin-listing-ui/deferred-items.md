# Phase 10 — Deferred Items

Items discovered during execution that are intentionally out of scope for
the plan that found them. Each entry includes who must address it.

---

## DEF-10-05-01: `__tests__/moderation.e2e.integration.test.tsx` Test 1.2 stale assertion

**Discovered during:** Plan 10-05 (Task 2 regression check — `npx jest --bail`)
**Status:** pre-existing failure on `main` BEFORE Plan 10-05 changes (verified
via `git stash` + re-run; reproduces with zero local changes)
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

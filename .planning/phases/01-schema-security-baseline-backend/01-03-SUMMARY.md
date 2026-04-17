---
phase: 01-schema-security-baseline-backend
plan: 03
subsystem: database
tags: [mongoose, ServiceOrder, providerSnapshot, supertest, jest, moderation, anti-pattern-6, DATA-03]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: "src/models/User.js (firebaseUid, email, firstName, lastName) from plan 01-01 — joined by POST /api/orders to build the provider snapshot"
  - phase: 01-schema-security-baseline-backend
    provides: "Jest + supertest + mongodb-memory-server harness from plan 01-01 — reused verbatim"
provides:
  - "ServiceOrder.providerSnapshot extended to 8 fields (companyName, phoneNumber, telegramUsername, email, firstName, lastName, providerRole, snapshotAt)"
  - "POST /api/orders creation path that resolves every providerSnapshot field server-side from Broker/LogisticsPartner + User (client-supplied providerSnapshot is ignored)"
  - "server.js exports `{ app }` with `require.main === module` guard so supertest can mount the Express app without binding a port"
  - "__tests__/moderation/ServiceOrder.providerSnapshot.test.js — 5 tests covering schema shape, providerRole enum (positive + negative), and POST /api/orders population for both broker and logistics provider types"
affects:
  - "01-04-PLAN.md (Firebase Admin + verifyIdToken — no coupling; just shares the test harness)"
  - "01-05-PLAN.md (capability map — no coupling; same test harness)"
  - "01-06-PLAN.md (migration backfill script — MUST write the same 8 fields on existing orders using the Broker/LogisticsPartner + User lookup this plan established; D-24)"
  - "02-* (Phase 2 DELETE /api/admin/moderation/:uid/provider-profile — relies on providerSnapshot to survive provider-profile hard-delete so buyer order history stays intact)"
  - "04-* (Phase 4 mobile) — buyer order-history UI will eventually render email/firstName/lastName/providerRole/snapshotAt from providerSnapshot; no mobile code touched in this plan"

# Tech tracking
tech-stack:
  added: []   # no new deps; reused jest/supertest/mongodb-memory-server from plan 01-01
  patterns:
    - "Server-authoritative snapshot pattern — creation handler replaces any client-supplied snapshot with values resolved by keyed lookups (ownerUid→Broker/LogisticsPartner, firebaseUid→User). Client values are discarded."
    - "Testable app export via `if (require.main === module) { app.listen(...) } module.exports = { app }` — production (`node server.js`, Railway) behavior is byte-identical; Jest+supertest mounts the app without a listening socket."
    - "Inline-subdoc schema assertion via dotted-path lookup (`schema.path('providerSnapshot.<leaf>')`) because Mongoose stores flat paths for inline nested objects; the canonical `.schema.paths` nested structure exists only for explicit sub-schemas."

key-files:
  created:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/ServiceOrder.providerSnapshot.test.js"
    - "/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-03-SUMMARY.md"
  modified:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js"

key-decisions:
  - "Ignore client-supplied item.providerSnapshot entirely (no hybrid/merge). Any mobile-side forgery or drift is neutered — the snapshot always reflects what the server saw at creation time."
  - "Missing profile OR missing user at creation time produces a console.warn + partial snapshot (providerRole + snapshotAt only, other fields null). Order creation still succeeds. Rationale: never block legitimate buyers if the provider's profile record is temporarily missing; plan 01-06's migration script covers the historical orphan case separately."
  - "Include all three fields the original snapshot carried (companyName, phoneNumber, telegramUsername) in the server-authoritative lookup, even though they were already populated — the point is to stop trusting the client for ANY field, not just the new ones."
  - "Used `require.main === module` guard instead of introducing a separate `src/app.js` + `src/server.js` split. D-04 defers server.js refactor; this pattern is the minimum-viable testability change."
  - "Added 2 positive-path tests beyond the plan's stated 3 (providerRole accepts broker|logistics; POST /api/orders logistics path). Plan said 13 total moderation tests expected; actual is 15. Net-positive coverage, no reduction of required assertions."

patterns-established:
  - "Trust boundary: POST /api/orders body is untrusted for providerSnapshot. Mobile can continue sending it (no breaking change to the request contract) but the server will overwrite it."
  - "Snapshot safety net on missing references: console.warn + partial snapshot with role+timestamp is the creation-path contract. The migration script (plan 01-06) handles retroactive backfill and may exit non-zero on unresolvable orphans per D-31."

requirements-completed:
  - DATA-03

# Metrics
duration: 2min 12s
completed: 2026-04-17
---

# Phase 01 Plan 03: ServiceOrder.providerSnapshot Extension Summary

**Extended the ServiceOrder.providerSnapshot subdoc with email/firstName/lastName/providerRole/snapshotAt and rewired POST /api/orders to populate every field from authoritative server-side lookups (Broker/LogisticsPartner + User), so a later hard-delete of a provider profile (Phase 2 DELETE endpoint) cannot destroy buyer order history.**

## Performance

- **Duration:** ~2min 12s
- **Started:** 2026-04-17T14:18:00Z
- **Completed:** 2026-04-17T14:20:12Z
- **Tasks:** 1 (TDD cycle: RED + GREEN, no REFACTOR required)
- **Files modified:** 2 backend (server.js + new test file) + 1 mobile (this summary)

## Accomplishments

- `serviceOrderSchema.providerSnapshot` now has 8 fields (3 existing + 5 new per D-22). `providerRole` is an enum `['broker', 'logistics']` with `default: null`; `snapshotAt` is a `Date` with `default: Date.now`.
- `POST /api/orders` creation loop now performs one authoritative lookup per unique `(providerUid, providerType)` group: `Broker.findOne({ ownerUid })` or `LogisticsPartner.findOne({ ownerUid })` plus `User.findOne({ firebaseUid })`. The client's `item.providerSnapshot` is no longer read — proven by the "stale-from-client" test case (`companyName: 'stale-from-client'` in the request body becomes `'Acme Brokerage'` in the persisted order).
- `server.js` exports the Express app for supertest: `app.listen(...)` is wrapped in `if (require.main === module) { ... }` and `module.exports = { app }` is added. Production startup (Railway runs `node server.js`) is unchanged — the script is the main module, so it still binds the port.
- Jest suite: 15/15 green. Breakdown: 4 `ModerationAction` append-only + 6 `User.moderationStatus` + 5 new `ServiceOrder.providerSnapshot`. Zero regressions to plans 01 and 02.
- `node -c server.js` exits 0 (syntax clean).

## Task Commits

Each commit atomic on `feat/moderation-baseline` in the backend repo:

1. **RED gate** — `ee480cf` `test(moderation): add failing providerSnapshot schema + creation-path tests` — 5-case test suite; 4 fail (expected), 1 passes by coincidence (enum doesn't exist so non-enum value is silently accepted).
2. **GREEN gate** — `889b831` `feat(moderation): extend providerSnapshot schema + server-authoritative populate on POST /api/orders` — schema extension + handler rewrite + app export + test-side fix for Mongoose's inline-subdoc dotted-path storage. All 5 tests pass; no regression to the 10 earlier tests.

TDD gate sequence intact: `test(...)` → `feat(...)`. No REFACTOR was needed — the GREEN diff is already modular and readable.

Mobile planning repo commit for SUMMARY.md: separate, via `gsd-tools commit`, at end of this plan.

## server.js Diff Summary

**Schema extension (lines ~202-206 pre-edit → ~202-211 post-edit):**
```
-  providerSnapshot: {
-    companyName: String,
-    phoneNumber: String,
-    telegramUsername: String,
-  },
+  providerSnapshot: {
+    companyName: String,
+    phoneNumber: String,
+    telegramUsername: String,
+    email: String,
+    firstName: String,
+    lastName: String,
+    providerRole: { type: String, enum: ['broker', 'logistics'], default: null },
+    snapshotAt: { type: Date, default: Date.now },
+  },
```

**POST /api/orders provider-grouping loop (pre → post):**
```
-    for (const item of items) {
-      const key = `${item.providerUid}_${item.providerType}`;
-      if (!providerGroups[key]) {
-        providerGroups[key] = {
-          providerUid: item.providerUid,
-          providerType: item.providerType,
-          providerSnapshot: item.providerSnapshot,   // TRUST CLIENT
-          services: [],
-        };
-      }
-      providerGroups[key].services.push(item.service);
-    }
+    for (const item of items) {
+      const key = `${item.providerUid}_${item.providerType}`;
+      if (!providerGroups[key]) {
+        let profile = null;
+        if (item.providerType === 'broker') {
+          profile = await Broker.findOne({ ownerUid: item.providerUid }).lean();
+        } else if (item.providerType === 'logistics') {
+          profile = await LogisticsPartner.findOne({ ownerUid: item.providerUid }).lean();
+        }
+        const ownerUser = await User.findOne({ firebaseUid: item.providerUid }).lean();
+        if (!profile || !ownerUser) {
+          console.warn(`[providerSnapshot] Warning: provider ${item.providerUid} (${item.providerType}) not fully resolvable at order creation — profile=${!!profile}, user=${!!ownerUser}`);
+        }
+        providerGroups[key] = {
+          providerUid: item.providerUid,
+          providerType: item.providerType,
+          providerSnapshot: {
+            companyName: profile?.companyName ?? null,
+            phoneNumber: profile?.phoneNumber ?? null,
+            telegramUsername: profile?.telegramUsername ?? null,
+            email: ownerUser?.email ?? null,
+            firstName: ownerUser?.firstName ?? null,
+            lastName: ownerUser?.lastName ?? null,
+            providerRole: item.providerType,
+            snapshotAt: new Date(),
+          },
+          services: [],
+        };
+      }
+      providerGroups[key].services.push(item.service);
+    }
```

**App export at EOF:**
```
-app.listen(PORT, () => {
-  console.log(`Server running on port ${PORT}`);
-});
+if (require.main === module) {
+  app.listen(PORT, () => {
+    console.log(`Server running on port ${PORT}`);
+  });
+}
+
+module.exports = { app };
```

`git diff --stat server.js`: `1 file changed, 39 insertions(+), 5 deletions(-)` across the GREEN commit.

## Export Pattern: `require.main === module` / `module.exports = { app }`

This is the standard Node pattern for making an Express file both a runnable script AND an importable module. The identity `require.main === module` is true **only** when the file is invoked directly (`node server.js`). When some other file does `require('./server.js')` the identity is false.

Why it's safe here:
- Railway deploys the backend via `node server.js` (see `package.json` "start" script). Under that invocation `require.main === module` is true → `app.listen(PORT, ...)` fires → production behavior is unchanged.
- Jest loads `server.js` via `require()` → the guard is false → no port bind → no `EADDRINUSE` collisions between test runs. `supertest(app)` mounts the Express app in-process via its internal ephemeral listener.
- No environment-sniffing (`NODE_ENV === 'test'`) needed — the guard is invocation-based, not env-based.

Threat model disposition T-03-06 (tampering with the module-export change breaking production) is mitigated by this exact pattern; the RED→GREEN run on a fresh Mongo instance confirms the app still starts and serves requests.

## Partial-Snapshot Fallback (missing references)

Design: if `Broker.findOne(...)` / `LogisticsPartner.findOne(...)` returns null OR `User.findOne(...)` returns null, the handler **does not** 4xx the request. It:

1. Logs `console.warn("[providerSnapshot] Warning: provider <uid> (<type>) not fully resolvable at order creation — profile=<bool>, user=<bool>")`.
2. Persists the snapshot with whatever it has: at minimum `providerRole` (from `item.providerType`) and `snapshotAt` (from `new Date()`). Missing fields become `null`.

Rationale:
- Blocking order creation on a missing provider profile would surprise buyers whose transactions are mid-flight when an admin edits/deletes a provider record (race condition). The server prefers "create the order, flag it for ops" over "fail the request."
- The warning log lets ops grep `[providerSnapshot] Warning:` in Railway logs and see which orders have partial snapshots.
- Plan 01-06 (migration + backfill script) has orthogonal responsibility for historical orders and may choose to exit non-zero on unresolvable orphans per D-31. Runtime policy (this plan) and migration policy (plan 06) are deliberately different: runtime MUST NOT block, migration MUST surface every orphan for admin triage.

## Test Counts

15 moderation tests green (vs. plan's predicted 13 — I added 2 extra positive-path cases):

```
PASS __tests__/moderation/User.moderationStatus.test.js           (6 tests)
PASS __tests__/moderation/ModerationAction.append-only.test.js    (4 tests)
PASS __tests__/moderation/ServiceOrder.providerSnapshot.test.js   (5 tests)

Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        ~2.7 s
```

Five-case breakdown for `ServiceOrder.providerSnapshot.test.js`:

1. `schema has all 8 expected providerSnapshot fields` — asserts all 8 dotted paths exist, providerRole.enumValues contains broker+logistics, snapshotAt.instance is `'Date'`.
2. `providerRole enum rejects invalid value` — `new ServiceOrder({ providerSnapshot: { providerRole: 'seller' } }).validate()` rejects with `/providerRole/`.
3. `providerRole enum accepts broker and logistics` — extra positive case. Both values `.validate()` resolves.
4. `POST /api/orders populates snapshot from Broker + User lookups (broker path)` — the canonical test from the plan. Seeds Broker + User, posts with stale client snapshot, asserts persisted values come from DB, not client.
5. `POST /api/orders populates snapshot from LogisticsPartner + User lookups (logistics path)` — extra parity case proving the logistics branch of the `if/else if` works.

## Decisions Made

- **Keep `module.exports = { app }` object-shaped (not bare `= app`).** Future plans may export additional handles (e.g. `models`, `middleware`) without breaking existing imports.
- **`profile?.companyName ?? null` instead of `|| null`.** Preserves falsy-but-defined values like empty strings and 0; the nullish-coalescing operator is semantically correct for the "missing field" case.
- **Test teardown uses `deleteMany({})` per-collection per-test** rather than dropping the database. Keeps the `seedSuperAdmin()` invariant intact (the superadmin row is reseeded before each test if needed — actually it seeds only on Mongo connect, so teardown is safe).
- **No dedup on `await Broker.findOne()` calls for repeat providers in the same order.** The loop wraps each `if (!providerGroups[key])` branch, so duplicate items for the same provider share one lookup. Correct by construction.
- **No new index on `ServiceOrder.providerSnapshot.*`.** The new fields are read-only snapshot data, not query keys. Buyer list / provider list queries still hit `buyerUid+createdAt` / `providerUid+createdAt`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking test design issue] Replace `schema.path('providerSnapshot').schema.paths` with per-leaf `schema.path('providerSnapshot.<leaf>')` assertions.**

- **Found during:** First GREEN run (Task 1, after schema + handler edits).
- **Issue:** Mongoose inline-nested-object schemas are stored as flat dotted paths (e.g. `providerSnapshot.companyName` is a full SchemaPath). `schema.path('providerSnapshot')` returns `undefined` for such inline blocks — a nested `.schema.paths` structure exists only for explicit sub-schemas created via `new mongoose.Schema({...})`. The plan's example test code would never pass against the schema shape the plan also prescribed. This is a test-code bug introduced in my own RED commit; found one test-case away from green.
- **Fix:** Replaced the single `Object.keys(...)` assertion with a loop of per-leaf `expect(schema.path('providerSnapshot.<leaf>')).toBeDefined()` assertions, plus direct checks of `enumValues` and `instance` for typed paths. Same contract (all 8 fields + enum + Date), different traversal.
- **Files modified:** `__tests__/moderation/ServiceOrder.providerSnapshot.test.js`.
- **Commit:** `889b831` (bundled into GREEN since it was a same-chunk fix, not a separate behavior).

### Added beyond plan

**2. Two extra positive-coverage tests (not in plan).**

- **Where:** `providerRole enum accepts broker and logistics` and the logistics-path `POST /api/orders` case.
- **Why:** The plan's 3 test cases covered the `broker` path and the negative enum rejection, leaving the `logistics` branch of the handler's `if/else if` uncovered by any test. Added the logistics parity test to close that branch. The enum-accepts test is a 3-line complement to the enum-rejects test; cheap symmetric coverage.
- **Effect:** Total moderation tests = 15 instead of the plan's predicted 13. The plan's `cd ... && npm test -- --testPathPattern moderation` acceptance criterion (exit 0) is strictly satisfied — more passing tests, not fewer.

## Authentication Gates

None. All work was local + test + code-edit. No external credentials, no OAuth, no auth flows triggered.

## Issues Encountered

- **Pre-existing duplicate-index Mongoose warnings** (`orderNumber`, `slug`, `ownerUid`). These predate this plan — they come from existing inline `unique: true` on `type: String` paths combined with `.index({ x: 1 }, { unique: true })` declarations. Out of scope per the scope-boundary rule (not caused by my changes). Plan 01-01's summary already flagged the `AdminUser.email` variant.
- **`seedSuperAdmin` runs on every test file** (because each test file requires server.js, which triggers the mongoose.connect() .then() callback). Harmless — it's an idempotent `findOneAndUpdate(..., { upsert: true })`. Produces a `console.log` line in test output but no assertion noise.

## Known Stubs

None. Every promised field is populated; every asserted behavior has a test; the `if (!profile || !ownerUser)` warning path is live code (not a TODO) that covers the "creation under partial provider data" case.

## Threat Flags

None — the plan's `<threat_model>` fully covered this plan's surface. T-03-01 (client-forged snapshot) is mitigated by the server-side overwrite; the "stale-from-client" test case proves it. T-03-06 (module.exports break production) is mitigated by the `require.main === module` guard, which leaves `node server.js` behavior byte-identical.

## TDD Gate Compliance

- **RED gate:** `ee480cf test(moderation): add failing providerSnapshot schema + creation-path tests` — 4/5 tests fail when run; 1 passes by coincidence (enum-not-yet-defined). Fail-fast verified before writing GREEN code.
- **GREEN gate:** `889b831 feat(moderation): ...` — 5/5 providerSnapshot tests pass + 10 prior tests still pass → 15/15 total.
- **REFACTOR gate:** not taken. The GREEN diff is already minimal and readable; no cleanup would change behavior.

All gates land on `feat/moderation-baseline` in the backend repo.

## Next Phase Readiness

- Plan 01-04 (Firebase Admin + verifyIdToken): unblocked. Uses `src/models/AdminUser.js` (already extracted), doesn't touch server.js routes that the handler update touched.
- Plan 01-05 (capability map + STATUS_POLICY): unblocked. No coupling to this plan.
- Plan 01-06 (migration backfill): **direct downstream**. The backfill script must populate these same 8 fields on existing ServiceOrder documents by repeating the Broker/LogisticsPartner + User lookup done here. Reference implementation: the provider-grouping loop in `POST /api/orders` (server.js post-edit). D-24 gives the rule for orphan orders (log + leave snapshot empty); D-31 raises that to "exit non-zero on orphan" for the migration.
- Phase 2 DELETE `/api/admin/moderation/:targetUid/provider-profile`: unblocked. When the handler lands it can safely `deleteOne({ ownerUid: uid })` on Broker/LogisticsPartner without destroying buyer order history — the snapshot carries the identifying data forward.

## Self-Check: PASSED

File existence:
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/ServiceOrder.providerSnapshot.test.js`
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js` (modified — 8-field providerSnapshot + server-side lookup + app export)
- FOUND: `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-03-SUMMARY.md` (this file)

Commits exist on `feat/moderation-baseline`:
- FOUND: `ee480cf` (RED test)
- FOUND: `889b831` (GREEN schema + handler + export + test fix)

Grep / behavior assertions (all 9 plan acceptance commands):
- PASS: `grep -q "providerRole:" server.js`
- PASS: `grep -q "snapshotAt:" server.js`
- PASS: `grep -q "enum: \['broker', 'logistics'\]" server.js`
- PASS: `grep -q "await Broker.findOne({ ownerUid: item.providerUid })" server.js`
- PASS: `grep -q "await LogisticsPartner.findOne({ ownerUid: item.providerUid })" server.js`
- PASS: `grep -q "module.exports = { app }" server.js`
- PASS: `grep -q "require.main === module" server.js`
- PASS: `test -f __tests__/moderation/ServiceOrder.providerSnapshot.test.js`
- PASS: `npm test` — 15/15 passing (plan acceptance said 13 minimum; exceeded)
- PASS: `node -c server.js` — syntax clean
- PASS: backend repo still on `feat/moderation-baseline`
- PASS: no unintentional file deletions (`git diff --diff-filter=D --name-only HEAD~2 HEAD` empty)

---
*Phase: 01-schema-security-baseline-backend*
*Plan: 03 (ServiceOrder.providerSnapshot extension)*
*Completed: 2026-04-17*

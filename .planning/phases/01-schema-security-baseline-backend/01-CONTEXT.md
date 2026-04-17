# Phase 1: Schema + Security Baseline (Backend) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend can verify admin callers cryptographically (Firebase `verifyIdToken` replaces spoofable `callerUid`-in-body) and has the data shape required to store moderation state (`User.moderationStatus` subdoc), audit entries (`ModerationAction` append-only collection), deletion-safe order snapshots (`ServiceOrder.providerSnapshot` — verified/extended from existing), and a central capability map governing severity-state feature gating.

**Covers:** SEC-01, SEC-02, DATA-01, DATA-02, DATA-03, DATA-04.

**Does NOT cover this phase:** moderation action endpoints (Phase 2), enforcement middleware on user-write routes (Phase 3), any mobile work (Phases 4–6).

**Scope boundary:** Backend only — work lives in `../backend-services/carEx-services/`. No changes to the `carEx` mobile repo in Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Backend Code Structure

- **D-01:** Start extracting moderation work into modules. New structure created in this phase:
  - `src/security/firebaseAdmin.js` — initializes `firebase-admin` from a single `FIREBASE_SERVICE_ACCOUNT_JSON` env var
  - `src/security/verifyIdToken.js` — Express middleware; parses `Authorization: Bearer <idToken>`; attaches `req.auth = { uid, email, claims }`
  - `src/security/requireAdmin.js` — Express middleware; requires `verifyIdToken` upstream; looks up `AdminUser` by email; attaches `req.admin = { role, email }`; 403 if not admin
  - `src/moderation/capabilities.js` — exports `STATUS_POLICY` (the capability map; shape below)
  - `src/moderation/service.js` — business-logic module with `suspend()`, `unsuspend()`, `revokeRole()`, `deleteProviderProfile()`, `editProfile()` (endpoints that call these are in Phase 2; scaffolds + signatures land in Phase 1)
  - `src/moderation/actions.js` — thin wrapper around `ModerationAction` model for append-only writes
  - `src/models/User.js`, `src/models/AdminUser.js`, `src/models/ModerationAction.js` — extracted from `server.js`
  - `scripts/migrate-moderation.js` — one-off backfill script
- **D-02:** Existing models NOT moved in Phase 1: `Broker`, `LogisticsPartner`, `Car`, `ServiceOrder`, `VehicleMake`, `VehicleModel`, `OTP`. They stay inline in `server.js`. Rationale: Phase 1 scope is moderation + admin security — extracting unrelated models inflates diff and risk.
- **D-03:** `server.js` begins importing from `src/` (`require('./src/models/User')`, etc.). The legacy `mongoose.model('User', userSchema)` block in `server.js` is removed in favor of the module. All existing routes that use `User` keep working because Mongoose returns the same registered model by name.
- **D-04:** No big-bang server.js refactor in Phase 1. Only the moderation + admin-security extraction. Other domains (brokers, orders, payments) wait for a dedicated future milestone.

### Firebase Admin Migration Strategy

- **D-05:** **Hybrid cutover.** Phase 1 wires `firebase-admin` + `verifyIdToken` + new `requireAdmin` and applies them **only** to new routes mounted under `/api/admin/moderation/*` (Phase 2 builds those routes). Legacy admin routes (`/api/admin/status`, `/api/admin/requests`, `/api/admin/users`) keep their current `callerUid`-in-body → `verifyAdminByUid()` pattern untouched in Phase 1.
- **D-06:** Legacy admin-route migration is **explicitly out of scope for this milestone** but tracked as a follow-up ticket. CONTEXT.md and the eventual SUMMARY.md must call out that `/api/admin/requests` and `/api/admin/users` remain spoofable until that follow-up lands.
- **D-07:** Service account key delivery: single env var `FIREBASE_SERVICE_ACCOUNT_JSON` containing the stringified JSON from the Google Cloud console. `src/security/firebaseAdmin.js` does `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)` on startup and calls `admin.initializeApp({ credential: admin.credential.cert(parsed) })`. Railway stores the value as a standard env var.
- **D-08:** `.env.example` (new file if not present) documents `FIREBASE_SERVICE_ACCOUNT_JSON=` with a one-line comment pointing to the Firebase console download. The actual service account JSON is **not** committed; `.gitignore` already excludes `.env`.
- **D-09:** Mobile idToken wiring lives in **Phase 4**, not Phase 1. Phase 1 is purely backend. CONTEXT.md for Phase 4 will reference the Bearer-token contract defined here.
- **D-10:** 401 response shape from `verifyIdToken`: `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }`. 403 response shape from `requireAdmin`: `{ error: 'unauthorized', message: 'Admin access required' }`. Both are JSON. Phase 3's `requireNotSuspended` uses `{ error: 'account_suspended', ... }` — keeps the three auth failures distinguishable by `error` code.

### Data Model — `moderationStatus` Subdoc (DATA-01)

- **D-11:** Added inline on `userSchema` (extracted to `src/models/User.js` per D-02/D-03). Subdoc shape:
  ```js
  moderationStatus: {
    state: { type: String, enum: ['active', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'active', required: true },
    severity: { type: String, enum: ['none', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'none' },
    reasonCategory: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'other'], default: null },
    note: { type: String, default: null, maxlength: 2000 },
    setByAdminUid: { type: String, default: null },
    setAt: { type: Date, default: null },
    restrictedFeatures: { type: [String], default: [] },
    lastActionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModerationAction', default: null },
  }
  ```
- **D-12:** `restrictedFeatures` is denormalized from `STATUS_POLICY` at suspend time so Phase 3 enforcement middleware does a single user-fetch (not a capability-map resolution per request). Downside: policy changes require re-computing on existing suspended users — acceptable at expected scale.
- **D-13:** Index: `{ 'moderationStatus.state': 1 }` and `{ 'moderationStatus.state': 1, 'moderationStatus.reasonCategory': 1 }` for the Phase 5 admin list/filter queries.
- **D-14:** Default value `{ state: 'active' }` applied by schema on new users; existing users backfilled by migration script (D-27).

### Data Model — `ModerationAction` Collection (DATA-02)

- **D-15:** New file `src/models/ModerationAction.js`. Mongoose schema:
  ```js
  {
    targetUid: { type: String, required: true },        // firebaseUid of the moderated user
    adminUid: { type: String, required: true },         // firebaseUid of the acting admin
    adminEmail: { type: String, required: true },       // denormalized for audit readability
    action: { type: String, enum: ['suspend', 'unsuspend', 'revoke_role', 'delete_provider_profile', 'edit_profile'], required: true },
    severity: { type: String, enum: ['none', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'none' },
    reasonCategory: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'other'], default: null },
    note: { type: String, default: null, maxlength: 2000 },
    roleAffected: { type: String, enum: ['seller', 'broker', 'logistics', null], default: null },  // for revoke_role / delete_provider_profile
    fieldDiff: { type: mongoose.Schema.Types.Mixed, default: null },                                // for edit_profile
    createdAt: { type: Date, default: Date.now, required: true },
  }
  ```
- **D-16:** Indexes: `{ targetUid: 1, createdAt: -1 }`, `{ adminUid: 1, createdAt: -1 }`. Collection name: `moderation_actions`.
- **D-17:** **Append-only enforcement at the application layer.** Register `pre('updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete')` hooks on the schema that throw `Error('ModerationAction is append-only')`. Tests in Phase 1 assert this. DB-user-level insert-only is **out of scope** (would require Atlas privilege changes; tracked as follow-up).
- **D-18:** No hash-chain tamper-evidence in Phase 1. Research flagged it as a hardening option — deferred to a future security milestone. Noted in Deferred Ideas.
- **D-19:** `ModerationAction.createdAt` is authoritative — no separate `timestamp` field.
- **D-20:** Audit-note visibility: `superadmin` + `admin` both read `note` in Phase 1. **Rationale:** the existing `AdminUser` schema already has both roles; gating note visibility by role is a Phase 5 UI concern, not a Phase 1 schema concern. Noted as a Phase 5 design input.

### Data Model — `ServiceOrder.providerSnapshot` (DATA-03)

- **D-21:** `ServiceOrder.providerSnapshot` **already exists** today in `server.js` (lines ~224–230) with `{ companyName, phoneNumber, telegramUsername }`. Phase 1 **verifies** coverage and extends if needed, rather than creating from scratch.
- **D-22:** Fields to add to `providerSnapshot` for delete-profile anonymization:
  - `email` (string) — needed so buyer order history shows something identifiable even after hard-delete
  - `firstName`, `lastName` (strings, optional) — same reason
  - `providerRole` (`'broker' | 'logistics'`) — so the anonymized display can still say "Broker: [name]"
  - `snapshotAt` (Date) — when the snapshot was captured (creation time of the order)
- **D-23:** Verify the ServiceOrder **creation path** (POST /api/orders handler in `server.js`) actually populates every `providerSnapshot` field. If not, the Phase 1 task adds that logic. Acceptance criterion (from ROADMAP #3) explicitly checks `db.orders.findOne(...).providerSnapshot` on existing data — migration must backfill.
- **D-24:** Migration backfill pulls provider data from `brokers` or `logistics_partners` collection by `providerUid` + `providerType`, populates `providerSnapshot`, leaves snapshot empty (and logs a warning) if the referenced provider no longer exists.

### Capability Map (DATA-04) — Claude's Discretion (rich policy)

- **D-25:** Location: `src/moderation/capabilities.js`. Plain JS module exporting `STATUS_POLICY`.
- **D-26:** Shape — rich policy object per state:
  ```js
  const STATUS_POLICY = {
    active: {
      capabilities: 'all',
      banner: null,
    },
    feature_limited: {
      capabilities: { blocked: ['create_listing', 'create_order', 'contact_seller', 'request_seller_role', 'request_broker_role', 'request_logistics_role', 'update_profile'] },
      banner: { titleKey: 'moderation.feature_limited.title', bodyKey: 'moderation.feature_limited.body', appealAllowed: false, resolutionHintKey: 'moderation.feature_limited.resolution' },
    },
    blocked_with_review: {
      capabilities: { blocked: 'all_writes' },  // every mutating endpoint rejects
      banner: { titleKey: 'moderation.blocked_with_review.title', bodyKey: 'moderation.blocked_with_review.body', appealAllowed: true, appealEmail: 'support@carexmarket.com' },
    },
    permanently_banned: {
      capabilities: { blocked: 'all_writes' },
      banner: { titleKey: 'moderation.permanently_banned.title', bodyKey: 'moderation.permanently_banned.body', appealAllowed: false },
    },
  };
  ```
- **D-27:** `banner.*Key` values point at i18n translation keys — actual copy lands in Phase 6 (`QUAL-01`). Keys are defined here so Phase 4 (mobile plumbing) and Phase 6 (affected-UX) both know the contract.
- **D-28:** Helper `resolveRestrictedFeatures(state)` exported from the same module — used by `moderation/service.js` when writing to `user.moderationStatus.restrictedFeatures` (D-12).

### Migration / Backfill — Claude's Discretion (belt + suspenders)

- **D-29:** `scripts/migrate-moderation.js` — one-off Node script runs `node scripts/migrate-moderation.js` manually. Does three things idempotently:
  1. Backfills `moderationStatus: { state: 'active', ... defaults }` on every `User` that lacks the subdoc.
  2. Backfills missing/empty `providerSnapshot` fields on every `ServiceOrder` by looking up the referenced provider.
  3. Creates indexes explicitly (so they exist before Phase 5 admin search hits them).
- **D-30:** `src/security/ensureBaseline.js` — called from `server.js` after Mongoose connects. Runs a fast `countDocuments({ 'moderationStatus.state': { $exists: false } })` on User. If non-zero, logs a warning (`[Baseline] {N} users missing moderationStatus — run scripts/migrate-moderation.js`) but does NOT auto-migrate on startup. Safer: admin runs the migration deliberately after deploy.
- **D-31:** Migration script exits non-zero on any document it cannot backfill (e.g., `ServiceOrder.providerUid` references a deleted provider) and prints a summary so the admin can intervene. No silent partial success.
- **D-32:** Migration is idempotent: rerunning skips already-backfilled documents.

### Testing (Jest + supertest)

- **D-33:** Install `jest@^29` and `supertest@^7` as devDependencies. Add `"test": "jest"` script in `backend-services/carEx-services/package.json` (replacing the current error-stub script).
- **D-34:** Tests live in `__tests__/moderation/` at backend repo root. Phase 1 tests:
  - `ModerationAction.append-only.test.js` — asserts `updateOne`, `deleteOne`, `findOneAndUpdate`, `findOneAndDelete` all throw.
  - `capabilities.test.js` — asserts `STATUS_POLICY` has an entry for every valid state in `User.moderationStatus.state` enum; asserts `resolveRestrictedFeatures` returns the expected list per state.
  - `requireAdmin.middleware.test.js` — spins up an Express app, mocks `verifyIdToken`, asserts 401 without Bearer, 403 when not admin, 200 when admin. Uses supertest.
- **D-35:** No backfilled tests on existing handlers in `server.js`. Scope discipline: Phase 1 only tests what Phase 1 introduces.
- **D-36:** Tests should not require a live Mongo. Use `mongodb-memory-server` (add as devDep) or mock at the Mongoose level for the middleware test. Append-only test uses real Mongoose with an in-memory connection.

### Claude's Discretion

Areas where the planner/executor can choose implementation details without asking:

- Exact ordering of migration script steps (users first vs. orders first) — doesn't matter, both idempotent.
- Precise ObjectId handling in `lastActionId` (Mongoose cast rules apply).
- Whether `ensureBaseline` logs once or repeats on every slow query — pick whatever is quietest.
- Jest config details (preset, moduleFileExtensions) — standard Node preset is fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 1 REQ-IDs: SEC-01, SEC-02, DATA-01, DATA-02, DATA-03, DATA-04
- `.planning/ROADMAP.md` §"Phase 1: Schema + Security Baseline (Backend)" — Goal + 5 success criteria
- `.planning/research/SUMMARY.md` — 7-step build order, key architectural decisions
- `.planning/research/STACK.md` §"Backend additions" — `firebase-admin@^13.8.0`, `zod@^3.24`, `express-rate-limit@^8.3.2` recommendations, rejected audit plugins
- `.planning/research/ARCHITECTURE.md` §"Build order" — Phase boundaries + component split
- `.planning/research/PITFALLS.md` §"Authorization", §"Append-only audit" — pitfalls #1, #4, #12, #13 all live in Phase 1

### Codebase state (existing)
- `.planning/codebase/STACK.md` — Mobile stack (for Phase 4 context; Phase 1 doesn't touch mobile)
- `.planning/codebase/ARCHITECTURE.md` §"Auth model" — Hybrid Firebase REST + backend mirror
- `.planning/codebase/CONCERNS.md` §"Security Issues" — the `callerUid`-in-body pattern that SEC-01 replaces
- `../backend-services/carEx-services/server.js` — Single-file backend (~1500 lines). **Required reading** for Phase 1 planners and executors. Key ranges:
  - `128–146` — `userSchema` (to be extracted + extended with moderationStatus)
  - `200–207` — `adminUserSchema` with `superadmin | admin` roles (already present)
  - `209–247` — `serviceOrderSchema` with `providerSnapshot` (already present; will be extended)
  - `272–276` — `verifyAdminByUid` helper (legacy, stays as-is in Phase 1)
  - `926–1060` — Existing `/api/admin/*` routes (legacy, stay as-is in Phase 1)
- `../backend-services/carEx-services/package.json` — Existing deps: Express 5.2.1, Mongoose 9.1.5, Stripe, Twilio. Pure JS.

### External references (for researcher/planner lookups, if needed)
- Firebase Admin SDK — Verify ID Tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Mongoose schema middleware: https://mongoosejs.com/docs/middleware.html
- Node `firebase-admin` npm: https://www.npmjs.com/package/firebase-admin

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already in backend)

- **`AdminUser` model with `superadmin | admin` roles** (`server.js:200-207`) — Phase 1's new `requireAdmin` middleware looks up `AdminUser` by email from the verified idToken (same table). No new admin-tier schema needed.
- **`verifyAdminByUid(uid)` helper** (`server.js:272-276`) — Legacy pattern: looks up `User.firebaseUid` → gets email → finds `AdminUser.email`. We do NOT reuse this for new moderation routes (that's the whole point of SEC-01), but reference its join logic when building `requireAdmin` (same table pair, different auth input).
- **`ServiceOrder.providerSnapshot`** (`server.js:224-230`) — Already present. Phase 1 extends, doesn't create.
- **`ServiceOrder.carSnapshot`** (`server.js:216-223`) — Parallel pattern for car data. Use as template/inspiration when adding `email`, `firstName`, `lastName` to `providerSnapshot`.
- **`seedSuperAdmin()`** (`server.js:258-270`) — Runs on MongoDB connect. Phase 1 `ensureBaseline()` hook (D-30) plugs into the same post-connect point.

### Established Patterns (must honor)

- **All models defined with `mongoose.model('Name', schema, 'collection_name')`** — include explicit collection names so Mongo doesn't pluralize incorrectly. `ModerationAction` uses `'moderation_actions'`.
- **No middleware functions today — every route handler is an inline `async (req, res) => { ... try/catch/res.json(...) }`.** Phase 1 introduces the first real middleware (`verifyIdToken`, `requireAdmin`). Keep signatures idiomatic Express, compose via `app.use(path, middleware1, middleware2, handler)`.
- **`.lean()` used frequently for read performance** — pattern for Phase 1 `requireAdmin` (read-only AdminUser lookup).
- **Error responses today use `{ message: ... }` shape.** Phase 1 introduces `{ error, message }` shape for new auth failures (D-10). Explicitly different to enable mobile interceptor distinguishing old vs new paths.

### Integration Points

- **`server.js` top-of-file imports** — new modules are required there (`const { verifyIdToken } = require('./src/security/verifyIdToken')`, etc.).
- **Mongoose connection block** (`server.js:20-25`) — `seedSuperAdmin()` runs after connect; `ensureBaseline()` (D-30) is added to the same callback.
- **Future Phase 2 routes mount points** — Phase 2 will do `app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter)`. Phase 1 scaffolds the middleware + router skeleton file `src/moderation/router.js` with a single `/ping` route that returns 200 (used by the SEC-01 acceptance curl).
- **Jest test runner** — `npm test` invokes `jest`. New `__tests__/` directory at backend repo root.

### Anti-Pattern Warnings

- **Do NOT overload `Broker.status` or `LogisticsPartner.status` (`active | inactive`) for moderation.** Those are separate "is this provider operational" flags that predate this work. Moderation lives on `User.moderationStatus` and cascades by join at read time (Phase 3).
- **Do NOT add a `suspended` state to `Car.listingStatus`.** `listingStatus` enum stays `active | booked | sold`. Phase 3's Mongoose `pre(/^find/)` middleware filters by owner's `moderationStatus.state`, NOT by a new listing flag. (Research pitfall #6: unsuspend-leaves-hidden bug.)
- **Do NOT migrate `/api/admin/requests` or `/api/admin/users` in Phase 1.** Hybrid cutover (D-05) — leave them on `callerUid` until a follow-up milestone. The temptation to "fix it all now" expands scope and increases regression risk on existing seller-approval flows.
- **Do NOT commit the service account JSON.** `FIREBASE_SERVICE_ACCOUNT_JSON` is an env var only; `.env` is already gitignored. `.env.example` documents the var name only.

</code_context>

<specifics>
## Specific Ideas

- The 5 success criteria in ROADMAP.md Phase 1 §"Success Criteria" are verbatim acceptance criteria for verifier — every plan's `must_haves` section should map to one of them.
- Acceptance criterion #1 requires a callable route: plan includes scaffolding `GET /api/admin/moderation/ping` that returns 200 + `{ ok: true }` — enough to exercise the auth chain end-to-end. Real moderation endpoints arrive in Phase 2.
- Acceptance criterion #4 (`ModerationAction.updateOne(...)` throws) requires a Mongoose-schema-level guard, not just a service-layer guard. Tests verify the schema-level error.
- Acceptance criterion #5 (`STATUS_POLICY` resolves + has entry for every severity state) requires the state enum in `User.moderationStatus.state` and `STATUS_POLICY` keys to be identity-equal. Phase 1 tests assert that.

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to follow-up milestones — do not quietly re-introduce:**

- **Migrate `/api/admin/requests`, `/api/admin/users`, `/api/admin/status` to Bearer idToken** (D-06). Tracked as a post-moderation security cleanup milestone. Until then, those routes remain spoofable — known risk, documented.
- **DB-user-level insert-only privilege on `moderation_actions`** (D-17). Requires Atlas privilege changes; application-layer append-only is Phase 1's bar.
- **Hash-chain tamper-evidence on ModerationAction** (D-18). Research flagged as a hardening option; not required for Phase 1.
- **Express 5 → Express 4 downgrade** — research flagged Express 5 performance regression, but backend is already on 5.2.1 and a downgrade is not worth the churn mid-milestone. Revisit in a dedicated perf milestone.
- **Extracting brokers / logistics / orders / payments models out of server.js** — scope discipline (D-04). Part of the deferred tech-debt milestone.
- **Backfilled tests on existing handlers** (D-35). Jest is installed this phase but test coverage of legacy routes is not a Phase 1 goal.
- **Super-admin-only audit-note visibility** (D-20) — Phase 5 UI concern. Schema is agnostic.
- **`callerUid`-side deprecation warnings logged from legacy admin routes** — would help the follow-up migration but adds noise this phase.

</deferred>

---

*Phase: 01-schema-security-baseline-backend*
*Context gathered: 2026-04-17*

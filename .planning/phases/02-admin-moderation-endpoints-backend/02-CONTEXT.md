# Phase 2: Admin Moderation Endpoints (Backend) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Five admin moderation HTTP endpoints mounted under `/api/admin/moderation/*` (behind the `verifyIdToken → requireAdmin` chain that Phase 1 already wired). Each endpoint mutates `User.moderationStatus` and/or a provider profile document AND appends a `ModerationAction` row in a single Mongoose transaction. All endpoints are rate-limited per admin and protected by self-moderation + last-admin guards.

**Covers:** SEC-03, SEC-04, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05.

**Does NOT cover this phase:**
- `requireNotSuspended` middleware on user-write endpoints (Phase 3, ENF-01)
- Mongoose `pre(/^find/)` middleware hiding suspended users from public queries (Phase 3, ENF-02)
- Payment-confirm TOCTOU re-check (Phase 3, ENF-03)
- `GET /api/admin/moderation/:targetUid/history` audit-read endpoint (Phase 5, UI-03) — and therefore the super-admin-vs-admin note-visibility decision stays deferred to Phase 5
- Any mobile work (Phases 4–6)

**Scope boundary:** Backend only — all work lives in `../backend-services/carEx-services/`. No changes to the `carEx` mobile repo in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Endpoint Surface (pinned by ROADMAP success criteria)

- **D-01:** Five endpoints, exactly as ROADMAP.md Phase 2 §Success Criteria names them — no bikeshedding:
  - `POST /api/admin/moderation/:targetUid` — body discriminator `{ action: 'suspend' | 'revoke_role', ... }` (single POST handles both per the roadmap wording)
  - `PATCH /api/admin/moderation/:targetUid/unsuspend` — returns user to `active`
  - `DELETE /api/admin/moderation/:targetUid/provider-profile` — body `{ role: 'broker' | 'logistics' }`
  - `POST /api/admin/moderation/:targetUid/edit-profile` — body `{ role, fields: {...} }`
  - Router file: extend `src/moderation/router.js` (already has `/ping` scaffold from Phase 1).
- **D-02:** Success response shape: `{ ok: true, user: { moderationStatus }, action: { _id, action, createdAt } }` — gives the admin UI enough to reconcile the row without a follow-up fetch. Error shape stays `{ error, message, ...fields }` per Phase 1 D-10.

### Edit-Profile Contract (ADMIN-05) — USER-DECIDED

- **D-03:** **Whitelist is narrow — identity/contact only.** Anything else is out of admin's lane.
  - **Broker editable fields:** `companyName`, `phoneNumber`, `telegramUsername`.
  - **LogisticsPartner editable fields:** `companyName`, `phoneNumber`, `telegramUsername`, `coverageAreas`, `timelines`.
  - **Explicitly NOT admin-editable** (provider's own content/operational domain): `description`, `avatarUrl`, `paymentOptions`, `services`, `status`, `ownerUid`, `createdAt`, `_id`.
  - Rationale: PROJECT.md scoped this to "company name, phone, Telegram" — admin is correcting identity/contact info on the provider's behalf, not curating their listing. Logistics gets `coverageAreas` + `timelines` because those are operational-identity (where you deliver, how fast) not creative content.
- **D-04:** `fieldDiff` stored as **per-field before/after, changed-only**:
  ```js
  fieldDiff: {
    companyName: { before: 'Old Co', after: 'New Co' },
    phoneNumber: { before: '+70000000', after: '+70000001' },
  }
  ```
  Only fields whose value actually changed appear. Unchanged-but-submitted fields are filtered out before writing the audit row. Readable in Phase 5 history UI with zero transformation; easy to grep "who changed companyName on user X."
- **D-05:** **Unknown fields → 400** `{ error: 'invalid_field', fields: ['foo', 'bar'] }`. Zod `.strict()` mode gives this for free. Prevents schema-drift bugs and accidental writes to unlisted fields.
- **D-06:** **No-op submit → 400** `{ error: 'no_changes' }`. Every `ModerationAction` row must represent an actual state change — keeps the audit log clean for compliance review. Computed by comparing the submitted fields to the current profile *after* whitelist filtering, *before* starting the transaction.
- **D-07:** Edit-profile is only valid when the target User has the corresponding role actually set (`User.brokerStatus === 'APPROVED'` or `User.logisticsStatus === 'APPROVED'`). If not, reject 400 `role_not_assigned`.

### Revoke-Role Semantics (ADMIN-03) — Claude's Discretion

- **D-08:** **Revoke only mutates `User.{role}Status` → `'NONE'`. The Broker / LogisticsPartner profile document is NOT touched.**
  - Seller revoke: `User.sellerStatus = 'NONE'`. (No separate collection exists for sellers.)
  - Broker revoke: `User.brokerStatus = 'NONE'`. Broker doc stays in `brokers` with its original `status`, `services`, etc. untouched.
  - Logistics revoke: `User.logisticsStatus = 'NONE'`. LogisticsPartner doc stays intact.
  - Rationale: "preserved for historical lookups" (ROADMAP #2) + Pitfall 6 symmetry. If the admin later regrants the role via the existing approve flow, no data needs restoration.
- **D-09:** **No new `listed: boolean` field on Broker / LogisticsPartner** — rejected in favor of joining on `User.brokerStatus === 'APPROVED'` at read time (Phase 3's concern, ENF-02). Rationale: today's broker directory query already joins (or should join) on the owner User's role status — that's the Single Source of Truth. Adding `listed` creates a second source that can drift.
- **D-10:** Existing `Broker.status: 'active' | 'inactive'` stays semantically *operational* (is this provider accepting work right now?) — it is **not** repurposed for moderation. Phase 2 does not touch it.
- **D-11:** Revoke payload: `{ action: 'revoke_role', role: 'seller' | 'broker' | 'logistics', reasonCategory, note? }`. If target User doesn't have the role assigned (`xStatus !== 'APPROVED'`), reject 400 `role_not_assigned`.
- **D-12:** Revoke writes a `ModerationAction` row with `action: 'revoke_role'`, `roleAffected: '<role>'`, `severity: 'none'`. No state mutation on `moderationStatus` — revoke is orthogonal to suspension.

### Delete-Provider-Profile Semantics (ADMIN-04) — Claude's Discretion

- **D-13:** **Delete mutates User AND hard-deletes the provider doc, atomically:**
  1. Hard-delete Broker or LogisticsPartner doc (`Broker.deleteOne({ ownerUid: targetUid })` / likewise for LogisticsPartner).
  2. Set corresponding `User.{role}Status = 'NONE'`. Otherwise User would claim a role pointing at a non-existent profile — inconsistent state.
  3. Append `ModerationAction { action: 'delete_provider_profile', roleAffected, severity: 'none' }`.
  All three in a single `session.withTransaction()`. If any step fails, the whole transaction aborts.
- **D-14:** **Only brokers and logistics profiles can be deleted.** Sellers have no profile doc; `DELETE /provider-profile { role: 'seller' }` returns 400 `invalid_role_for_delete`. (Admin who wants to revoke seller role uses revoke_role.)
- **D-15:** **Past orders are preserved via `ServiceOrder.providerSnapshot`** (populated + backfilled in Phase 1, D-21..D-24). Phase 2 delete handler does NOT touch the `service_orders` collection. If `providerSnapshot` is empty for some order (migration skipped it per D-31), that's a pre-existing data-integrity problem, not Phase 2's concern — surface via log warning, not rollback.
- **D-16:** Delete is irreversible from the admin UI's perspective (no "undelete"). The audit row + the order-side `providerSnapshot` are the only remaining traces. Document this clearly in the Phase 5 UI confirm dialog (Phase 5 concern).

### Suspend / Unsuspend Semantics (ADMIN-01, ADMIN-02)

- **D-17:** **Suspend payload:** `{ action: 'suspend', severity: 'feature_limited' | 'blocked_with_review' | 'permanently_banned', reasonCategory: 'spam' | 'policy_violation' | 'fraud' | 'other', note?: string }`. Admin sends `severity` only; handler derives `state = severity` (non-active states are identity-equal to their severity — see D-11 in 01-CONTEXT.md).
- **D-18:** **User.moderationStatus mutations on suspend, inside transaction:**
  ```js
  user.moderationStatus = {
    state: severity,                                    // derived from severity
    severity,
    reasonCategory,
    note: note ?? null,
    setByAdminUid: req.admin.uid,
    setAt: new Date(),
    restrictedFeatures: resolveRestrictedFeatures(severity),  // from capabilities.js
    lastActionId: insertedActionId,                     // link back to audit row
  };
  ```
  `lastActionId` is set AFTER the audit row insert (inside the same transaction) — requires two-step pattern: insert action, then update user with the inserted _id. Both inside one transaction.
- **D-19:** **Re-suspend (already-suspended user, different severity) is ALLOWED.** Admin may escalate `feature_limited → blocked_with_review` after discovering worse behavior. Each re-suspend writes a new `ModerationAction`; prior rows never mutate (append-only). `lastActionId` on the User doc flips to the newest audit row.
- **D-20:** **Re-suspend with identical severity (no-op)** → 400 `already_at_severity`. Same compliance hygiene as edit-profile D-06: every audit row represents a real change.
- **D-21:** **Unsuspend payload:** `{ note?: string }`. (The PATCH path already specifies the action.) Handler sets `state = 'active'`, `severity = 'none'`, clears `reasonCategory`, `note`, `restrictedFeatures: []`, bumps `setByAdminUid` / `setAt` to this unsuspend event, updates `lastActionId`. Appends `ModerationAction { action: 'unsuspend', severity: 'none' }`.
- **D-22:** **Unsuspend on already-active user** → 400 `not_suspended`. Same idempotency discipline.

### Transaction Strategy — Claude's Discretion

- **D-23:** **Use `session.withTransaction()`** (Mongoose-wrapped, auto-retries transient transaction errors per Atlas best practice). Every mutating handler opens a session, runs the reads + writes in `withTransaction`, and errors bubble out of the callback to abort.
- **D-24:** **Transaction boundary covers:** audit-row insert → User.moderationStatus update (or Broker/LogisticsPartner delete → User.xStatus update) → last-admin-guard query. If any step throws, the whole transaction aborts. No partial state lands.
- **D-25:** **Atlas tier assumption:** M10+ replica set (Atlas transactions require replica set, which is default on M-series). If the project is on M0 sandbox, transactions fail at runtime — surface the error clearly rather than silently degrading to non-transactional. Verification: `.planning/STATE.md` blocker "Atlas cluster tier — confirm M10+" must be resolved during planning. If M0, escalate before executing.

### Self-Moderation + Last-Admin Guards (SEC-03) — Claude's Discretion

- **D-26:** **Self-moderation guard** is a small dedicated middleware `denySelfModeration` that runs AFTER `requireAdmin` and BEFORE the action handler. It reads `req.params.targetUid === req.admin.uid` → 400 `{ error: 'cannot_moderate_self' }`. Single file, applied to every route in the moderation router. Backend-authoritative — UI guard in Phase 5 is defense-in-depth.
- **D-27:** **Last-admin guard** lives INSIDE each action handler, INSIDE the transaction, right before the state-mutation step. Aggregate count of "active admins" defined as:
  ```js
  const activeAdminCount = await User.countDocuments({
    email: { $in: await AdminUser.distinct('email') },
    'moderationStatus.state': 'active',
  }, { session });
  ```
  (Runs inside the transaction via `{ session }` — read/write isolation across the guard + mutation.)
- **D-28:** Guard fires when:
  - `suspend` — and target is the last active admin → 400 `last_admin_protected`
  - `revoke_role` — only when revoked role would remove admin capability; admins are identified by `AdminUser` rows, not a User role field, so revoke_role is NOT admin-destructive. Guard skipped for revoke_role. (If an admin loses their `brokerStatus`, they're still an admin.)
  - `delete_provider_profile` — same reasoning; skipped. Admin-ness lives in `AdminUser`, not in broker/logistics profiles.
  - `edit_profile` — no state change to admin-ness; guard skipped.
  - `unsuspend` — can only INCREASE admin count; guard skipped.
  - Net: last-admin guard runs only for `suspend`.
- **D-29:** Attempted self-moderation and attempted last-admin-suspend are **logged but NOT audited to ModerationAction**. Audit log reflects *successful* state changes; rejected attempts stay in `console.log` (with admin UID + timestamp for ops forensics). Rationale: cluttering the audit ledger with rejected attempts dilutes its legal value.

### Rate Limiting (SEC-04) — Claude's Discretion

- **D-30:** **`express-rate-limit@^8.3` with default in-memory store.** Mounted on the moderation router (`moderationRouter.use(limiter)` — applies to every moderation endpoint uniformly).
- **D-31:** **Limits:** 30 requests per 15-minute window per admin UID. Keyed by `req.admin.uid` (set by `requireAdmin`). Response on breach: `429` with `{ error: 'rate_limited', retryAfter: <seconds> }` and `Retry-After` header.
- **D-32:** **All moderation endpoints count toward the limit**, including unsuspend and edit-profile. Rationale: SEC-04 wording is "30 actions"; being conservative against compromised-admin scripting is the whole point. A benign admin will never approach 30/15min.
- **D-33:** **STATE.md blocker — Railway instance count:** Memory store is correct for single-instance Railway (CarEx's current deployment). If Railway scales horizontally, in-memory limits become per-instance (effectively 30×N). Must verify Railway instance count during planning. If >1, swap to `rate-limit-redis` + Railway Redis add-on (pattern noted; not required Phase 2 implementation if count confirmed = 1).

### Payload Validation — Claude's Discretion

- **D-34:** **Zod per-action schemas in `src/moderation/schemas.js`** (single module). Exports `suspendSchema`, `revokeRoleSchema`, `unsuspendSchema`, `deleteProfileSchema`, `editProfileBrokerSchema`, `editProfileLogisticsSchema`.
- **D-35:** All schemas use `.strict()` mode → Zod automatically rejects unknown top-level keys → gives D-05 for free. Enum values pulled from `STATUS_POLICY` keys and `ModerationAction.action` enum so they cannot drift.
- **D-36:** Handler pattern:
  ```js
  router.post('/:targetUid', denySelfModeration, async (req, res, next) => {
    const parsed = actionDispatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
    const { action } = parsed.data;
    // dispatch to suspend / revoke_role
  });
  ```
- **D-37:** `zod@^3.24` added as a backend dep. Noted in research/STACK.md but not yet in package.json (verify during planning). If already installed via some other plan — confirm version.

### Testing (Phase 2 additions to Jest + supertest harness from Phase 1)

- **D-38:** Tests live in `__tests__/moderation/` (same dir as Phase 1 tests). Coverage per handler:
  - `suspend.test.js` — happy path (User updated + ModerationAction appended in one transaction); re-suspend different severity allowed; re-suspend same severity rejected; self-moderation rejected; last-admin rejected; unknown severity rejected by Zod.
  - `unsuspend.test.js` — happy path (state → active); unsuspend-on-active rejected.
  - `revokeRole.test.js` — per-role (seller/broker/logistics); Broker/LogisticsPartner docs NOT deleted; role_not_assigned rejected; self-moderation rejected.
  - `deleteProviderProfile.test.js` — broker and logistics happy paths; seller rejected 400; past orders still resolve via providerSnapshot; transaction rollback on simulated mid-flight failure.
  - `editProfile.test.js` — narrow whitelist enforced; unknown field 400; no-op 400; changed-only diff shape; role_not_assigned rejected.
  - `rateLimit.test.js` — 30 requests succeed, 31st returns 429 with Retry-After; limit is per admin UID (admin A's limit doesn't affect admin B).
- **D-39:** Tests use `mongodb-memory-server` replica-set mode (already a devDep per D-36 in Phase 1) for transaction support. Firebase verify is mocked (`jest.mock('firebase-admin')` returns a fake decoded token with admin email).

### Claude's Discretion

Areas the planner/executor can choose without asking:
- Exact order of audit-row insert vs User update inside the transaction (either works as long as `lastActionId` is resolved before commit).
- Request-log format for rejected self-moderation / last-admin attempts (console.log format).
- Retry-After value on 429 — derive from the rate limiter's window reset time (library provides this).
- Whether to expose `denySelfModeration` as a reusable middleware or inline the check per handler (middleware is cleaner — lean that way).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone decisions (preset reason picker, severity model, no email/push, providerSnapshot preservation)
- `.planning/REQUIREMENTS.md` §Security (SEC-03, SEC-04), §Admin Actions (ADMIN-01..05) — Phase 2 REQ-IDs
- `.planning/ROADMAP.md` §"Phase 2: Admin Moderation Endpoints (Backend)" — Goal + 5 acceptance criteria (pin the route shape)
- `.planning/STATE.md` §Blockers — Railway instance count, Atlas tier, audit-note visibility (Phase 5 concern)

### Research
- `.planning/research/SUMMARY.md` §"Phase 2: Backend Moderation Endpoints" — 3-paragraph brief on transaction + Stripe re-check
- `.planning/research/STACK.md` §"Backend additions" — `zod@^3.24`, `express-rate-limit@^8.3` version pins
- `.planning/research/PITFALLS.md` — Pitfalls #2 (suspend-mid-checkout race; phase 3 fix but suspend handler's audit row is the trigger), #8 (self-mod + last-admin), #9 (revoke-role directory consistency), #12 (audit note visibility — deferred to Phase 5), plus §"Looks Done But Isn't" checklist

### Phase 1 artifacts (locked, carry forward)
- `.planning/phases/01-schema-security-baseline-backend/01-CONTEXT.md` §Decisions — D-01..D-36 all apply; D-11 (moderationStatus shape), D-15 (ModerationAction shape), D-21..D-24 (providerSnapshot), D-25..D-28 (STATUS_POLICY + resolveRestrictedFeatures), D-10 (error shapes) are the load-bearing carry-forwards
- `.planning/phases/01-schema-security-baseline-backend/01-05-SUMMARY.md` — `verifyIdToken` + `requireAdmin` middleware chain + `/api/admin/moderation` mount point
- `.planning/phases/01-schema-security-baseline-backend/01-06-SUMMARY.md` — migration script + `ensureBaseline` warning hook

### Backend codebase (existing)
- `../backend-services/carEx-services/server.js` — Main app. Key ranges:
  - `145–160` — Broker schema (edit-profile whitelist source of truth for Broker fields)
  - `162–179` — LogisticsPartner schema (edit-profile whitelist source of truth for Logistics)
  - `192–247` — ServiceOrder schema incl. `providerSnapshot` (extended in Phase 1)
  - `915–919` — `app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter)` mount point
  - `922–1065` — Legacy `/api/admin/*` routes (stay as-is, NOT touched in Phase 2 per 01-CONTEXT.md D-06)
- `../backend-services/carEx-services/src/moderation/router.js` — Router extended in Phase 2; currently has `/ping` scaffold
- `../backend-services/carEx-services/src/moderation/service.js` — Stub signatures locked in Phase 1; Phase 2 fills bodies
- `../backend-services/carEx-services/src/moderation/actions.js` — `writeAction()` single audit-write path
- `../backend-services/carEx-services/src/moderation/capabilities.js` — `STATUS_POLICY` + `resolveRestrictedFeatures()`
- `../backend-services/carEx-services/src/models/User.js` — `moderationStatus` subdoc shape
- `../backend-services/carEx-services/src/models/ModerationAction.js` — Audit row shape + append-only guard
- `../backend-services/carEx-services/src/models/AdminUser.js` — `{ email, role: 'superadmin' | 'admin' }` — join target for last-admin guard
- `../backend-services/carEx-services/src/security/requireAdmin.js` — Contract: `req.admin = { uid, email, role }` — read by rate limiter + self-mod guard
- `../backend-services/carEx-services/package.json` — `firebase-admin@^13.8.0` already present; Phase 2 adds `zod@^3.24` + `express-rate-limit@^8.3`

### External docs
- `express-rate-limit` v8 options (keyGenerator, standardHeaders): https://www.npmjs.com/package/express-rate-limit
- Zod v3.24 `.strict()` object parsing: https://zod.dev/api/object#strict
- Mongoose `session.withTransaction()`: https://mongoosejs.com/docs/transactions.html#with-transactions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 1 middleware chain** (`src/security/verifyIdToken.js`, `requireAdmin.js`) — Phase 2 mounts onto this; don't re-implement.
- **`src/moderation/actions.writeAction(doc)`** — single write path into `ModerationAction`. All audit writes in Phase 2 go through this (not `ModerationAction.create(...)` directly).
- **`STATUS_POLICY` + `resolveRestrictedFeatures(state)`** — handler's `suspend` calls `resolveRestrictedFeatures(severity)` to populate `user.moderationStatus.restrictedFeatures`. No duplication.
- **Mongoose model registry** — `require('./models/User')` / `require('./models/ModerationAction')` / `require('./models/AdminUser')` returns the same registered instance regardless of call site (same rule as 01-CONTEXT.md D-03).

### Established Patterns (must honor)

- **`{ error, message }` error shape for new auth-adjacent responses** (01-CONTEXT.md D-10); `{ message }` shape reserved for legacy routes. Phase 2's 400s use `{ error, message?, ...fieldContext }` — e.g., `{ error: 'invalid_field', fields: [...] }`, `{ error: 'last_admin_protected' }`, `{ error: 'rate_limited', retryAfter }`.
- **Explicit collection names on models** — `ModerationAction` uses `'moderation_actions'`; don't let Mongoose pluralize implicitly.
- **Transactions via `session.withTransaction()`** — pattern not yet present in this codebase, Phase 2 establishes it. Any future transactional work should follow.

### Integration Points

- **Router mount** — `src/moderation/router.js` is already `app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter)`'d in `server.js:919`. Phase 2 only adds routes *inside* the router, not remounts.
- **Rate limiter placement** — applied to the moderation router (`moderationRouter.use(rateLimiter)`) before route definitions, so it runs after auth middleware but before any handler.
- **Self-mod middleware placement** — applied per-route (not at router level) because future non-mutating routes in the moderation namespace (e.g., history read in Phase 5) probably shouldn't have a self-mod guard.

### Anti-Pattern Warnings

- **Do NOT write to `Broker.status` / `LogisticsPartner.status` on revoke or suspend** (D-10). Those are the provider's operational flag. Moderation visibility is computed at read time from `User.moderationStatus.state` + `User.{role}Status` — Phase 3's concern.
- **Do NOT write to `Car.listingStatus` on suspend** (01-CONTEXT.md anti-pattern, Pitfall 6). Suspension hides listings via Phase 3's read-time filter, never by mutating listing state.
- **Do NOT clutter `ModerationAction` with rejected-self-mod attempts** (D-29). Audit ledger is for successful state changes. Rejected attempts go to stdout/logs.
- **Do NOT reuse the legacy `callerUid`-in-body pattern** — every Phase 2 route uses `req.admin.uid` from the verified idToken. Copy-pasting from `server.js:957` (approve/reject) is the failure mode to avoid.
- **Do NOT hard-delete `service_orders` on delete-provider-profile** (Pitfall 3). Orders stay; `providerSnapshot` is what buyers see.

</code_context>

<specifics>
## Specific Ideas

- ROADMAP Phase 2 success criterion #5 (cannot_moderate_self, last_admin_protected, 429) must show up as three distinct integration tests, not just type-level checks — `rateLimit.test.js` hits 31 times; `suspend.test.js` asserts `cannot_moderate_self` and `last_admin_protected`.
- The two-step transaction pattern (insert audit row → update User with `lastActionId: insertedId`) is the one non-obvious implementation detail. Document with a comment on the suspend handler so future readers don't "optimize" it into a single atomic `$set` and break the back-link.
- Zod `.strict()` behavior: the handler wraps `parsed.error.issues` into the 400 response so the mobile admin UI can surface "Unknown field: foo" specifically (Phase 5 will consume this shape). Don't strip issues to a generic "invalid_payload" message.

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to later phases or milestones — do not quietly re-introduce:**

- **`GET /api/admin/moderation/:targetUid/history`** (read audit log for Phase 5 UI-03) — **Phase 5** owns this, not Phase 2. ROADMAP Phase 2 success criteria don't mention it.
- **Super-admin vs admin note visibility on history read** (Pitfall 12) — Phase 5 concern; schema is agnostic. STATE.md blocker stays open but doesn't block Phase 2.
- **`requireNotSuspended` middleware on user-write routes** (ENF-01) — Phase 3.
- **`pre(/^find/)` Mongoose middleware hiding suspended/revoked users** (ENF-02) — Phase 3.
- **Payment-confirm TOCTOU re-check** (ENF-03, Pitfall 2) — Phase 3. Phase 2 suspend handler does NOT proactively cancel Stripe payment intents; that logic belongs in the confirm-booking transaction.
- **`rate-limit-redis` swap for multi-instance Railway** — Phase 2 uses memory store per D-30. If Railway scales horizontally in a future milestone, follow-up swap.
- **Bulk moderation** (MOD2-03) — anti-feature per PROJECT.md; v2 at earliest.
- **IP address + device fingerprint on audit rows** (MOD2-02) — v2. Current schema captures `adminUid` + `adminEmail` only.
- **Super-admin-only promotion/demotion** — out of scope; existing `AdminUser` flat role stays.
- **Hash-chain tamper-evidence on ModerationAction** (01-CONTEXT.md deferred) — still deferred.

</deferred>

---

*Phase: 02-admin-moderation-endpoints-backend*
*Context gathered: 2026-04-17*

# Project Research Summary

**Project:** CarEx — Admin Moderation Milestone
**Domain:** Post-approval user lifecycle management on a React Native + Node/Express + MongoDB marketplace
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

This milestone adds admin moderation controls to an existing, production-grade mobile car marketplace. The domain is well-charted: eBay, Turo, and Facebook Marketplace all converge on the same baseline — a severity-tiered suspension model, an append-only audit trail, per-user action history, and transparent in-app notification to the affected user. CarEx is targeting a single admin team of 1–5 operators acting on a few thousand users, which is the simplest viable scale and requires no queue infrastructure or automated flagging (those belong to a future milestone). The research confirms the PROJECT.md feature set is correctly scoped and the chosen design decisions (orders pause not cancel; preset reasons plus optional note; no shadow-ban; no auto-cancel; GDPR-safe provider profile deletion) are aligned with industry norms.

The two most consequential architectural choices are (1) introducing `firebase-admin verifyIdToken` on every new admin endpoint — the current `callerUid`-in-body pattern is trivially spoofable and must not be extended to destructive moderation routes — and (2) creating a new `ModerationService` module on mobile rather than piling more methods onto the already 378-line `AuthService` god-file. Both choices pay for themselves immediately and establish patterns the codebase needs for long-term health. The backend work (models, middleware, routes) must be designed and contracted before any mobile implementation begins; the two repos ship together but the backend drives the sequence.

The primary risks are authorization correctness, data-integrity during the suspend-mid-checkout race, and the temptation to take four documented shortcuts that each look cheap at implementation time but create irreversible production problems: mutating `listing.active` on suspend (breaks unsuspend symmetry), hard-deleting orders on provider-profile delete (destroys buyer history), embedding moderation state in an existing `user.status` enum (schema pollution), and skipping the append-only enforcement on the audit collection (legally untenable). All four are explicitly called out in PITFALLS.md with prevention patterns; the roadmap must address them at the schema and foundation phases, before any action endpoints are built.

---

## Key Findings

### Recommended Stack

The existing stack is fixed; this milestone adds three backend packages and zero mobile packages. `firebase-admin@^13.8.0` enables `verifyIdToken` — the only correct way to verify who is calling admin endpoints (Node 20+ required, already satisfied). `zod@^3.24` validates moderation endpoint payloads with strict enum constraints for severity and reason categories. `express-rate-limit@^8.3` guards against runaway admin scripts and credential-stuffing (30 moderation actions / 15 min / admin). On mobile, every required pattern — global banner, route guard, feature-gate overlay, status-driven conditional navigation — is achievable with existing AuthContext, AsyncStorage, React Navigation, and plain React components. Adding any state-management or notification library would expand scope without delivering value.

**Core technology additions:**

- `firebase-admin@^13.8.0` — server-side `verifyIdToken`; closes the `callerUid`-spoofing hole before any moderation route ships
- `zod@^3.24` — validates severity / reason / note enums on moderation request bodies; shareable schema types across controller and service
- `express-rate-limit@^8.3` — rate-limits admin moderation actions at the router level; last line of defence against a compromised admin session
- `services/http/client.ts` (new mobile module, no new npm package) — extracts shared axios instance and interceptors from AuthService; used by new ModerationService

**Explicitly excluded:** `mongoose-audit-trail` (abandoned 2020), `mongoose-diff-history` (wrong shape for semantic moderation events), Passport.js (unnecessary machinery), any toast / banner / flag library on mobile.

### Expected Features

The feature research categorises the full milestone scope against a three-tier MVP model. The `UserStatus` model and audit collection are the keystone: every other feature — banner, enforcement middleware, unsuspend, history view, search — depends on them existing first.

**Must have (table stakes, P1):**

- `UserStatus` subdocument on User (`active` / `feature_limited` / `blocked_with_review` / `permanently_banned`) + migration to backfill existing users
- `ModerationAction` collection: append-only rows with `adminUid`, `targetUid`, `action`, `severity`, `reasonCategory`, `note`, `createdAt`
- Four admin actions with confirm dialog: Suspend (with severity), Revoke role, Delete provider profile, Edit provider profile
- Unsuspend action (writes new audit row; never mutates originals)
- Per-user audit history view in admin UI
- Admin user list: search by email / UID, filter by role / status, pagination
- Server-side `verifyFirebaseToken` + `requireAdmin` on every moderation endpoint
- `requireNotSuspended` middleware on all user write endpoints (listings, orders, payments, contact-seller)
- Severity-aware in-app banner: reason category + admin note + appeal path for `blocked_with_review`; non-dismissable for `blocked` / `banned`; dismissable for `feature_limited`
- Read-only access to own past orders preserved for all suspension levels
- Orders pause (not auto-cancel) when provider is suspended
- Anonymized `providerSnapshot` on past orders when provider profile is deleted
- RU + EN i18n for all new strings

**Should have (P2 — ship if foundation is clean, else slip to polish follow-up):**

- Smart search: single input matches email / UID / phone
- Saved filters persisted in AsyncStorage
- Pinned admin note per user (separate from audit-row notes)
- CSV export of audit log
- Rate limit per admin UID on moderation actions
- Admin-to-admin handoff comments on a user

**Defer hard (P3 — next milestone or later):**

- Automated flagging pipeline and admin review queue
- Listing-level moderation (takedown one listing without touching the seller)
- In-app appeal ticket system
- Email / push notifications on moderation events
- Tiered admin permissions
- Full-user GDPR erasure self-service workflow

**Anti-features (explicitly do not build):** shadow ban, bulk auto-ban, free-text-only reason, auto-cancel / auto-refund on suspension, hard-delete of the User record.

### Architecture Approach

The system follows a server-authoritative status model: `user.moderationStatus` is the single source of truth, loaded once per request by a `loadUser` middleware and enforced by `requireNotSuspended` before any write handler executes. A separate `ModerationAction` collection (append-only, indexed by `targetUid + createdAt`) holds the full audit ledger; a `User.moderationStatus` subdocument caches current state for O(1) gating reads. On mobile, `AuthContext.refreshUser()` (already exists) is extended to merge `moderationStatus` from the user endpoint; a React Navigation auth-flow conditional stack handles `blocked` / `banned` routing; an axios 403 interceptor triggers `refreshUser()` for mid-session changes; `AppState` background-to-active transition also triggers `refreshUser()` — zero new infrastructure, zero polling.

**Major components:**

1. `moderation.routes / controller / service` (backend) — HTTP surface, payload validation, business rules (severity mapping, delete-preserves-orders, role-revoke semantics)
2. `audit.service` + `ModerationAction` model (backend) — append-only ledger, sole writer, `pre('save')` immutability guard
3. `verifyFirebaseToken` + `loadUser` + `requireNotSuspended` middlewares (backend) — declarative per-route gating replacing the `callerUid`-in-body pattern
4. Mongoose `pre(/^find/)` plugin on `Car` / `BrokerProfile` / `LogisticsProfile` (backend) — auto-filters blocked-seller records from public queries without touching handler code
5. `ModerationService.ts` + `http/client.ts` (mobile) — new module; never extends `AuthService`
6. `UserStatusBanner` + `FeatureGateOverlay` + `useFeatureGate` hook (mobile) — affected-user UI primitives consumed by `App.tsx` and individual screens
7. `AdminManagementScreen` (extended) + `AdminModerationScreen` (new) — admin UI surfaces

The capability map (`STATUS_POLICY` table in `moderation/policy.ts`) centralises which status level gates which feature. Every route and every mobile screen reads from this table — one edit, applied everywhere.

### Critical Pitfalls

1. **`callerUid`-in-body spoofing** — Any new moderation route that follows the existing admin pattern is trivially exploitable. Install `firebase-admin`, create `verifyFirebaseToken` middleware, and require it on every new route before writing a single action handler. Phase 0 work, not a follow-up.

2. **Suspend-mid-checkout race condition** — Buyer's `confirm-booking` can succeed against a seller suspended between `create-payment-intent` and confirmation. Re-read all provider statuses inside a Mongoose transaction at `confirm-booking` time; cancel the PaymentIntent and surface `provider_suspended` to mobile if any provider is not `active`.

3. **Cascading delete destroying order history** — `deleteProviderProfile` must only hard-delete the `Broker` / `LogisticsProfile` document. Past orders must be preserved with a frozen `providerSnapshot`. If `providerSnapshot` is not already on the Order schema, add it in Phase 0 — it is a prerequisite for the delete action.

4. **Audit log mutability** — Standard Mongoose collections allow `updateOne` / `deleteOne`. Enforce append-only at the model layer (`pre('save')` rejects non-new documents; no update/delete methods exported from `audit.service`). Without this, the audit trail has no legal weight.

5. **Unsuspend leaving listings hidden** — Never write `listing.active = false` on suspend. Filter at read time via the `pre(/^find/)` middleware instead. Unsuspend then only needs to flip `moderationStatus.state` back to `active`; listings become visible automatically with their original user-controlled state preserved.

---

## Implications for Roadmap

Based on combined research, the milestone maps to seven phases with a strict backend-first dependency chain.

### Phase 0: Security Baseline + Schema / Contract Design

**Rationale:** The `callerUid` auth hole must be closed before any moderation endpoint is written. The `providerSnapshot` field on Orders and the `moderationStatus` subdocument on User must exist before any action is implemented — schema-first prevents retrofits that would break the data-preservation contracts.

**Delivers:** `firebase-admin` installed and wired; `verifyFirebaseToken` + `requireAdmin` middlewares scaffolded; `UserStatus` subdocument added to User schema; `ModerationAction` schema defined (with append-only pre-save guard); `providerSnapshot` added to Order schema; OpenAPI contract document for all moderation endpoints; migration scripts to backfill `moderationStatus: { state: 'active' }` on existing users and `providerSnapshot` on existing orders.

**Addresses:** Pitfalls 1 (auth hole), 3 (cascading delete prerequisite), 10 (status field pollution).

### Phase 1: Backend Data Model + Audit Foundation

**Rationale:** Audit collection, capability map, and enforcement middleware are the load-bearing foundation. Every subsequent phase writes audit rows and every enforcement decision reads the capability map. Zero retrofit cost if built here.

**Delivers:** `audit.service.ts` (append + listByTarget only, no update/delete exports); `STATUS_POLICY` capability map in `moderation/policy.ts`; `loadUser` middleware; `requireNotSuspended` middleware; compound index `{ 'moderationStatus.state': 1, roles: 1 }` on User; indexes on ModerationAction; unit tests asserting append-only behaviour.

**Addresses:** Pitfalls 4 (audit tampering), 5 (middleware side of status propagation), 11 (gating sprawl via capability map).

### Phase 2: Backend Moderation Endpoints

**Rationale:** With the foundation in place, action endpoints are business logic wrapped in a transaction. The Stripe re-check lives here because it is tied to the suspend action semantics.

**Delivers:** `POST /api/admin/moderation/:targetUid` (suspend, revoke_role, edit_provider_profile); `GET /api/admin/moderation/:targetUid/history`; `PATCH /api/admin/moderation/:targetUid/unsuspend`; `DELETE /api/admin/moderation/:targetUid/provider-profile`; each action in `session.withTransaction()` writing User + ModerationAction atomically; `confirm-booking` re-reads all provider statuses inside its transaction; self-moderation guard; last-admin guard.

**Addresses:** Pitfalls 2 (checkout race), 6 (unsuspend symmetry via read-time filter), 8 (self-suspend / last-admin), 9 (role-revoke directory via `profile.listed = false`), 12 (audit note permission split on history endpoint).

### Phase 3: Backend Enforcement Middleware

**Rationale:** Enforcement must land before mobile UI exposes actions to real users. A suspension that only changes UI is not a suspension.

**Delivers:** `requireNotSuspended` applied to `POST /api/cars`, `POST /api/orders`, `POST /api/payments/create-payment-intent`, `PUT /api/brokers/:uid`, `PUT /api/logistics/:uid`, contact-seller endpoint; Mongoose `pre(/^find/)` plugin on `Car`, `BrokerProfile`, `LogisticsProfile`; integration tests: suspend user → POST returns 403, listings vanish, unsuspend → listings visible again.

**Addresses:** Pitfall 5 (backend enforcement side), Pitfall 11 (backend capability enforcement, not mobile-only).

### Phase 4: Mobile Plumbing (ModerationService + AuthContext + Interceptors)

**Rationale:** Mobile cannot build admin or user-facing UI without the shared HTTP client and status-aware AuthContext. This phase establishes the mobile architectural baseline.

**Delivers:** `src/services/http/client.ts` (shared axios instance; Bearer token from `AuthService.getToken()`; 403 `account_suspended` → `refreshUser()` + route-to-banner); `src/services/moderation/ModerationService.ts` using the shared client (NOT added to `AuthService`); `AuthContext` extended with `ModerationStatus` type; `AppState` background-to-active handler calls `refreshUser()`; `useFeatureGate(feature)` hook reading from `STATUS_POLICY`; React Navigation conditional stack for `blocked_with_review` / `permanently_banned`.

**Addresses:** Pitfalls 5 and 7 (mobile cache + reactive handling), Pitfall 11 (useFeatureGate centralises mobile gating). Establishes anti-god-module precedent.

### Phase 5: Admin UI

**Rationale:** Admin UI is the first phase with real end-to-end flow. Backend endpoints are stable; mobile plumbing is validated; admin screens can be built and tested against real data.

**Delivers:** `ModerationActionRow` component added to `AdminManagementScreen` rows; `SeverityPickerModal` + `ReasonPicker` (preset categories + optional note); `AdminModerationScreen` (search by email / UID, filter by status / role, per-user history tab, unsuspend action); route added to `RootStackParamList`; optimistic row updates + toast after each action; all new admin strings in `translations.ts` RU + EN.

**Addresses:** UX pitfalls (status pill on every row, confirm dialog for destructive actions, disabled self-row, visible audit history, role-revoke feedback).

### Phase 6: Affected-User UI + Polish + Load Test + Security Review

**Rationale:** Affected-user UI requires a live suspended test account to validate all severity branches. Load testing and security review require the full system assembled. This phase ships the feature.

**Delivers:** `UserStatusBanner` component (non-dismissable for `blocked` / `banned`; dismissable-but-persistent for `feature_limited`; reason + appeal path shown); `FeatureGateOverlay` on `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen`, contact-seller CTA; all RU + EN severity × reason-category translation key combinations; appeal CTA throttle (10-minute AsyncStorage cooldown); load test with 10k seeded users confirming admin search < 200ms; `explain()` confirms indexes used; pen test confirming `callerUid`-only curl returns 403; "Looks Done But Isn't" checklist from PITFALLS.md signed off.

**Addresses:** Pitfalls 7 (banner visible on cold-start deep-link), 14 (search performance), 15 (appeal email flood throttle).

### Phase Ordering Rationale

- Schema before actions, actions before enforcement, enforcement before UI — every layer depends on the one below it; reversing creates retrofits that break append-only and data-preservation contracts.
- Backend-first within each backend/mobile pairing — mobile cannot test against an imaginary API; contracts must be stable.
- Audit foundation before first action endpoint — every action writes audit rows from day one; retrofitting audit creates history gaps in a compliance feature.
- Capability map before mobile gating — the map is central policy; defining it at Phase 1 prevents the 50-screen gating sprawl pitfall.
- Admin UI before affected-user UI — admin actions must work end-to-end to produce the suspended test accounts needed to validate all banner severity branches.

### Research Flags

Phases that may benefit from targeted research during planning:

- **Phase 0 (Firebase Admin SDK initialization on Railway):** Verify the exact Railway environment variable pattern (`FIREBASE_SERVICE_ACCOUNT` stringified JSON vs. `GOOGLE_APPLICATION_CREDENTIALS` path). Confirm whether the backend is JS or TypeScript before writing contract files.
- **Phase 2 (Stripe PaymentIntent cancellation inside a Mongoose transaction):** Confirm the exact Stripe SDK call sequence for cancelling a `requires_capture` intent when a Mongoose transaction rolls back. Verify against the Stripe SDK version in `carEx-services`.
- **Phase 3 (Mongoose pre-find middleware on existing Car schema):** Inspect existing `Car.find` call chain and aggregation pipelines to confirm the middleware fires without conflict.

Phases with well-documented patterns (skip research):

- **Phase 1 (Audit collection + append-only):** Standard Mongoose `pre('save')` pattern; fully documented.
- **Phase 4 (React Navigation conditional stack):** Auth-flow pattern from official React Navigation docs maps directly.
- **Phase 5 (Admin UI components):** Entirely internal; existing component patterns apply.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package choices verified against official docs and npm; version compatibility confirmed |
| Features | HIGH | Domain is well-established; feature tiers verified against eBay / Turo / Facebook Marketplace comparables; P1/P2/P3 split calibrated to team scale of 1–5 admins |
| Architecture | HIGH | Grounded in existing codebase inspection (AuthService.ts 378 lines confirmed, AuthContext.tsx plumbing confirmed); all patterns sourced from official docs |
| Pitfalls | HIGH | Authorization and data-integrity items verified with Firebase docs, MongoDB auditing docs, GDPR Art. 17; mobile UX propagation items are MEDIUM (derived from stack constraints, not load-tested against this app) |

**Overall confidence:** HIGH

### Gaps to Address

- **Backend language (JS vs. TS):** Unconfirmed. If plain JS, Zod is used without type inference and schema-sharing approach changes. Confirm at the start of Phase 0.
- **Existing `providerSnapshot` on Order schema:** May not exist on historical orders. Inspect the current Order schema in `carEx-services` before writing the Phase 0 migration to determine backfill scope.
- **Stripe PaymentIntent state at `confirm-booking`:** The exact state (`requires_capture` vs. already captured) determines whether a cancel or refund is issued. Verify during Phase 2.
- **Atlas cluster tier:** `express-rate-limit` memory store is correct for a single Railway instance; must swap to `rate-limit-redis` if horizontally scaled. Confirm current instance count at Phase 0.
- **Audit note visibility model:** PITFALLS.md recommends a two-tier read (note visible to author + super-admins only) but current admin model has no `superAdmin` flag. A Key Decision is needed at Phase 0 on whether to add one or treat all admins as equal for this milestone.

---

## Sources

### Primary (HIGH confidence)

- Firebase Admin `verifyIdToken` — `https://firebase.google.com/docs/auth/admin/verify-id-tokens`
- React Navigation auth-flow pattern — `https://reactnavigation.org/docs/auth-flow/`
- Mongoose middleware docs — `https://mongoosejs.com/docs/middleware.html`
- GDPR Art. 17 — `https://gdpr-info.eu/art-17-gdpr/`
- `firebase-admin` npm v13.8.0 — `https://www.npmjs.com/package/firebase-admin`
- `express-rate-limit` npm v8.3.2 — `https://www.npmjs.com/package/express-rate-limit`
- `.planning/PROJECT.md` — milestone requirements, decisions, constraints
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `INTEGRATIONS.md` — existing codebase ground truth
- `src/services/AuthService.ts` (lines 1–378) — confirms god-module scope and `callerUid`-in-body pattern
- `src/context/AuthContext.tsx` — confirms `refreshUser`, `isAdmin`, `adminRole` plumbing

### Secondary (MEDIUM confidence)

- Zod v3.24 validation guide (2026) — `https://1xapi.com/blog/validate-api-requests-zod-nodejs-2026`
- Firebase auth token middleware pattern (OneUptime, Feb 2026) — `https://oneuptime.com/blog/post/2026-02-17-firebase-auth-token-verification-express-middleware-cloud-run/view`
- Soft-delete Mongoose pattern (OneUptime, Mar 2026) — `https://oneuptime.com/blog/post/2026-03-31-mongodb-soft-delete-mongoose/view`
- MongoDB auditing for compliance (OneUptime, Mar 2026) — `https://oneuptime.com/blog/post/2026-03-31-mongodb-auditing-compliance/view`
- Express 4 vs 5 benchmark — `https://www.repoflow.io/blog/express-4-vs-express-5-benchmark-node-18-24`
- Marketplace moderation comparables — GetStream, Lasso, Markko, CometChat guides
- Shadow-ban legal analysis (DSA transparency) — `https://www.sciencedirect.com/science/article/pii/S0267364923000018`
- Race condition pattern — `https://sidshome.wordpress.com/2026/02/16/the-aws-marketplace-race-condition-nobody-warns-you-about/`
- Compliance audit log design — `https://mattermost.com/blog/compliance-by-design-18-tips-to-implement-tamper-proof-audit-logs/`
- Capability-map pattern — Unleash, DevCycle, Nicole Tietz-Sokolskaya

### Tertiary (rejection rationale)

- `mongoose-audit-trail` npm — rejected; abandoned 2020, 256 weekly downloads
- `mongoose-diff-history` GitHub — rejected; wrong shape for semantic moderation events
- Passport.js — rejected; unnecessary session machinery for a single Firebase auth strategy

---

*Research completed: 2026-04-17*
*Ready for roadmap: yes*

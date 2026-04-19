# Roadmap: CarEx — Admin Moderation Milestone

## Overview

Six phases deliver admin moderation over approved users on an existing React Native + Node/Express + MongoDB marketplace. The sequence is strictly **backend-first**: schema + auth baseline lands before any moderation endpoint; endpoints land before enforcement; enforcement lands before mobile; mobile plumbing lands before admin UI; admin UI lands before affected-user UI. This order is forced by hard dependencies (Firebase idToken verification must precede destructive endpoints; the capability map must precede both backend enforcement and mobile feature-gating; `Order.providerSnapshot` must precede provider-profile delete; ModerationService must precede admin screens; backend 403 responses must exist before the mobile 403 interceptor has anything to catch). The backend repo (`backend-services/carEx-services`) is modified in phases 1–3; the mobile repo (`carEx`) is modified in phases 4–6. Phase 6 is the merge gate — it includes the 10k-user load test and the security review that must pass before anything ships to `main`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Schema + Security Baseline (Backend)** - Install firebase-admin, add moderation schemas, backfill existing data (completed 2026-04-17)
- [ ] **Phase 2: Admin Moderation Endpoints (Backend)** - POST/GET/PATCH/DELETE moderation routes with transactions, audit writes, rate limiting
- [ ] **Phase 3: Backend Enforcement (Backend)** - requireNotSuspended on write endpoints, pre-find hiding, payment-confirm re-check
- [x] **Phase 4: Mobile Plumbing (Mobile)** - Shared http client, ModerationService, 403 interceptor, AppState refresh (completed 2026-04-18)
- [ ] **Phase 5: Admin Moderation UI (Mobile)** - Quick actions on AdminManagementScreen + new AdminModerationScreen with search and history (includes 2 backend read routes locked by D-16)
- [ ] **Phase 6: Affected-User UX + Security Review (Both)** - Banner, FeatureGateOverlay, appeal CTA, translations audit, load test, security review

## Phase Details

### Phase 1: Schema + Security Baseline (Backend)
**Goal**: Backend can verify admin callers cryptographically and has the data shape required to store moderation state, audit entries, and deletion-safe order snapshots
**Depends on**: Nothing (first phase)
**Scope**: Backend only (`backend-services/carEx-services`)
**Requirements**: SEC-01, SEC-02, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. `curl -X POST /api/admin/moderation/ping` (or any admin route protected by the new middleware) with no `Authorization: Bearer` header returns `401`; with a valid admin idToken returns the route's success response
  2. `db.users.findOne(...)` on any existing user shows a `moderationStatus` subdoc with `state: 'active'` (migration backfilled successfully)
  3. `db.orders.findOne(...)` on any existing order shows a populated `providerSnapshot` field (migration backfilled successfully)
  4. Attempting `ModerationAction.updateOne(...)` or `ModerationAction.deleteOne(...)` in a unit test throws "ModerationAction is append-only"
  5. `import { STATUS_POLICY } from 'moderation/capabilities'` resolves to the capability map and every severity state has an entry with the full capability set
**Plans**: 6 plans
  - [x] 01-01-PLAN.md — Backend modularization skeleton: extract User/AdminUser models, create append-only ModerationAction, install Jest+supertest+mongodb-memory-server (DATA-02)
  - [x] 01-02-PLAN.md — Add User.moderationStatus subdoc + indexes + defaults (DATA-01)
  - [x] 01-03-PLAN.md — Extend ServiceOrder.providerSnapshot with email/firstName/lastName/providerRole/snapshotAt + populate at order creation (DATA-03)
  - [x] 01-04-PLAN.md — Capability map src/moderation/capabilities.js with STATUS_POLICY + resolveRestrictedFeatures helper (DATA-04)
  - [x] 01-05-PLAN.md — firebase-admin init + verifyIdToken + requireAdmin middlewares + GET /api/admin/moderation/ping (SEC-01, SEC-02)
  - [x] 01-06-PLAN.md — scripts/migrate-moderation.js backfill + ensureBaseline startup check (DATA-01, DATA-03)

### Phase 2: Admin Moderation Endpoints (Backend)
**Goal**: Admins can suspend, unsuspend, revoke role, delete provider profile, and edit provider profile via rate-limited HTTP endpoints, each writing an audit row atomically
**Depends on**: Phase 1
**Scope**: Backend only (`backend-services/carEx-services`)
**Requirements**: SEC-03, SEC-04, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. `POST /api/admin/moderation/:targetUid { action: 'suspend', severity, reasonCategory, note }` updates `user.moderationStatus` and appends a `ModerationAction` row inside a single Mongoose transaction; `PATCH /api/admin/moderation/:targetUid/unsuspend` returns user to `active` and appends a new audit row (originals never mutated)
  2. `POST /api/admin/moderation/:targetUid { action: 'revoke_role', role }` strips the role from the user while the corresponding provider profile document remains in the database (preserved for historical lookups but not surfaced in provider-facing queries)
  3. `DELETE /api/admin/moderation/:targetUid/provider-profile` hard-deletes the broker/logistics profile document; a pre-existing order owned by that provider still resolves to the provider's name via `order.providerSnapshot` (no 500s, no dangling joins)
  4. `POST /api/admin/moderation/:targetUid/edit-profile` applies provided field changes and writes an audit row with action `edit_profile` containing the `fieldDiff`; unchanged fields are untouched
  5. An admin calling any moderation endpoint against their own UID returns `400 cannot_moderate_self`; suspending/revoking the last active admin returns `400 last_admin_protected`; issuing more than 30 moderation actions in 15 minutes from one admin returns `429`
**Plans**: TBD

### Phase 3: Backend Enforcement (Backend)
**Goal**: Non-active users are blocked from all write endpoints server-side, their listings disappear from public queries without any denormalized flag mutation, and payment confirmation re-verifies provider status inside its transaction
**Depends on**: Phase 2
**Scope**: Backend only (`backend-services/carEx-services`)
**Requirements**: ENF-01, ENF-02, ENF-03, ENF-04
**Success Criteria** (what must be TRUE):
  1. After suspending user X with a `blocked_with_review` severity, every subsequent request from X to `POST /api/cars`, `POST /api/orders`, `POST /api/payments/create-payment-intent`, `PUT /api/brokers/:uid`, `PUT /api/logistics/:uid`, or contact-seller returns `403 { error: 'account_suspended', status, reasonCategory, note }`
  2. After suspending user X, `GET /api/cars` (public browse) no longer returns cars owned by X; after unsuspending X, `GET /api/cars` returns X's cars again immediately with no data migration or backfill — and X's cars still have whatever `active` flag X originally set
  3. A concurrent test where admin suspends seller Y during the window between `create-payment-intent` and `confirm-booking` causes `confirm-booking` to return `provider_suspended`, the PaymentIntent is cancelled/refunded, and no order is created
  4. A feature-limited user whose capability map blocks `create_listing` receives `403 { error: 'account_suspended' }` on `POST /api/cars` but receives `200` on read endpoints they are permitted to call
**Plans**: 6 plans
  - [x] 03-01-PLAN.md — Extract Car/Broker/LogisticsPartner models to src/models/ with co-located pre(/^find/) hide hooks (ENF-02)
  - [x] 03-02-PLAN.md — Create attachAuthIfPresent + requireNotSuspended factory middleware (ENF-01, ENF-04)
  - [x] 03-03-PLAN.md — Wire middleware on 5 ROADMAP-named routes + replace inline schemas with requires in server.js (ENF-01, ENF-02, ENF-04)
  - [x] 03-04-PLAN.md — Rewrite confirm-booking as transactional service with refund-first-throw-second + providerSnapshot absorption (ENF-03)
  - [x] 03-05-PLAN.md — Replace POST /api/orders handler body with 410 Gone (ENF-03)
  - [x] 03-06-PLAN.md — Enforcement test suite under __tests__/enforcement/ mapping to ROADMAP Success Criteria #1-4 (ENF-01..04 verification)

### Phase 4: Mobile Plumbing (Mobile)
**Goal**: Mobile has a separate ModerationService (not glued onto AuthService), a shared axios instance with idToken and 403 interceptors, and a refresh-on-foreground handler so suspensions propagate without an app restart
**Depends on**: Phase 3
**Scope**: Mobile only (`carEx`)
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04
**Success Criteria** (what must be TRUE):
  1. `src/services/moderation/ModerationService.ts` exists as a new module and owns every moderation HTTP call; `src/services/AuthService.ts` has no methods added to it during this milestone (grep confirms)
  2. `src/services/http/client.ts` exports a shared axios instance used by both `AuthService` and `ModerationService`; both a request interceptor (attaches `Authorization: Bearer <idToken>`) and a response interceptor (catches `403 account_suspended`) are wired to that single instance
  3. When the backend returns `403 account_suspended` to any API call, the client interceptor calls `AuthContext.refreshUser()` and the updated `user.moderationStatus` appears in React DevTools without a user-visible navigation loop
  4. Suspending a logged-in user, backgrounding the app, and returning to foreground causes `AuthContext.refreshUser()` to fire via the `AppState` handler in `App.tsx` and `user.moderationStatus.state` transitions to the new value without an app restart
**Plans**: 7 plans
  - [x] 04-01-PLAN.md — Shared axios client + ModerationError typed error (MOB-02, MOB-03)
  - [x] 04-02-PLAN.md — ModerationService module wrapping 7 admin moderation endpoints (MOB-01)
  - [x] 04-03-PLAN.md — useAppStateRefresh hook (MOB-04)
  - [x] 04-04-PLAN.md — AuthContext enrichment: dedupe + cooldown + listener registration + skip flag (MOB-03, MOB-04)
  - [x] 04-05-PLAN.md — Migrate AuthService backend calls to shared apiClient; Identity Toolkit stays on axios (MOB-02, MOB-01)
  - [x] 04-06-PLAN.md — Mount AppStateRefreshEffect inside AuthProvider in App.tsx (MOB-04)
  - [x] 04-07-PLAN.md — End-to-end integration tests mapped to 4 ROADMAP success criteria (MOB-01..04 verification)

### Phase 5: Admin Moderation UI (Mobile)
**Goal**: Admins can moderate users from the mobile app with per-row quick actions on the existing screen and deep search / history / unsuspend on a new dedicated screen; ship the two backend read endpoints (`GET /api/admin/moderation/:targetUid/history` + `GET /api/admin/users/search`) locked by CONTEXT.md D-16 that power the detail + search UIs
**Depends on**: Phase 4
**Scope**: Mobile only (`carEx`) — PLUS two cross-repo backend plans (`backend-services/carEx-services`) for the new read routes per D-16
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. On `AdminManagementScreen`, every approved user row has a quick-action menu (Suspend / Unsuspend / Revoke role / Delete profile / Edit profile); tapping an action opens a modal with severity picker (for suspend), preset reason picker (Spam / Policy violation / Fraud / Other), and optional note; confirm fires the corresponding `ModerationService` call and the row updates optimistically. A user with BOTH approved provider profiles (broker + logistics) sees TWO distinct delete rows ("Delete broker profile" / "Delete logistics profile"), each routing the explicit role verbatim through to `ModerationService.deleteProviderProfile` — no silent default
  2. `AdminModerationScreen` is reachable from navigation and supports searching users by email substring or Firebase UID prefix, filtering by role and moderation state, and paginated results, backed by `GET /api/admin/users/search`
  3. Opening a user from `AdminModerationScreen` shows a detail panel with full moderation history (every `ModerationAction` row for that user, most recent first) displaying action type, severity, admin who acted, timestamp, reason category, and note, backed by `GET /api/admin/moderation/:targetUid/history`
  4. The moderation history view has an Unsuspend button that, when tapped on a suspended user, calls `ModerationService.unsuspend`, appends a new audit entry to history (the prior rows are unchanged), and the user's current state transitions to `active`
**Plans**: 13 plans
  - [ ] 05-0a-PLAN.md — Backend `GET /api/admin/moderation/:targetUid/history` route + jest+supertest coverage (cross-repo) (UI-03, UI-04)
  - [ ] 05-0b-PLAN.md — Backend `GET /api/admin/users/search` route with ReDoS-escape + allowlisted filters + cursor pagination + jest+supertest coverage (cross-repo) (UI-02)
  - [x] 05-01-PLAN.md — Wave 0 test scaffolds for service+hook+util+component+screen layers (includes 3 dual-role delete test.todo entries; useDebouncedValue scaffold uses react-test-renderer)
  - [x] 05-02-PLAN.md — Theme tokens (COLORS.moderation, role, TYPOGRAPHY) + ~72 RU/EN translation keys (adds `deleteBrokerProfile` + `deleteLogisticsProfile` for dual-role delete rows)
  - [x] 05-03-PLAN.md — ModerationService.searchUsers + getHistory real impl + typed response envelopes
  - [x] 05-04-PLAN.md — useDebouncedValue hook + formatYmdHm util + moderationErrorKeyMap util + nav route types
  - [x] 05-05-PLAN.md — SeverityBadge + EmptyState shared primitives
  - [x] 05-06-PLAN.md — QuickActionSheet (role-explicit delete — TWO rows for dual-role users) + ModerationActionModal + TypedConfirmationModal interactive components
  - [x] 05-07-PLAN.md — AdminModerationScreen (NEW) — search, filter, infinite scroll, action plumbing, `pendingDeleteRole` pass-through
  - [x] 05-08-PLAN.md — AdminUserDetailScreen (NEW) — sticky summary, paginated history, unsuspend flow
  - [x] 05-09-PLAN.md — Repurpose AdminManagementScreen (with `pendingDeleteRole` pass-through) + AdminDashboardScreen nav card + App.tsx wiring + fill Wave 0 service+hook+util tests + populate 05-VALIDATION.md + final guardrails
  - [x] 05-10-PLAN.md — Fill Wave 0 component+screen test scaffolds (8 files) with real assertions locking the dual-role delete contract end-to-end
  - [x] 05-11-PLAN.md — Gap closure: submit-driven search on AdminModerationScreen + axios CanceledError suppression in ModerationService + delete dead useDebouncedValue (UAT Test 3 fix) (UI-02)
  - [x] 05-12-PLAN.md — Gap closure: Firebase idToken refresh (securetoken.googleapis.com + single-flight 401 interceptor + proactive 5-min-pre-expiry check) (UAT Test 8 fix) (SEC-01, MOB-02, MOB-03)
**UI hint**: yes

### Phase 6: Affected-User UX + Security Review (Both)
**Goal**: Moderated users see a severity-aware in-app banner with reason and appeal path, restricted screens render a FeatureGateOverlay, all new strings are translated RU+EN, the admin search endpoints pass a 10k-user load test, and the security review signs off before merge
**Depends on**: Phase 5
**Scope**: Primarily mobile (`carEx`); backend for load test / security review; cross-cutting translation audit
**Requirements**: AFF-01, AFF-02, AFF-03, AFF-04, QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. When `user.moderationStatus.state !== 'active'`, a non-dismissable `UserStatusBanner` renders above the navigator on every screen; the banner copy changes by severity (resolvable instructions for `feature_limited`, appeal message for `blocked_with_review`, permanent-ban message for `permanently_banned`) and displays the admin-selected preset reason category plus the optional note verbatim
  2. For `blocked_with_review` severity, the banner's "Contact support" CTA opens a `mailto:support@carexmarket.com` prefilled with the user's UID and reason category; for `permanently_banned` no appeal CTA is rendered
  3. For `feature_limited` severity, screens blocked by the capability map (e.g., `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen`, contact-seller CTA on `CarDetailsScreen`) render `FeatureGateOverlay` explaining what to do to resolve, while buyer screens remain fully usable when only a provider role is gated
  4. Every new user-facing string introduced across phases 5 and 6 (admin labels, banner copy, overlay copy, reason categories, severity messages) has both RU and EN keys in `src/constants/translations.ts`; grep finds no untranslated literal strings in new moderation components
  5. Backend load test with 10,000 seeded users shows admin search + moderation history endpoints respond < 200ms P95 with `explain()` confirming index use on `moderationStatus.state`, `ModerationAction.targetUid+createdAt`, and `ModerationAction.adminUid+createdAt`
  6. Security review sign-off confirms (a) `verifyIdToken` runs on every admin route, (b) no `callerUid` body param is trusted for authorization on any new route, (c) suspend and confirm-booking mutations are transactional, (d) the `ModerationAction` collection rejects updates and deletes at the application layer, (e) no new hardcoded secrets were introduced
**Plans**: 11 plans
  - [x] 06-01-PLAN.md — Wave 0 test scaffolds (banner/overlay/wrapper + translation-parity) (AFF-01..04, QUAL-01)
  - [ ] 06-02-PLAN.md — Add 32 RU + 32 EN translation keys per UI-SPEC Copywriting (QUAL-01)
  - [ ] 06-03-PLAN.md — UserStatusBanner component + real assertions (mailto encode + severity icons) (AFF-01, AFF-02, AFF-03)
  - [ ] 06-04-PLAN.md — FeatureGateOverlay component + capability-key-driven copy lookup tests (AFF-04)
  - [ ] 06-05-PLAN.md — GatedScreenWrapper with CAPABILITY_ALIASES + all_writes sentinel (AFF-04)
  - [ ] 06-06-PLAN.md — Wrap SellCarScreen + ServiceCartScreen + ServiceApplicationScreen (AFF-04)
  - [ ] 06-07-PLAN.md — CarDetailsScreen inline contact_seller gate on TWO CTAs + fade Modal (AFF-04)
  - [ ] 06-08-PLAN.md — Mount UserStatusBanner in App.tsx + Android LayoutAnimation enable (AFF-01)
  - [ ] 06-09-PLAN.md — Jest literal scanner for new moderation components (QUAL-01)
  - [ ] 06-0a-PLAN.md — Backend seed 10k users + verify-indexes.sh (cross-repo) (QUAL-02)
  - [ ] 06-0b-PLAN.md — Backend k6 harness with P95<200ms threshold + .gitignore (cross-repo) (QUAL-02)
  - [ ] 06-10-PLAN.md — Security review artifact 06-SECURITY.md (5 sections a-e) (QUAL-03)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema + Security Baseline (Backend) | 6/6 | Complete   | 2026-04-17 |
| 2. Admin Moderation Endpoints (Backend) | 0/TBD | Not started | - |
| 3. Backend Enforcement (Backend) | 0/6 | Not started | - |
| 4. Mobile Plumbing (Mobile) | 7/7 | Complete | 2026-04-18 |
| 5. Admin Moderation UI (Mobile) | 12/14 | In progress (mobile scope 12/12; backend 05-0a/0b deferred to cross-repo) | - |
| 6. Affected-User UX + Security Review (Both) | 1/12 | In progress | - |

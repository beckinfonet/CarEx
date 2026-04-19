# Requirements: CarEx — Admin Moderation Milestone

**Defined:** 2026-04-17
**Core Value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Security

- [ ] **SEC-01**: Backend verifies the caller's Firebase ID token via `firebase-admin.auth().verifyIdToken()` on every admin route (replaces the spoofable `callerUid`-in-body pattern)
- [ ] **SEC-02**: Every admin moderation endpoint enforces admin-only access server-side; mobile `isAdmin` is never trusted for authorization
- [x] **SEC-03**: Backend rejects admin attempts to suspend, revoke, or delete their own account or the last remaining admin (guard in both UI and backend; backend is authoritative)
- [x] **SEC-04**: Admin moderation endpoints are rate-limited via `express-rate-limit` (30 actions per 15 minutes per admin) to defend against compromised-admin scripting

### Data Model

- [ ] **DATA-01**: `User` schema has a `moderationStatus` subdocument with fields `state` (`active` | `feature_limited` | `blocked_with_review` | `permanently_banned`), `reasonCategory`, optional `note`, `setByAdminUid`, `setAt`, `restrictedFeatures[]`
- [ ] **DATA-02**: New `ModerationAction` collection is append-only (no update, no delete) and indexed by `{ targetUid: 1, createdAt: -1 }` and `{ adminUid: 1, createdAt: -1 }`; each entry carries action, severity, reasonCategory, optional note, admin UID, target UID, timestamp
- [ ] **DATA-03**: `Order` schema has a `providerSnapshot` field that denormalizes provider identity at order time; allows provider profile hard-delete without breaking buyer order history. Migration backfills existing orders
- [ ] **DATA-04**: A central **capability map** (`backend-services/carEx-services/src/moderation/capabilities.ts`) maps each severity state to a set of blocked capabilities (e.g., `create_listing`, `create_order`, `contact_seller`, `withdraw_funds`); admin picks from this map when choosing "feature-limited" severity

### Admin Actions

- [x] **ADMIN-01**: Admin can **suspend** any user with one of three severities (feature-limited / blocked-with-review / permanently-banned), a preset reason category (Spam / Policy violation / Fraud / Other), and an optional free-text note. Status mutation + audit write occur in a single Mongoose transaction
- [x] **ADMIN-02**: Admin can **unsuspend** any suspended user, returning them to `active`. Listings re-surface automatically via read-time filter (no mutation on suspend — prevents unsuspend-leaves-hidden bug)
- [x] **ADMIN-03**: Admin can **revoke** a provider role (broker / seller / logistics). User is downgraded to regular user; provider profile record is preserved for history but no longer surfaces in provider-facing queries
- [x] **ADMIN-04**: Admin can **delete** a broker or logistics provider profile. Provider profile record is hard-deleted; past orders remain intact via `Order.providerSnapshot`; the `User` record's provider link is nulled
- [x] **ADMIN-05**: Admin can **edit** provider profile fields (company name, phone, Telegram, contact email) on behalf of the provider. Edit writes an audit entry with `action: 'edit_profile'` and a diff of changed fields

### Backend Enforcement

- [x] **ENF-01**: A `requireNotSuspended` Express middleware gates all user-mutation endpoints (create listing, create/confirm order, message seller, request role, update profile) and returns `403 { error: 'account_suspended', status, reasonCategory, note }` for non-active users
- [x] **ENF-02**: Mongoose `pre(/^find/)` middleware auto-hides documents owned by suspended users from public queries (listings, broker lists, logistics lists); admin queries opt in via `.setOptions({ includeAllUsers: true })`
- [x] **ENF-03**: `POST /api/payments/confirm-booking` re-verifies every involved provider's status inside the Mongoose transaction before finalizing. If any provider is suspended during the Stripe confirm window, the booking is rejected and the payment intent is cancelled; prevents TOCTOU race
- [x] **ENF-04**: Suspension never mutates `listing.active` or similar denormalized flags on owned documents. Visibility is *always* computed at read time by joining to the owner's `moderationStatus.state`

### Admin UI

- [ ] **UI-01**: `AdminManagementScreen` gains per-row quick-action menu on every approved user: Suspend / Unsuspend / Revoke role / Delete profile / Edit profile. Action triggers a modal with severity + preset-reason picker + optional note
- [ ] **UI-02**: New `AdminModerationScreen` provides search by email / Firebase UID, filter by role and moderation state, paginated list of users, per-user detail panel
- [ ] **UI-03**: Per-user detail panel shows full moderation history (every `ModerationAction` row for that user, most recent first) with action type, severity, admin who acted, timestamp, reason category, note
- [ ] **UI-04**: Admin can unsuspend a user directly from the moderation history view; the unsuspend action writes a new audit entry (history is never edited)

### Mobile Architecture

- [ ] **MOB-01**: A new **`ModerationService`** module lives at `src/services/moderation/ModerationService.ts` — separate from `AuthService.ts`. It owns all moderation HTTP calls. Adding to `AuthService` is explicitly disallowed for this milestone
- [ ] **MOB-02**: A shared **`http/client.ts`** axios instance is extracted from `AuthService.ts` and reused by `ModerationService` (and any future service modules). Owns base URL, idToken request interceptor, and the 403 response interceptor
- [ ] **MOB-03**: The shared axios client intercepts `403 account_suspended` responses globally, calls `AuthContext.refreshUser()`, and triggers the status banner — so a user who is suspended mid-session sees the banner immediately on the next API call
- [ ] **MOB-04**: `App.tsx` listens to `AppState` transitions; when the app returns from background to active, `AuthContext.refreshUser()` runs — so suspensions propagate without requiring an app restart

### Affected-User UX

- [x] **AFF-01**: A global `UserStatusBanner` component renders above the navigator whenever `user.moderationStatus.state !== 'active'`. Banner is non-dismissable and severity-aware (resolvable message / appeal message / permanent-ban message)
- [x] **AFF-02**: Banner displays the admin-selected preset reason category plus the optional note verbatim (full transparency — matches milestone decision)
- [x] **AFF-03**: For `blocked_with_review` severity, the banner shows a CTA that opens a mailto to `support@carexmarket.com` prefilled with the user's UID and current reason category; `permanently_banned` shows no appeal CTA
- [ ] **AFF-04**: For `feature_limited` severity, restricted screens (as defined by the capability map) render a `FeatureGateOverlay` explaining what the user must do to resolve; buyer features remain usable when a provider role is the only thing gated

### Quality

- [ ] **QUAL-01**: Every new user-facing string (admin UI labels, banner copy, overlay copy, reason-category labels) lands in `src/constants/translations.ts` under both `RU` (default) and `EN`
- [ ] **QUAL-02**: Backend passes a load test with 10,000 synthetic users against the admin search + moderation history endpoints; add any missing indexes surfaced by the test
- [ ] **QUAL-03**: Dedicated security review before merging to `main`: verify idToken verification, admin-only enforcement, transaction safety on suspend + payment confirm, audit log append-only at the application layer (and DB layer if Atlas tier supports it), no hardcoded secrets introduced

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Moderation (extended)

- **MOD2-01**: CSV export of moderation audit log (by target user or by actor admin)
- **MOD2-02**: IP address and device fingerprint captured on every moderation action (ban-evasion context)
- **MOD2-03**: Bulk selection with per-row confirm (bulk *selection* only, never bulk *ban*)
- **MOD2-04**: Super-admin tier that gates who can read private audit notes vs. only categories
- **MOD2-05**: Admin-to-admin handoff comments / pinned notes per user
- **MOD2-06**: Saved search filters and moderation SLA tracking

### Notifications

- **NOTF-01**: Email notification to affected user when moderated (requires backend mailer config)
- **NOTF-02**: Push notification on moderation (requires FCM/APNs setup)
- **NOTF-03**: In-app appeal ticket system (alternative to `mailto:support@carexmarket.com`)

### Listings moderation

- **LIST-01**: Pull down an individual car listing while leaving the seller active (listing-level moderation)
- **LIST-02**: Automated content flagging with an admin review queue

### Tech debt (separate future milestone)

- **DEBT-01**: Split `AuthService.ts` god-module into domain services (users, brokers, logistics, payments, orders, admin) — `ModerationService` extraction in this milestone establishes the pattern
- **DEBT-02**: Replace `user: any` in `AuthContext` with a typed `User` interface; add response types to every `AuthService` method
- **DEBT-03**: Add meaningful Jest test coverage — components, hooks, service modules
- **DEBT-04**: Standardize error handling across services (no silent swallows; consistent rethrow + UI surfacing)

### Pre-release blockers (tracked in codebase CONCERNS.md)

- **REL-01**: Swap Stripe `pk_test_...` to `pk_live_...` and move out of `App.tsx` to config
- **REL-02**: Replace placeholder `APP_STORE_URL` with real App Store ID
- **REL-03**: Move `currentEnv` flag out of `src/constants/config.ts` to a proper env-config mechanism

## Out of Scope

Explicitly excluded from this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Email / push notifications on moderation | Deferred to keep scope tight; avoids touching Twilio / email infra this milestone. Banner is enough for "learn you've been moderated" |
| Listing-level moderation (pull down one listing while seller stays active) | Milestone scope is user-level moderation; seller suspension indirectly hides listings via read-time filter |
| Auto-cancel / auto-refund of in-flight orders on suspension | **Anti-feature.** Orders *pause*, not auto-cancel. Prevents destructive side effects; admin can manually cancel if needed |
| In-app appeal ticket system | Appeals via `support@carexmarket.com` for this milestone; in-app ticketing is a separate product |
| Shadow ban (mute without user awareness) | **Anti-feature.** Contradicts the "show reason to affected user" decision; ethically hostile and legally exposed under DSA-style transparency |
| Bulk ban (mass action across many users in one click) | **Anti-feature at this scale.** Miscategorization risk is enormous; no throughput need at a small admin team size. Bulk *selection* with per-row confirm may land in v2 |
| Pre-approval queue changes | Existing approve/reject flow stays as-is; milestone only affects *after-approval* state |
| Full tech-debt sweep (AuthService split, typing, tests) | Separate milestone. `ModerationService` extraction in v1 establishes the pattern |
| Stripe live-key migration, App Store ID, env-flag cleanup | Separate pre-release milestone (tracked in `.planning/codebase/CONCERNS.md`) |
| Listing.active mutation on suspend | **Anti-pattern.** Would cause unsuspend to leave listings hidden. Visibility is always computed at read time |

## Traceability

Populated during roadmap creation. Every requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 2 | Complete |
| SEC-04 | Phase 2 | Complete |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| ADMIN-01 | Phase 2 | Complete |
| ADMIN-02 | Phase 2 | Complete |
| ADMIN-03 | Phase 2 | Complete |
| ADMIN-04 | Phase 2 | Complete |
| ADMIN-05 | Phase 2 | Complete |
| ENF-01 | Phase 3 | Complete |
| ENF-02 | Phase 3 | Complete |
| ENF-03 | Phase 3 | Complete |
| ENF-04 | Phase 3 | Complete |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| MOB-01 | Phase 4 | Pending |
| MOB-02 | Phase 4 | Pending |
| MOB-03 | Phase 4 | Pending |
| MOB-04 | Phase 4 | Pending |
| AFF-01 | Phase 6 | Complete |
| AFF-02 | Phase 6 | Complete |
| AFF-03 | Phase 6 | Complete |
| AFF-04 | Phase 6 | Pending |
| QUAL-01 | Phase 6 | Pending |
| QUAL-02 | Phase 6 | Pending |
| QUAL-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

**Per-Phase Requirement Counts:**
- Phase 1 (Schema + Security Baseline): 6 (SEC-01, SEC-02, DATA-01..04)
- Phase 2 (Admin Moderation Endpoints): 7 (SEC-03, SEC-04, ADMIN-01..05)
- Phase 3 (Backend Enforcement): 4 (ENF-01..04)
- Phase 4 (Mobile Plumbing): 4 (MOB-01..04)
- Phase 5 (Admin Moderation UI): 4 (UI-01..04)
- Phase 6 (Affected-User UX + Security Review): 7 (AFF-01..04, QUAL-01..03)
- **Total: 32 ✓**

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after roadmap creation (traceability populated)*

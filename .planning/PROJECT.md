# CarEx

## What This Is

CarEx is a React Native mobile marketplace for buying and selling cars, with add-on broker and logistics services booked through the app. The backend is a separate Node/Express + MongoDB + S3 service; identity uses Firebase Identity Toolkit REST. This milestone adds admin moderation controls over approved users (buyers, sellers, brokers, logistics providers) so operators can suspend, revoke, edit, or delete accounts after the initial approval gate.

## Core Value

Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.

## Requirements

### Validated

<!-- Inferred from existing code via .planning/codebase/ analysis. -->

- ✓ Car listing browse, filter, details — existing
- ✓ Car listing creation with multi-image upload (S3) — existing
- ✓ Firebase Identity Toolkit REST auth (signup, login, password reset, delete) — existing
- ✓ Backend user mirror at `/api/users/:firebaseUid` (profile, avatar) — existing
- ✓ Role request/approve flow for seller, broker, logistics — existing
- ✓ Admin approval of pending role requests (`/api/admin/requests`) — existing
- ✓ Admin user management (add/remove other admins) — existing
- ✓ Broker and logistics provider profiles — existing
- ✓ Service cart (buyer books broker/logistics services per car) — existing
- ✓ Stripe payment intent + booking confirmation — existing
- ✓ Orders (buyer view, provider view, status updates) — existing
- ✓ OTP phone verification (backend-mediated, Twilio optional) — existing
- ✓ Offline detection, i18n (RU default + EN), deep linking (`carex://`, `carexmarket.com/listing/:id`) — existing

### Active

<!-- This milestone: admin moderation for approved users. -->

Core actions (admin → target user):

- [ ] **Suspend** a user — temporary, reversible; admin picks severity level at suspension time
- [ ] **Revoke role** — downgrade broker/seller/logistics back to regular user; provider profile preserved
- [ ] **Delete provider profile** — hard-delete the broker/logistics profile record; past orders preserved and seller reference anonymized
- [ ] **Edit provider profile fields** on behalf of the provider (company name, phone, Telegram, etc.)
- [ ] Apply all four actions to **any user**, not just providers (regular buyers can also be suspended/blocked)

Suspension severity model (chosen by admin at action time):

- [ ] **Feature-limited + resolvable** — user logs in, sees restricted UI + a message explaining what to do to resolve (e.g. "verify phone", "re-submit documents")
- [ ] **Blocked with review** — user sees reason + instructions to appeal via `support@carexmarket.com`
- [ ] **Permanent ban** — user sees they are permanently blocked from the portal

Audit + reason:

- [ ] Every moderation action writes an audit row: admin UID, timestamp, target UID, action, severity, preset reason category, optional free-text note
- [ ] Admin UI uses a preset reason picker (Spam / Policy violation / Fraud / Other) with optional note
- [ ] Full audit history viewable per user in moderation screen

Notification to affected user:

- [ ] In-app banner/modal on next login showing reason (preset category + note)
- [ ] Banner content adapts to severity: resolvable message vs appeal instructions vs permanent ban
- [ ] No email or push — in-app only for this milestone

UI surface:

- [ ] **Extend `AdminManagementScreen`** with quick moderation actions on each listed user
- [ ] **New moderation screen** for deep search, history, bulk actions (search by email/UID, filter by role/status, view audit trail)

Backend work (separate repo `backend-services/carEx-services`):

- [x] New moderation endpoints: `POST /api/admin/moderation/:targetUid`, `PATCH /api/admin/moderation/:targetUid/unsuspend`, `DELETE /:targetUid/provider-profile`, `POST /:targetUid/edit-profile` — Phase 2 complete
- [ ] `GET /api/admin/moderation/:targetUid/history` (audit-read endpoint — Phase 5)
- [ ] New `UserStatus` model (active | feature_limited | blocked_with_review | permanently_banned) + audit log collection
- [ ] Listings/orders hide automatically when owner is suspended; orders pause rather than auto-cancel
- [ ] Enforce status checks on all user-initiated endpoints (create listing, create order, contact seller, etc.)

### Out of Scope

- **Email or push notifications on moderation** — deferred; in-app only for this milestone, keeps scope tight and avoids touching Twilio/email infra
- **Listing-level moderation** (pulling down a specific listing while leaving the seller active) — user scoped moderation to users + roles, not individual listings; seller suspension indirectly hides their listings
- **Auto-cancel / auto-refund of in-flight orders on suspension** — orders *pause* instead; admin can manually cancel if needed. Prevents destructive side effects
- **Appeal workflow inside the app** — users appeal via email (`support@carexmarket.com`); no in-app ticket system
- **Tech-debt sweep** (AuthService god-module split, `user: any` typing, test coverage, error-handling cleanup) — deferred to a dedicated future milestone after moderation ships
- **Stripe `pk_test_` → `pk_live_` swap and other App Store release prep** — tracked in `.planning/codebase/CONCERNS.md`, separate future milestone
- **Pre-approval moderation** (modifying request queue behavior) — existing approve/reject flow stays as-is; this milestone only touches *after*-approval state

## Context

- **Brownfield codebase:** Mobile app has been iterated on heavily (47 build versions). Most core marketplace + services features are in place. Codebase map lives at `.planning/codebase/`.
- **Architecture:** Mobile = React Native 0.83 + TypeScript, single native-stack navigator, provider chain `AuthProvider → CartProvider → StripeProvider → LanguageProvider`. All backend HTTP centralized in `src/services/AuthService.ts` (misleading name — it's the full API client, ~378 lines).
- **Auth model:** Hybrid. Google Identity Toolkit REST for identity (hardcoded web API key — intended public); each Firebase UID (`user.localId`) is mirrored as a backend user and used as the primary key everywhere (cars, orders, payments, admin, OTP).
- **Existing admin plumbing to build on:** `AuthContext` already exposes `isAdmin`/`adminRole`; `AuthService` has `getAdminStatus`, `getAdminRequests`, `approveRequest`, `rejectRequest`, `getAdminUsers`, `addAdminUser`, `removeAdminUser`. Screens: `AdminDashboardScreen`, `AdminManagementScreen`. Roles today: broker, seller, logistics — via `requestSellerStatus` / `requestBrokerStatus` / `requestLogisticsStatus` + admin approve/reject. Nothing exists for *after-approval* moderation.
- **Backend-mobile coupling:** Mobile and backend ship together. This milestone has real work in both repos; API contracts must be designed before mobile implementation.
- **i18n:** All new user-facing strings (admin UI, affected-user banners) must land in `src/constants/translations.ts` with both RU and EN keys. Default language is RU.
- **Audit log is not optional:** Full who/when/why/target is a hard requirement — moderation actions cannot be untraceable.

## Constraints

- **Tech stack (mobile):** React Native 0.83 + TypeScript + axios + AsyncStorage. Don't introduce new state-management or networking libs for this milestone. Extend existing `AuthService.ts` or split sensibly; do not rewrite it wholesale.
- **Tech stack (backend):** Node/Express + Mongoose + MongoDB Atlas. New routes mount under `/api/admin/moderation/*`. Follow existing admin-auth pattern (`callerUid` param → `getAdminStatus` check).
- **Auth enforcement:** Admin-only endpoints must validate the caller's admin status server-side on every request — never trust mobile-side `isAdmin`.
- **Data preservation:** Suspending or revoking must never destroy order/audit history. Delete-profile hard-deletes only the provider profile record; orders stay with anonymized seller reference.
- **Order safety:** In-flight orders touching a suspended provider are *paused*, not auto-cancelled. Buyers see a status banner on the order. Admin can manually cancel if needed.
- **i18n:** All moderator and affected-user strings are RU-first and must have EN parity.
- **No breaking changes to existing auth/cart/payments flows:** Moderation adds UI and endpoints; it must not regress signup, login, listing browse, cart, or Stripe checkout.
- **Secrets hygiene:** No new hardcoded keys. Existing `CONCERNS.md` items (Firebase key, Stripe test key) are explicitly *not* addressed here but also must not get worse.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Moderation applies to all users, not just provider roles | Buyers can also be bad actors (fraud, abuse); admin needs a single mental model | — Pending |
| Suspension has severity levels chosen at action time (feature-limited / blocked-with-review / permanent ban) | One-size-fits-all block is too blunt; severity carries the right UX to the affected user | — Pending |
| Preset reason picker + optional note (not required free-text) | Preset keeps data analyzable; free-text in audit handles edge cases without forcing friction | — Pending |
| Reason shown to affected user | User's own words: full transparency. Supports appeal flow via email | — Pending |
| Delete-profile preserves past orders via anonymized seller reference | Accounting + buyer history must remain intact; GDPR-style deletion stops at the provider profile record | — Pending |
| In-app notification only (no email/push) | Avoids touching Twilio/email infra this milestone; in-app banner is enough for "learn you've been moderated" | — Pending |
| Extend `AdminManagementScreen` *and* add a dedicated moderation screen | Quick actions where admin already is, deep search/history where volume demands it | — Pending |
| Backend work lives in separate repo but same milestone | Contract must be designed first, then mobile consumes it | — Pending |
| Tech debt deferred to a later milestone | Moderation is user-requested priority; bundling would expand scope and delay the feature | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after Phase 2 completion (admin moderation endpoints shipped)*

# CarEx

## What This Is

CarEx is a React Native mobile marketplace for buying and selling cars, with add-on broker and logistics services booked through the app. The backend is a separate Node/Express + MongoDB + S3 service; identity uses Firebase Identity Toolkit REST. As of v1.0 (shipped 2026-04-30), the platform includes admin moderation controls over approved users (buyers, sellers, brokers, logistics providers) — operators can suspend, revoke, edit, or delete accounts after the initial approval gate, with full audit trail and TOCTOU-safe payment confirmation.

## Core Value

Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.

## Current State

**Latest shipped:** v1.1 — Admin Listing Moderation (2026-06-06) · [archive](milestones/v1.1-ROADMAP.md)
**Previous:** v1.0 — Admin Moderation (2026-04-30) · [archive](milestones/v1.0-ROADMAP.md)
**Distribution:** TestFlight 1.0.45 + Google Play internal 1.0.48 — verified live
**Tags:** `v1.0`, `v1.1`
**v1.2 progress:** Phase 12 (Notification Domain + In-App Center) complete 2026-06-07 — backend domain/emit/router + mobile center/subscriptions/settings, RU/EN i18n, all pure-REST. Code review found & fixed 3 contract blockers; 24/24 must-haves verified, 5 runtime UAT items deferred to on-device pass (12-HUMAN-UAT.md). Next: Phase 13 (FCM push, native).

_Design spec: [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md)._

## Current Milestone: v1.2 Notifications

**Goal:** Give buyers a notification system — an in-app notification center plus OS push (FCM) — so they're alerted to relevant inventory and watched-car events without re-checking the app.

**Target features:**
- In-app notification center: bell icon + unread badge + feed/history (pure REST, no native SDK)
- OS push via FCM / react-native-firebase (the only native module); backend send pure REST (FCM HTTP v1)
- **Saved Search** subscription: criteria (make/model + optional price/year/body) → alert on newly-added matching listings
- **Watch** subscription: follow one car → alerts on price drop / booked / sold / back-available
- Per-subscription cadence: instant vs daily digest (Watch always instant; node-cron digest worker)
- Notification preferences screen + contextual push-permission prompt
- Backend event hooks on listing create / price edit / status transitions, respecting the Phase 9 hide-hook + moderation status
- RU + EN parity for all notification strings (rendered server-side from keys for push)

**Key context:** Full design pre-approved via brainstorming (spec linked above). Carries forward the NOTF-* candidate. Three phases (continuing numbering): **Phase 12** — backend notification domain + in-app center (pure REST); **Phase 13** — FCM push transport (native, RN 0.83 compat-gated); **Phase 14** — node-cron daily digest. Reuses existing patterns: `user.localId` as per-user key, axios `apiClient`, provider+hook context pattern (`NotificationContext` mirrors Cart), `LanguageContext` for i18n, existing deep-link `linking` config.

## Requirements

### Validated

<!-- Pre-existing functionality (inferred from `.planning/codebase/` analysis at v1.0 start). -->

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

<!-- v1.0 milestone shipped 2026-04-30. -->

- ✓ Admin can suspend any user with 3 severities (feature-limited / blocked-with-review / permanently-banned) + preset reason category + optional note, atomic via Mongoose transactions — v1.0
- ✓ Admin can unsuspend, revoke role, hard-delete provider profile, edit provider profile fields — v1.0
- ✓ All moderation actions write append-only audit rows (`ModerationAction` collection rejects updates/deletes at the application layer) — v1.0
- ✓ Backend `requireNotSuspended` middleware on 5 write routes returns `403 account_suspended` — v1.0
- ✓ Mongoose `pre(/^find/)` hooks auto-hide listings/profiles owned by suspended users — v1.0
- ✓ TOCTOU-safe `confirm-booking` re-verifies provider status inside transaction with refund-first-throw-second — v1.0
- ✓ Admin moderation rate-limited at 30 actions / 15 min / admin (429 on excess) — v1.0
- ✓ Self-moderation + last-admin protection (`400 cannot_moderate_self` / `400 last_admin_protected`) — v1.0
- ✓ AdminManagementScreen quick-action menu + dual-role delete contract (TWO rows for users with both broker + logistics) — v1.0
- ✓ AdminModerationScreen with email/UID search, role/state filters, paginated results — v1.0
- ✓ Per-user moderation history with cursor pagination, unsuspend from history view — v1.0
- ✓ Mobile shared axios `apiClient` with idToken request interceptor + 403 response interceptor + AppState foreground refresh — v1.0
- ✓ `ModerationService` as separate module (not glued onto AuthService) — v1.0
- ✓ Severity-aware `UserStatusBanner` above navigator with reason category + verbatim note — v1.0
- ✓ `mailto:support@carexmarket.com` appeal CTA on `blocked_with_review` severity — v1.0
- ✓ `FeatureGateOverlay` on capability-restricted screens (SellCar, ServiceCart, ServiceApplication, contact_seller CTA) — v1.0
- ✓ All new strings in `src/constants/translations.ts` with RU + EN parity (jest literal scanner enforces) — v1.0
- ✓ Security review APPROVED (06-SECURITY.md, all 5 verdicts PASS, merge-gate cleared) — v1.0
- ✓ Cryptographic admin auth via `firebase-admin.verifyIdToken()` on every admin route — v1.0
- ✓ Cross-phase production fixes shipped alongside: Android deep-link App Links, install-prompt redirects (Vercel UA + smart-app-banner), listing-image retry-on-error + picker shrink — v1.0
- ✓ Admin listing moderation: Edit / Suspend / Archive / Delete-soft / Restore, each atomic with append-only `ListingModerationAction` audit row (LSEC/LDATA/LADM) — v1.1
- ✓ Backend read-time hide hook + status-aware listing-detail GET + cart-add + TOCTOU-safe confirm-booking re-verification (refund-first-throw-second) (LENF-01..03) — v1.1
- ✓ Admin Users|Listings tab UI: search + status chips + paginated list + per-row Restore + inline `CarDetailsScreen` moderation bottom-sheet + admin Deleted view — v1.1
- ✓ Buyer-affected UX: severity-aware listing-detail + cart banners; in-flight paid orders proceed; RU/EN parity (parity scanner enforced) — v1.1
- ✓ Listing-moderation security review APPROVED (`LIST-SECURITY.md`, 5 PASS verdicts, merge-gate cleared) — v1.1

### Active

<!-- v1.2 — Notifications. Requirements being defined via /gsd-new-milestone (see design spec). -->

- _v1.2 Notifications requirements pending — being scoped via `/gsd-new-milestone`._

<!-- v1.2+ carry-forward candidates (deferred from v1.0): -->

Still deferred to a future milestone:

- QUAL-02 — 10k-user backend load test (deferred from v1.0 by operator 2026-04-19)
- DEBT-01 — Split `AuthService.ts` god-module into domain services (pattern established by ModerationService extraction)
- DEBT-02 — Replace `user: any` in AuthContext with typed `User` interface
- DEBT-03 — Expand Jest test coverage across components/hooks/services
- DEBT-04 — Standardize error handling (no silent swallows; consistent rethrow + UI surfacing)
- REL-01 — Swap Stripe `pk_test_...` → `pk_live_...` and move out of `App.tsx` to config
- REL-03 — Move `currentEnv` flag out of `src/constants/config.ts` to a proper env-config mechanism
- MOD2-01..06 — Extended moderation (CSV export, IP/device fingerprint, bulk select, super-admin tier, admin-handoff comments, saved filters)
- NOTF-01..03 — Email + push + in-app appeal ticket system
- LIST-02 — Automated content flagging queue (paired with LIST-01, deferred to v1.2+)
- UX — UserStatusBanner overlap with navbar avatar + logo + screen title (captured during Phase 04 UAT 2026-04-30)

### Out of Scope

- **Email or push notifications on moderation** — deferred. Banner is sufficient for "learn you've been moderated"; revisit in next milestone if user feedback warrants it
- **Listing-level moderation** — seller suspension indirectly hides listings via read-time filter
- **Auto-cancel / auto-refund of in-flight orders on suspension** — anti-pattern. Orders pause; admin manually cancels if needed. Prevents destructive side effects
- **Appeal workflow inside the app** — appeals via `support@carexmarket.com` for v1.0. In-app ticket system tracked as NOTF-03 for future
- **Shadow ban (mute without user awareness)** — anti-feature. Contradicts the "show reason to affected user" decision
- **Bulk ban** — anti-feature at this scale. Miscategorization risk too large; bulk *selection* with per-row confirm may land in v2 (MOD2-03)
- **Pre-approval moderation** — existing approve/reject flow stays as-is
- **Listing.active mutation on suspend** — anti-pattern. Visibility computed at read time

## Context

- **Codebase size:** ~21,700 LOC TypeScript (mobile only); separate backend repo at `backend-services/carEx-services` with similar magnitude. Total v1.0 milestone delta: +79,184 / -1,010 lines across 348 files in the mobile repo (326 commits since milestone start).
- **Architecture:** Mobile = React Native 0.83 + TypeScript, single native-stack navigator, provider chain `AuthProvider → CartProvider → StripeProvider → LanguageProvider`. Mobile HTTP now split between `AuthService.ts` (Identity Toolkit + legacy backend calls) and `ModerationService.ts` (separate domain module — pattern established for future splits per DEBT-01). Shared `apiClient` (axios instance) handles idToken request interceptor + 403 response interceptor.
- **Auth model:** Hybrid. Google Identity Toolkit REST for identity (hardcoded web API key — intended public); each Firebase UID (`user.localId`) is mirrored as a backend user and is the primary key everywhere. v1.0 added single-flight Firebase ID token refresh with 5-min-pre-expiry proactive check (Plan 05-12) and `firebase-admin.verifyIdToken()` on every backend admin route.
- **Backend infrastructure:** Backend lives at `backend-services/carEx-services` (sibling repo at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`); Railway-deployed. The public domain `www.carexmarket.com` is fronted by Vercel which proxies `/.well-known/*` to Railway/Express but serves `/listing/*` and other paths from a separate React SPA at `carEx-frontend/carex-web`. v1.0 close window discovered + fixed Android App Links cert fingerprint mismatch + added Vercel UA-conditional store redirects for users without the app.
- **i18n:** All v1.0 user-facing strings in `src/constants/translations.ts` with RU + EN parity; jest literal scanner enforces (06-09 QUAL-01).
- **Distribution:** v1.0 shipped to TestFlight (iOS 1.0.45 / build 46) + Google Play internal testing (Android 1.0.48 / code 49). Verified live on real devices 2026-04-30.

## Constraints

- **Tech stack (mobile):** React Native 0.83 + TypeScript + axios + AsyncStorage. Provider stack order is preserved per CLAUDE.md contract (`GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer → Stack.Navigator`).
- **Tech stack (backend):** Node/Express + Mongoose + MongoDB Atlas. Admin routes mount under `/api/admin/*`; moderation routes under `/api/admin/moderation/*`.
- **Auth enforcement:** Admin-only endpoints validate the caller's Firebase ID token server-side on every request via `firebase-admin.verifyIdToken()` + `requireAdmin` middleware. Mobile `isAdmin` is never trusted for authorization.
- **Data preservation:** Suspending or revoking never destroys order/audit history. Delete-profile hard-deletes only the provider profile record; orders stay with `providerSnapshot` denormalization.
- **Order safety:** In-flight orders touching a suspended provider are paused; admin manually cancels if needed.
- **i18n:** All moderator and affected-user strings RU-first with EN parity.
- **No breaking changes to existing auth/cart/payments flows:** Each milestone adds without regressing.
- **Secrets hygiene:** No new hardcoded keys. Existing `CONCERNS.md` items (Firebase web API key, Stripe `pk_test_`) explicitly NOT addressed in v1.0; tracked as REL-01 for future milestone.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Moderation applies to all users, not just provider roles | Buyers can also be bad actors; admin needs a single mental model | ✓ Good — v1.0 |
| Suspension has 3 severity levels chosen at action time | One-size-fits-all block is too blunt; severity carries the right UX to the affected user | ✓ Good — v1.0 |
| Preset reason picker + optional note (not required free-text) | Preset keeps data analyzable; free-text handles edge cases without forcing friction | ✓ Good — v1.0 |
| Reason shown to affected user verbatim (full transparency) | Supports appeal flow via email; ethically aligned; legally aligned with DSA-style transparency | ✓ Good — v1.0 |
| Delete-profile preserves past orders via `Order.providerSnapshot` denormalization | Accounting + buyer history must remain intact | ✓ Good — v1.0 |
| In-app banner only (no email/push) | Avoids Twilio/email infra; banner is sufficient for v1.0 | ✓ Good — v1.0 |
| Extend AdminManagementScreen *and* add dedicated AdminModerationScreen | Quick actions where admin already is, deep search/history where volume demands | ✓ Good — v1.0 |
| Backend work in separate repo but same milestone | Contract designed first, then mobile consumes | ✓ Good — v1.0 |
| ModerationService as separate module (not glued onto AuthService) | Establishes pattern for DEBT-01 god-module split next milestone | ✓ Good — v1.0 |
| `requireNotSuspended` factory middleware (capability-driven) instead of inline checks | Reusable; capability map is the single source of truth | ✓ Good — v1.0 |
| `pre(/^find/)` hide hooks instead of `listing.active` mutation | Clean unsuspend; no zombie-hidden listings after un-mutation | ✓ Good — v1.0 |
| `confirm-booking` re-verifies provider status inside same Mongoose transaction (refund-first-throw-second) | Prevents TOCTOU race during Stripe confirm window | ✓ Good — v1.0 |
| Append-only `ModerationAction` enforced at application layer (6 pre-hooks, not relying on Atlas tier) | Audit history is non-negotiable; works on free-tier MongoDB | ✓ Good — v1.0 |
| Cursor format: opaque base64 of `(createdAt, _id)` | Sort-stable, total-ordered, no client-visible internals | ✓ Good — v1.0 |
| Dual-role delete contract: TWO distinct delete rows for users with both broker + logistics profiles | Eliminates ambiguity on which role to delete; explicit `role` payload | ✓ Good — v1.0 |
| QUAL-02 load test deferred indefinitely (operator decision 2026-04-19) | Disposition: accept-with-deferred-verification per 06-SECURITY.md Section (e); not blocking merge | — Deferred — revisit next milestone |

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
*Last updated: 2026-05-29 — v1.1 Phase 11 (buyer-affected UX + quality + security review) complete; v1.1 milestone fully executed, ready for ship/cut*

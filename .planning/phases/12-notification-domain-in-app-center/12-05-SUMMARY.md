---
phase: 12-notification-domain-in-app-center
plan: 05
subsystem: notification-domain
tags: [backend, notifications, emit-wiring, integration, listing-lifecycle, i18n, wave-3]
requires:
  - "12-01: Notification/Subscription models + User.language enum + Wave-0 userLanguage scaffold"
  - "12-03: notificationService.emit() (guards + price-direction) + translations"
  - "12-04: src/notifications/router.js (uid-scoped REST surface, awaiting mount)"
provides:
  - "[BE] /api/notifications mounted behind verifyIdToken (NDOM-05, non-admin)"
  - "[BE] PUT /api/users/:uid persists language (RU/EN enum-guarded) (NI18N-01)"
  - "[BE] 6 emit trigger points wired AFTER commit (NDOM-02): new_listing, price_drop (seller PUT), booked/sold/back_available (PATCH status), booked (confirmBooking), price_drop (admin editListing)"
affects:
  - "12-06+ mobile NotificationService now reaches a live REST surface"
  - "Phase 13 FCM push rides the same emit() call sites (instant cadence already fires fcm.send stub)"
tech-stack:
  added: []
  patterns:
    - "Emit-after-commit, off-hot-path try/catch at every call site (Pitfall 8) — a notification failure never breaks the listing/booking response"
    - "Capture-before-mutation: oldPrice snapshot before Object.assign (seller PUT), oldStatus snapshot before listingStatus reassignment (PATCH status)"
    - "back_available gated strictly on a booked->active transition (NSUB-02)"
    - "Admin price_drop sourced from fieldDiff.price.{before,after}, emitted post-transaction (never inside session.withTransaction)"
    - "Test inlines the route handler verbatim (Phase-3 acceptance convention) rather than booting server.js"
key-files:
  created: []
  modified:
    - "[BE] server.js"
    - "[BE] src/moderation/listingService.js"
    - "[BE] __tests__/userLanguage.test.js"
decisions:
  - "Router mount INVERTS the moderation mount: verifyIdToken ONLY, no requireAdmin (NDOM-05) — the notification center is a per-user buyer surface, not an admin tool. The router itself scopes every query to req.auth.uid (12-04)."
  - "Every emit call site is wrapped in its own try/catch logging to console.error — defense-in-depth atop emit()'s internal containment, so even an emit() that threw before its own guards (e.g. mongoose.model not registered) cannot 500 the listing/booking response (T-12-05-03)."
  - "Seller PUT emits price_drop only when car.price actually changed (typeof both numbers && !==) to avoid invoking emit() on every non-price edit; emit()'s own direction-check then suppresses a raise. Admin editListing relies on fieldDiff.price existing (the diff is already change-gated) plus emit()'s decrease-check."
  - "confirmBooking booked emit uses result.car._id when present, falling back to the request carId — robust to the idempotent fast-path return shape ({car,orders})."
  - "userLanguage.test.js follows the Phase-3 acceptance pattern: it does NOT boot server.js (which initializes Stripe/Twilio/S3/Firebase/Mongo URI). It reproduces the PUT /api/users/:uid whitelist VERBATIM over a MongoMemoryServer-backed minimal Express app + supertest, exercising the same enum-guard code path without the init weight."
metrics:
  duration: "~12m"
  completed: "2026-06-06"
  tasks: 2
  files: 3
---

# Phase 12 Plan 05: Emit Wiring + Router Mount + Language Whitelist Summary

The integration seam that connects the Phase 12 notification domain to the real listing lifecycle: `notificationService.emit()` wired into all six existing trigger points AFTER commit (NDOM-02), the `/api/notifications` router mounted behind `verifyIdToken` only (NDOM-05, non-admin), and `PUT /api/users/:uid` extended to persist a RU/EN-enum-guarded `language` field (NI18N-01). All server.js edits for the phase land here — single owner, no cross-plan server.js conflicts.

## What Was Built

**Task 1 — Router mount + language whitelist + new_listing/price_drop/status emits** (`91ca041`, backend repo)
- Required `notificationRouter` + `notificationService` at the top of server.js alongside the other route modules.
- Mounted `app.use('/api/notifications', verifyIdToken, notificationRouter)` — INVERTS the moderation mount (no `requireAdmin`); the router is reachable by any authenticated buyer (NDOM-05).
- Added `language` to the `PUT /api/users/:uid` whitelist with the `['RU','EN'].includes(language)` enum guard — an out-of-enum value is dropped, not persisted (T-12-05-04).
- Wired three emit sites:
  - **POST /api/cars** → `new_listing` after `newCar.save()` (actor = `sellerId || req.auth?.uid`).
  - **PUT /api/cars/:id** → snapshot `const oldPrice = car.price` BEFORE the `Object.assign` reassignment; after `car.save()`, emit `price_drop` only when the price actually changed (actor = `sellerId`, with `oldPrice`/`newPrice`).
  - **PATCH /api/cars/:id/status** → snapshot `const oldStatus = car.listingStatus` before mutation; after save emit `booked` (new=booked), `sold` (new=sold), or `back_available` (new=active && old=booked) (actor = `sellerId`).
- Every emit is wrapped in its own try/catch so a notification failure cannot break the HTTP response (Pitfall 8 / T-12-05-03).
- Filled `__tests__/userLanguage.test.js` with 5 passing assertions: model field wiring check + EN persists + RU persists + out-of-enum (FR) ignored + legacy default RU.

**Task 2 — confirmBooking + admin editListing emits** (`89a6e2d`, backend repo)
- **confirmBooking route** (server.js): after `await confirmBookingService(...)` returns `{ car, orders }`, emit `booked` with `carId = result.car._id` (fallback to request carId) and `actorUid = buyerUid` — the buyer is the actor; watchers other than the buyer get notified. Emitted post-transaction, never inside the service session.
- **admin editListing** (src/moderation/listingService.js): required `notificationService`; after the edit `session.withTransaction(...)` commits, when `fieldDiff.price` exists, emit `price_drop` with `actorUid = adminUid`, `oldPrice = fieldDiff.price.before`, `newPrice = fieldDiff.price.after` — `emit()` direction-checks, so only a decrease produces a notification.
- Both emits wrapped in try/catch.

## Verification

- `npx jest __tests__/userLanguage.test.js` → **5 passed** (RED→GREEN; was test.todo from 12-01).
- `grep -n "app.use('/api/notifications'" server.js` → mount with `verifyIdToken`, **no** `requireAdmin`.
- `grep -c "notificationService.emit" server.js` → **4** (new_listing, seller price_drop, status emit, confirmBooking booked) — ≥4 required.
- `grep -n "const oldPrice" server.js` → line 945, BEFORE the `Object.assign` price reassignment (capture-before-mutation).
- `grep -n "oldStatus === 'booked'" server.js` → confirms back_available is gated on booked→active.
- `grep -n "language" server.js` → in the PUT /api/users/:uid whitelist with the `['RU','EN']` enum guard.
- `grep -n "fieldDiff.price" src/moderation/listingService.js` → admin price_drop emit uses before/after; `actorUid: adminUid` present.
- Full backend suite `npm test` → **385 passed, 2 failed** — the 2 failures are the PRE-EXISTING `ServiceOrder.providerSnapshot (DATA-03)` tests that expect POST /api/orders to return 201 (Phase 03-05 replaced it with a 410 Gone stub; logged to deferred-items.md). Verified pre-existing by re-running with this plan's changes stashed: identical 2-fail result. Zero regression introduced by the emit wiring.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

- Daily-cadence subscriptions still set `digestPending=true` only (consumed by the Phase 14 cron) — emit() instant-cadence path fires the `fcm.send` no-op stub end-to-end. Unchanged here; documented in 12-03.

## Threat Flags

None — no new security surface beyond the planned `/api/notifications` mount (verifyIdToken-gated, uid-scoped in the router) and the enum-guarded language field, both in the plan's threat_model.

## Self-Check: PASSED

- Files: `server.js` + `src/moderation/listingService.js` + `__tests__/userLanguage.test.js` confirmed modified in `carEx-services`.
- Commits: `91ca041` (Task 1) + `89a6e2d` (Task 2) confirmed in backend repo git log atop `dc92ae1` (12-04).
- Tests: userLanguage 5/5 pass; full suite 385 pass with only the pre-existing DATA-03 2-fail (stash-verified pre-existing); all 7 grep gates satisfied.

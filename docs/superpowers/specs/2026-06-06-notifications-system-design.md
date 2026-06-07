# CarEx Notifications System — Design Spec

**Date:** 2026-06-06
**Status:** Approved design (pre-plan)
**Author:** brainstorming session (CarEx)

## Overview

Add a notification system to CarEx with two halves that share one notification
domain:

1. **In-app notification center** — a bell icon with an unread badge, a feed
   screen, and notification history. Pure REST, no native SDK.
2. **OS push** — lock-screen alerts delivered via **FCM / react-native-firebase**
   when the app is closed. This is the only native module the feature introduces.

Users subscribe in two ways and receive notifications on the events they opted
into:

- **Saved Search** — criteria (make/model + optional price/year/body) → alert
  when a *newly-added* listing matches.
- **Watch** — follow one specific car → alerts on its lifecycle events
  (price drop, booked, sold, back-available).

## Goals

- Let buyers find out about relevant inventory without re-checking the app.
- Standard marketplace subscription UX (saved searches + followed items).
- Both in-app history AND real-time re-engagement (closed-app push).
- Keep noise low — notification fatigue is the top cause of opt-out.

## Decisions log (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| In-app vs push | **Both** | Re-engagement + history. |
| Push transport | **FCM / react-native-firebase** | Reuses existing `carex-market` Firebase project; backend send stays pure REST (FCM HTTP v1 + service-account JWT, no server SDK); free at scale; no third-party data sharing. |
| Native SDK | **Accepted** | OS-push *receipt* is unavoidably native on any provider; it is the only native dependency. In-app center and backend send remain pure REST. |
| Subscription model | **Two primitives** (Saved Search + Watch) | "New listing" and "make/model" are the same thing at different filter strengths; standard marketplace pattern; less code. |
| Watch events | price drop, booked, sold, back-available | Time-sensitive buyer signals. ("Newly added" belongs to Saved Search, not Watch.) |
| Cadence | **Per-subscription instant/daily** | Watch events always instant; each Saved Search is instant or daily digest. Requires a scheduled worker. |
| "Newly added" | = Saved Search new-match trigger | A Watch follows an existing car, so cannot fire on creation. Confirmed with user. |

## Constraints (inherited from CLAUDE.md / project)

- **Mobile stack:** RN 0.83 + TypeScript + axios + AsyncStorage. No new
  state-management or networking libs. Extend `AuthService.ts` or split sensibly.
- **Backend stack:** Node/Express + Mongoose + MongoDB Atlas. Follow existing
  router-mount + `verifyIdToken`/`requireAdmin` middleware patterns.
- **Auth:** `user.localId` (Firebase UID) is the per-user key for all records.
- **i18n:** RU-first, EN parity. All user-facing strings localized.
- **No regressions** to signup/login/browse/cart/Stripe.
- **Secrets hygiene:** no new hardcoded keys; service-account credentials via env.
- **Respect existing listing visibility:** the Phase 9 read-time hide hook and
  moderation `status` must gate all notifications (never notify about
  suspended/archived/deleted/hidden listings).

## Data model (3 new Mongoose models)

```
DeviceToken {
  uid, token (unique), platform: 'ios'|'android', appVersion,
  createdAt, lastSeenAt
}
  // Registered on login + on FCM token-refresh; removed on logout.

Subscription {
  uid, kind: 'saved_search'|'watch',
  criteria?: { makeId, modelId, priceMin, priceMax, yearMin, bodyType },  // saved_search
  carId?,                                                                  // watch
  cadence: 'instant'|'daily',     // saved_search only; watch is always instant
  events: string[],               // watch event opt-ins
  active: boolean, createdAt
}
  // Indexes: { kind, 'criteria.makeId', 'criteria.modelId' } for match;
  //          { kind, carId } for watch lookups; { uid } for "my subscriptions".

Notification {
  uid, kind,
  titleKey, bodyKey, params,      // i18n: store keys + params, NOT rendered text
  data: { deeplink, carId?, searchId? },
  read: boolean,
  channels: ['in_app'|'push'],
  digestPending: boolean,         // daily items flushed by cron
  createdAt
}
  // Index: { uid, createdAt } for feed; { uid, read } for unread count;
  //        { digestPending } for the digest worker.
```

Daily-digest items are ordinary `Notification` rows with `digestPending: true` —
no separate queue collection.

## Event → notification flow (real backend hook points)

| Event | Hook point | Targets |
|---|---|---|
| New listing | `POST /api/cars` | matching active Saved Searches |
| Price drop | `PUT /api/cars/:id`, admin moderation PATCH (price decreased) | Watchers of that car |
| Booked / Sold | `PATCH /api/cars/:id/status`, `confirmBooking` (`listingStatus`) | Watchers |
| Back-available | `listingStatus` booked→active | Watchers |

**Guards:**
- Matching and sending respect the hide-hook and moderation `status` — no
  notifications for non-active/hidden listings.
- Dedup: repeated edits within a short window collapse to one notification.
- Never notify the actor about their own action (e.g. seller editing own price).

## Send pipeline

A single backend `notificationService.emit(event)`:

1. Resolve target subscriptions for the event.
2. Write `Notification` rows.
3. `instant` → send FCM push immediately to the uid's device tokens.
4. `daily` → leave `digestPending: true`.

A `node-cron` worker runs once/day, aggregates each user's pending rows into one
digest push ("12 new BMWs today"), sends, clears flags.

Push send is **pure REST** (FCM HTTP v1 endpoint + service-account JWT signed
server-side) — no `firebase-admin` SDK required.

## i18n

Push text is rendered server-side, so the backend must know the user's language:

- Persist `language` on the `User` record, synced from `LanguageContext` whenever
  the user changes language.
- The send pipeline renders `titleKey`/`bodyKey` from a **backend translations
  map** (RU + EN parity).
- The in-app feed renders the same keys client-side via `useLanguage().t`.

## Mobile surfaces

- **Bell icon** in the header with an unread badge → **NotificationsScreen** (feed;
  tapping an item deep-links via the existing `linking` config).
- **Watch button** (bell/heart) on `CarDetailsScreen`.
- **"Notify me about new matches"** action on Home/filter results → creates a
  Saved Search from the current filters.
- **NotificationSettingsScreen** — master toggle, per-category toggles, manage
  saved searches & watches, instant-vs-daily per saved search.
- **`NotificationContext`** — mirrors the Auth/Cart/Language provider+hook pattern;
  auto-clears on `user.localId` change (like CartContext).
- **Permission UX:** do NOT prompt for OS push on launch. Prompt **contextually**
  the first time the user taps Watch or Save-search (higher opt-in, App
  Store-friendly).

## Phasing

**Phase A — Domain + in-app center (pure REST, zero native).**
Models, subscription CRUD endpoints, matching engine, event hooks, in-app feed
endpoints (list / mark-read / unread-count), `NotificationContext`, bell+badge,
NotificationsScreen, Watch button, Save-search action, NotificationSettingsScreen.
*Fully usable without push.*

**Phase B — FCM push transport (native).**
react-native-firebase install + native config (APNs auth key upload to Firebase,
pod/gradle/entitlements wiring), device-token registration + refresh + logout
cleanup, contextual permission prompt, wire instant push into the send pipeline.
Includes an explicit **RN 0.83 compatibility check** on react-native-firebase
versions before install.

**Phase C — Digest cadence.**
`node-cron` digest worker, per-subscription instant/daily plumbing, localized
digest aggregation + rendering.

## Risks / open items

- **RN 0.83 + react-native-firebase compatibility** — newest RN; verify a
  supported version exists before Phase B. Fallback: pin RN-firebase version or
  evaluate bare FCM + notifee.
- **APNs key** — requires an Apple Developer account APNs auth key uploaded to
  the Firebase console (one-time ops step, not code).
- **Match-engine cost** — on high listing volume, matching every new car against
  all saved searches could get heavy; indexed criteria fields mitigate; revisit
  if listing volume grows.
- **Railway worker model** — confirm whether the cron runs in-process
  (node-cron in the Express process) or as a separate Railway service.

## Out of scope (this milestone)

- Marketing/broadcast sends, rich media push, notification A/B testing.
- Seller-side notifications (e.g. "your listing got a watcher") — could be a
  follow-on; the domain supports it.
- Email/SMS channels (Twilio exists but is OTP-only here).
- Web push.

# v1.2 Notifications — Architecture Integration Research

**Milestone:** v1.2 Notifications (Phases 12–14)
**Researched:** 2026-06-06
**Mode:** Architecture / integration validation
**Confidence:** HIGH (verified against actual backend + mobile source, not training data)
**Source of truth:** `docs/superpowers/specs/2026-06-06-notifications-system-design.md`

Backend repo: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`
Mobile repo: `/Users/beckmaldinVL/development/mobileApps/carEx`

---

## Summary

The spec's 3-model design (DeviceToken, Subscription, Notification) is sound and integrates cleanly. The strongest validated decision is **digest-as-flag** (`digestPending` on Notification) rather than a separate queue — it matches the existing append-only/audit patterns and avoids a fourth collection.

The most important correction to the spec: **do NOT use Mongoose `post('save')` hooks for event emission.** Use **explicit `notificationService.emit()` calls placed inside the existing route handlers, AFTER `await car.save()` / after the transaction commits.** Reasons: (1) the codebase already follows an explicit-service-layer pattern (`confirmBooking.js`, `listingService.js`) and never uses lifecycle hooks for side effects; (2) the price-drop event requires the *before* value (old price), which post-save cannot see without extra plumbing; (3) post-save fires inside the `confirmBooking` transaction where a push send must NOT run (it would fire before commit and on every retry); (4) the actor-exclusion and dedup guards need request context (`sellerId`, `adminUid`) that hooks don't have.

Three hook points already exist as clean seams: `POST /api/cars` (server.js:778), `PUT /api/cars/:id` (server.js:886), `PATCH /api/cars/:id/status` (server.js:459), `confirmBooking` (src/payments/confirmBooking.js:227), plus the admin edit path `editListing` (src/moderation/listingService.js:136, for admin-initiated price drops). All run on Mongoose 9 / Express 5; `firebase-admin@13.8.0` is **already installed** (used for `verifyIdToken`), so FCM HTTP v1 auth can reuse its service-account credential plumbing in Phase 13 even though the send stays REST.

Key gotcha surfaced by the code: the Car model has a **`pre(/^find/)` hide-hook** (Car.js:64 and 105). The matching engine's "find subscriptions whose criteria match this new car" runs on the *Subscription* collection (unaffected), but any time the notification pipeline **re-reads a Car** to validate it's still visible, it must respect those hooks (do NOT pass the `includeAllUsers`/`includeAllListingStatuses` bypass flags — the absence of bypass is exactly what enforces the "never notify about hidden listings" guard). This is the inverse of the admin code, which always bypasses.

---

## Backend Data Model & Indexing

### Validation of the 3 models — APPROVED with refinements

All three new models go in `src/models/` (NEW files), matching `Car.js`, `User.js`, `ModerationAction.js`, `ListingModerationAction.js`. They are registered by `require()` at the top of `server.js` (mirror lines 12–16) so the cron worker and service can `mongoose.model('Notification')` lazily.

**`src/models/DeviceToken.js` (NEW)** — approved as specced. Refinements:
- `token` unique index is correct, but uniqueness must be **global**, not per-uid: the same physical device can re-login as a different user, and FCM tokens are device-scoped. On register, upsert on `token` and overwrite `uid` (last-writer-wins) so a shared device routes push to the currently-logged-in user only.
- Add index `{ uid: 1 }` for "send to all this user's devices" fan-out in `emit()`.
- `platform: 'ios'|'android'` + `appVersion` as specced (useful for APNs/Android payload differences later).
- `lastSeenAt` updated on login + token-refresh; used by a future stale-token sweep (out of scope now).

**`src/models/Subscription.js` (NEW)** — approved. This is the matching-engine hot path. Refinements:
- `criteria.makeId` / `criteria.modelId` should be `mongoose.Schema.Types.ObjectId` to match `Car.makeId`/`modelId` (Car.js:11–12). The Car stores both ObjectId refs AND denormalized `makeName`/`modelName`; **match on `makeId`/`modelId`** (the ObjectIds are stable; names have legacy `make`/`model` string variants on old listings — see Car.js:14–15).
- `active: boolean` — index it; the matching query must filter `active: true`.
- Keep `watch` rows (`carId` set) and `saved_search` rows (`criteria` set) in one collection discriminated by `kind` — confirmed good (the spec's "two primitives, one collection" decision). Distinct index sets per kind below.

**`src/models/Notification.js` (NEW)** — approved, **including digest-as-flag.** Refinements:
- `titleKey` / `bodyKey` / `params` (i18n keys, NOT rendered text) — correct and load-bearing for server-side push rendering (see i18n section).
- `data: { deeplink, carId?, searchId? }` — `deeplink` should be the path the existing `linking` config understands: `listing/:carId` maps to `CarDetails` (App.tsx:84). For saved-search digests that have no single car, deeplink to the notifications feed or a pre-filtered Home.
- Add a dedup helper field `dedupeKey` (e.g. `` `${carId}:${eventType}` ``) with a partial/TTL consideration — see dedup below. This supports the spec's "repeated edits within a short window collapse to one notification" guard without a separate table.

### Indexing strategy for the matching engine (at scale)

The expensive operation is: **new car created → find all saved-search Subscriptions that match.** This is a *reverse* query (one document probing many subscriptions), the opposite of normal search.

Recommended indexes on `Subscription`:
```js
// Matching engine — new-car → matching saved searches.
// Most selective leading field first: kind+active narrows to live saved searches,
// then makeId/modelId are the equality-match join keys.
subscriptionSchema.index({ kind: 1, active: 1, 'criteria.makeId': 1, 'criteria.modelId': 1 });

// Watch lookups — price-drop / booked / sold / back-available on a specific car.
subscriptionSchema.index({ kind: 1, carId: 1, active: 1 });

// "My subscriptions" screen (manage saved searches + watches).
subscriptionSchema.index({ uid: 1, active: 1 });
```

Matching query shape for a new car (makeId M, modelId D, price P, year Y, bodyType B):
```js
// modelId optional in a saved search (make-only watch is valid), so match
// modelId === car.modelId OR subscription left it unset.
const subs = await Subscription.find({
  kind: 'saved_search',
  active: true,
  'criteria.makeId': car.makeId,
  $and: [
    { $or: [{ 'criteria.modelId': car.modelId }, { 'criteria.modelId': { $exists: false } }, { 'criteria.modelId': null }] },
    { $or: [{ 'criteria.priceMax': { $exists: false } }, { 'criteria.priceMax': { $gte: car.price } }] },
    { $or: [{ 'criteria.priceMin': { $exists: false } }, { 'criteria.priceMin': { $lte: car.price } }] },
    { $or: [{ 'criteria.yearMin': { $exists: false } }, { 'criteria.yearMin': { $lte: car.year } }] },
    { $or: [{ 'criteria.bodyType': { $exists: false } }, { 'criteria.bodyType': car.bodyType }] },
  ],
});
```
The leading `{ kind, active, makeId }` triple is the index's job; the range/optional clauses filter the (small) candidate set in memory. At CarEx's scale (Kyrgyzstan regional marketplace, low listing volume per spec's own risk note) this is comfortably fast. **Scale flag for the roadmap:** if listing volume ever grows, the mitigation is already indexed; revisit only if a single make accumulates tens of thousands of active saved searches. The spec's risk note (lines 175–177) is correctly scoped — no pre-optimization needed.

Indexes on `Notification`:
```js
notificationSchema.index({ uid: 1, createdAt: -1 });   // feed (newest first)
notificationSchema.index({ uid: 1, read: 1 });          // unread badge count
notificationSchema.index({ digestPending: 1 });         // cron worker sweep
```
Match the existing cursor convention if the feed paginates: base64(`{createdAt,_id}`) — already the house style (`listingService.js:46` `encodeCursor`, ModerationService cursor reasoning). Reuse it so mobile has one cursor model.

### Digest queue: flag, not collection — CONFIRMED

`digestPending: true` on ordinary Notification rows is the right call. It mirrors the codebase's preference for **state-on-the-row over side-collections** (e.g. moderation state lives on `User.moderationStatus`, not a separate table). The cron worker (Phase 14) does `Notification.find({ digestPending: true })`, groups by `uid`, sends one aggregated push, then `updateMany({ digestPending: true }, { $set: { digestPending: false } })`. Watch events never set `digestPending` (always instant). A separate collection would add a sync-consistency burden for zero benefit.

---

## Event Hooks & notificationService

### RECOMMENDATION: explicit service calls, NOT Mongoose post-save hooks

The codebase has **zero lifecycle-hook side effects** — every write goes through an explicit handler or service (`confirmBooking.js`, `listingService.js`). The only `pre`/`post` hooks present are the read-time `pre(/^find/)` hide hooks (Car.js) and append-only-enforcement hooks on audit models. Adding `post('save')` emission would break the established mental model and create four concrete bugs:

1. **No "before" value.** Price-drop needs `oldPrice > newPrice`. `post('save')` sees only the new doc. The explicit handlers already have the old doc in hand (`PUT /api/cars/:id` loads `car` before `Object.assign`, server.js:891; `editListing` computes a full `fieldDiff` with `{before, after}`, listingService.js:241).
2. **Fires inside the confirmBooking transaction.** `car.save({ session })` (confirmBooking.js:230) would trigger post-save *before commit* and *on every transaction retry* (the service auto-retries, confirmBooking.js:118–123). A push sent on a rolled-back attempt is unrecoverable. Explicit emission placed *after* `session.withTransaction(...)` returns fires exactly once, post-commit.
3. **No request context.** Actor-exclusion ("never notify the seller about their own edit") needs `sellerId` from the request body / `adminUid` from the auth chain. Hooks don't have it.
4. **Hide-hook interaction.** A clean emission point lets us assert visibility explicitly before sending (see guards below).

### Exact hook placements (all in existing files — MODIFIED)

| Event | File · location | Placement | Targets |
|---|---|---|---|
| **New listing** | `server.js` POST `/api/cars` handler, after `await newCar.save()` (line 872), before `res.json` | `await notificationService.emit({ type: 'new_listing', car: newCar.toObject(), actorUid: sellerId })` | matching active `saved_search` subs |
| **Price drop (seller)** | `server.js` PUT `/api/cars/:id`, after `await car.save()` (line 968) | capture `const oldPrice = car.price` *before* `Object.assign` (line 941); after save, if `newPrice < oldPrice` → `emit({ type: 'price_drop', carId, oldPrice, newPrice, actorUid: sellerId })` | `watch` subs on that carId |
| **Price drop (admin edit)** | `src/moderation/listingService.js` `editListing`, after `session.withTransaction` returns (line 378) | `fieldDiff.price` already holds `{before, after}`; if `after < before` → `emit({ type: 'price_drop', carId, oldPrice: before, newPrice: after, actorUid: adminUid })` | `watch` subs |
| **Booked** | `server.js` PATCH `/api/cars/:id/status`, after `await car.save()` (line 472) | if `listingStatus === 'booked'` → `emit` | `watch` subs |
| **Booked (paid)** | `src/payments/confirmBooking.js`, **after** `session.withTransaction` block (after line 301, before `return`) | use `savedCar`; emit `booked`. MUST be after commit, never inside the txn | `watch` subs (exclude `buyerUid` — they did it) |
| **Sold** | `server.js` PATCH `/api/cars/:id/status`, after save | if `listingStatus === 'sold'` → emit | `watch` subs |
| **Back-available** | PATCH `/api/cars/:id/status`, after save | capture `oldListingStatus` before assign (line 471); if `booked → active` → emit `back_available` | `watch` subs |

Note `confirmBooking` is called from the thin server.js handler (server.js:1222) which already error-maps. The emit goes *inside* `confirmBooking.js` after the transaction (so it has `savedCar`), not in the route handler — keeps the service self-contained like the rest of that module.

### Guards (enforced inside emit, not at call sites)

- **Hide-hook / moderation-status respect.** For `saved_search` matching, the new car at `POST /api/cars` is freshly created with `status: 'active'` default (Car.js:47) and the seller passed `requireNotSuspended('create_listing')` (server.js:778) — so it's visible by construction. For watch events, re-read the car *without* bypass flags: `const c = await Car.findById(carId)` (NO `setOptions`). If the hide hooks return null (seller suspended OR `status !== 'active'`), the car is hidden → **suppress the notification.** This is the single most important guard and it's automatic: the absence of the admin bypass flags means the `pre(/^find/)` hooks (Car.js:64, 105) do the gating for free. Document this inversion loudly — every admin read in the codebase *adds* the bypass; the notification pipeline must *omit* it.
- **Actor exclusion.** `emit()` drops any target subscription whose `uid === event.actorUid` before writing rows.
- **Dedup.** Before writing, check for an existing Notification with the same `dedupeKey` (`${carId}:${type}`) for the same `uid` within a short window (e.g. last 10 min) and skip. Cheap with a `{ uid, dedupeKey, createdAt }` lookup or an in-process short-TTL cache.

### notificationService design — `src/notifications/` (NEW dir, mirrors `src/moderation/`, `src/payments/`)

```
src/notifications/
  notificationService.js   // emit() + resolveTargets() + writeRows()  (NEW)
  push/
    fcm.js                 // Phase 13 — FCM HTTP v1 send via service-account JWT (NEW)
  digest.js                // Phase 14 — cron worker body (NEW)
  translations.js          // backend RU/EN map for push rendering (NEW)
  matchSavedSearches.js    // pure matching-query builder, unit-testable (NEW)
  __tests__/               // mirror src/moderation/__tests__ (NEW)
```

`emit(event)` flow (single entry point):
1. **resolveTargets(event)** — pure-ish: builds the Subscription query per event type (saved-search match for `new_listing`; `{ kind:'watch', carId }` for watch events), returns `[{ uid, subscriptionId, cadence, kind }]`. Excludes `actorUid`.
2. **visibility guard** — for watch events, re-read Car *without* bypass; suppress if hidden.
3. **writeRows** — `Notification.insertMany(rows)` with `titleKey`/`bodyKey`/`params`/`data.deeplink`/`channels`. Daily saved-search rows get `digestPending: true`; everything else `false`.
4. **dispatch** — instant rows (watch always instant; saved-search `cadence==='instant'`) → resolve `DeviceToken`s for the uid → `fcm.send()` (Phase 13; in Phase 12 this is a no-op stub so the in-app feed works standalone). Daily rows → left for the cron worker.

**Testability:** `emit` takes the event object and depends only on injected/lazy-resolved models (`mongoose.model('Notification')`, etc.) — same lazy-resolution idiom as `confirmBooking.js:94` and `listingService.js:80`, so `mongodb-memory-server` tests (already a devDep) can register loose schemas. Push send (`fcm.send`) is injected (mirror `confirmBooking({ stripe })` dependency injection, confirmBooking.js:87) so Phase 12/14 tests never hit the network. `matchSavedSearches.js` is a pure query-builder returning a Mongo filter object — unit-testable with zero DB.

---

## Mobile Integration (context / screens / routes / token lifecycle)

### NotificationContext (NEW: `src/context/NotificationContext.tsx`)

Mirror `CartContext.tsx` / `FavoritesContext.tsx` exactly:
- `createContext` + `useNotifications()` hook that throws if used outside provider (house pattern, every context does this).
- **Auto-clear on `user.localId` change** via the `prevUidRef` sentinel pattern — copy `CartContext.tsx:57-64` / `FavoritesContext.tsx:55-63` verbatim (skip-on-mount, clear in-memory on transition).
- State: `unreadCount`, `notifications[]`, `loading`. Methods: `refresh()`, `markRead(id)`, `markAllRead()`, fetch unread count on mount + on AppState foreground.
- Data source: a NEW `NotificationService.ts` module (NOT glued to AuthService — same MOB-01 guardrail that produced `ModerationService.ts`). Thin `apiClient` wrappers: `getFeed(cursor)`, `getUnreadCount()`, `markRead`, `markAllRead`, subscription CRUD (`createSavedSearch`, `createWatch`, `deleteSubscription`, `listSubscriptions`), `registerDeviceToken`, `unregisterDeviceToken`, `setLanguage`. Bearer injection + 401/403 handling come free from `apiClient` interceptors (http/client.ts).

**Watch vs Favorites:** these are DISTINCT. `FavoritesContext` is local-only AsyncStorage hearts (no server, no events). "Watch" is a server-side `Subscription` that drives push. Do not conflate. The bell/heart on CarDetails for Watch is a *new* control wired to `NotificationService.createWatch(carId)`; the existing favorite heart stays as-is. (Flag for UX/design phase: two heart-like controls on one screen needs visual disambiguation — bell for Watch, heart for Favorite.)

### Provider placement (App.tsx — MODIFIED)

Current order: `SafeAreaProvider → AuthProvider → CartProvider → FavoritesProvider → StripeProvider → LanguageProvider → PersonalityProvider → NavigationContainer`.

`NotificationContext` depends on `useAuth` (for `user.localId`). Place it **after AuthProvider**, alongside Cart/Favorites: `... → CartProvider → FavoritesProvider → NotificationProvider → StripeProvider → LanguageProvider ...`. It does NOT need LanguageProvider (in-app rendering uses `useLanguage().t` *inside screen components*, which are children of LanguageProvider — the context itself only holds keys/params, never rendered text). This keeps the CLAUDE.md provider-order contract intact (additive insertion).

### Routes (RootStackParamList — MODIFIED `src/types/navigation.ts` + App.tsx)

Add three NEW screens + entries:
```ts
Notifications: undefined;                    // the feed (NEW screen NotificationsScreen.tsx)
NotificationSettings: undefined;             // master + per-category toggles, manage subs (NEW)
// SavedSearches/Watches management can live inside NotificationSettings or be its own:
NotificationSubscriptions: undefined;        // optional — manage saved searches + watches (NEW, or fold into Settings)
```
Register matching `<Stack.Screen>` entries in App.tsx (mirror lines 109–132). The bell-tap deep-link path already exists: tapping a feed item with `data.deeplink === 'listing/:carId'` resolves through the existing `linking` config (App.tsx:84) → `CarDetails`. No new linking prefix needed; optionally add `notifications` → `Notifications` to `linking.screens` so a push that opens cold-start lands on the feed.

### Mobile surfaces (NEW components / MODIFIED screens)

- **Bell + badge** — NEW `src/components/NotificationBell.tsx`, placed in the header. Reads `useNotifications().unreadCount`. The app uses a custom header (`BottomBar.tsx`, `MoreMenu.tsx`, `Logo.tsx` exist); place the bell in the top header area near the logo. (Flag: captured UX concern in PROJECT.md about header crowding — coordinate bell placement with existing avatar/logo/title.)
- **NotificationsScreen** (NEW) — feed list, cursor-paginated, mark-read on view, tap → deep-link. Use `OptimizedImage` for any car thumbnails (MEMORY: remote images must use OptimizedImage/FastImage, not RN Image).
- **Watch button** on **CarDetailsScreen.tsx** (MODIFIED) — toggle calls `NotificationService.createWatch/deleteSubscription`. First tap triggers the contextual push-permission prompt (Phase 13).
- **"Notify me about new matches"** on **HomeScreenV2.tsx / SearchResultsV2.tsx / FilterModal.tsx** (MODIFIED) — builds a `saved_search` Subscription from current filter state. First tap → contextual permission prompt (Phase 13).
- **NotificationSettingsScreen** (NEW) — master toggle, per-category toggles, list/delete saved searches & watches, per-saved-search instant/daily cadence selector (cadence plumbing is Phase 14 but the UI control can ship in Phase 12 disabled/instant-only).

### Device-token registration lifecycle (Phase 13 — MODIFIED AuthContext.tsx)

This is the trickiest integration and it lands in **Phase 13** (the token only exists once FCM/react-native-firebase is installed). Hook points in `AuthContext.tsx`:
- **On login** (`login`, line 385–412) and **signup** (line 414–433), after `setUser`: request FCM token (Phase 13), call `NotificationService.registerDeviceToken({ token, platform, appVersion })`. Gate behind permission state — do NOT request OS permission here (spec: contextual prompt only).
- **On FCM token refresh** (`onTokenRefresh` listener, registered in a NEW mount effect in AuthContext or a small `useDeviceToken` hook): re-register the new token.
- **On logout** (`logout`, line 435–459): call `NotificationService.unregisterDeviceToken(token)` to remove the row so a logged-out device stops receiving the previous user's push. Do this **before** clearing the idToken ref (line 439) — the unregister call needs the Bearer. Or capture the token and fire unregister with the still-valid token. Order matters: the existing logout clears `currentIdTokenRef.current` first; insert the unregister call ahead of that clear, or pass the token explicitly (mirror how `deleteAccount` grabs the token before logout, line 511).
- **Cold start** (`loadStorageData`, line 354–383): re-assert the token if permission was previously granted (refresh `lastSeenAt`).

Use the existing `setLogoutTrigger`/listener registration pattern (AuthContext.tsx:347, http/client.ts) if you want to avoid a circular dep, but a direct `NotificationService` call inside `logout` is simpler and matches how `AuthService.logout()` is already called inline (line 450).

---

## i18n Server-Side Rendering

Push text is rendered by the backend (the app is closed), so the backend needs (a) a translations map and (b) the user's language.

### Backend translations map (NEW: `src/notifications/translations.js`)

A backend-side RU/EN map keyed by `titleKey`/`bodyKey` with `{param}` interpolation:
```js
// src/notifications/translations.js (NEW)
const PUSH_STRINGS = {
  RU: {
    price_drop_title: 'Цена снижена',
    price_drop_body: '{makeName} {modelName} теперь {price} {currency}',
    new_match_title: 'Новое объявление по вашему поиску',
    booked_title: 'Объявление забронировано',
    digest_title: 'Сегодня новых объявлений: {count}',
    // ...
  },
  EN: { price_drop_title: 'Price dropped', /* ... EN parity ... */ },
};
function renderPush(lang, key, params) { /* lookup + interpolate, fallback RU */ }
```
This map is **independent** of the mobile `src/constants/translations.ts` but must stay key-parity with it for the *in-app* rendering of the same Notification rows. The in-app feed renders `titleKey`/`bodyKey` client-side via `useLanguage().t` (LanguageContext) — so the SAME keys must exist in BOTH maps. **Roadmap flag:** add a parity check. The codebase already enforces RU/EN parity with a jest literal scanner (PROJECT.md: "jest literal scanner enforces"); extend or add a sibling scanner that asserts every notification key exists in RU + EN on BOTH the backend map and the mobile translations. Keys are the contract between the two repos.

### Persisting `user.language` (MODIFIED `src/models/User.js` + sync path)

`User.js` currently has **no `language` field** (verified — lines 3–29). Add:
```js
language: { type: String, enum: ['RU', 'EN'], default: 'RU' },
```
Sync mechanism — two MODIFIED touch points:
- **Mobile `LanguageContext.tsx`** currently holds language **in-memory only, default RU, with no persistence** (verified — no AsyncStorage, no backend write). MODIFIED: when `setLanguage` is called and a user is logged in, fire `NotificationService.setLanguage(lang)` → `PUT /api/users/:uid` (or a dedicated `/language` endpoint) to persist on the User row. Also persist locally to AsyncStorage so the app remembers the choice across launches (a pre-existing gap worth closing here).
- **Backend** `PUT /api/users/:uid` (server.js:512) already exists for profile updates — extend it to accept `language`, OR add a thin `PATCH /api/users/:uid/language`. The send pipeline reads `User.language` (default RU) when rendering push.

Fallback: if `User.language` is unset/null, render RU (matches the app default).

---

## Build Order (Phases 12–14)

The spec's A/B/C phasing maps to Phases 12/13/14 and the dependency order is correct. Refined with integration points:

### Phase 12 — Domain + in-app center (pure REST, zero native)
**Backend (carEx-services):**
1. NEW models: `DeviceToken.js`, `Subscription.js`, `Notification.js` + indexes. Register in `server.js` requires.
2. NEW `src/notifications/`: `notificationService.js` (`emit` with `fcm.send` as an injected no-op stub), `matchSavedSearches.js`, `translations.js`.
3. MODIFIED route hooks: `POST /api/cars`, `PUT /api/cars/:id`, `PATCH /api/cars/:id/status` (server.js), `confirmBooking.js` (after-commit emit), `listingService.js editListing` (admin price-drop) — all call `notificationService.emit(...)` post-write/post-commit, with visibility + actor-exclusion + dedup guards.
4. NEW subscription CRUD + feed endpoints: a `src/notifications/router.js` mounted under `/api/notifications/*` (mirror the `/api/admin/moderation` mount pattern, server.js:988, but gated by `attachAuthIfPresent` + per-user `uid`, not `requireAdmin`). Routes: create/list/delete subscription, feed list (cursor), unread-count, mark-read, mark-all-read.
5. MODIFIED `User.js`: add `language` field. MODIFIED `PUT /api/users/:uid` to accept it.

**Mobile (carEx):**
6. NEW `src/services/NotificationService.ts` (apiClient wrappers).
7. NEW `src/context/NotificationContext.tsx` (mirror Cart/Favorites; auto-clear on uid change). MODIFIED `App.tsx` provider insertion + routes.
8. NEW screens: `NotificationsScreen`, `NotificationSettingsScreen` (+ optional subscriptions screen). NEW `NotificationBell` component in header.
9. MODIFIED `CarDetailsScreen` (Watch button), `HomeScreenV2`/`SearchResultsV2`/`FilterModal` (Save-search action), `navigation.ts` (routes).
10. MODIFIED `LanguageContext.tsx` (persist language to backend + AsyncStorage). NEW/extended RU/EN keys in `src/constants/translations.ts` + backend `translations.js` (parity).

**Exit criteria:** fully usable in-app notification center; subscriptions create rows; events write Notification rows; feed + badge work. No push yet (stub).

### Phase 13 — FCM push transport (native, RN 0.83 compat-gated)
1. **GATE FIRST:** verify a `react-native-firebase` version supports RN 0.83 before installing (spec risk, lines 170–172). Fallback: pin version, or bare FCM + `notifee`. This is a research/spike sub-task, not assumed.
2. Native config: react-native-firebase install, `pod install`, gradle, iOS push entitlement, APNs auth key uploaded to Firebase console (ops, one-time). Reuses the existing `carex-market` Firebase project.
3. Backend: implement `src/notifications/push/fcm.js` — FCM HTTP v1 send signed with the service-account JWT. **Reuse `firebase-admin@13.8.0`** (already installed for `verifyIdToken`, server.js:17) for credential loading / JWT minting even though the send itself stays REST. Wire it into `notificationService.emit` (replace the Phase 12 stub for instant rows).
4. Mobile: MODIFIED `AuthContext.tsx` — device-token register on login/signup, refresh on `onTokenRefresh`, unregister on logout (token captured before idToken clear). NEW `useDeviceToken` hook or inline. Contextual permission prompt on first Watch / Save-search tap.

**Exit criteria:** closed-app push for instant events (watch + instant saved searches).

### Phase 14 — Daily digest cadence
1. Backend: NEW `src/notifications/digest.js` cron worker. **Railway worker-model decision (spec open item, line 178):** run `node-cron` in-process inside the Express process, gated by `require.main === module` so tests don't start it (mirror the `app.listen` guard, server.js:1413). A separate Railway service is overkill at this scale and complicates the single-repo deploy. Add `node-cron` as a backend dependency.
2. Per-subscription cadence plumbing: `Subscription.cadence` already in the model (Phase 12); the digest worker reads `Notification` rows with `digestPending: true`, groups by uid, renders one localized digest via `translations.js` (`digest_title` with `{count}`), sends via `fcm.js`, then `updateMany` clears the flag.
3. Mobile: enable the instant/daily cadence selector in `NotificationSettingsScreen` (UI shipped disabled in Phase 12).

**Exit criteria:** daily digest push aggregates the day's saved-search matches into one notification.

### Data-flow (end state)
```
Seller/admin write (POST/PUT/PATCH cars, confirmBooking, editListing)
   └─ AFTER commit → notificationService.emit(event)
        ├─ resolveTargets: query Subscription (indexed) — exclude actorUid
        ├─ visibility guard: re-read Car WITHOUT bypass flags → suppress if hidden
        ├─ writeRows: Notification.insertMany (digestPending per cadence)
        └─ dispatch instant → DeviceToken lookup → fcm.send (HTTP v1)   [Phase 13]
node-cron (daily) → Notification{digestPending:true} → group by uid → fcm.send → clear flags   [Phase 14]

Mobile: NotificationContext (auto-clear on uid) ← GET /api/notifications feed + unread-count
        bell badge ← unreadCount; tap item → deeplink (existing linking) → CarDetails
        in-app render: titleKey/bodyKey via useLanguage().t (same keys as backend map)
```

---

## New vs Modified Files

### Backend (`backend-services/carEx-services`)

**NEW:**
- `src/models/DeviceToken.js`
- `src/models/Subscription.js`
- `src/models/Notification.js`
- `src/notifications/notificationService.js`
- `src/notifications/matchSavedSearches.js`
- `src/notifications/translations.js`
- `src/notifications/router.js` (`/api/notifications/*`)
- `src/notifications/push/fcm.js` (Phase 13)
- `src/notifications/digest.js` (Phase 14)
- `src/notifications/__tests__/*` (mirror `src/moderation/__tests__`)

**MODIFIED:**
- `server.js` — require new models; mount `/api/notifications` router; add `emit` calls in `POST /api/cars` (~872), `PUT /api/cars/:id` (~968), `PATCH /api/cars/:id/status` (~472); extend `PUT /api/users/:uid` (~512) for `language`; start cron under `require.main === module` (Phase 14).
- `src/payments/confirmBooking.js` — post-commit `emit('booked')` after line 301.
- `src/moderation/listingService.js` — post-commit `emit('price_drop')` in `editListing` after line 378.
- `src/models/User.js` — add `language` field.
- `package.json` — add `node-cron` (Phase 14); possibly `react-native-firebase` is mobile-only (no backend dep — send is REST via existing `firebase-admin`).

### Mobile (`carEx`)

**NEW:**
- `src/services/NotificationService.ts`
- `src/context/NotificationContext.tsx`
- `src/screens/NotificationsScreen.tsx`
- `src/screens/NotificationSettingsScreen.tsx`
- `src/components/NotificationBell.tsx`
- (Phase 13) `src/hooks/useDeviceToken.ts` (or inline in AuthContext)

**MODIFIED:**
- `App.tsx` — insert `NotificationProvider` (after FavoritesProvider); register 2–3 new `<Stack.Screen>`; optional `notifications` linking entry.
- `src/types/navigation.ts` — add `Notifications`, `NotificationSettings` (+ optional subscriptions) routes.
- `src/context/AuthContext.tsx` (Phase 13) — device-token register/refresh/unregister in login/signup/logout/loadStorageData.
- `src/context/LanguageContext.tsx` — persist language to backend (`NotificationService.setLanguage`) + AsyncStorage.
- `src/screens/CarDetailsScreen.tsx` — Watch button.
- `src/screens/HomeScreenV2.tsx`, `src/screens/SearchResultsV2.tsx`, `src/components/FilterModal.tsx` — Save-search action.
- `src/constants/translations.ts` — new RU/EN notification keys (parity-enforced).
- `package.json` (Phase 13) — `react-native-firebase` (RN 0.83 compat-gated). iOS `Podfile`/entitlements + Android gradle config (Phase 13 native wiring).

---

## Confidence & Open Items

| Area | Confidence | Note |
|---|---|---|
| Data model + indexing | HIGH | Verified against actual Car/User schemas + existing index style |
| Hook placement | HIGH | Read every target handler; line numbers verified |
| post-save vs explicit | HIGH | Codebase has zero side-effect hooks; transaction-retry hazard is concrete |
| Hide-hook respect | HIGH | Verified both `pre(/^find/)` hooks + bypass-flag inversion |
| Mobile context/lifecycle | HIGH | CartContext/FavoritesContext/AuthContext patterns read directly |
| i18n persistence | HIGH | Confirmed `User.language` absent + LanguageContext non-persistent |
| FCM + RN 0.83 | LOW (spec risk) | Must spike react-native-firebase RN 0.83 support in Phase 13 before install — DO NOT assume |
| Railway cron model | MEDIUM | Recommend in-process node-cron under require.main guard; confirm Railway single-process is acceptable for ops |

**Open items for planners:**
- Spike react-native-firebase ↔ RN 0.83 compatibility as the first Phase 13 task (gating).
- Decide whether subscription management is its own screen or folded into NotificationSettings (UX phase).
- Bell placement vs existing header crowding (PROJECT.md captured UX concern).
- Watch (server subscription) vs Favorite (local heart) visual disambiguation on CarDetails.
- Confirm the `/api/notifications` auth posture: per-user `attachAuthIfPresent` + uid-scoping (NOT requireAdmin) — endpoints must never let a user read another uid's notifications (enforce uid from the verified token, not the request body).

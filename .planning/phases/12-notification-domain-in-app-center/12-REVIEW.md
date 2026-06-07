---
phase: 12-notification-domain-in-app-center
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - App.tsx
  - src/components/BottomBar.tsx
  - src/components/MoreMenu.tsx
  - src/components/notifications/NotificationBadge.tsx
  - src/components/notifications/NotificationFeedItem.tsx
  - src/components/notifications/SaveSearchBar.tsx
  - src/components/notifications/WatchButton.tsx
  - src/constants/translations.ts
  - src/context/LanguageContext.tsx
  - src/context/NotificationContext.tsx
  - src/screens/CarDetailsScreen.tsx
  - src/screens/NotificationSettingsScreen.tsx
  - src/screens/NotificationsScreen.tsx
  - src/screens/ProfileScreen.tsx
  - src/screens/SearchResultsV2.tsx
  - src/services/notifications/NotificationService.ts
  - src/types/navigation.ts
  - backend-services/carEx-services/server.js
  - backend-services/carEx-services/src/models/DeviceToken.js
  - backend-services/carEx-services/src/models/Notification.js
  - backend-services/carEx-services/src/models/Subscription.js
  - backend-services/carEx-services/src/models/User.js
  - backend-services/carEx-services/src/moderation/listingService.js
  - backend-services/carEx-services/src/notifications/matchSavedSearches.js
  - backend-services/carEx-services/src/notifications/notificationService.js
  - backend-services/carEx-services/src/notifications/push/fcm.js
  - backend-services/carEx-services/src/notifications/router.js
  - backend-services/carEx-services/src/notifications/schemas.js
  - backend-services/carEx-services/src/notifications/translations.js
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 23 (mobile + backend sibling repo)
**Status:** issues_found

## Summary

Phase 12 wires an in-app notification domain across both repos: a per-user
notification feed + subscription CRUD on the backend (IDOR-safe, token-derived
uid), watch/save-search UI on mobile, and post-commit `emit()` hooks on listing
create/edit/status/booking. The security invariants the phase claims mostly hold:
the router never trusts body/param uid (every filter is `{ uid: req.auth.uid }`),
emit() re-reads with the plain hide-hook, excludes the actor, and dedups on
`${carId}:${eventType}`; the language PUT is enum-guarded. Subscription
criteria are stored as ObjectId in the model. The IDOR / actor-exclusion /
TOCTOU plumbing is sound.

However, there are **three end-to-end contract breaks that make the user-facing
notification center non-functional as shipped**:

1. The feed list cannot render any meaningful title/body — the mobile
   translation keys the rows reference (`new_match`, `price_drop`, etc.) do not
   exist on the mobile side, and `params` are never interpolated. Every row
   collapses to a generic "Уведомления" header with no body.
2. `listSubscriptions()` always returns `[]` because the router returns
   `{ items: [...] }` but the client only accepts a bare array. The settings
   screen's saved-search / watched-car lists are permanently empty.
3. The saved-search deep link round-trips through canonical keys
   (`makeId`/`priceMin`) that `useHomeListings` does not understand — it keys on
   RU labels (`'Цена'`/`'Год'`) and `selectedMake`/`selectedModel`. A new_match
   notification tap lands on an unfiltered results screen.

Plus six warnings (badge never populates before the center is opened; match-all
saved searches from silently-dropped filters; etc.).

## Critical Issues

### CR-01: Feed rows render no title/body — mobile is missing the notification copy keys and never interpolates params

**File:** `src/components/notifications/NotificationFeedItem.tsx:80-84`, `src/constants/translations.ts` (RU ~1003-1030, EN ~2046-2073)
**Issue:** The backend writes Notification rows with `titleKey`/`bodyKey` set to
`new_match` / `price_drop` / `booked` / `sold` / `back_available`
(`notificationService.js:53-59`) and **no** literal `title`/`body` fields
(`Notification.js:20-36` has none). `NotificationFeedItem` resolves
`(titleKey && t[titleKey]) || notification.title || t.notifications`. The mobile
translations object has **no keys** named `new_match`/`price_drop`/`booked`/`sold`/
`back_available` (grep confirms only the UI-chrome keys exist). So `t[titleKey]`
is `undefined`, `notification.title` is `undefined`, and every row falls through
to `t.notifications` ("Уведомления") with an empty body. Additionally, the
backend stores interpolation `params` (`makeModel`, `price`, `oldPrice`,
`newPrice`) but the mobile side has no `interpolate`/`render` helper, so even if
the keys existed the `{makeModel}`/`{price}` tokens would render literally.
The localized backend copy in `src/notifications/translations.js` is never
reachable from the in-app feed (it's only wired for the Phase 13 push payload).
Net effect: the notification center shows N identical generic rows.
**Fix:** Add the five message keys to BOTH mobile RU/EN translation blocks as
template strings (mirroring `src/notifications/translations.js`) and add a
mobile interpolation step before render, e.g.:
```ts
// translations.ts (RU)
notif_new_match_title: 'Новый вариант по вашему поиску',
notif_new_match_body: '{makeModel} — {price}. Посмотрите, пока не уехало.',
notif_price_drop_title: 'Цена упала',
notif_price_drop_body: '{makeModel} теперь {newPrice} (было {oldPrice}).',
// ...booked / sold / back_available

// NotificationFeedItem.tsx
const interp = (tpl?: string) =>
  (tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => String(notification.params?.[k] ?? ''));
const title = interp(t[`notif_${titleKey}_title`]) || t.notifications;
const body  = interp(t[`notif_${bodyKey}_body`]);
```
(Also add `params?: Record<string, unknown>` to `NotificationItem`.) Decide a
single canonical key namespace and keep backend/mobile in lockstep.

### CR-02: `listSubscriptions()` always returns `[]` — settings lists are permanently empty (client/router shape mismatch)

**File:** `src/services/notifications/NotificationService.ts:192-200`; `backend-services/carEx-services/src/notifications/router.js:231-242`
**Issue:** The router responds `res.status(200).json({ items })` (router.js:238).
The mobile client does `return Array.isArray(response.data) ? response.data : []`
(NotificationService.ts:195). `response.data` is the object `{ items: [...] }`,
which is **not** an array, so the guard always returns `[]`. Every other GET in
this client unwraps the envelope (`getFeed` reads `data.items`), but
`listSubscriptions` does not. `NotificationSettingsScreen` therefore always shows
empty "My saved searches" and "My watched cars" lists even after the user has
created subscriptions, and delete/edit are unreachable. (Note the feed GET uses
`{ items, nextCursor }` and `getFeed` correctly reads `data.items` — only the
subscriptions reader is wrong.)
**Fix:** Unwrap the envelope to match the router:
```ts
listSubscriptions: async (): Promise<Subscription[]> => {
  try {
    const response = await apiClient.get('/api/notifications/subscriptions');
    const items = response.data?.items;
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('Failed to list subscriptions', error);
    throw error;
  }
},
```

### CR-03: Saved-search deep link does not restore filters — new_match tap lands on an unfiltered results screen

**File:** `src/screens/NotificationsScreen.tsx:101-131`; consumed by `src/hooks/useHomeListings.ts:25` / `src/screens/SearchResultsV2.tsx:57-67`
**Issue:** The backend builds `carex://search?makeId=...&priceMin=...&yearMin=...&bodyType=...`
(`notificationService.js:79-89`, canonical keys). `routeNotification` parses those
canonical keys into `initialFilters` (`makeId`, `priceMin`, `yearMin`, `bodyType`,
NotificationsScreen.tsx:43-49,107-122) and navigates `SearchResults` with them.
But `useHomeListings` seeds `activeFilters` **verbatim** from `opts.initialFilters`
(useHomeListings.ts:25) and its filter predicate keys on **RU labels**
(`activeFilters['Цена']`, `activeFilters['Год']`) and on `selectedMake`/
`selectedModel` refs (useHomeListings.ts:69-90) — never on `makeId`/`priceMin`/
`yearMin`. Nothing seeds `selectedMake`/`selectedModel` from `initialFilters`
either. So the restored filters are inert: a new_match notification tap opens an
effectively unfiltered results list, breaking NCEN-03's core promise. (The same
canonical-vs-RU-label mismatch means SaveSearchBar's `buildCriteria` correctly
produces canonical criteria for the backend, but the *return trip* cannot be
consumed.)
**Fix:** Make the round-trip use one vocabulary. Either (a) have
`routeNotification` reconstruct the RU-label `activeFilters` shape and a
`selectedMake`/`selectedModel`/`selectedCategory` seed that `useHomeListings`
understands, or (b) add a canonical→internal adapter inside `useHomeListings`
when `initialFilters` arrives with canonical keys. Add a round-trip test:
`buildCriteria(...)` → `buildSearchDeeplink(...)` → `routeNotification(...)` →
asserts the resulting filters actually narrow `filteredCars`.

## Warnings

### WR-01: Unread badge never appears until the user opens the notification center

**File:** `src/context/NotificationContext.tsx:83-101`; `src/screens/NotificationsScreen.tsx:157-159`
**Issue:** `unreadCount` starts at 0 and is only updated by `refresh()`, which is
called solely from `NotificationsScreen`'s mount effect. Nothing fetches the
count on login, on app foreground, or on provider mount. The BottomBar dot
(BottomBar.tsx:38-42) and MoreMenu "9+" bubble (MoreMenu.tsx:90-96) both derive
from `unreadCount`, so they stay invisible until the user has already navigated
into the center — defeating NCEN-01 (the badge is supposed to be the *entry*
signal). After `markAllRead` inside the center it works, but a freshly launched
app with unread notifications shows a clean badge.
**Fix:** Trigger a lightweight `getUnreadCount` on login and on app foreground.
Add an effect in `NotificationProvider` keyed on `user?.localId` (fetch count
when a uid is present), and optionally hook `useAppStateRefresh` so foreground
transitions refresh the count.

### WR-02: Save-search with only unmapped filters silently creates a match-everything subscription

**File:** `src/components/notifications/SaveSearchBar.tsx:67-100`
**Issue:** `buildCriteria` only maps `'Цена'` (price), `'Год'` (year), makeId,
modelId, and bodyType. The other live filters — `'Пробег'` (mileage),
`'Топливо'` (fuel), `'КПП'` (transmission) — are not mapped and are dropped.
`hasActiveFilters` returns true when any of those is set, so the bar shows and
the user taps Save, but `buildCriteria` returns `{}` (all keys stripped at
line 85-87). The backend `criteriaSchema` is `.strict()` with all-optional
fields, so `{}` is accepted and creates a saved_search whose criteria matches
**every** new listing (`carSatisfiesCriteria` treats every null bound as a
wildcard, matchSavedSearches.js:54-74). The user silently subscribes to all
inventory and gets a new_match notification for every listing — the opposite of
their intent, and a notification-spam vector.
**Fix:** Either (a) map the missing filters into criteria fields the backend
supports, or (b) guard against empty criteria: if `Object.keys(criteria).length
=== 0`, do not POST and surface a "no saveable filters" message. At minimum the
backend should reject an empty `criteria` for `saved_search` (require at least
one constraint) so a match-all subscription can't be created.

### WR-03: WatchButton always renders "Watch" even when the car is already watched

**File:** `src/components/notifications/WatchButton.tsx:58-83`
**Issue:** `watching` is seeded `useState(false)` with no initial fetch of
existing subscriptions, so every time CarDetails mounts the pill shows "Watch"
(inactive) regardless of whether the user already has an active watch on this
car. Tapping again POSTs a second `kind:'watch'` subscription — the router has
no idempotency/uniqueness guard (router.js:205-228 just `Subscription.create`),
so duplicate watch rows accumulate for the same `(uid, carId)`. The settings
screen will then list the same watched car multiple times. (Dedup at emit time
prevents duplicate *notifications*, but not duplicate *subscriptions*.)
**Fix:** On mount, resolve initial watch state from `listSubscriptions()` (or a
lightweight per-car check) and seed `watching` accordingly; disable the button
when already watching. Add a unique index `{ uid, kind, carId }` (partial, for
kind:'watch') on Subscription and have POST upsert rather than blindly create.

### WR-04: `summarizeCriteria` shows raw ObjectId strings for make/model

**File:** `src/screens/NotificationSettingsScreen.tsx:70-86`
**Issue:** `summarizeCriteria` pushes `criteria.makeId ?? criteria.make`. Since
saved searches now store `makeId`/`modelId` as 24-hex ObjectId strings (and
`make`/`model` name fields are never written), the saved-search row summary
renders an opaque ObjectId like `665f...e2a1` instead of a human make/model.
Similarly the watched-cars list renders the raw `sub.carId`
(NotificationSettingsScreen.tsx:415). Cosmetic but user-facing — the lists are
unreadable. (Compounds CR-02: once the lists actually populate, this becomes
visible.)
**Fix:** Resolve make/model names via the existing vehicle catalog
(`useVehicleCatalog`) for display, or have the backend include denormalized
`makeName`/`modelName` on the subscription document / list response.

### WR-05: `persistPrefs` merges onto a stale `prefs` snapshot, dropping concurrent toggles

**File:** `src/screens/NotificationSettingsScreen.tsx:96, 131-147, 149-179`
**Issue:** `prefs` is recomputed each render from `user?.notificationPrefs`, and
`persistPrefs` closes over it: `const merged = { ...prefs, ...patch }`. Because
each toggle updates local state and fires `persistPrefs` (which PUTs `merged`
then calls `refreshUser()` async), two quick toggles can both read the same
pre-refresh `prefs` baseline. The second PUT overwrites with a `merged` that
lacks the first toggle's change (it merged onto the old server snapshot, not the
just-written value). The local Switch state is correct, but the persisted
`notificationPrefs` can lose a field until the next full refresh, and the
optimistic local state and server can diverge.
**Fix:** Track the working prefs in a single state object and merge patches onto
the latest local state (functional update), e.g. keep
`const [prefsState, setPrefsState] = useState(prefs)` and
`setPrefsState(prev => { const merged = { ...prev, ...patch }; persist(merged); return merged; })`,
rather than merging onto the render-time `prefs` snapshot.

### WR-06: Mobile `Subscription`/`NotificationItem` types drift from the backend documents

**File:** `src/services/notifications/NotificationService.ts:62-112`
**Issue:** `NotificationItem` declares `title?`/`body?` but the backend Notification
document has `titleKey`/`bodyKey`/`params` and never `title`/`body`
(Notification.js:20-36) — the feed item only reaches those via `as any` casts
(NotificationFeedItem.tsx:80-81), which hid CR-01 from the type checker.
`Subscription` declares `active: boolean` and `createdAt` but the list payload is
wrapped in `{ items }` (CR-02), and `events`/`carId`/`criteria` optionality does
not match the model defaults. The `NotificationEvent` union also carries dead
`back_in_stock`/`new_photos` spellings the backend `eventEnum` never emits.
**Fix:** Align the mobile interfaces with the actual document shape: add
`titleKey`/`bodyKey`/`params` to `NotificationItem`, type the list response as
`{ items: Subscription[] }`, and drop the unused event spellings (or document
them as legacy-only). Removing the `as any` casts will surface CR-01 at compile
time.

## Info

### IN-01: Double `booked` emit path (status PATCH + confirm-booking)

**File:** `backend-services/carEx-services/server.js:487, 1305-1322`
**Issue:** A `booked` notification can be emitted from both the
`PATCH /api/cars/:id/status` handler (listingStatus→booked) and the
`POST /api/payments/confirm-booking` handler. emit's dedup on
`${carId}:booked` collapses duplicate *unread* rows, so this is currently
harmless, but the dual trigger is non-obvious and a future change to the dedup
key would resurface it.
**Fix:** Document the dual-source intent at one of the call sites, or consolidate
the booked emit into the booking flow only.

### IN-02: `back_available` emit relies on `listingStatus` but emit visibility-gates on moderation `status`

**File:** `backend-services/carEx-services/server.js:475-495`; `src/notifications/notificationService.js:167-168`
**Issue:** The status handler computes `notifyType` from `listingStatus`
transitions, while emit() suppresses on the *moderation* `status !== 'active'`
(Car.js has two independent status fields). This is correct today (the
hide-hook re-read is meant to gate on moderation state), but the two-status
overload is a documented footgun (Car.js:1-3) and worth a one-line comment at
the emit call site clarifying which `status` gates what.
**Fix:** Add a comment noting that lifecycle (`listingStatus`) drives the event
type while moderation (`status`) drives emit suppression.

### IN-03: `getFeed` cursor pagination duplicates the boundary row if createdAt timestamps collide across pages

**File:** `backend-services/carEx-services/src/notifications/router.js:110-127`
**Issue:** The cursor uses strict `$lt` on `(createdAt, _id)` which is correct,
but `encodeCursor` requires `item.createdAt`/`item._id` to be present on the
`.lean()` row. Rows are fine in production; the note is that `loadMore` in
`NotificationContext.tsx:103-114` appends without de-duplicating `_id`, so any
future cursor regression would surface as duplicate feed rows (FlatList keyed on
`_id` would then warn on duplicate keys).
**Fix:** Optional defensive de-dupe in `loadMore` (`setFeed(prev => uniqBy([...prev, ...items], '_id'))`).

### IN-04: Daily-cap / quiet-hours are persisted but inert (plumbing only)

**File:** `src/screens/NotificationSettingsScreen.tsx:104-106, 320-358`
**Issue:** Quiet-hours start/end are read-only display (no editor wired — only a
static label) and `dailyCap` is selectable and persisted but never enforced
(Phase 14). This is intentional per the plan (D-16 plumbing), but the UI gives
no signal that these controls do nothing yet, which can read as a bug to QA.
**Fix:** Add a small "coming soon"/"not yet active" hint near the quiet-hours
and daily-cap controls (consistent with the Daily cadence coming-soon treatment).

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

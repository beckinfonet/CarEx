# Phase 12: Notification Domain + In-App Center - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 27 (13 backend, 14 mobile)
**Analogs found:** 25 with strong/role match / 27 total

> **Split-repo phase.** Backend files live in the sibling repo
> `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`.
> Mobile files live in this repo. Paths below are tagged **[BE]** or **[MOB]**.
> All backend analogs are in `src/moderation/` (the house service-split pattern);
> all mobile analogs are existing context/service/screen/component files.

---

## File Classification

### Backend (sibling repo `carEx-services`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `src/models/Notification.js` | model | CRUD | `src/models/Car.js` / `User.js` | exact |
| `src/models/Subscription.js` | model | CRUD | `src/models/User.js` | exact |
| `src/models/DeviceToken.js` | model | CRUD | `src/models/User.js` | exact (define now, populate Phase 13 — RESEARCH OQ#1) |
| `src/notifications/router.js` | route | request-response + cursor feed | `src/moderation/router.js` | exact |
| `src/notifications/schemas.js` | config (validation) | transform | `src/moderation/schemas.js` | exact |
| `src/notifications/notificationService.js` | service | event-driven (emit after commit) | `src/moderation/service.js` | role-match |
| `src/notifications/matchSavedSearches.js` | utility | transform (pure) | `src/moderation/capabilities.js` | role-match (pure module) |
| `src/notifications/translations.js` | config | transform | (new; parity test mirrors mobile) | no analog |
| `src/notifications/push/fcm.js` | service | event-driven (no-op stub) | — | no analog (trivial stub) |
| `server.js` (PUT `/api/users/:uid` + `language`) | route | CRUD | self `server.js:512-531` | exact (in-place edit) |
| `server.js` (6 emit trigger points) | route | event-driven | self handlers `:459/:512/:778/:886/:1223` | exact (in-place edit) |
| `src/models/User.js` (+ `language`, +`notificationPrefs`) | model | CRUD | self `User.js:3-29` | exact (in-place edit) |
| `__tests__/notification-translations-parity.test.js` | test | — | mobile `__tests__/translation-parity.test.ts` | role-match (cross-repo) |

### Mobile (this repo)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `src/services/notifications/NotificationService.ts` | service | request-response | `src/services/moderation/ModerationService.ts` | exact |
| `src/context/NotificationContext.tsx` | provider/context | request-response (server-backed) | `src/context/FavoritesContext.tsx` | exact (auto-clear) |
| `src/screens/NotificationsScreen.tsx` | screen | request-response (cursor feed) | (feed-list screens; AdminModerationScreen) | role-match |
| `src/screens/NotificationSettingsScreen.tsx` | screen | CRUD | `src/screens/ProfileScreen.tsx` (menu-row groups) | role-match |
| `src/components/notifications/WatchButton.tsx` | component | request-response | `src/components/BottomBar.tsx` (active pill) | role-match |
| `src/components/notifications/SaveSearchBar.tsx` | component | request-response | `src/components/BottomBar.tsx` / MoreMenu CTA | role-match |
| `src/components/notifications/NotificationBadge.tsx` | component | (presentational) | — | no analog (trivial) |
| `src/components/notifications/NotificationFeedItem.tsx` | component | (presentational) | feed row patterns | role-match |
| `src/context/LanguageContext.tsx` (+ persistence) | provider/context | CRUD | self + `FavoritesContext.tsx` hydrate | exact (in-place edit) |
| `src/components/MoreMenu.tsx` (+ Notifications item + count) | component | request-response | self `MoreMenu.tsx:31-89` | exact (in-place edit) |
| `src/components/BottomBar.tsx` (+ red dot) | component | (presentational) | self `BottomBar.tsx:29-35` | exact (in-place edit) |
| `src/screens/ProfileScreen.tsx` (+ settings row) | screen | navigation | self `ProfileScreen.tsx:141-150` | exact (in-place edit) |
| `App.tsx` (provider + screens) | config/entry | — | self `App.tsx:89-144` | exact (in-place edit) |
| `src/types/navigation.ts` (+ 2 routes) | config | — | self `navigation.ts:1-26` | exact (in-place edit) |
| `src/constants/translations.ts` (+ keys) | config | transform | self (RU/EN parallel) | exact (in-place edit) |

---

## Shared Patterns (cross-cutting — apply to all relevant plans)

### S1. Base64 `{createdAt,_id}` cursor — **copy VERBATIM** [BE]
**Source:** `src/moderation/router.js:27-45` + query at `:233-254`
**Apply to:** `notifications/router.js` feed endpoint (NCEN-02).
```js
function encodeCursor(item) {
  if (!item) return null;
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt.toISOString(), _id: item._id.toString() }),
    'utf8',
  ).toString('base64');
}
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.createdAt || !parsed._id) throw new Error('missing fields');
    return { createdAt: new Date(parsed.createdAt), _id: parsed._id };
  } catch (_err) { return undefined; } // sentinel → 400 invalid_cursor
}
// query (verbatim shape):
const query = { uid };                       // ← uid from req.auth.uid, NOT targetUid
if (cursor) query.$or = [
  { createdAt: { $lt: cursor.createdAt } },
  { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
];
const rows = await Notification.find(query)
  .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
const hasMore = rows.length > limit;
const items = hasMore ? rows.slice(0, limit) : rows;
const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;
return res.status(200).json({ items, nextCursor });
```
> Note the limit clamp at `router.js:223-226`: `Math.min(Math.max(rawLimit,1),100)`, default 25.

### S2. Router auth mount — uid from TOKEN, NOT admin-gated [BE]
**Source:** `server.js:988` (contrast) + `src/security/verifyIdToken.js`
**Apply to:** notification router mount (NDOM-05).
```js
// server.js — INVERT the moderation mount: drop requireAdmin.
app.use('/api/notifications', verifyIdToken, notificationRouter);
// verifyIdToken attaches req.auth = { uid, email, claims } (verifyIdToken.js:31).
// Inside router: const uid = req.auth.uid;   // NEVER req.body.uid / req.params.uid (V4 IDOR)
```
Every notification/subscription read+write **must** filter by `req.auth.uid`. The moderation router reads `req.admin.uid` (added by `requireAdmin`); the notification router has no `req.admin` — use `req.auth.uid`.

### S3. Zod `.strict()` schemas + enum lockstep [BE]
**Source:** `src/moderation/schemas.js:8-95`
**Apply to:** `notifications/schemas.js` (subscription create/edit, mark-read, prefs). Mirror the enum-in-lockstep-with-Mongoose convention and `discriminatedUnion` for the saved_search/watch split.
```js
const { z } = require('zod');
const kindEnum = z.enum(['saved_search', 'watch']);            // lockstep w/ Subscription.js
const cadenceEnum = z.enum(['instant', 'daily']);
const eventEnum = z.enum(['price_drop', 'booked', 'sold', 'back_available']);
const criteriaSchema = z.object({
  makeId: z.string().optional(), modelId: z.string().optional(),
  priceMin: z.number().int().optional(), priceMax: z.number().int().optional(),
  yearMin: z.number().int().optional(), yearMax: z.number().int().optional(),
  bodyType: z.string().optional(),
}).strict();
// discriminatedUnion('kind', [savedSearchSchema, watchSchema]) — see moderation dispatchSchema:33
```
Router-layer `.strict()` rejection → convert `unrecognized_keys` issue to a named 400 envelope exactly as `router.js:189-197`.

### S4. Router service-error translation table [BE]
**Source:** `src/moderation/router.js:59-84` (`KNOWN_USER_ERRORS` set + `handleServiceError`)
**Apply to:** notification router — pre-register a `KNOWN_USER_ERRORS` set (`subscription_not_found`, `invalid_cursor`, `not_owner`, …); unknown → 500 `internal_error`. Copy the `handleServiceError(err, res, tag)` shape verbatim.

### S5. Mobile service split via shared `apiClient` — **NOT AuthService** [MOB]
**Source:** `src/services/moderation/ModerationService.ts:8-21, 311-462`
**Apply to:** `NotificationService.ts`. Object export, thin verb+path+body wrappers over `apiClient` (`../http/client`), try/catch → `console.error` + re-throw. `apiClient` already injects Bearer idToken (request interceptor `client.ts:88-95`) and normalizes 401/403 (response interceptors `client.ts:98-183`). **DELETE with body uses `config.data`** (see `deleteProviderProfile:383-399`). Abort-suppression helper `isAbortError` (`:35-39`) for any signal-accepting reads (the feed `loadMore`).
```ts
import { apiClient } from '../http/client';
export const NotificationService = {
  getFeed: async (cursor?: string, config?: { signal?: AbortSignal }) => {
    try {
      const res = await apiClient.get('/api/notifications', { params: { cursor }, signal: config?.signal });
      return res.data; // { items, nextCursor }
    } catch (e) { if (isAbortError(e)) throw e; console.error('Failed to load feed', e); throw e; }
  },
  getUnreadCount: async () => (await apiClient.get('/api/notifications/unread-count')).data,
  markRead: async (id: string) => (await apiClient.patch(`/api/notifications/${id}/read`)).data,
  markAllRead: async () => (await apiClient.patch('/api/notifications/read-all')).data,
  createSubscription: async (body) => (await apiClient.post('/api/notifications/subscriptions', body)).data,
  deleteSubscription: async (id: string) => (await apiClient.delete(`/api/notifications/subscriptions/${id}`)).data,
  // ...
};
```
> **MOB-01 guardrail (CLAUDE.md):** `grep -c 'notification\|subscription\|watch' src/services/AuthService.ts` stays 0. Do not bolt onto AuthService.

### S6. Mobile context auto-clear on uid change [MOB]
**Source:** `src/context/FavoritesContext.tsx:28-63`
**Apply to:** `NotificationContext.tsx`. Use the `prevUidRef` skip-on-mount sentinel to clear unread/feed cache on user switch. Provider must `useAuth()`, so place it AFTER `FavoritesProvider` in `App.tsx`.
```tsx
const { user } = useAuth();
const prevUidRef = useRef<string | null>(null);
useEffect(() => {
  const currentUid = user?.localId || null;
  if (prevUidRef.current !== null && prevUidRef.current !== currentUid) {
    setUnreadCount(0); setFeed([]);   // clear server-backed cache on user switch
  }
  prevUidRef.current = currentUid;
}, [user?.localId]);
```

### S7. RU/EN parity test harness [BOTH]
**Source (mobile):** `__tests__/translation-parity.test.ts` (set-equality, non-empty leaf, no TODO/FIXME)
**Apply to:** (a) mobile new keys auto-covered by extending `src/constants/translations.ts` in parallel RU/EN; (b) NEW backend `__tests__/notification-translations-parity.test.js` mirroring this — set-equality + placeholder-token parity + assert KGS som (NI18N-03). Use set-equality, **not** a hardcoded key count.

### S8. Theme tokens — no hardcoded hex [MOB]
**Source:** `src/constants/theme.ts` (`COLORS`, `SIZES`, `TYPOGRAPHY`) + UI-SPEC color table.
**Apply to:** every new component/screen. Red dot = `COLORS.destructive` `#EF4444`; accent (Watch pill, count badge, SaveSearchBar, unread indicator, selected cadence) = `COLORS.accent` `#3B82F6`; Watch active fill `rgba(59,130,246,0.1)` (mirrors `BottomBar.activeButton:68-70`). `minTapTarget` 44px on every interactive control.

---

## Pattern Assignments

### [BE] `src/models/Notification.js` (model, CRUD)
**Analog:** `src/models/User.js:1-34` / `Car.js:5-56` (schema → `.index()` calls → `module.exports = mongoose.model(...)`)
- Store `titleKey/bodyKey/params` (KEYS not rendered text). Indexes per RESEARCH §Data Model: `{uid,createdAt}` (feed), `{uid,read}` (unread count), `{digestPending}` (Phase 14), `dedupeKey`. `createdAt` index also serves 90-day prune (NDOM-06).
- `dedupeKey: String` = `` `${carId}:${eventType}` `` (NDOM-03 dedup).
**Schema-convention excerpt to copy (`User.js:3-29`):**
```js
const mongoose = require('mongoose');
const schema = new mongoose.Schema({ /* fields */ createdAt: { type: Date, default: Date.now } });
schema.index({ uid: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', schema);
```

### [BE] `src/models/Subscription.js` (model, CRUD)
**Analog:** `User.js` schema conventions; **ObjectId requirement verified against `Car.js:11-12`** (`makeId`/`modelId` are `mongoose.Schema.Types.ObjectId`).
- `criteria.makeId/modelId` MUST be `ObjectId` (NDOM-04 / Pitfall 5) to match `Car.makeId/modelId`.
- `kind` enum lockstep with `schemas.js` `kindEnum`; `cadence` default `'instant'`; `events: [String]` (all 4 on watch create, D-03); `active: Boolean default true`.
- Indexes: `{kind,active,'criteria.makeId','criteria.modelId'}` (match), `{kind,carId,active}` (watch lookup), `{uid,active}` (manage).

### [BE] `src/models/DeviceToken.js` (model, CRUD)
**Analog:** `User.js`. Define model + `{uid:1}` index now (satisfies NDOM-01 literally); leave unpopulated until Phase 13 (RESEARCH OQ#1 / A1). `token` UNIQUE globally.

### [BE] `src/notifications/router.js` (route, request-response + cursor)
**Analog:** `src/moderation/router.js` (entire file)
- **Mount:** S2 (uid from token, NOT requireAdmin).
- **Cursor feed:** S1 verbatim, query keyed on `req.auth.uid`.
- **Error table:** S4.
- **Endpoints:** `GET /` (feed), `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`, `POST /subscriptions`, `GET/PATCH/DELETE /subscriptions/:id`.
- **Schema gate per route:** `safeParse` → 400 `invalid_payload` on failure, exactly as `router.js:96-99`.
- **IDOR guard:** every subscription/notification lookup includes `uid: req.auth.uid` in the Mongo filter (ownership enforced server-side; `:id` alone is never trusted).

### [BE] `src/notifications/schemas.js` (validation)
**Analog:** `src/moderation/schemas.js:1-95` → S3.

### [BE] `src/notifications/notificationService.js` (service, event-driven)
**Analog:** `src/moderation/service.js:1-120` for module shape (requires models at top, exported async fns, named `Error` throws). The **emit-after-commit + 3-guard** logic is phase-specific (no exact analog) — assemble from these verified primitives:

**Guard (a) — hide-hook respect by OMITTING bypass flags** (NDOM-03a). Source verified `Car.js:64-121`:
```js
// INVERT the admin pattern: NEVER pass includeAllUsers / includeAllListingStatuses.
const visible = await Car.findById(carId);          // plain findById — BOTH pre(/^find/) hooks apply
if (!visible || visible.status !== 'active') return; // suppress (TOCTOU re-check at emit time)
```
> Every admin/internal read in the codebase ADDS bypass flags (e.g. `setOptions({includeAllListingStatuses:true})`). The notification pipeline must never add them. Document this inversion loudly in the file header.

**Guard (b) — actor-exclusion** (NDOM-03b): drop any subscription where `subscription.uid === event.actorUid`.

**Guard (c) — dedup** (NDOM-03c): `dedupeKey = ` `` `${carId}:${eventType}` `` `; dedup per `(uid, carId, eventType)`.

**Match resolution:** `new_listing` → `matchSavedSearches`; watch events → `Subscription.find({ kind:'watch', carId, active:true })`.

**Optional atomicity** for subscription/notification writes: `session.withTransaction` + array-form create with `{session}` — copy verbatim from `service.js:64-79`:
```js
const session = await mongoose.startSession();
await session.withTransaction(async () => {
  const [row] = await Notification.create([{ /* doc */ }], { session }); // array form for {session}
});
```

### [BE] `src/notifications/matchSavedSearches.js` (pure utility, transform)
**Analog:** `src/moderation/capabilities.js:1-62` (pure module: const policy/table at top, exported pure fns, `module.exports = { ... }`, fully unit-testable — no I/O in the export surface).
- Indexed query against `Subscription` `{kind:'saved_search',active:true,'criteria.makeId','criteria.modelId'}`, then numeric-bound + bodyType filtering (NDOM-04). Off the hot path (Pitfall 8).

### [BE] `src/notifications/translations.js` (config, transform)
**No analog** (new). RU-first map keyed by `titleKey/bodyKey`, interpolating `params`. Currency = KGS som (NI18N-03). Parity-tested by S7(b).

### [BE] `src/notifications/push/fcm.js` (no-op stub)
**No analog.** `module.exports = { send: async () => ({ ok: true, delivered: 0, stub: true }) }` — success-shaped so the instant branch never throws (NPRF-07 / RESEARCH A4). Phase 13 replaces internals.

### [BE] `server.js` — PUT `/api/users/:uid` + `language` (route, in-place edit, NI18N-01)
**Analog:** self `server.js:512-531` (whitelist destructure → conditional `update` build → `findOneAndUpdate`).
```js
// add `language` to the destructure at :514 and the whitelist:
const { firstName, lastName, phoneNumber, telegramUsername, avatarUrl, language } = req.body;
// ...existing conditional assigns...
if (language !== undefined && ['RU','EN'].includes(language)) update.language = language;
// User.js: add  language: { type: String, enum: ['RU','EN'], default: 'RU' }
```

### [BE] `server.js` — 6 emit trigger points (route, in-place edits, NDOM-02)
**Analog:** the existing handlers themselves. Place `await notificationService.emit({...})` AFTER persist. Actor source per RESEARCH §Pattern 3 (VERIFIED):

| Trigger | Handler (verified line) | Actor uid | Capture-before note |
|---------|------------------------|-----------|---------------------|
| new_listing | `POST /api/cars` `:778` | `req.body.sellerId` (or `req.auth.uid` — has `attachAuthIfPresent`) | none |
| price_drop (seller) | `PUT /api/cars/:id` `:886` | `req.body.sellerId` (`:888`) | capture `oldPrice = car.price` BEFORE the field reassignments (~`:895-919`); emit only if `newPrice < oldPrice` |
| booked / back_available | `PATCH /api/cars/:id/status` `:459` | `req.body.sellerId` (`:461`) | capture `old = car.listingStatus` before `:471`; back_available when `old==='booked' && new==='active'` |
| booked (buyer flow) | confirmBooking route `:1223` | `buyerUid` | emit AFTER `await confirmBookingService(...)` returns `{car,orders}` |
| price_drop (admin) | admin `editListing` (`listingService.js:278` `fieldDiff.price`) | `adminUid` | use `fieldDiff.price.{before,after}` |

Example (PUT price-drop, verified context `:886-919`):
```js
const car = await Car.findById(req.params.id);   // existing :891
const oldPrice = car.price;                       // CAPTURE before reassign
// ... existing edit + await car.save() ...
await notificationService.emit({
  type: 'price_drop', carId: car._id.toString(),
  actorUid: req.body.sellerId, oldPrice, newPrice: car.price,
});
```
> **Anti-pattern (verified zero exist):** do NOT use Mongoose post-save hooks — they can't see before-state, fire inside the confirmBooking transaction, and lack actor context.

### [BE] `src/models/User.js` (model edit, NI18N-01 + NPRF-03/04)
**Analog:** self `User.js:3-29`. Add `language` enum field; add `notificationPrefs` subdoc (master mute, category toggles, quietHours {start,end} default 22:00–08:00, dailyCap default 3) following the inline `moderationStatus` subdoc shape at `:19-28` (RESEARCH OQ#2 recommendation / D-16).

### [MOB] `src/services/notifications/NotificationService.ts` (service)
**Analog:** `ModerationService.ts` → S5.

### [MOB] `src/context/NotificationContext.tsx` (provider/context)
**Analog:** `FavoritesContext.tsx` → S6 (auto-clear) + hydrate-on-mount cancellable effect (`:34-53`). Provider/hook export shape with throw-if-outside guard (`:93-97`):
```tsx
export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
};
```
Exposes `unreadCount, feed, loading, refresh, loadMore, markRead, markAllRead` + subscription CRUD passthroughs. Fetch via `NotificationService`.

### [MOB] `src/screens/NotificationsScreen.tsx` (screen, cursor feed)
**Analogs:** `NotificationContext` (data) + cursor pattern S1 (consumed). FlatList reverse-chron, pull-to-refresh, `onEndReached` → `loadMore`, tap → `markRead` + deep-link via existing `linking` (`App.tsx:79-87`, `CarDetails: 'listing/:carId'`, store `data.deeplink`). Empty state (`BellOff`, D-14 copy). "Mark all read" in header. Theme per S8.

### [MOB] `src/screens/NotificationSettingsScreen.tsx` (screen, CRUD)
**Analog:** `ProfileScreen.tsx:141-175` (menu-group `View style={styles.menuContainer}` + rows). Order per D-11: master mute → category toggles → quiet-hours → "My saved searches" list → "My watched cars" list. Inline edit (cadence selector: Instant selected / Daily disabled + "coming soon", D-10) and delete via `Alert.alert` confirm (UI-SPEC destructive table). Switch/toggle = RN `Switch`. KGS-aware strings via `useLanguage().t`.

### [MOB] `src/components/notifications/WatchButton.tsx` (component)
**Analog:** `BottomBar.tsx:25-35` (labeled pill: icon + `Text` in a `TouchableOpacity` with accent border) + active-fill `:68-70`.
- Labeled `Bell` + text ("Отслеживать"/"Watch" inactive, "Вы отслеживаете"/"Watching" active). Accent border + accent icon; active = `rgba(59,130,246,0.1)` fill. NOT a Heart variant (sibling-component discipline, D-01).
- One tap → `createSubscription({ kind:'watch', carId, events:[all 4], cadence:'instant' })` (D-03).
- **Key on `car._id || car.id || carId` — never bare `car.id`** (D-04, project memory `car_id_field_unreliable`).
- Mount on `CarDetailsScreen` below hero, above spec block (D-02), separate from heart (`:612`) and CTA stack (`:787-898`).

### [MOB] `src/components/notifications/SaveSearchBar.tsx` (component)
**Analog:** `BottomBar.tsx` accent pill styling; mounts in `SearchResultsV2` header region (`:115-167`).
- Sticky bar, visible only when filters active. One tap + toast-with-Undo (D-08/D-09), no confirm sheet.
- **Criteria mapping (Pitfall 4 — load-bearing):** `useHomeListings.activeFilters` uses **RU label keys** (verified `useHomeListings.ts:95-111`: `'Год'`, `'Цена'`, `'Пробег'`, `'Топливо'`, `'КПП'`). Map to canonical before POST:
```ts
const criteria = {
  makeId: selectedMake?.id, modelId: selectedModel?.id,   // ObjectId strings
  priceMin: activeFilters['Цена']?.min, priceMax: activeFilters['Цена']?.max,
  yearMin: activeFilters['Год']?.min,   yearMax: activeFilters['Год']?.max,
  bodyType: selectedCategory?.name,
};
await NotificationService.createSubscription({ kind: 'saved_search', criteria, cadence: 'instant' });
```

### [MOB] `src/components/notifications/NotificationBadge.tsx` (presentational)
**No analog** (trivial). Two modes: red dot (`COLORS.destructive`, unread>0) for BottomBar; "9+"-capped count bubble (`COLORS.accent`, `radiusPill`, ~18-22px) for MoreMenu item. Both read `unreadCount` from `useNotifications`.

### [MOB] `src/components/notifications/NotificationFeedItem.tsx` (presentational)
**Analog:** card row patterns (`MoreMenu` grid item / settings rows). Per-category lucide icon (UI-SPEC iconography table). Unread = accent left indicator + 600-weight title (`textPrimary`); read = `textSecondary`. `minTapTarget` 44px.

### [MOB] `src/context/LanguageContext.tsx` (context edit, NI18N-02)
**Analog:** self `:14-24` + `FavoritesContext.tsx:34-53` hydrate pattern. Add: hydrate from AsyncStorage on mount (default `'RU'` when absent); on `setLanguage`, persist to AsyncStorage AND `PUT /api/users/:uid` guarded on `user?.localId` (Pitfall 6 — don't fire before auth ready; verify provider order still gives `useAuth` access, or thread via callback since LanguageContext currently does NOT `useAuth` and sits below StripeProvider in `App.tsx:98`).

### [MOB] `src/components/MoreMenu.tsx` (component edit, D-06/D-07)
**Analog:** self `:31-41` (MENU_ITEMS) + `:16-25` (`getIcon`) + `:76-89` (grid render). Add a `{ id, name: t.notifications, route: 'Notifications' }` item with a `Bell` icon case in `getIcon`; overlay the "9+" count badge (S-MOB NotificationBadge) on that grid item.

### [MOB] `src/components/BottomBar.tsx` (component edit, D-07)
**Analog:** self `:29-35` (the More `TouchableOpacity`). Overlay red-dot NotificationBadge on the More button when `unreadCount>0` (consume `useNotifications`).

### [MOB] `src/screens/ProfileScreen.tsx` (screen edit, D-12)
**Analog:** self `:141-150` (menu-row map: icon + title + `ChevronRight`) and the admin rows `:157-163`. Add a "Notification settings" row (`Bell` + `ChevronRight`) → `navigation.navigate('NotificationSettings')`.

### [MOB] `App.tsx` (entry edit)
**Analog:** self `:89-144`. Insert `<NotificationProvider>` AFTER `<FavoritesProvider>` (needs `useAuth`; must wrap NavigationContainer so badges/screens read context — `:96-138`). Register `<Stack.Screen name="Notifications" .../>` and `name="NotificationSettings"` in the navigator (`:109-132`).

### [MOB] `src/types/navigation.ts` (config edit)
**Analog:** self `:1-26`. Add `Notifications: undefined;` and `NotificationSettings: undefined;` to `RootStackParamList`.

### [MOB] `src/constants/translations.ts` (config edit)
**Analog:** self (parallel RU/EN object). Add all UI-SPEC §Copywriting strings to BOTH `RU` and `EN`; covered by S7(a) parity test. KGS som, not ruble (audience-tone memory).

---

## No Analog Found

| File | Role | Data Flow | Reason / Fallback |
|------|------|-----------|-------------------|
| `src/notifications/translations.js` [BE] | config | transform | First backend translations map. Build fresh; parity-test mirrors mobile harness (S7). |
| `src/notifications/push/fcm.js` [BE] | service | event-driven | Trivial no-op stub; no precedent needed (RESEARCH A4 defines the success-shaped return). |
| `src/components/notifications/NotificationBadge.tsx` [MOB] | component | presentational | No badge component exists; trivial. Tokens per UI-SPEC color table (S8). |

---

## Metadata

**Analog search scope:**
- Backend: `src/moderation/` (router, schemas, service, capabilities), `src/models/` (User, Car), `src/security/` (verifyIdToken, requireAdmin), `server.js` (handler line numbers verified).
- Mobile: `src/services/moderation/`, `src/services/http/`, `src/context/` (Favorites, Language), `src/components/` (BottomBar, MoreMenu), `src/screens/ProfileScreen`, `src/hooks/useHomeListings`, `App.tsx`, `src/types/navigation.ts`, `__tests__/`.

**Files read this pass (no re-reads):** ModerationService.ts, FavoritesContext.tsx, LanguageContext.tsx, MoreMenu.tsx, BottomBar.tsx, http/client.ts, navigation.ts, App.tsx, ProfileScreen.tsx (120-180), useHomeListings.ts (80-140); [BE] moderation/router.js, moderation/schemas.js, moderation/capabilities.js, moderation/service.js (1-120), models/User.js, models/Car.js, security/verifyIdToken.js, server.js (459-548, 886-925, 985-994).

**Pattern extraction date:** 2026-06-06
</content>
</invoke>

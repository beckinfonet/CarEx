# Phase 12: Notification Domain + In-App Center - Research

**Researched:** 2026-06-06
**Domain:** Notification domain (backend Mongoose models + after-commit emit + REST router) and an in-app notification center (mobile RN context/screens), zero native code
**Confidence:** HIGH (architecture, data model, hook points, mobile surfaces all verified against actual source in both repos)

## Summary

Phase 12 builds a complete, push-free notification system across two repos. The **backend** (sibling repo at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`) gets three new Mongoose models, a uid-scoped `/api/notifications/*` router, a `notificationService.emit()` called AFTER commit at six existing trigger points, a pure `matchSavedSearches` module, a backend RU/EN translations map, a `language` field on `User`, and a `fcm.send` no-op stub. The **mobile** app gets a `NotificationService.ts` (sibling to the existing `ModerationService.ts`, NOT bolted onto `AuthService.ts`), a `NotificationProvider`/`useNotifications` context (mirroring `FavoritesContext`/`CartContext` auto-clear-on-uid-change), two new Stack screens (`NotificationsScreen`, `NotificationSettingsScreen`), a labeled `WatchButton`, a sticky `SaveSearchBar`, and badge surfaces on `BottomBar`/`MoreMenu`. Plus `LanguageContext` persistence (currently in-memory only — a verified gap).

Every architectural claim here was checked against real source: `firebase-admin@13.8.0` IS installed (do not add `google-auth-library`); `node-cron` is NOT installed (Phase 14 adds it); `User.js` has NO `language` field; `LanguageContext.tsx` holds language in `useState` only with no AsyncStorage and no backend write; the Car hide-hook gates visibility by ADDING bypass flags (`includeAllUsers`/`includeAllListingStatuses`), so the notification pipeline respects it by OMITTING them; `PUT /api/cars/:id` and `PATCH /api/cars/:id/status` currently have NO auth middleware and identify the actor via `req.body.sellerId`, while `confirmBooking` returns `{ car, orders }` after the transaction with `buyerUid` as the actor.

**Primary recommendation:** Mirror the Phase 2/11 `src/moderation/` split exactly for `src/notifications/` on the backend and the `ModerationService.ts` split for `NotificationService.ts` on mobile. Reuse the verified base64 `{createdAt,_id}` cursor (lifted verbatim from `src/moderation/router.js:27-45`), the `apiClient` interceptor stack, the translation-parity test harness, and the `prevUidRef` auto-clear pattern. Place all six `emit()` calls AFTER `await save()`/after the transaction returns in existing handlers — never in Mongoose post-save hooks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subscription persistence (Saved Search, Watch) | Backend (Mongoose) | — | Server-side records keyed on `uid`; the Watch subscription is explicitly server-backed (distinct from local-only Favorite heart). |
| Match new listing → saved searches | Backend (`matchSavedSearches` pure module) | — | Off the request hot path; indexed query against `Subscription`. |
| Event detection (price-drop/booked/sold/back-available) | Backend (route handlers, after commit) | — | Only the server sees before/after state and the actor uid; emit lives in existing handlers. |
| Notification storage + feed pagination | Backend (`Notification` model + router) | — | Reverse-chron cursor feed served over REST; uid from verified token. |
| i18n render of notification title/body | Backend translations map (for push, Phase 13) + Mobile `useLanguage().t` (for in-app feed) | — | Notification rows store `titleKey/bodyKey/params`, NOT rendered text; mobile renders the in-app feed client-side, backend renders push. |
| Unread badge + feed UI | Mobile (`NotificationContext` + screens) | Backend (unread count endpoint) | Badge derives from context; context fetches count/feed from REST. |
| Watch/Save-search entry controls | Mobile (`WatchButton`, `SaveSearchBar`) | Backend (subscription POST) | UI affordance + one-tap create. |
| Language persistence | Mobile (`LanguageContext` → AsyncStorage + backend write) | Backend (`User.language` + `PUT /api/users/:uid`) | NEW work both sides; verified gap. |
| Push transport | DEFERRED to Phase 13 (native) | — | `fcm.send` ships as a no-op stub. |
| Daily-digest delivery, quiet-hours/cap enforcement, 90-day prune | DEFERRED to Phase 14 (node-cron) | — | Plumbing/policy lands Phase 12; execution Phase 14. |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Watch control (NSUB-02/04, NCEN-06):**
- **D-01:** Watch is a **labeled bell button** (Bell icon + text label "Watch"/"Отслеживать"), a distinct pill/button — explicitly separate from the icon-only red Heart favorite. Its own component, NOT a variant of the favorite heart.
- **D-02:** Placement **below the hero image** on `CarDetailsScreen`, above the spec/details block — separated from the transactional CTA stack (`:787-898`) and the top-right icon action row (`:612`).
- **D-03:** Watching opts into **all 4 events by default** (price-drop [decrease only], booked, sold, back-available). One tap = "follow this car." Per-event opt-out lives in `NotificationSettingsScreen`, NOT at watch time. `Subscription.events: string[]` populated with all four on creation.
- **D-04:** Watch keys on `car._id || car.id || carId` — **never bare `car.id`**.

**Feed entry + unread badge (NCEN-01/02):**
- **D-05 [reinterprets NCEN-01]:** **No top-header bell, NO new bottom navigator.** Entry reuses the existing `BottomBar` **More** button → existing `MoreMenu` bottom-sheet. A global bottom-tab navigator was explicitly REJECTED (out-of-scope nav restructure).
- **D-06:** Add a **"Notifications"** grid item to `MoreMenu` (Bell icon, existing grid-item pattern) → navigates to `NotificationsScreen`.
- **D-07:** **Badge split** — plain **red dot** on `BottomBar` More when unread > 0; **count badge capped "9+"** on the MoreMenu "Notifications" item. Both derive from `NotificationContext` unread count.

**Save-search action (NCEN-06, NSUB-01/03):**
- **D-08:** **Sticky bar above results** ("🔔 Notify me about new matches") pinned in `SearchResultsV2` header area, visible whenever filters are active.
- **D-09:** **One-tap + toast.** Instantly creates the Saved Search from current applied filters at **instant** cadence, then a confirmation toast with an **Undo** affordance. No confirm sheet.
- **D-10 [resolves roadmap tension]:** Cadence selector = **Instant selected, Daily shown-but-disabled** ("coming soon" hint). `Subscription.cadence` defaults to `instant`. Phase 14 enables Daily.

**Settings + subscription management (NPRF-01/02):**
- **D-11:** **Single `NotificationSettingsScreen`** in order: master mute, per-category toggles (saved-search / watch), quiet-hours controls (plumbing only), then "My saved searches" list and "My watched cars" list, each row editable (cadence / per-event toggles) and deletable inline. NOT split into a separate screen.
- **D-12:** Reached via a **"Notification settings"** row in `ProfileScreen` (Bell + ChevronRight, existing menu-row pattern `:141-150`). So: MoreMenu "Notifications" → feed; ProfileScreen "Notification settings" → settings.

### Claude's Discretion
- **D-13:** Exact RU/EN label strings, icon sizing, toast component choice, visual treatment of the sticky bar. All new strings to `translations.ts` with RU+EN parity (jest parity scanner).
- **D-14:** Empty-state copy for `NotificationsScreen` (research suggests "Save a search or watch a car to get alerts").
- **D-15:** Feed-item appearance (per-category icons, read/unread styling per NCEN-04, day grouping if cheap). Reverse-chron + base64 cursor is LOCKED.
- **D-16:** Quiet-hours default values and soft daily-cap (2–3/day) default. Plumbing lands Phase 12; delivery Phase 14. Seed quiet-hours from the device-timezone→city signal (no GPS, no per-user TZ field).

### Deferred Ideas (OUT OF SCOPE)
- **Global bottom-tab navigator** — app-wide nav restructure; its own future phase. Reuse existing BottomBar/MoreMenu.
- Per-event opt-out granularity beyond settings, confirm-sheet save flow, day-grouping/swipe-dismiss in feed — all v2/NOTF2 backlog.
- **All native FCM/APNs work** (Phase 13). **Daily-digest worker + actual daily delivery** (Phase 14). **Contextual OS-push permission prompt** NPRF-06 (Phase 13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NDOM-01 | 3 Mongoose models with documented indexes (`DeviceToken`, `Subscription`, `Notification`) | Verified `src/models/` has no notification models; follow `User.js`/`Car.js` schema+index conventions. Indexes specified in Standard Stack §Data Model. |
| NDOM-02 | `notificationService.emit()` AFTER commit at 6 trigger points | Verified all 6 hook points exist: `POST /api/cars:778`, `PUT /api/cars/:id:886`, `PATCH /api/cars/:id/status:459`, `confirmBooking` (returns after txn), admin `editListing` (post-commit, has `fieldDiff.price`), booked→active (in PATCH status handler). |
| NDOM-03 | Three guards: hide-hook re-read (`findById`, no bypass), actor-exclusion, dedup `(uid,carId,eventType)` | Verified Car hide-hooks gate by ADDING `includeAllUsers`/`includeAllListingStatuses`; plain `findById` (no setOptions) applies both filters → suppress on null. Actor: `req.body.sellerId` (PUT/PATCH), `buyerUid` (confirmBooking). |
| NDOM-04 | Pure unit-testable `matchSavedSearches` via indexed query, off hot path | `Car.makeId/modelId` are `ObjectId`; `Subscription.criteria.makeId/modelId` must be ObjectId to match. Module mirrors `src/moderation/capabilities.js` (pure, unit-tested). |
| NDOM-05 | `/api/notifications/*` router mounted, uid-scoped (token, NOT body param; NOT admin-gated) | Use `verifyIdToken` (strict, NOT `requireAdmin`); `req.auth.uid` from token. Mount pattern mirrors `server.js:988` but without `requireAdmin`. |
| NDOM-06 | 90-day retention pruned (job Phase 14; policy defined here) | Define constant + `Notification.createdAt` index; prune cron is Phase 14. |
| NSUB-01 | Create/manage Saved Search (make, model, price min/max, year min/max, body); default instant | `useHomeListings.activeFilters` is the criteria source (Russian-keyed labels — must map). `yearMax` added per research (spec had only `yearMin`). |
| NSUB-02 | Watch a car → price-drop (decrease), booked, sold, back-available (booked→active only) | Watch event set; `events: string[]`. |
| NSUB-03 | Per-search cadence instant/daily (selector present; daily delivery Phase 14); Watch always instant | `Subscription.cadence` field; Daily disabled in UI (D-10). |
| NSUB-04 | Watch keys on `car._id \|\| car.id \|\| carId`; price-drop only on decrease (direction-checked) | Capture `oldPrice` before `Object.assign` in PUT handler; admin `fieldDiff.price.{before,after}`. |
| NCEN-01 | Bell + unread badge in app header → satisfied via BottomBar/MoreMenu per D-05 | BottomBar red dot + MoreMenu count. |
| NCEN-02 | `NotificationsScreen` reverse-chron feed, cursor pagination (base64 `{createdAt,_id}`) | Cursor helper verbatim from `src/moderation/router.js:27-45`. |
| NCEN-03 | Tap deep-links via existing `linking` config | `linking` in `App.tsx:79-87` has `CarDetails: 'listing/:carId'`; store `data.deeplink`. |
| NCEN-04 | Mark read on open; "mark all read"; read/unread visually distinct | `Notification.read`; endpoints PATCH read + mark-all. |
| NCEN-05 | Onboarding empty state | D-14 copy; `BellOff` icon per UI-SPEC. |
| NCEN-06 | Watch control on CarDetails + "Notify me about new matches" on results | `WatchButton` + `SaveSearchBar`. |
| NPRF-01 | `NotificationSettingsScreen`: master mute + per-category toggles | Single screen per D-11. |
| NPRF-02 | List/edit-cadence/delete subscriptions | Inline rows per D-11; `Alert.alert` delete confirm per UI-SPEC. |
| NPRF-03 | Quiet hours (plumbing only Phase 12; delivery Phase 14) | Store on `User` or subscription prefs; default 22:00–08:00 (D-16). |
| NPRF-04 | Soft daily cap 2–3/day (plumbing only; enforcement Phase 14) | Store pref; default 3 (D-16). |
| NPRF-05 | Dedup + actor-exclusion user-visible-correct | Same guards as NDOM-03; backend tests prove. |
| NPRF-07 | Push-denied fallback: in-app center fully functional with `fcm.send` no-op | Phase 12 ships standalone; stub returns success no-op. |
| NI18N-01 | `language` field on `User`; accepted by `PUT /api/users/:uid`; server push uses it (default RU) | VERIFIED ABSENT — new field; extend PUT whitelist (`server.js:512-531`). |
| NI18N-02 | `LanguageContext` persists language to backend + AsyncStorage (currently in-memory) | VERIFIED in-memory only (`LanguageContext.tsx:15`); new persistence. |
| NI18N-03 | Backend translations map renders title/body from keys+params, RU/EN parity (backend parity test); KGS som | New backend `translations.js`; new backend parity test mirroring `__tests__/translation-parity.test.ts`. |
</phase_requirements>

## Standard Stack

### Core

**Phase 12 adds ZERO new packages in either repo.** Everything reuses installed deps.

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `mongoose` | installed (backend) | 3 new models + indexed match query | Existing ODM; all models live in `src/models/`. [VERIFIED: backend package.json] |
| `express` | installed (backend) | `/api/notifications/*` router | Existing router-mount pattern. [VERIFIED] |
| `firebase-admin` | `13.8.0` installed | Already used for `verifyIdToken`; reused for FCM creds in Phase 13. **Do NOT add `google-auth-library`.** | [VERIFIED: `node_modules/firebase-admin/package.json` = 13.8.0] |
| `zod` | installed (backend) | Subscription/notification request validation | Existing `src/moderation/schemas.js` precedent. [VERIFIED] |
| `axios` | `1.13.4` (mobile) | `NotificationService.ts` via shared `apiClient` | Existing `src/services/http/client.ts` interceptor stack. [VERIFIED] |
| `@react-native-async-storage/async-storage` | `2.2.0` (mobile) | `LanguageContext` persistence | Existing dep. [VERIFIED] |
| `lucide-react-native` | `0.563.0` (mobile) | Bell/badge/feed icons | Existing dep; UI-SPEC names all icons. [VERIFIED] |

### Supporting (Phase 13/14 — DO NOT install in Phase 12)

| Library | Version | Phase | Note |
|---------|---------|-------|------|
| `@react-native-firebase/app` + `/messaging` | `^24.1.0` (locked-step) | 13 | Native push; gated by Podfile spike. [CITED: research SUMMARY] |
| `node-cron` | `^4.x` | 14 | In-process digest. **VERIFIED NOT currently in backend deps.** |

### Data Model (NDOM-01) — 3 new models in backend `src/models/`

Follow `User.js`/`Car.js` conventions (schema → `.index()` calls → `module.exports = mongoose.model(...)`).

```
DeviceToken {
  uid, token (UNIQUE globally), platform: 'ios'|'android', appVersion, createdAt, lastSeenAt
}
  // index: { uid: 1 }  (fan-out)
  // Phase 13 populates rows; model + indexes defined here is acceptable, but
  // device-token registration is Phase 13 (NPUSH-04). Phase 12 may stub or omit
  // the model — confirm with planner whether DeviceToken ships now or Phase 13.

Subscription {
  uid, kind: 'saved_search'|'watch',
  criteria?: { makeId: ObjectId, modelId: ObjectId, priceMin, priceMax, yearMin, yearMax, bodyType },
  carId?: String,                 // watch — store car._id string
  cadence: 'instant'|'daily',     // default 'instant'; watch always instant
  events: [String],               // watch opt-ins; all 4 on create (D-03)
  active: Boolean (default true), createdAt
}
  // indexes: { kind, active, 'criteria.makeId', 'criteria.modelId' } (match),
  //          { kind, carId, active } (watch lookup), { uid, active } (manage)
  // criteria.makeId/modelId MUST be ObjectId — Car.makeId/modelId are ObjectId. [VERIFIED Car.js:11-12]

Notification {
  uid, kind,
  titleKey, bodyKey, params,      // store KEYS + params, NOT rendered text (i18n)
  data: { deeplink, carId?, searchId? },
  read: Boolean (default false),
  channels: [String],            // ['in_app'] in Phase 12
  digestPending: Boolean (default false),
  dedupeKey: String,             // `${carId}:${eventType}` for dedup
  createdAt
}
  // indexes: { uid, createdAt } (feed), { uid, read } (unread count),
  //          { digestPending } (Phase 14 worker), dedupeKey
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sibling `src/notifications/` module | Inline routes in `server.js` | Rejected — Phase 2/11 established the `src/moderation/` split as the house pattern; `server.js` is already 57KB. |
| `NotificationService.ts` sibling | Methods on `AuthService.ts` | Rejected — CLAUDE.md + ModerationService precedent forbid AuthService bloat; mirror the MOB-01 guardrail. |
| `firebase-admin` for creds (Phase 13) | `google-auth-library` | Rejected — firebase-admin@13.8.0 already installed; zero new deps. |
| Separate digest queue collection | `digestPending` flag on Notification | Rejected by spec — flag approach confirmed. |

**Installation:** None. Phase 12 installs nothing.

## Architecture Patterns

### System Architecture Diagram

```
                          BACKEND (sibling repo: carEx-services)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  EXISTING HANDLERS (emit AFTER commit — NOT post-save hooks)              │
  │   POST /api/cars ──────────────┐                                          │
  │   PUT /api/cars/:id ───────────┤ capture oldPrice BEFORE Object.assign    │
  │   PATCH /api/cars/:id/status ──┤ capture old listingStatus                │
  │   confirmBooking (after txn) ──┤ actor = buyerUid                         │
  │   admin editListing (post) ────┤ fieldDiff.price.{before,after}           │
  │   booked→active transition ────┘                                          │
  │            │                                                              │
  │            ▼  notificationService.emit(event)                            │
  │   ┌─────────────────────────────────────────────────┐                   │
  │   │ 1. GUARDS:                                        │                   │
  │   │    a. re-read Car via plain findById (NO bypass) │  null → suppress  │
  │   │    b. actor-exclusion (skip event.actorUid)      │                   │
  │   │    c. dedup per (uid, carId, eventType)          │                   │
  │   │ 2. resolve targets:                              │                   │
  │   │    new_listing → matchSavedSearches (pure)       │                   │
  │   │    watch events → Subscription{kind:watch,carId} │                   │
  │   │ 3. write Notification rows (titleKey/bodyKey)    │                   │
  │   │ 4. instant → fcm.send(NO-OP STUB) ; daily → flag │                   │
  │   └─────────────────────────────────────────────────┘                   │
  │                                                                          │
  │   /api/notifications/*  (verifyIdToken, uid from token, NOT admin)       │
  │     GET  /              cursor feed {items,nextCursor}                    │
  │     GET  /unread-count                                                    │
  │     PATCH /:id/read     ·  PATCH /read-all                                │
  │     POST /subscriptions ·  GET/PATCH/DELETE /subscriptions/:id           │
  │   PUT /api/users/:uid   ← + language field (NI18N-01)                     │
  └──────────────────────────────────────────────────────────────────────────┘
                                    │ REST (apiClient, Bearer idToken)
                                    ▼
                          MOBILE (this repo)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  NotificationService.ts (sibling of ModerationService — NOT AuthService)  │
  │            │                                                              │
  │  NotificationProvider (after FavoritesProvider; useAuth; auto-clear uid)  │
  │   exposes: unreadCount, feed, refresh, markRead, markAllRead, subs CRUD   │
  │            │                                                              │
  │   ├─ BottomBar More  → red dot (unread>0)                                 │
  │   ├─ MoreMenu        → "Notifications" item + "9+" count → NotificationsScreen
  │   ├─ NotificationsScreen   → cursor feed, tap=markRead+deeplink, empty state
  │   ├─ ProfileScreen   → "Notification settings" row → NotificationSettingsScreen
  │   ├─ NotificationSettingsScreen → mute, category toggles, quiet-hours,    │
  │   │                                saved-search list, watched-car list    │
  │   ├─ CarDetailsScreen → WatchButton (below hero, labeled bell pill)       │
  │   └─ SearchResultsV2  → SaveSearchBar (sticky, filters active) + Undo toast│
  │  LanguageContext → persist language to AsyncStorage + PUT /api/users/:uid │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

**Backend** (`carEx-services/src/notifications/` — mirrors `src/moderation/`):
```
src/notifications/
├── notificationService.js     # emit(event): guards → resolve → write → fcm.send
├── matchSavedSearches.js      # PURE, unit-testable indexed match (NDOM-04)
├── translations.js            # backend RU/EN map (NI18N-03)
├── router.js                  # /api/notifications/* (verifyIdToken, uid-scoped)
├── schemas.js                 # zod request schemas (mirror moderation/schemas.js)
├── push/fcm.js                # send = NO-OP STUB in Phase 12
└── __tests__/                 # jest (testMatch **/__tests__/**/*.test.js)
src/models/
├── DeviceToken.js  ├── Subscription.js  └── Notification.js
```

**Mobile** (this repo):
```
src/services/notifications/
├── NotificationService.ts     # apiClient wrappers (sibling of moderation/ModerationService.ts)
└── __tests__/
src/context/NotificationContext.tsx   # provider + useNotifications hook (FavoritesContext pattern)
src/screens/NotificationsScreen.tsx
src/screens/NotificationSettingsScreen.tsx
src/components/notifications/WatchButton.tsx
src/components/notifications/SaveSearchBar.tsx
src/components/notifications/NotificationBadge.tsx
src/components/notifications/NotificationFeedItem.tsx
```

### Pattern 1: Emit AFTER commit (never post-save hook) — NDOM-02/03

**What:** Place `await notificationService.emit({...})` in the existing route handler AFTER the document is persisted, passing the actor uid and any before/after state captured before mutation.
**When to use:** All six trigger points.
**Example (price-drop in `PUT /api/cars/:id`):**
```js
// Source: VERIFIED against server.js:886-980 (PUT handler) + Car.js hide-hook
const car = await Car.findById(req.params.id);          // existing (server.js:891)
const oldPrice = car.price;                              // CAPTURE before Object.assign
// ... existing Object.assign(car, {...price: ...}) at :941-966 ...
await car.save();                                        // existing (:968)
// AFTER commit — emit. Actor is the seller editing (req.body.sellerId).
await notificationService.emit({
  type: 'price_drop',
  carId: car._id.toString(),
  actorUid: req.body.sellerId,        // VERIFIED: PUT identifies actor via body.sellerId
  oldPrice, newPrice: car.price,      // direction-check: only emit if newPrice < oldPrice
});
```
**Why post-save hooks fail here (VERIFIED):** post-save can't see the *before* price, fires inside (and on retries of) the `confirmBooking` transaction, and lacks request context (actor uid). The codebase has ZERO side-effect lifecycle hooks — keep it that way.

### Pattern 2: Hide-hook respect by OMITTING bypass flags — NDOM-03(a)

**What:** Re-read the Car with a plain `findById` (no `setOptions`). The two `pre(/^find/)` hooks then apply automatically; a hidden/suspended/archived listing returns null → suppress.
**Example:**
```js
// Source: VERIFIED against Car.js:64-121 — hooks short-circuit ONLY when the
// bypass flag is set; default behavior hides. INVERT the admin pattern.
const visible = await Car.findById(carId);   // NO .setOptions(...) — both hooks apply
if (!visible || visible.status !== 'active') return;  // suppress (TOCTOU re-check at emit time)
```
**Critical:** Every admin/internal read in the codebase ADDS `includeAllUsers`/`includeAllListingStatuses` (e.g. `server.js:835`). The notification pipeline must NEVER add them. Document this inversion loudly in `notificationService.js`.

### Pattern 3: Actor source per trigger point (NDOM-03(b)) — VERIFIED

| Trigger | Actor uid source | Note |
|---------|-----------------|------|
| `POST /api/cars` | `req.body.sellerId` (or `req.auth.uid` if Bearer present) | new_listing — actor is the seller; never notify them. |
| `PUT /api/cars/:id` | `req.body.sellerId` | VERIFIED: no auth middleware; actor via body (`:889`). |
| `PATCH /api/cars/:id/status` | `req.body.sellerId` | VERIFIED: actor via body (`:461`). |
| `confirmBooking` (booked) | `buyerUid` | VERIFIED: `confirmBooking({...buyerUid})` returns `{car,orders}` after txn (`:306`); emit in route after `await confirmBookingService(...)` (`server.js:1223`). |
| admin `editListing` (price_drop) | `adminUid` | VERIFIED: service takes `{adminUid}`; has `fieldDiff.price.{before,after}` (`listingService.js:278`). |
| booked→active (back-available) | `req.body.sellerId` | In PATCH status handler when old `listingStatus==='booked'` && new `==='active'`. |

### Pattern 4: Base64 cursor (NCEN-02) — reuse verbatim

**What:** Lift `encodeCursor`/`decodeCursor` from `src/moderation/router.js:27-45` exactly. The feed query mirrors `:233-254`.
```js
// Source: VERIFIED src/moderation/router.js:236-252 — proven (createdAt DESC, _id DESC)
if (cursor) query.$or = [
  { createdAt: { $lt: cursor.createdAt } },
  { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
];
const rows = await Notification.find({ uid, ...query })
  .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
```

### Pattern 5: Mobile context auto-clear on uid change (FavoritesContext)

**What:** `NotificationProvider` mirrors `FavoritesContext.tsx:55-63` `prevUidRef` sentinel to clear unread/feed state when `user.localId` changes. Provider placed AFTER `FavoritesProvider` in `App.tsx` (needs `useAuth`; must wrap the navigator so screens/badges read context).
```tsx
// Source: VERIFIED FavoritesContext.tsx:55-63
const prevUidRef = useRef<string | null>(null);
useEffect(() => {
  const currentUid = user?.localId || null;
  if (prevUidRef.current !== null && prevUidRef.current !== currentUid) {
    setUnreadCount(0); setFeed([]);   // clear server-backed cache on user switch
  }
  prevUidRef.current = currentUid;
}, [user?.localId]);
```

### Pattern 6: Service split via shared apiClient (ModerationService)

**What:** `NotificationService.ts` methods are thin "verb + path + body" wrappers over `apiClient` (`src/services/http/client.ts`), which already injects Bearer idToken (request interceptor) and normalizes 403/401 (response interceptors). DELETE with body uses `config.data`.
**Why:** Verified `ModerationService.ts:8-21` documents this exact contract; reuse it.

### Anti-Patterns to Avoid
- **Mongoose post-save hooks for emit** — can't see before-state, fires inside transactions, no actor context. (VERIFIED zero hooks exist.)
- **Adding `includeAllUsers`/`includeAllListingStatuses` in the notification pipeline** — inverts the hide-hook and notifies about hidden listings.
- **Bolting notification methods onto `AuthService.ts`** — violates CLAUDE.md + MOB-01 guardrail.
- **Bare `car.id`** — undefined on some nav paths; always `car._id || car.id || carId`.
- **Storing rendered notification text** — store `titleKey/bodyKey/params`; render at read time (in-app via `useLanguage().t`, push via backend map).
- **Russian-keyed filter labels leaking into `Subscription.criteria`** — `useHomeListings.activeFilters` uses RU label keys (`'Цена'`, `'Год'`, `'Пробег'`). Map them to canonical `{priceMin,priceMax,yearMin,yearMax,...}` before POSTing the subscription.
- **`admin gating the notification router** — NDOM-05 requires uid from token, NOT `requireAdmin`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor pagination | Custom offset/skip | `encodeCursor`/`decodeCursor` from `moderation/router.js:27-45` | Proven, deterministic (createdAt,_id) tiebreak; offset paging double-counts on inserts. |
| Listing-visibility gate | Custom status checks scattered in emit | Plain `findById` (omit bypass flags) | The two `pre(/^find/)` hooks already encode the full hide policy (seller-cascade + status). |
| Bearer injection / 401 refresh | Per-method axios config | Shared `apiClient` | Request + 401-retry + 403-moderation interceptors already centralized. |
| RU/EN parity enforcement | Manual review | Extend `__tests__/translation-parity.test.ts` (mobile) + new backend parity test mirroring it | Set-equality + placeholder-token parity already implemented. |
| Per-user reset on logout | Manual clear calls | `prevUidRef` sentinel (FavoritesContext) | Established pattern; avoids leaking prior user's data. |
| Transaction + audit atomicity (if needed) | Ad-hoc | `session.withTransaction` pattern from `moderation/service.js:64-70` (array-form `create([doc],{session})`) | Phase 12 emit is mostly non-transactional, but subscription writes can reuse this if atomicity is needed. |

**Key insight:** The two repos already contain proven solutions for every cross-cutting concern this phase needs (cursor, hide-hook, auth interceptors, parity tests, uid-reset). The risk in this phase is NOT building primitives — it's wiring emit calls correctly into six handlers and respecting the hide-hook inversion.

## Common Pitfalls

### Pitfall 1: Notifying about hidden/suspended/archived listings
**What goes wrong:** Emit resolves targets and writes notifications for a car that was suspended between match-time and send-time.
**Why it happens:** Using a cached Car object, or adding bypass flags out of habit.
**How to avoid:** Re-read Car with plain `findById` (no setOptions) at emit time; suppress if null or `status !== 'active'`. Re-check at BOTH match time AND send time (TOCTOU).
**Warning signs:** A watcher gets a "price drop" alert for an archived car.

### Pitfall 2: Self-notification (actor not excluded)
**What goes wrong:** A seller editing their own listing's price gets a price-drop alert about their own car. Success criterion #3 forbids this.
**Why it happens:** Actor uid not threaded into emit, or compared against the wrong field.
**How to avoid:** Pass `actorUid` per Pattern 3 table; drop any subscription where `subscription.uid === event.actorUid`.
**Warning signs:** Seller edits price 3× and sees notifications.

### Pitfall 3: Duplicate alerts on rapid edits
**What goes wrong:** A seller edits price three times → three price-drop alerts per watcher. Criterion #3 allows AT MOST ONE.
**Why it happens:** No dedup.
**How to avoid:** `dedupeKey = ${carId}:${eventType}`; dedup per `(uid, carId, eventType)` within a window. Index `dedupeKey`.
**Warning signs:** Feed shows multiple identical rows.

### Pitfall 4: Russian-keyed filter labels in subscription criteria
**What goes wrong:** Save-search POSTs `{'Цена': {min,max}, 'Год': {...}}` instead of `{priceMin, priceMax, yearMin, yearMax}`; `matchSavedSearches` never matches.
**Why it happens:** `useHomeListings.activeFilters` (VERIFIED `:95-122`) uses RU display labels and does client-side filtering, NOT server params.
**How to avoid:** Add a mapping layer in `SaveSearchBar`/`SaveSearch` create that translates `activeFilters` + `selectedMake`/`selectedModel` into canonical `criteria` with ObjectId makeId/modelId.
**Warning signs:** Saved search created but new matching cars never notify.

### Pitfall 5: criteria.makeId type mismatch
**What goes wrong:** `Subscription.criteria.makeId` stored as a name string; indexed query against `Car.makeId` (ObjectId) returns nothing.
**Why it happens:** Legacy denormalized `makeName`/`make` strings exist on Car alongside the ObjectId refs.
**How to avoid:** Store `criteria.makeId/modelId` as ObjectId (match `Car.makeId/modelId`, VERIFIED `Car.js:11-12`), NOT the legacy name strings.

### Pitfall 6: LanguageContext persistence regressions
**What goes wrong:** Adding AsyncStorage + backend write to `LanguageContext` breaks the in-memory default or fires a backend call before auth is ready.
**Why it happens:** `LanguageContext` is currently provider-only with no async, mounted deep in the tree (below StripeProvider). It does NOT currently `useAuth`.
**How to avoid:** Hydrate from AsyncStorage on mount; only PUT `/api/users/:uid` when a user is logged in (guard on `user?.localId`); default RU when no stored value. Confirm provider ordering still gives access to `useAuth` if you wire backend writes there (or thread via a callback).
**Warning signs:** Crash on launch before login; language reverts after restart.

### Pitfall 7: Backend translations parity not enforced
**What goes wrong:** Backend notification strings drift between RU/EN; KGS som rendered as ruble.
**Why it happens:** The existing parity test only covers mobile `translations.ts`.
**How to avoid:** New backend `__tests__/notification-translations-parity.test.js` mirroring `translation-parity.test.ts` (set-equality + placeholder-token parity); assert currency formatting uses KGS som.

### Pitfall 8: Match engine on the request hot path
**What goes wrong:** `POST /api/cars` blocks while matching every saved search.
**Why it happens:** Synchronous match inside the response path.
**How to avoid:** `matchSavedSearches` is a pure module using the indexed `{kind,active,criteria.makeId,criteria.modelId}` query; emit happens after the response is sent or fire-and-forget after commit (planner decides), off the hot path per NDOM-04.

## Code Examples

### Router mount (uid-scoped, NOT admin) — NDOM-05
```js
// Source: VERIFIED contrast with server.js:988 (which uses requireAdmin).
// Notification router uses verifyIdToken ONLY — uid from req.auth.uid.
app.use('/api/notifications', verifyIdToken, notificationRouter);
// Inside router: const uid = req.auth.uid;  // NEVER req.body.uid / req.params.uid
```

### PUT /api/users/:uid language extension — NI18N-01
```js
// Source: VERIFIED server.js:512-531 — add `language` to the whitelist.
const { firstName, lastName, phoneNumber, telegramUsername, avatarUrl, language } = req.body;
// ...existing fields...
if (language !== undefined && ['RU','EN'].includes(language)) update.language = language;
// User.js: add  language: { type: String, enum: ['RU','EN'], default: 'RU' }
```

### Save-search criteria mapping (mobile) — NSUB-01
```ts
// Map useHomeListings state → canonical Subscription criteria.
// activeFilters keys are RU labels (VERIFIED useHomeListings.ts:95-122).
const criteria = {
  makeId: selectedMake?.id,                 // ObjectId string
  modelId: selectedModel?.id,
  priceMin: activeFilters['Цена']?.min, priceMax: activeFilters['Цена']?.max,
  yearMin: activeFilters['Год']?.min,   yearMax: activeFilters['Год']?.max,
  bodyType: selectedCategory?.name,
};
await NotificationService.createSavedSearch({ criteria, cadence: 'instant' });
```

## Runtime State Inventory

> This is a greenfield feature addition (new models, new screens), NOT a rename/refactor/migration. No existing runtime state is renamed or migrated. The one data-shape change is additive (`User.language` defaulting to `'RU'`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None renamed. NEW: `User.language` field added (additive, default RU). Existing user docs get the default on read. | Code edit only (schema default backfills logically; no migration needed). |
| Live service config | None — no n8n/Datadog/external config touches this phase. | None — verified phase scope is code in two repos. |
| OS-registered state | None — zero native code in Phase 12 (Task Scheduler/launchd/pm2 untouched). | None. |
| Secrets/env vars | None — no new keys (firebase-admin creds already present for verifyIdToken; `fcm.send` is a no-op stub). | None. |
| Build artifacts | None — no package.json dep changes in either repo for Phase 12. | None. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spec implied Mongoose post-save hooks | Explicit `emit()` after commit | research SUMMARY refinement | 6 handler edits, not model hooks. |
| STACK.md proposed `google-auth-library` | Reuse `firebase-admin@13.8.0` | verified installed | Zero new backend deps. |
| Spec "digest-default acceptable" | Instant is DEFAULT | research correction | `cadence` defaults to `instant`; Daily disabled in UI. |
| Spec `yearMin` only | `yearMin` + `yearMax` | research addition | criteria + UI carry both bounds. |

**Deprecated/outdated:**
- FCM HTTP v1 multicast/batch (removed June 2024) — relevant only to Phase 13 send loop, not Phase 12.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DeviceToken` model may be deferable to Phase 13 (Phase 12 has no token registration) | Data Model | LOW — planner confirms; if defined now it's an empty unused model. NDOM-01 lists all three, so safest to define all three in Phase 12. |
| A2 | Quiet-hours/daily-cap prefs stored on `User` (or a prefs subdoc) | NPRF-03/04 | LOW — exact storage location is plumbing; planner picks. Defaults from D-16 (22:00–08:00, cap 3). |
| A3 | `matchSavedSearches` queries `Car` collection directly via indexed criteria | NDOM-04 | LOW — confirmed Car.makeId/modelId are ObjectId; query shape standard. |
| A4 | `fcm.send` stub returns a success-shaped no-op so the instant branch doesn't throw | NPRF-07 | LOW — stub contract; planner defines exact return shape Phase 13 will honor. |
| A5 | Backend send-SDK posture (firebase-admin `.send()` vs hand-rolled HTTP v1) is a Phase 13 decision | Stack | LOW — out of Phase 12 scope; stub only. |

**Note:** No `[ASSUMED]`-tagged factual claims about library capabilities remain — versions, schema shapes, hook points, and absence of `language`/`node-cron` were all VERIFIED against source.

## Open Questions

1. **Does `DeviceToken` ship in Phase 12 or Phase 13?**
   - What we know: NDOM-01 lists all three models with indexes as a Phase 12 requirement; token *registration* is NPUSH-04 (Phase 13).
   - What's unclear: whether to create an unused `DeviceToken` model now.
   - Recommendation: Define the model + indexes in Phase 12 (satisfies NDOM-01 literally); leave it unpopulated until Phase 13.

2. **Where do quiet-hours / daily-cap preferences live?**
   - What we know: plumbing lands Phase 12, enforcement Phase 14.
   - What's unclear: `User` subdoc vs per-subscription vs a `NotificationPrefs` model.
   - Recommendation: a `notificationPrefs` subdoc on `User` (master mute, category toggles, quietHours, dailyCap) — single read for settings screen; planner confirms.

3. **Should `PUT /api/cars/:id` / `PATCH status` gain auth middleware to get a trustworthy actor uid?**
   - What we know: both currently have NO auth and trust `req.body.sellerId` (VERIFIED). Ownership IS checked (`car.sellerId !== sellerId → 403`).
   - What's unclear: whether actor-exclusion can rely on body `sellerId`.
   - Recommendation: rely on `req.body.sellerId` for actor-exclusion (ownership is already enforced, so it can't be spoofed to someone else's car); do NOT expand auth scope in this phase (avoids regression risk per the no-breaking-changes constraint).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MongoDB Atlas | All backend models/queries | ✓ (existing) | — | — |
| `firebase-admin` | verifyIdToken (router auth); Phase 13 creds | ✓ | 13.8.0 | — |
| `mongodb-memory-server` | Backend jest tests | ✓ | 10.4.3 | — |
| Node >= 20 | Both repos | ✓ | — | — |
| `node-cron` | Phase 14 digest only | ✗ | — | N/A in Phase 12 (out of scope) |

**Missing dependencies with no fallback:** None for Phase 12.
**Missing dependencies with fallback:** None — Phase 12 installs nothing.

## Validation Architecture

### Test Framework

**Backend** (`carEx-services`):
| Property | Value |
|----------|-------|
| Framework | Jest `^29.7.0` |
| Config | `package.json` `jest` field: `{testEnvironment:'node', testMatch:['**/__tests__/**/*.test.js'], testTimeout:30000}` |
| Quick run | `npx jest src/notifications/__tests__/<file>.test.js` |
| Full suite | `npm test` |
| DB fixture | `mongodb-memory-server` (+ `__tests__/_helpers/mongoReplSet.js` for transactions) |

**Mobile** (this repo):
| Property | Value |
|----------|-------|
| Framework | Jest (react-native preset) |
| Config | `package.json` test script `jest`; preset via @react-native |
| Quick run | `npx jest path/to/file` |
| Full suite | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NDOM-03 | Suppress emit for hidden/suspended/archived listing (plain findById null) | unit (backend) | `npx jest src/notifications/__tests__/guards.test.js` | ❌ Wave 0 |
| NDOM-03 | Actor-exclusion (seller editing own price → 0 self-notifs) | unit (backend) | `npx jest src/notifications/__tests__/actorExclusion.test.js` | ❌ Wave 0 |
| NDOM-03 | Dedup: 3 edits → ≤1 alert per watcher | unit (backend) | `npx jest src/notifications/__tests__/dedup.test.js` | ❌ Wave 0 |
| NDOM-04 | `matchSavedSearches` pure-function matching | unit (backend) | `npx jest src/notifications/__tests__/matchSavedSearches.test.js` | ❌ Wave 0 |
| NSUB-04 | Price-drop only on decrease (direction check) | unit (backend) | `npx jest src/notifications/__tests__/priceDirection.test.js` | ❌ Wave 0 |
| NDOM-05 | Router uid-scoped from token, not admin-gated | integration (backend) | `npx jest src/notifications/__tests__/router.test.js` | ❌ Wave 0 |
| NCEN-02 | Cursor pagination correctness | integration (backend) | `npx jest src/notifications/__tests__/feedCursor.test.js` | ❌ Wave 0 |
| NI18N-03 | Backend RU/EN parity + KGS som | unit (backend) | `npx jest __tests__/notification-translations-parity.test.js` | ❌ Wave 0 |
| NI18N-01 | `language` accepted by PUT /api/users/:uid | integration (backend) | `npx jest __tests__/userLanguage.test.js` | ❌ Wave 0 |
| NI18N-02/03 | Mobile RU/EN parity for new keys | unit (mobile) | `npx jest __tests__/translation-parity.test.ts` | ✅ extend existing |
| NCEN-01/07 | Badge derives from context unread; feed renders | component (mobile) | `npx jest src/context/__tests__/NotificationContext.test.tsx` | ❌ Wave 0 |
| NSUB-04 | Watch keys on `car._id\|\|car.id\|\|carId` | component (mobile) | `npx jest src/components/notifications/__tests__/WatchButton.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run the specific new test file (`npx jest <file>`).
- **Per wave merge:** full suite in the touched repo (`npm test`).
- **Phase gate:** both repos' full suites green before `/gsd-verify-work`. Note split-repo deploy gotcha — backend tests run in the sibling repo.

### Wave 0 Gaps
- [ ] Backend `src/notifications/__tests__/` scaffolds for guards, actorExclusion, dedup, matchSavedSearches, priceDirection, router, feedCursor (with `test.todo` placeholders importing not-yet-existing modules — mirrors Phase 5 Wave 0 pattern)
- [ ] Backend `__tests__/notification-translations-parity.test.js` (mirror mobile `translation-parity.test.ts`)
- [ ] Backend `__tests__/userLanguage.test.js`
- [ ] Mobile `src/context/__tests__/NotificationContext.test.tsx`, `src/components/notifications/__tests__/WatchButton.test.tsx`, `NotificationService` test
- [ ] Extend existing mobile `__tests__/translation-parity.test.ts` coverage (already green; new keys auto-covered by set-equality)
- [ ] No framework install needed — jest present in both repos.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifyIdToken` (firebase-admin) on `/api/notifications/*`; uid from token. |
| V3 Session Management | no | Stateless Bearer idToken; no server sessions. |
| V4 Access Control | yes | uid-scoped queries — every notification/subscription read+write filters by `req.auth.uid`; NEVER trust `req.body.uid`/`req.params.uid`. NOT admin-gated (NDOM-05). |
| V5 Input Validation | yes | zod schemas for subscription criteria + cadence + events (mirror `moderation/schemas.js`); enum-validate `language`. |
| V6 Cryptography | no | No new crypto in Phase 12; idToken verification handled by firebase-admin. |

### Known Threat Patterns for {RN mobile + Express/Mongoose backend}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — reading/deleting another user's notifications/subscriptions | Elevation/Info disclosure | Scope ALL queries by `req.auth.uid` from the verified token; never accept uid from body/params/query. |
| Notifying about a hidden/suspended listing (info leak via notification) | Info disclosure | Plain `findById` (omit bypass flags) at emit time; suppress on null/non-active (TOCTOU re-check). |
| Self-notification / spoofed actor | Tampering | Actor-exclusion using ownership-enforced `sellerId`/`buyerUid`. |
| NoSQL injection via criteria fields | Tampering | zod-validate + cast `makeId/modelId` to ObjectId; numeric bounds parsed as ints. |
| Notification spam / fatigue | DoS (user trust) | dedup `(uid,carId,eventType)`, daily-cap plumbing (enforcement Phase 14), master/per-category mute. |
| PII in notification body | Info disclosure | In-app feed stores keys+params (not rendered PII); generic push bodies are a Phase 13 concern. |

## Sources

### Primary (HIGH confidence) — verified source reads
- Backend repo `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`: `package.json` (deps), `src/models/Car.js` (hide-hooks `:64-121`), `src/models/User.js` (no language field), `src/moderation/router.js` (cursor `:27-45`, mount pattern), `src/moderation/service.js` (transaction pattern `:64-70`), `server.js` (route handlers `:303,456,459,778,886,988,1220`), `src/payments/confirmBooking.js` (`:227,306`), `src/moderation/listingService.js` (fieldDiff `:278`), `src/security/attachAuthIfPresent.js`. firebase-admin@13.8.0 confirmed installed; node-cron confirmed absent.
- Mobile repo (this): `App.tsx` (provider stack, linking), `src/types/navigation.ts`, `src/context/FavoritesContext.tsx` (auto-clear `:55-63`), `src/context/LanguageContext.tsx` (in-memory only `:15`), `src/services/http/client.ts` (interceptors), `src/services/moderation/ModerationService.ts` (split contract), `__tests__/translation-parity.test.ts`, `src/components/MoreMenu.tsx`, `src/components/BottomBar.tsx`, `src/hooks/useHomeListings.ts` (RU-keyed filters `:95-122`), `src/screens/SearchResultsV2.tsx`.
- `.planning/REQUIREMENTS.md`, `12-CONTEXT.md`, `12-UI-SPEC.md`, `docs/superpowers/specs/2026-06-06-notifications-system-design.md`.

### Secondary (MEDIUM confidence)
- `.planning/research/v1.2/SUMMARY.md` — milestone research synthesis (npm versions verified 2026-06-06; RNFB/Podfile findings are Phase 13 scope).

### Tertiary (LOW confidence)
- None — all Phase-12-relevant claims verified against source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all reuse verified installed.
- Architecture / hook points: HIGH — all 6 trigger points + actor sources + hide-hook inversion verified by line number in source.
- Data model: HIGH — schema shapes match existing conventions; ObjectId requirement verified against Car.js.
- Mobile surfaces: HIGH — all integration points (BottomBar, MoreMenu, ProfileScreen, CarDetails, SearchResultsV2, App.tsx) read directly.
- Pitfalls: HIGH — derived from verified code behavior (RU-keyed filters, in-memory LanguageContext, bypass-flag inversion).

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable — internal architecture, no fast-moving external deps in Phase 12 scope)

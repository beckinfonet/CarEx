# Phase 13: FCM Push Transport (native) - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 18 (10 mobile new/modified, 3 native iOS, 4 native Android, 4 backend sibling-repo)
**Analogs found:** 17 / 18 (the gating Podfile spike has a partial/self analog; one new module — mobile PushContext — has a close sibling)

> **Cross-repo note.** Backend files live in the SIBLING repo at
> `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`
> (confirmed accessible during mapping). Railway deploys backend `main`
> ([[backend_deploy_gotcha]]) — backend changes ship as a distinct deployable
> unit and will NOT take effect in prod until merged there. Planner must scope
> backend work into its own plan(s).
>
> **Spike gate (D-01/D-02).** Every mobile-native task below is CONDITIONAL on
> the iOS static-frameworks spike (NPUSH-01) passing. If the spike aborts, only
> the backend-stub-stays-no-op state ships. Pattern assignments assume the spike
> passed.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/push/PushService.ts` *(new)* | service | request-response (CRUD on device tokens) | `src/services/notifications/NotificationService.ts` | exact (sibling domain-split, same `apiClient` wrapper) |
| `src/context/PushContext.tsx` *(new, optional)* | provider/context | event-driven (token lifecycle + 3-state taps) | `src/context/NotificationContext.tsx` | role-match (context+hook pattern; different data flow) |
| `src/context/AuthContext.tsx` *(modify)* | provider | event-driven (register/refresh/unregister) | itself — existing login/signup/logout seams | self / exact |
| `index.js` *(modify)* | config/entry | event-driven (background message handler) | itself (current 9-line registrar) | self |
| `App.tsx` *(modify)* | config/route | event-driven (3-state tap routing) | itself — existing `linking` config | self / exact |
| `src/components/notifications/WatchButton.tsx` *(modify)* | component | event-driven (pre-prompt trigger) | itself — existing `createSubscription` flow | self / exact |
| `src/components/notifications/SaveSearchBar.tsx` *(modify)* | component | event-driven (pre-prompt trigger) | itself / WatchButton | self / exact |
| `src/screens/NotificationSettingsScreen.tsx` *(modify)* | screen | request-response (live status row) | itself — existing toggle/settings layout | self / exact |
| `src/constants/translations.ts` *(modify)* | config | n/a (string table) | itself — existing `notif_*` + `notNow` keys | self / exact |
| `ios/Podfile` *(modify)* | config | n/a (build) | itself — existing fmt/stripe post_install hooks | self / partial |
| `ios/carEx/carEx.entitlements` *(modify)* | config | n/a | itself — existing `associated-domains` entry | self / exact |
| `ios/carEx/Info.plist` *(modify)* | config | n/a | itself | self |
| `android/build.gradle` *(modify)* | config | n/a (build) | itself — existing buildscript deps block | self / exact |
| `android/app/build.gradle` *(modify)* | config | n/a (build) | itself — existing `apply plugin` lines | self / exact |
| `android/app/.../AndroidManifest.xml` *(modify)* | config | n/a | itself — existing intent-filters/permissions | self / exact |
| `android/app/google-services.json` *(new)* | config | n/a | — (Firebase console download; human-gated) | no analog (generated artifact) |
| `backend src/notifications/push/fcm.js` *(replace stub)* | service | event-driven (fan-out send loop) | `backend src/security/firebaseAdmin.js` (init) + `backend src/notifications/notificationService.js` (caller) | role-match |
| `backend src/notifications/router.js` *(add token routes)* OR new `src/notifications/deviceTokens` router | route | CRUD (register/unregister) | `backend src/notifications/router.js` subscription routes | exact |
| `backend src/notifications/translations.js` *(add push_* keys)* | config | n/a (string table + render) | itself — existing `render`/`interpolate` | self / exact |

---

## Pattern Assignments

### `src/services/push/PushService.ts` (service, request-response) — NEW

**Analog:** `src/services/notifications/NotificationService.ts` (the Phase-12 domain-split that MOB-01 mandates).

**CRITICAL — MOB-01 guardrail.** Device-token register/unregister HTTP MUST live
in this NEW module, NOT in `AuthService.ts`. The grep gate
`grep -c 'notification\|subscription\|watch' src/services/AuthService.ts` returns 0
and a similar token/device gate is expected. Mirror the NotificationService split
exactly (header comment cites MOB-01, all methods delegate to `apiClient`).

**Imports + header pattern** (`NotificationService.ts:26-39`):
```typescript
import axios from 'axios';
import { apiClient } from '../http/client';
// apiClient owns Bearer idToken injection (request interceptor) + 401 refresh.
// Backend derives caller uid from the verified token — NEVER send uid in body.
```

**Thin verb+path+body method pattern** (`NotificationService.ts:189-214`) — copy this exact shape for `registerToken` / `unregisterToken`:
```typescript
createSubscription: async (body: CreateSubscriptionBody) => {
  try {
    const response = await apiClient.post('/api/notifications/subscriptions', body);
    return response.data;
  } catch (error) {
    console.error('Failed to create subscription', error);
    throw error;
  }
},
```
New methods (shape, not literal):
- `registerToken({ token, platform, appVersion })` → `POST` to the device-token route. **No uid in body** (uid from Bearer).
- `unregisterToken(token)` → `DELETE` — note `NotificationService.ts:24` reminder: axios DELETE body goes via `config.data`.

**Why apiClient, not raw axios:** the request interceptor (`http/client.ts:88-95`) attaches the Bearer unconditionally; the 401 interceptor (`http/client.ts:139-183`) handles refresh+retry. PushService must reuse it so token register/unregister get the same auth treatment — except the **logout unregister**, see the AuthContext ordering trap below.

---

### `src/context/AuthContext.tsx` (provider, event-driven) — MODIFY

**Analog:** itself. The login/signup/logout callbacks are the exact seams NPUSH-04 names.

**Register-on-login seam** (`AuthContext.tsx:385-412`, `login`): after `setUser(userData)` + `checkAdminStatus`, acquire the FCM token (`messaging().getToken()`) and call `PushService.registerToken(...)`. Mirror seam in `signup` (`AuthContext.tsx:414-433`).

**Unregister-on-logout — THE ORDERING TRAP (NPUSH-04 / Pitfall 4).** `logout()` clears the token ref FIRST, line 439:
```typescript
const logout = useCallback(async () => {
  // Clear the token ref FIRST — before any other teardown or awaits ...
  currentIdTokenRef.current = null;          // ← line 439
  refreshTokenRef.current = null;
  ...
  await AuthService.logout();
  setUser(null);
```
The device-token `DELETE` needs a valid Bearer, which the request interceptor pulls from `currentIdTokenRef` via `tokenProvider`. So you MUST capture the FCM token AND fire `PushService.unregisterToken(...)` **BEFORE line 439** (or capture the idToken and pass it explicitly to a fire-and-forget unregister). Do NOT place the unregister after the ref clear — it will send no Bearer and the backend can't authorize the delete → stale token keeps receiving pushes.

**Token-refresh listener pattern** (`AuthContext.tsx:242-352`, the mount `useEffect`): RNFB's `onTokenRefresh` should be subscribed once here (or in PushContext) the same way the existing client listeners are wired on mount. The existing `setIdTokenRefreshListener`/`setModerationRefreshListener` registration (lines 287, 247) is the precedent for "subscribe-once-on-mount, re-register on fire."

**Stale-after-await guard precedent** (`AuthContext.tsx:449`, `refreshGenerationRef`): if any async token work can resolve after logout, follow the existing generation-counter pattern so a late resolve doesn't resurrect state.

---

### `index.js` (entry, event-driven) — MODIFY

**Analog:** itself (current 9-line file) + RESEARCH §Pattern 1.

Current state:
```javascript
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
AppRegistry.registerComponent(appName, () => App);
```
NPUSH-06: register `messaging().setBackgroundMessageHandler(...)` at MODULE SCOPE, BEFORE `AppRegistry.registerComponent`, because the OS spins the JS context with NO React tree for a background/quit data message. Keep the handler minimal (headless). Do not move display/route work here — that happens on tap via `getInitialNotification` / `onNotificationOpenedApp` inside the tree (see App.tsx below).

---

### `App.tsx` (route, event-driven) — MODIFY

**Analog:** itself — the existing `linking` config (`App.tsx:81-96`) is reused AS-IS for push taps. No new route wiring.

**Existing whitelist (do NOT widen):**
```javascript
const linking = {
  prefixes: ['https://www.carexmarket.com', 'carex://'],
  config: { screens: {
    Home: '', CarDetails: 'listing/:carId', SearchResults: 'search',
  }},
};
```
`data.deeplink` from a push must route only through these. CarDetails (`listing/:carId`) and SearchResults (`search`) are the only two notification targets (matches Phase-12 NCEN-03).

**3-state tap routing (NPUSH-06/07)** — mount an effect inside the AuthProvider subtree (mirror `AppStateRefreshEffect`, `App.tsx:68-78`, which mounts `useAppStateRefresh` inside the tree the same way `OfflineNotice` uses `useNetwork`). Per RESEARCH §Pattern 2:
- `getInitialNotification()` once on mount → cold-start/quit tap → `data.deeplink`.
- `onNotificationOpenedApp()` → background tap → `data.deeplink`.
- `onMessage()` → foreground.

**Android cold-start gotcha (Pitfall 5):** `carex://search` has NO intent-filter in AndroidManifest. Prefer in-JS `navigationRef.navigate` over `Linking.openURL` for push taps to sidestep the manifest gap, OR add the intent-filter (see AndroidManifest below).

**car-id rule ([[car_id_field_unreliable]]):** the backend builds the deeplink; it MUST use `car._id || car.id || carId`, never bare `car.id`. WatchButton (`WatchButton.tsx:63`) is the grep-visible precedent.

---

### `src/components/notifications/WatchButton.tsx` + `SaveSearchBar.tsx` (component, event-driven) — MODIFY

**Analog:** themselves. Both already have the first-subscription create flow (`WatchButton.tsx:65-83` `handlePress`; `SaveSearchBar.tsx:127` `handleSave`).

**NPRF-06 pre-prompt insertion point:** the soft pre-prompt fires once on the FIRST successful Watch OR first Save-search (D-04, single ask covers both). Insert the trigger right around the existing `createSubscription` success path:
```typescript
// WatchButton.tsx:65-83 — existing handlePress
const handlePress = async () => {
  if (submitting || watching) return;
  if (!watchKey) return;
  setSubmitting(true);
  try {
    await NotificationService.createSubscription({ kind: 'watch', carId: watchKey, events: WATCH_EVENTS, cadence: 'instant' });
    setWatching(true);          // ← after first success: fire pre-prompt (gated by AsyncStorage "shown" flag)
  } catch (error) { ... }
};
```
- Persist a "pre-prompt shown / dismissed" flag in `AsyncStorage` (D-05: "Not now" = never auto-re-ask).
- Soft modal copy via `useLanguage().t` (D-06 plain/functional RU-first). On "Включить" → RNFB `requestPermission()` + Android `POST_NOTIFICATIONS` → on grant, register token.
- **Anti-pattern (RESEARCH):** NEVER request permission on launch — only contextually here.

**i18n pattern** (both files): `const { t } = useLanguage();` then `t.<key>`. New keys: `pushPrePromptTitle`, `pushPrePromptBody`, `pushEnable` ("Включить"); `notNow` ("Не сейчас") ALREADY exists (`translations.ts:956` RU / `:2014` EN).

---

### `src/screens/NotificationSettingsScreen.tsx` (screen, request-response) — MODIFY

**Analog:** itself — the existing toggle-row layout (`NotificationSettingsScreen.tsx:286-318`) is the exact pattern to mirror for the denied-recovery row (D-09/D-10/D-11).

**Live-status row pattern** — add a row that reads OS permission live (D-11) and deep-links to OS settings when off (D-10). Reuse the existing `toggleRow` style + structure:
```typescript
// existing toggleRow shape (lines 287-296) — mirror for the push-status row
<View style={styles.toggleRow}>
  <Text style={styles.toggleLabel}>{t.muteAllNotifications}</Text>
  <Switch value={muteAll} onValueChange={onToggleMute} .../>
</View>
```
For the recovery row (RESEARCH §Code Examples):
- Read status: `const status = await messaging().hasPermission();` → `enabled = status === AUTHORIZED || status === PROVISIONAL`.
- Render `t.pushStatusOn` / `t.pushStatusOff`; when off, a tappable row → `Linking.openSettings()`.
- Re-read live status on screen focus (existing `useEffect(loadSubs, [loadSubs])` at line 125 is the on-mount precedent; add a focus listener or AppState re-check so returning from OS settings refreshes the row).

**New keys:** `pushStatusOn`, `pushStatusOff`, `pushEnableInSettings`. Follow the existing `notificationSettings`/`cadenceInstant` key placement.

---

### `src/constants/translations.ts` (config) — MODIFY

**Analog:** itself — existing `notif_*` block (`translations.ts:1037-1046` RU / `:2091-2100` EN) and `notNow` (`:956`/`:2014`).

**RU/EN parity is enforced** (a parity scanner exists per backend translations comment; the mobile table has a matching scanner). Every new key added under `RU` MUST have an `EN` sibling.

New keys (RU first, EN parity): `pushPrePromptTitle`, `pushPrePromptBody`, `pushEnable`, `pushStatusOn`, `pushStatusOff`, `pushEnableInSettings`.

**DO NOT reuse the in-app `notif_*_body` strings for push** — they interpolate `{makeModel}`/`{price}`/`{newPrice}` (e.g. `translations.ts:1038`), which are D-08b HARD-BANNED from the lock screen. Push copy is rendered server-side (see backend translations.js below); these mobile keys are for the pre-prompt + status UI only.

---

### `ios/Podfile` (config, build) — MODIFY  *(spike-critical)*

**Analog:** itself — the existing `post_install` hooks (`Podfile:34-49`) MUST be preserved through the linkage switch.

**Existing hooks that survive the switch:**
```ruby
# Podfile:34-49 — fmt C++17 + stripe enum-redeclared flags
if target.name == 'fmt'
  config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
end
if target.name == 'stripe-react-native'
  existing = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
  config.build_settings['OTHER_CPLUSPLUSFLAGS'] = "#{existing} -Wno-error=enum-redeclared-with-different-underlying-type"
  ...
end
```
**Spike adds (RESEARCH §Pitfall 1-2):** `$RNFirebaseAsStaticFramework = true`, `use_frameworks! :linkage => :static` (the existing `ENV['USE_FRAMEWORKS']` block at `Podfile:11-15` is the toggle seam), and `RCT_USE_PREBUILT_RNCORE=0` at `pod install` time. The spike must prove Stripe's `FollyConvert.h` still resolves — that is the central spike test. Capture a pre-frameworks `Podfile.lock` rollback checkpoint (D-02).

---

### `ios/carEx/carEx.entitlements` + `ios/carEx/Info.plist` (config) — MODIFY

**Analog:** the entitlements file itself — it already has one capability entry (`associated-domains`), so the file shape and edit point are established:
```xml
<!-- carEx.entitlements — EXISTING -->
<key>com.apple.developer.associated-domains</key>
<array><string>applinks:www.carexmarket.com</string></array>
```
- entitlements: ADD `aps-environment` (development → production).
- `Info.plist`: ADD `UIBackgroundModes` → `remote-notification` (confirmed ABSENT — grep returned none).
- Xcode: enable Push Notifications + Background Modes capabilities. iOS target already 15.1 (≥15, no change). `GoogleService-Info.plist` already present in `ios/carEx/`.

---

### `android/build.gradle` + `android/app/build.gradle` (config, build) — MODIFY

**Analog:** the existing buildscript deps block and `apply plugin` lines.

`android/build.gradle:13-17` (buildscript dependencies) — ADD the classpath alongside existing entries:
```gradle
dependencies {
    classpath("com.android.tools.build:gradle")
    classpath("com.facebook.react:react-native-gradle-plugin")
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    // ADD: classpath("com.google.gms:google-services:4.4.4")
}
```
`android/app/build.gradle:1-3` (apply plugin lines) — ADD `apply plugin: "com.google.gms.google-services"` at the BOTTOM of the file.
`targetSdkVersion = 36` (`android/build.gradle:7`) ≥33 → `POST_NOTIFICATIONS` IS runtime-gated (resolves RESEARCH A4).

---

### `android/app/src/main/AndroidManifest.xml` (config) — MODIFY

**Analog:** itself — existing intent-filters + the single `uses-permission` line.

Existing (`AndroidManifest.xml:4`, `:28-45`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
...
<data android:scheme="carex" android:host="listing" android:pathPrefix="/" />
<data android:scheme="carex" android:host="stripe-redirect" />
<data android:scheme="https" android:host="www.carexmarket.com" android:pathPrefix="/listing" />
```
ADD:
- `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` (next to INTERNET, line 4).
- Default-channel `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" .../>` inside `<application>`.
- **Pitfall 5:** `carex://search` host is NOT declared (only `listing`/`stripe-redirect`). Either add a `carex://search` intent-filter mirroring the `listing` one, OR (preferred) route push taps via in-JS `navigationRef.navigate` and skip the manifest edit.

---

### `backend src/notifications/push/fcm.js` (service, event-driven) — REPLACE STUB

**Analogs:** `backend src/security/firebaseAdmin.js` (init/OAuth caching) + `backend src/notifications/notificationService.js:212-213` (the emit caller) + RESEARCH §Pattern 3.

**Current stub (replace entirely):**
```javascript
// fcm.js — Phase 12 success-shaped NO-OP
async function send() { return { ok: true, delivered: 0, stub: true }; }
module.exports = { send };
```

**OAuth/init pattern to reuse** (`firebaseAdmin.js:9-29`) — DO NOT add `google-auth-library`; admin SDK caches OAuth internally:
```javascript
const { ensureInitialized } = require('../../security/firebaseAdmin'); // caches creds
const admin = ensureInitialized();
```

**Caller contract (must stay compatible)** — `notificationService.js:212-213` calls:
```javascript
if (cadence === 'instant') {
  await fcm.send({ uid, title: keys.titleKey, data: target.data });
}
```
The new `send` must accept `{ uid, ... , data }` and pull tokens from `DeviceToken.find({ uid })` (model at `backend src/models/DeviceToken.js` — `{ uid, token (unique), platform, appVersion }`, `{uid}` index). Render GENERIC PII-safe copy (NOT the caller's params). Use `admin.messaging().sendEachForMulticast({ tokens, notification: { title, body }, data: { deeplink } })`; prune on `messaging/registration-token-not-registered` / `messaging/invalid-argument` (`DeviceToken.deleteOne`); never throw on one bad token; backoff on 429. See RESEARCH §Pattern 3 for the full ~40-line shape.

**TOCTOU re-check (NPUSH-08) ALREADY EXISTS upstream** in `emit()` (`notificationService.js:167`, plain `Car.findById` suppresses on hidden/non-active) — `send` is only reached after that gate; do not duplicate it, but do not bypass it either.

---

### `backend src/notifications/router.js` device-token routes (route, CRUD) — ADD

**Analog:** the subscription routes in the SAME file (`router.js:205-294`).

**Auth pattern (V4 IDOR, mandatory)** — `router.js:11-16` header + every route: caller identity is ALWAYS `req.auth.uid` from the verified token, NEVER from body/params. Mounted under `verifyIdToken` (NOT an admin gate).

**POST pattern to copy** (`router.js:205-227`):
```javascript
router.post('/subscriptions', async (req, res) => {
  const parsed = createSubscriptionSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  try {
    const uid = req.auth.uid; // server-side identity ONLY — body uid is ignored.
    const created = await Subscription.create({ uid, ... });
    return res.status(201).json(created.toObject());
  } catch (err) { return handleServiceError(err, res, 'create-subscription'); }
});
```
New routes (mirror exactly):
- `POST /device-tokens` (or `/subscriptions-sibling`): zod-validate `{ token, platform }` (platform enum already on the model); upsert on the unique `token` with `uid: req.auth.uid`.
- `DELETE /device-tokens/:token` (or via body): filter includes `uid: req.auth.uid` so another user's token deletes 0 rows (mirror `router.js:283-292` DELETE).

Reuse `handleServiceError` (`router.js:84-91`) + `KNOWN_USER_ERRORS` set (`router.js:62-69`) for error mapping. Validation schema goes alongside the existing `./schemas` import (`router.js:30`).

---

### `backend src/notifications/translations.js` push_* keys (config) — ADD

**Analog:** itself — existing `render`/`interpolate`/`formatSom` (`translations.js:74-104`) and the parity test it cites.

**Add a SEPARATE generic push set** — do NOT reuse the in-app `new_match`/`price_drop`/... bodies (they interpolate `{makeModel}`/`{price}` → D-08b banned). Add `push_*` keys with category-specific title + generic body, NO params:
```javascript
// extend TRANSLATIONS with a generic, param-free push set (illustrative, RU/EN parity)
RU: { push_new_match: { title: 'Новый вариант по поиску', body: 'Откройте, чтобы посмотреть' },
      push_price_drop: { title: 'Цена снизилась', body: 'Откройте, чтобы посмотреть' }, ... }
```
- One canonical body line per category; identical body text across all events of a category (D-07).
- HARD-BAN (D-08b): no KGS amount, no seller identity, no exact location.
- Extend `render` (or add `renderGenericPush(key, lang)`) for the param-free path; `fcm.js` calls it.
- Extend the existing parity test (`__tests__/notification-translations-parity.test.js`) to cover `push_*` AND assert no `{makeModel}`/`{price}` tokens appear in push copy (RESEARCH Wave-0 gap).

---

## Shared Patterns

### Domain-split service (MOB-01) — applies to: PushService, PushContext
**Source:** `src/services/notifications/NotificationService.ts:1-39` (header + apiClient delegation) and `src/services/moderation/ModerationService.ts` (the original split precedent).
Notification/subscription/device-token HTTP MUST NOT go in `AuthService.ts` (grep gate). Every method is a thin `apiClient.<verb>(path, body)` wrapper with `try { ... } catch (e) { console.error(...); throw e; }`.

### Bearer auth via shared apiClient — applies to: all PushService methods (except logout unregister)
**Source:** `src/services/http/client.ts:88-95` (request interceptor) + `:139-183` (401 refresh+retry).
```typescript
apiClient.interceptors.request.use((config) => {
  const token = tokenProvider?.();
  if (token) { config.headers.Authorization = `Bearer ${token}`; }
  return config;
});
```
Backend derives uid from the verified token → client NEVER sends uid (IDOR-safe).

### Context + hook with throw-guard — applies to: PushContext (if created)
**Source:** `src/context/NotificationContext.tsx:202-208`, `AuthContext.tsx:565-571`.
```typescript
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
```
Provider order in `App.tsx:106-113` matters — a PushProvider depending on `useAuth` must nest inside `AuthProvider` (like `NotificationProvider` does).

### Per-user reset on uid transition — applies to: PushContext (if it caches token state)
**Source:** `src/context/NotificationContext.tsx:73-81` (`prevUidRef` sentinel, skip-on-mount), itself mirroring `FavoritesContext.tsx:55-63`.

### Backend IDOR-safe route (uid from token) — applies to: device-token routes
**Source:** `backend src/notifications/router.js:11-16` (header) + every route's `const uid = req.auth.uid;`. Mongo filters always include `uid`; another user's id matches 0 rows.

### i18n RU/EN parity — applies to: mobile translations.ts + backend translations.js
**Source:** `src/constants/translations.ts` (parity scanner) + `backend translations.js:11-13` (`notification-translations-parity.test.js`). Every new key needs both languages; KGS som never ruble; KG-audience terms ([[carex_audience_tone_tolerance]]).

### Server-built deeplink with car-id fallback — applies to: backend send loop + emit deeplink builders
**Source:** `WatchButton.tsx:63` (`car?._id || car?.id || carId`) and `App.tsx` linking whitelist. Never bare `car.id` ([[car_id_field_unreliable]]). `buildWatchDeeplink`/`buildSearchDeeplink` already exported from `notificationService.js:222`.

### firebase-admin cached-OAuth init — applies to: backend fcm.js send loop
**Source:** `backend src/security/firebaseAdmin.js:9-29` (`ensureInitialized`, lazy, throws loud on misconfig). Same `FIREBASE_SERVICE_ACCOUNT_JSON` credential used for `verifyIdToken` serves FCM send (verify it has FCM send scope — RESEARCH A1). Do NOT add `google-auth-library`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `android/app/google-services.json` | config | n/a | Generated artifact downloaded from the Firebase console (human-gated). No code analog; planner flags as a human task. |
| RNFB native handler wiring (`setBackgroundMessageHandler`, `getInitialNotification`, `onTokenRefresh`) | n/a | event-driven | First native-Firebase dependency in the codebase ([[firebase_sdk_split]]) — no prior RNFB usage exists; patterns come from RESEARCH §Pattern 1-2 + rnfirebase.io, not the codebase. Spike-gated. |

> Even where "no analog," the surrounding seams (index.js registrar, App.tsx
> in-tree effect mount, AuthContext lifecycle callbacks) DO have analogs above —
> only the RNFB API calls themselves are net-new.

## Metadata

**Analog search scope:** `src/services/{notifications,moderation,http}`, `src/context/`, `src/components/notifications/`, `src/screens/`, `src/constants/`, `App.tsx`, `index.js`, `ios/{Podfile,carEx/}`, `android/{build.gradle,app/}`, and sibling `backend-services/carEx-services/src/{notifications,models,security}/`.
**Files scanned:** ~22 (10 mobile, 6 native, 6 backend).
**Backend sibling repo:** ACCESSIBLE — read directly (fcm.js stub, DeviceToken.js, firebaseAdmin.js, notificationService.js, router.js, translations.js).
**Pattern extraction date:** 2026-06-06

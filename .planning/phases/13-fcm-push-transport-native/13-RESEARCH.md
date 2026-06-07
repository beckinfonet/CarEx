# Phase 13: FCM Push Transport (native) - Research

**Researched:** 2026-06-06
**Domain:** React Native native push (FCM via RNFB), iOS static-frameworks native build, firebase-admin server-side send
**Confidence:** HIGH (versions, native-build landmines, send-loop pattern verified) / MEDIUM (exact spike pass/fail boundary — only a real-device build proves it)

## Summary

Phase 13 turns the Phase-12 `fcm.send` no-op stub into a real OS-push transport. The single dominant risk is **the iOS native build**: `@react-native-firebase` requires `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true`, and this codebase has TWO known collisions with that mode — (1) `stripe-react-native` on RN 0.81+ fails to find `react/utils/FollyConvert.h` under static frameworks, and (2) RN 0.83's prebuilt React-Core (`RCT_USE_PREBUILT_RNCORE`) references a modulemap that is never generated under static linkage. Both are documented, both have workarounds, and both are exactly why the milestone gates everything behind a 2-day timeboxed spike (NPUSH-01) with a committed pre-frameworks rollback checkpoint and a hard ABORT-AND-REVERT on failure (D-01/D-02). `[VERIFIED: GitHub stripe/stripe-react-native#2065, invertase/react-native-firebase #7731/#8960, web search 2026]`

The rest of the phase is mechanically well-understood and low-risk *once the spike passes*: install RNFB 24.1.0 (app + messaging locked-step), wire APNs `.p8` to Firebase, configure Android google-services + `POST_NOTIFICATIONS` + a default channel, register/refresh/unregister device tokens in `AuthContext`, handle the 3 app states (`setBackgroundMessageHandler` at the top of `index.js` + `getInitialNotification` for cold-start + `onNotificationOpenedApp` for background), route `data.deeplink` through the existing `linking` config, and replace the backend stub with a `firebase-admin` send loop that prunes dead tokens and never aborts the fan-out on one bad token. A contextual soft pre-prompt (NPRF-06) precedes the OS dialog, fired once on first Watch/Save-search, with a Settings-screen recovery path that reflects live OS permission status.

**Primary recommendation:** Make the spike a hard Wave-0 gate. Spike succeeds ONLY when a **Release archive runs on a real device with Stripe checkout still working**. Add `$RNFirebaseAsStaticFramework = true`, `use_frameworks! :linkage => :static`, and set `RCT_USE_PREBUILT_RNCORE=0`; verify Stripe's FollyConvert header resolves under static frameworks before declaring victory. Plan every downstream task as conditional on the spike passing.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Native build / static-frameworks switch | iOS native (Podfile/Xcode) | — | Pods + Xcode capabilities only; spike-gated |
| Permission request + soft pre-prompt | Mobile client (RN) | — | OS dialog can only be triggered client-side, contextually |
| Device-token capture/refresh | Mobile client (RNFB messaging) | API (persist) | Token is a device fact; backend stores it |
| Device-token persistence + prune | API / Backend | DB (DeviceToken) | Server owns the send fan-out source of truth |
| 3-state message handling + tap routing | Mobile client (RN/index.js) | — | Handlers run in/around the JS runtime + native launch |
| Deeplink routing | Mobile client (existing `linking`) | API (builds URL) | URL built server-side, parsed client-side — both exist already |
| Push send (fan-out, backoff, prune) | API / Backend (firebase-admin) | DB | `firebase-admin` already installed; replaces the stub |
| Generic PII-safe body rendering | API / Backend (translations.js) | — | Body chosen at send time, in user's `User.language` |
| TOCTOU hide-hook re-check at send | API / Backend (notificationService.emit) | DB | Already enforced via plain `Car.findById`; reused |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Spike timebox is **2 days** — hard abort trigger.
- **D-02:** If the spike cannot produce a Stripe-intact Release build that runs on a real device within the timebox → **ABORT & REVERT** to the pre-frameworks checkpoint; ship Phase-12 in-app center as the only channel for this milestone; re-attempt push in a future milestone. Do NOT extend the timebox; do NOT pivot to an alternate transport this phase.
- **D-03:** The **notifee-fallback decision is the spike's output** (RNFB built-in display vs `@notifee/react-native`), recorded inside the spike — not pre-locked.
- **D-04:** Soft pre-prompt fires **once, on the first Watch OR first Save-search** (single ask covers both).
- **D-05:** "Not now" = **never auto-re-ask**; re-entry only via the recovery path (D-09).
- **D-06:** Pre-prompt copy is **plain & functional, RU-first** (e.g. "Включить уведомления, чтобы не пропустить новые совпадения?"), "Включить" / "Не сейчас" — NOT UNHINGED voice.
- **D-07:** Push bodies are **fully generic, one canonical line per category** — NO make/model, NO price, NO KGS amount.
- **D-08:** Structure is **category-specific title + generic body** (e.g. title "Цена снизилась" / body "Откройте, чтобы посмотреть"), not a single app-name line.
- **D-08b:** **Hard-banned from any push payload:** price amount (KGS), seller identity, exact location. Never on the lock screen.
- **D-09:** Re-enable path lives on **NotificationSettingsScreen** — a "Push: Off — Enable in Settings" row deep-linking to OS app-settings. No nagging banner.
- **D-10:** Recovery uses **deep-link to OS Settings** (app cannot re-trigger the native dialog after deny), not static text.
- **D-11:** NotificationSettingsScreen **reflects live OS permission status** ("On"/"Off").

### Claude's Discretion
- Device-token model shape / multi-device handling, OAuth caching mechanics, exponential-backoff tuning, channel/entitlement wiring details (all bounded by NPUSH-02..06).
- notifee adoption — deferred to spike (D-03).

### Deferred Ideas (OUT OF SCOPE)
- Re-attempting native push after a spike abort (future milestone).
- UNHINGED-voice push copy (rejected for this phase, D-06).
- In-notification-center re-enable banner (rejected in favor of Settings-only, D-09).
- Daily-digest worker + scheduled delivery (Phase 14).
- Any new notification *categories* beyond Phase-12's instant set.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NPUSH-01 | Timeboxed iOS Podfile static-frameworks spike, Stripe-intact Release build on real device, rollback checkpoint, notifee decision | §Spike Mechanics, §Common Pitfalls 1-3 — the FollyConvert + prebuilt-core landmines and their workarounds |
| NPUSH-02 | RNFB app+messaging 24.x locked-step, iOS ≥15, Android google-services + POST_NOTIFICATIONS + default channel | §Standard Stack (24.1.0 verified), §Android Setup; iOS target ALREADY 15.1 |
| NPUSH-03 | APNs `.p8` to Firebase; aps-environment entitlement + Push/Background-modes; verified on device | §iOS APNs + Entitlements (entitlements file + GoogleService-Info.plist already present) |
| NPUSH-04 | Device-token lifecycle in AuthContext: register login/signup, refresh onTokenRefresh, unregister logout (capture token before idToken ref clears) | §Device-Token Lifecycle — exact AuthContext hook points + ordering trap |
| NPUSH-05 | Backend `firebase-admin.messaging()` per-token send (cached OAuth, backoff on 429), prune UNREGISTERED/INVALID_ARGUMENT, never abort fan-out | §Backend Send Loop — sendEachForMulticast + error-code mapping |
| NPUSH-06 | Foreground/background/quit handled; `setBackgroundMessageHandler` at top of `index.js`; `getInitialNotification()` cold-start | §3-State Handling — registration locations |
| NPUSH-07 | Push tap (incl. cold-start) routes `data.deeplink` through existing `linking`; deeplinks built with `car._id \|\| car.id \|\| carId` | §Deeplink Routing — backend already builds `carex://listing/:carId`; Android manifest gap flagged |
| NPUSH-08 | Send-time hide-hook/moderation TOCTOU re-check; generic PII-safe bodies (no leakage) | §PII-Safe Push Copy — DO NOT reuse in-app body params; emit() TOCTOU already exists |
| NPRF-06 | Soft in-app pre-prompt with "Not now"; never on launch; contextual on first Watch/Save-search | §Contextual Permission — attach to WatchButton + SaveSearchBar |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-firebase/app` | **24.1.0** | RNFB core; native Firebase init | The only maintained RN FCM binding; locked-step with messaging `[VERIFIED: npm 2026-06-05]` |
| `@react-native-firebase/messaging` | **24.1.0** | FCM token + message handling | Token lifecycle + 3-state handlers `[VERIFIED: npm 2026-06-05]` |
| `firebase-admin` | **^13.8.0 (already installed)** | Backend send via `messaging().send*` | Already used for `verifyIdToken`; sanctioned per [[firebase_sdk_split]]. **Do NOT add `google-auth-library`** (admin SDK caches OAuth internally) `[VERIFIED: backend package.json]` |

### Supporting / conditional
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@notifee/react-native` | 9.1.8 | Rich foreground notification display | **ONLY if the spike (D-03) decides RNFB built-in display is insufficient.** Not pre-locked. Adds another native pod — re-run the static-frameworks build if adopted `[VERIFIED: npm]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RNFB messaging | Bare APNs + FCM HTTP v1 (no native SDK) | Avoids the static-frameworks landmine BUT loses token mgmt, 3-state handlers, and is far more native code. Rejected — NPUSH-02 mandates RNFB; the spike exists to de-risk it |
| `sendEachForMulticast` | per-token `send()` in a `for` loop | Loop is what NPUSH-05 literally says; multicast is the modern efficient form (≤500 tokens/call, indexed responses). See §Backend Send Loop for reconciliation |

**Installation (mobile — ONLY after the spike passes):**
```bash
npm install @react-native-firebase/app@24.1.0 @react-native-firebase/messaging@24.1.0
cd ios && RCT_USE_PREBUILT_RNCORE=0 pod install
```

**Version verification (run during planning to confirm currency):**
```bash
npm view @react-native-firebase/app version      # 24.1.0 as of 2026-06-05
npm view @react-native-firebase/messaging version # 24.1.0
```
`[VERIFIED: npm registry, 2026-06-06]`

## Architecture Patterns

### System Architecture Diagram

```
                          BACKEND (carEx-services, sibling repo, Railway)
  Car/Booking event ──▶ notificationService.emit(event)
                          │  (a) plain Car.findById  ── TOCTOU hide-hook re-check (NPUSH-08, EXISTS)
                          │  (b) resolveTargets → matchSavedSearches / watch subs
                          │  (c) actor-exclusion, (d) price-direction, (e) dedup
                          ▼
                        Notification.create({titleKey,bodyKey,params,data.deeplink})  ── in-app row (Phase 12)
                          │
                  cadence==='instant' ──▶ fcm.send({uid, ...})   ◀── REPLACE THE STUB (NPUSH-05)
                          │
                          ▼
                  DeviceToken.find({uid})  ─ fan-out source of truth
                          │
                  render GENERIC push title+body in User.language (NO PII, D-07/D-08b)
                          │
                  firebase-admin messaging().sendEachForMulticast({tokens, notification, data:{deeplink}})
                          │   429 → exponential backoff;  per-response error:
                          │   registration-token-not-registered / invalid-argument → DeviceToken.deleteOne
                          ▼
                        ════════ FCM ════════ ▶ APNs (iOS) / FCM (Android)
                                                      │
   MOBILE (carEx)                                     ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ index.js TOP: messaging().setBackgroundMessageHandler(...)  (NPUSH-06) │
   │   ── registered OUTSIDE the React tree, BEFORE AppRegistry             │
   │                                                                        │
   │ App lifecycle:                                                         │
   │   foreground  → onMessage()            ── (display via RNFB/notifee)   │
   │   background tap → onNotificationOpenedApp() ─┐                        │
   │   QUIT/cold tap → getInitialNotification()  ─┴▶ data.deeplink         │
   │                                                  │                     │
   │                              Linking.openURL / navigation              │
   │                                       ▼                                │
   │   existing linking config: carex://listing/:carId → CarDetails        │
   │                            carex://search          → SearchResults     │
   └──────────────────────────────────────────────────────────────────────┘

   AuthContext (NPUSH-04): login/signup → getToken()+register; onTokenRefresh → re-register;
                           logout → CAPTURE token BEFORE currentIdTokenRef clears → unregister

   Permission (NPRF-06): first Watch/Save-search → soft pre-prompt → OS dialog
                         deny → NotificationSettingsScreen row → Linking.openSettings()
```

### Recommended Task / Component Structure
```
ios/Podfile                      # static frameworks + $RNFirebaseAsStaticFramework (spike)
ios/carEx/carEx.entitlements     # add aps-environment (EXISTS — has associated-domains)
ios/carEx/Info.plist             # add UIBackgroundModes: remote-notification
android/build.gradle             # add classpath com.google.gms:google-services
android/app/build.gradle         # apply plugin com.google.gms.google-services (bottom)
android/app/google-services.json # NEW — download from Firebase console
android/app/src/main/AndroidManifest.xml  # POST_NOTIFICATIONS + default-channel meta + carex://search host gap
index.js                         # setBackgroundMessageHandler at top
src/services/push/PushService.ts # NEW domain module (mirror NotificationService split, NOT in AuthService)
src/context/AuthContext.tsx      # token register/refresh/unregister hooks
src/components/notifications/WatchButton.tsx     # pre-prompt trigger (first sub)
src/components/notifications/SaveSearchBar.tsx   # pre-prompt trigger (first sub)
src/screens/NotificationSettingsScreen.tsx       # denied-recovery row + live status
src/constants/translations.ts    # pre-prompt + recovery + generic push copy (RU/EN parity)
--- backend (sibling repo) ---
src/notifications/push/fcm.js     # replace stub: DeviceToken fan-out + send loop + prune
src/notifications/router.js       # NEW POST/DELETE /subscriptions-sibling device-token routes (uid from token)
src/notifications/translations.js # NEW generic push keys (push_*_title / push_*_body)
```

### Pattern 1: Background handler registered outside React (NPUSH-06)
**What:** `setBackgroundMessageHandler` MUST be registered at module scope in `index.js`, before/around `AppRegistry.registerComponent`, because the OS spins up the JS context with NO React tree for a background/quit data message.
**Example:**
```js
// index.js — Source: https://rnfirebase.io/messaging/usage (CITED)
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  // Keep minimal — runs headless. Display/route work happens on tap via
  // getInitialNotification / onNotificationOpenedApp inside the tree.
});

AppRegistry.registerComponent(appName, () => App);
```

### Pattern 2: Three-state tap routing (NPUSH-06/07)
**What:** Cold-start (quit) uses `getInitialNotification()` once on mount; background uses `onNotificationOpenedApp()`; foreground uses `onMessage()`. All three read `data.deeplink` and feed it to the existing `linking`.
**Example:**
```js
// Inside a mounted effect (App subtree). Source: rnfirebase.io/messaging/notifications (CITED)
import { Linking } from 'react-native';
// quit → cold start (run ONCE; guard against double-handling)
messaging().getInitialNotification().then(msg => {
  if (msg?.data?.deeplink) Linking.openURL(msg.data.deeplink);
});
// background → foreground via tap
const unsub = messaging().onNotificationOpenedApp(msg => {
  if (msg?.data?.deeplink) Linking.openURL(msg.data.deeplink);
});
```
`Linking.openURL('carex://...')` is the simplest route into the existing config; the alternative is `navigationRef.navigate`. The existing `linking` already whitelists `CarDetails: 'listing/:carId'` and `SearchResults: 'search'` (App.tsx:88-95).

### Pattern 3: Backend send via firebase-admin (NPUSH-05)
**What:** `messaging().sendEachForMulticast` sends to ≤500 tokens, returns `responses[]` aligned by index; prune on registration errors; retry transient/429 with backoff; never let one bad token abort.
**Example:**
```js
// backend src/notifications/push/fcm.js — Source: firebase.google.com/docs/cloud-messaging/send/admin-sdk (CITED)
const { ensureInitialized } = require('../../security/firebaseAdmin'); // EXISTS, caches OAuth
async function send({ uid, titleKey, bodyKey, lang, data }) {
  const admin = ensureInitialized();
  const tokens = (await DeviceToken.find({ uid }).lean()).map(t => t.token);
  if (!tokens.length) return { ok: true, delivered: 0 };
  const { title, body } = renderGenericPush(titleKey, bodyKey, lang); // NO PII (D-08b)
  const resp = await admin.messaging().sendEachForMulticast({
    tokens, notification: { title, body }, data: { deeplink: data.deeplink },
  });
  await Promise.all(resp.responses.map(async (r, i) => {
    if (r.success) return;
    const code = r.error?.code; // 'messaging/registration-token-not-registered' | 'messaging/invalid-argument'
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-argument') {
      await DeviceToken.deleteOne({ token: tokens[i] }); // prune; never throw
    }
    // else: transient/429 — log; rely on next emit (or add bounded retry+backoff)
  }));
  return { ok: true, delivered: resp.successCount };
}
```
**Reconciling with NPUSH-05's "per-token loop":** `sendEachForMulticast` internally fans out one HTTP request per token (it is NOT the legacy batch `/batch` endpoint) and returns per-token results — it satisfies the spirit of the requirement (per-token isolation, one bad token never aborts) while being the current recommended API. A literal `for`-loop of `send()` is also acceptable; document whichever the plan picks. `[VERIFIED: firebase docs + GitHub firebase-admin-node]`

### Anti-Patterns to Avoid
- **Reusing the in-app Notification body in the push payload.** The existing in-app rows/`translations.js` embed `{makeModel}`, `{price}`, `{newPrice}` — these are HARD-BANNED from push (D-08b). The send loop must render a SEPARATE generic copy set. (See §PII-Safe Push Copy.)
- **Requesting permission on app launch.** NPRF-06 forbids it. Only on first Watch/Save-search, behind the soft pre-prompt.
- **Calling `messaging().getToken()` before the static-frameworks build is proven.** Adding RNFB at all is spike-gated ([[firebase_sdk_split]]).
- **Unregistering the token AFTER `currentIdTokenRef` is cleared in `logout()`.** AuthContext.logout() clears the token ref FIRST (line 439); the backend unregister call needs a valid Bearer. Capture the device token AND fire the unregister BEFORE the ref clears (NPUSH-04 explicit).
- **Adding `google-auth-library` to the backend.** firebase-admin already manages/caches OAuth. (STATE decision, line 169.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FCM token acquisition/refresh | Manual APNs token plumbing | RNFB `getToken()` / `onTokenRefresh()` | Cross-platform, handles APNs↔FCM mapping |
| 3-state message delivery | Custom native notification observers | RNFB `setBackgroundMessageHandler` / `getInitialNotification` / `onNotificationOpenedApp` / `onMessage` | The whole reason to take the native dependency |
| Server OAuth for FCM v1 | `google-auth-library` token minting | `firebase-admin` (cached creds) | Already installed; admin SDK caches the OAuth token |
| Multi-token send + error mapping | Hand-rolled HTTP v1 loop | `messaging().sendEachForMulticast` | Indexed per-token results, isolates failures |
| Deeplink parsing | New navigation handler | Existing App.tsx `linking` config | `listing/:carId` + `search` already wired (Phase 12) |
| Live OS permission read | Polling hacks | RNFB `messaging().hasPermission()` / `requestPermission()` | Returns AuthorizationStatus for the live-status row (D-11) |

**Key insight:** Almost everything in this phase already has a sanctioned library or an existing codebase seam (the linking config, the emit TOCTOU re-check, firebase-admin, the NotificationService split pattern). The genuinely NEW custom work is small: the device-token model is already defined, the send loop is ~40 lines, and the permission pre-prompt is a small UI flow. The risk budget is almost entirely in the iOS build.

## Runtime State Inventory

> Phase 13 is greenfield-additive (new transport), not a rename/refactor. Included for the cross-repo + native-registration surface, which a grep cannot find.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `DeviceToken` collection (defined Phase 12, EMPTY — no write path yet). `token` globally unique, `{uid}` index. | Backend: add register/unregister write path (router). Mobile: populate via RNFB token. |
| Live service config | **Firebase project console** (not in git): APNs `.p8` auth key must be uploaded; `google-services.json` (Android) downloaded from console; `GoogleService-Info.plist` ALREADY in `ios/carEx/`. FCM API must be enabled. | Manual console steps — flag as human-gated tasks. |
| OS-registered state | iOS Push Notifications capability + Background Modes (remote-notification) registered in Xcode project/entitlements; Android default notification channel created at runtime. | Xcode capability + entitlement edit; Android channel-create call. |
| Secrets/env vars | Backend `FIREBASE_SERVICE_ACCOUNT_JSON` (already used by `firebaseAdmin.js` for verifyIdToken) — same credential serves FCM send. No new secret needed for send. | None new — verify the service account has FCM send scope. |
| Build artifacts | iOS `Pods/` + `Podfile.lock` change materially under static frameworks; a `pod deintegrate` may be needed when toggling linkage. RN 0.83 prebuilt-core cache. | Spike must `pod install` clean; rollback checkpoint must capture pre-frameworks `Podfile.lock`. |

**Cross-repo note:** Backend lives at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` and Railway deploys backend `main` ([[backend_deploy_gotcha]]). The send-loop change + device-token routes ship there; they will NOT take effect in prod until merged to backend `main`. Plan the backend work as a distinct deployable unit.

## Common Pitfalls

### Pitfall 1: Stripe + static frameworks → `FollyConvert.h` not found (SPIKE-CRITICAL)
**What goes wrong:** On RN 0.81+, after `use_frameworks! :linkage => :static`, `stripe-react-native`'s `RCTFollyConvert.h` references `<react/utils/FollyConvert.h>`, which is no longer publicly exposed in the static React-Core framework → build fails.
**Why:** RN reorganized New-Architecture internal headers; static frameworks change header visibility.
**How to avoid:** This is THE spike's central test. Workarounds reported: header-search-path patch, or a post_install that re-exposes the header; the spike must find and commit the working combination. The existing Podfile already has Stripe-specific `OTHER_CPLUSPLUSFLAGS` post-install hooks (lines 41-48) that MUST be preserved through the linkage switch.
**Warning signs:** `'react/utils/FollyConvert.h' file not found` during `pod install`/Xcode build. `[VERIFIED: GitHub stripe/stripe-react-native#2065]`

### Pitfall 2: RN 0.83 prebuilt React-Core vs static linkage (SPIKE-CRITICAL)
**What goes wrong:** RN 0.83 ships a prebuilt `React-Core-prebuilt` pod that references `React-use-frameworks.modulemap`, which is never generated when `use_frameworks: :static` is enabled → missing-modulemap build failure.
**Why:** The 0.83+ prebuilt-binary system was not designed for static frameworks.
**How to avoid:** Set `RCT_USE_PREBUILT_RNCORE=0` (env var at `pod install` time) to fall back to source-built React-Core, OR (RN 0.84+/Expo path) use `forceStaticLinking`. This project is bare RN 0.83 → use the env-var workaround. Record the exact incantation in the spike output.
**Warning signs:** modulemap-not-found / `React-use-frameworks.modulemap` errors. `[VERIFIED: web search 2026, invertase #8960]`

### Pitfall 3: Spike "passes" on simulator but fails on device / Release
**What goes wrong:** Debug + simulator can mask static-framework + APNs issues. APNs entitlements and push delivery only work on a real device with a Release-signed build.
**Why:** Simulator has no APNs; Debug uses Metro-served JS, masking archive-time bundling problems.
**How to avoid:** D-02's pass bar is explicit — **Release archive, real device, Stripe checkout works.** Make that the literal spike acceptance criterion. `[CITED: NPUSH-01 / D-02]`

### Pitfall 4: Token-unregister race in logout (NPUSH-04)
**What goes wrong:** `AuthContext.logout()` clears `currentIdTokenRef` FIRST (line 439). If the device-token unregister call fires after that, it has no Bearer and the backend can't authorize the delete → stale token keeps receiving pushes after logout.
**How to avoid:** Capture the FCM token and call the backend unregister BEFORE the ref clear (or pass the token to a fire-and-forget unregister that uses the still-valid token). NPUSH-04 calls this out explicitly: "token captured before the idToken ref clears."
**Warning signs:** Logged-out device still receives the previous user's pushes. `[VERIFIED: AuthContext.tsx:435-459]`

### Pitfall 5: Android `carex://search` deeplink host not declared (NPUSH-07)
**What goes wrong:** AndroidManifest declares intent-filters for `carex://listing` and `carex://stripe-redirect` and `https://www.carexmarket.com/listing`, but NOT `carex://search`. A push tap routing to a saved-search result via `carex://search?...` may not resolve from a cold start on Android.
**Why:** Android needs an explicit intent-filter per scheme/host for OS-level URL dispatch (RN Linking on a cold start relies on the launch intent).
**How to avoid:** Either add a `carex` (no host) / `carex://search` intent-filter, OR route via `getInitialNotification()` → in-JS navigation rather than relying on OS URL dispatch (the RNFB tap handler gives you `data.deeplink` directly, so in-JS `navigationRef.navigate` sidesteps the manifest gap entirely). Prefer the in-JS route for push taps. `[VERIFIED: AndroidManifest.xml:24-45 + App.tsx linking]`

### Pitfall 6: Android 13+ POST_NOTIFICATIONS runtime permission
**What goes wrong:** On Android 13 (API 33)+, notifications are silently dropped unless `POST_NOTIFICATIONS` is both declared AND granted at runtime. RNFB `requestPermission()` triggers it on iOS; Android needs the manifest entry + runtime request.
**How to avoid:** Declare `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` and request at the same contextual moment as iOS (NPRF-06 pre-prompt → OS dialog). Create a default channel before first notification or messages won't display.
**Warning signs:** iOS pushes work, Android silently doesn't. `[CITED: Android docs / RNFB messaging]`

### Pitfall 7: PII leaking onto the lock screen via `notification` payload
**What goes wrong:** Putting the in-app body (`{makeModel} — {price} сом`) into the FCM `notification.body` leaks make/model/price to the lock screen — violates D-07/D-08b.
**How to avoid:** Render a SEPARATE generic push copy set server-side; carry routing context only in `data` (the `deeplink`), never identifying detail in `notification`. (See §PII-Safe Push Copy.) `[CITED: D-07/D-08b]`

## PII-Safe Push Copy (NPUSH-08 / D-07/D-08b)

The existing in-app copy (mobile `translations.ts:1037-1046`, backend `translations.js`) is **NOT reusable for push** — it interpolates `{makeModel}`, `{price}`, `{newPrice}`, `{oldPrice}`. Push needs a NEW generic set, one canonical line per category, rendered in `User.language`:

| Category | Title (RU example) | Body (RU example — generic) | EN parity required |
|----------|--------------------|------------------------------|---------------------|
| new_match | "Новый вариант по поиску" | "Откройте, чтобы посмотреть" | yes |
| price_drop | "Цена снизилась" | "Откройте, чтобы посмотреть" | yes |
| booked | "Авто забронировали" | "Откройте, чтобы посмотреть" | yes |
| sold | "Авто продали" | "Откройте, чтобы посмотреть" | yes |
| back_available | "Авто снова в продаже" | "Откройте, чтобы посмотреть" | yes |

These are ILLUSTRATIVE (per CONTEXT specifics) — the planner finalizes exact lines with RU/EN parity, observing the D-08b hard-ban (no KGS amount, no seller, no exact location). The backend parity test pattern from Phase 12 (`notification-translations-parity.test.js`) should be extended to the new `push_*` keys. `[VERIFIED: translations files both repos]`

## Device-Token Lifecycle (NPUSH-04)

Existing `DeviceToken` model (backend): `{ uid, token (unique), platform, appVersion, createdAt, lastSeenAt }`, `{uid}` index. Multi-device is natural — multiple rows per uid; a re-registered token (unique) upserts rather than duplicates.

AuthContext seam points (file: `src/context/AuthContext.tsx`):
- **login** (line 385) / **signup** (line 414): after session saved, `getToken()` → POST register `{ token, platform, appVersion }` (uid derived from Bearer server-side — IDOR-safe, mirrors NotificationService).
- **onTokenRefresh**: subscribe once (in a mounted effect or PushService); re-register on fire.
- **logout** (line 435): **BEFORE** `currentIdTokenRef.current = null` (line 439), capture the FCM token and fire the backend unregister (DELETE) with the still-valid Bearer. (Pitfall 4.)

Keep all push HTTP in a NEW `PushService`/`PushContext` domain module, NOT in `AuthService` — the MOB-01 guardrail forbids notification/subscription HTTP in AuthService and a grep gate enforces it. The token-register/unregister endpoints are device-domain; put them on the notifications router (uid from token) and call via a thin client wrapper (mirror the ModerationService/NotificationService split). `[VERIFIED: DeviceToken.js, AuthContext.tsx, NotificationService.ts MOB-01 note]`

## Contextual Permission Pre-Prompt (NPRF-06)

- Attach the soft pre-prompt trigger to the FIRST successful Watch (`src/components/notifications/WatchButton.tsx`) OR first Save-search (`src/components/notifications/SaveSearchBar.tsx`) — whichever fires first (D-04, single ask covers both).
- Persist a "pre-prompt shown / dismissed" flag (AsyncStorage; "Not now" = never auto-re-ask, D-05).
- Soft prompt (in-app modal) → on "Включить" call RNFB `requestPermission()` (iOS dialog) + Android `POST_NOTIFICATIONS` request → on grant, register token.
- Recovery (D-09/D-10/D-11) on NotificationSettingsScreen: a row reading live status via `messaging().hasPermission()`; when off, `Linking.openSettings()` to OS app settings. The screen already exists and has the settings-row layout pattern.
- Copy is plain/functional RU-first (D-06) — add `pushPrePromptTitle`, `pushPrePromptBody`, `pushEnable` ("Включить"), `notNow` (EXISTS line 956), `pushStatusOn`, `pushStatusOff`, `pushEnableInSettings` to translations with EN parity. `[VERIFIED: WatchButton/SaveSearchBar paths, NotificationSettingsScreen.tsx, translations.ts]`

## iOS APNs + Entitlements (NPUSH-03)

- iOS deployment target is ALREADY 15.1 (`project.pbxproj` — exceeds the ≥15 requirement; no change needed). `[VERIFIED]`
- `GoogleService-Info.plist` ALREADY present in `ios/carEx/`. `[VERIFIED]`
- `carEx.entitlements` EXISTS (has `associated-domains`) — ADD `aps-environment` (development → production). `[VERIFIED]`
- `Info.plist`: ADD `UIBackgroundModes` → `remote-notification` (not currently present). `[VERIFIED — absent]`
- Xcode: enable Push Notifications + Background Modes capabilities.
- Firebase console (human-gated): upload APNs `.p8` auth key (preferred over `.p12`) with Key ID + Team ID.
- `AppDelegate.swift` is minimal/standard (uses `RCTReactNativeFactory`); RNFB's iOS swizzling generally handles APNs registration, but verify whether the RNFB iOS setup requires `didReceiveRemoteNotification`/registration forwarding given this newer AppDelegate shape — confirm during the spike. `[VERIFIED: AppDelegate.swift]`

## Android Setup (NPUSH-02)

- `android/build.gradle`: ADD `classpath("com.google.gms:google-services:4.4.4")` (currently absent). `[VERIFIED — absent]`
- `android/app/build.gradle`: ADD `apply plugin: "com.google.gms.google-services"` at the BOTTOM (currently absent). `[VERIFIED — absent]`
- `android/app/google-services.json`: NEW — download from Firebase console (human-gated).
- `AndroidManifest.xml`: ADD `POST_NOTIFICATIONS` permission; ADD default-channel `<meta-data>` (`com.google.firebase.messaging.default_notification_channel_id`); consider the `carex://search` intent-filter gap (Pitfall 5). `[VERIFIED — manifest has only listing/stripe hosts]`
- `compileSdk`/`targetSdk` come from `rootProject.ext` — confirm target ≥33 so POST_NOTIFICATIONS runtime model applies; check `android/build.gradle` ext block during planning.

## Code Examples

### Live permission status for the recovery row (D-11)
```js
// Source: rnfirebase.io/messaging/usage (CITED)
import messaging from '@react-native-firebase/messaging';
const status = await messaging().hasPermission();
const enabled = status === messaging.AuthorizationStatus.AUTHORIZED
             || status === messaging.AuthorizationStatus.PROVISIONAL;
```

### Open OS settings for re-enable (D-10)
```js
import { Linking } from 'react-native';
Linking.openSettings(); // routes to this app's OS settings page
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `use_frameworks!` (dynamic) | `:linkage => :static` + `$RNFirebaseAsStaticFramework = true` | RNFB v15 / firebase-ios-sdk v9+ | Mandatory for RNFB on iOS; the whole spike premise |
| Legacy FCM batch `sendMulticast`/`sendAll` | `sendEachForMulticast` / `sendEach` | firebase-admin v11+ | Old methods deprecated/removed; use the "each" variants |
| FCM legacy HTTP API + server key | FCM HTTP v1 + OAuth (via firebase-admin) | 2024 (legacy API shut down) | Must use firebase-admin; no static server key |
| Permission-on-launch | Contextual pre-prompt | iOS best practice / App Store norms | Encoded as NPRF-06 |

**Deprecated/outdated:**
- `messaging().sendMulticast()` / `sendAll()` — replaced by `sendEachForMulticast()` / `sendEach()`.
- FCM legacy server-key HTTP — gone; firebase-admin only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 (mobile: `preset: react-native`; backend: jest ^29.7.0) |
| Config file | mobile `jest.config.js`; backend `package.json` jest block |
| Quick run command | `npx jest path/to/file` |
| Full suite command | `npm test` (each repo) |

### Critical caveat — most NPUSH criteria are real-device, NOT unit-testable
RNFB native handlers (`setBackgroundMessageHandler`, `getInitialNotification`, `onMessage`, token acquisition, OS permission) require native modules and a real device/Release build. They CANNOT run in Jest. The spike (NPUSH-01), APNs delivery (NPUSH-03), 3-state taps (NPUSH-06), and cold-start deeplink (NPUSH-07) are **human/real-device validation** — they belong in a HUMAN-UAT artifact, not automated tests. Plan them as device-checklist items.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NPUSH-01 | Release archive on device, Stripe intact | manual (real device) | — (device checklist) | ❌ UAT |
| NPUSH-02 | RNFB installed, channel/perms declared | build + manual | `cd ios && pod install` / gradle build | ❌ Wave 0 |
| NPUSH-03 | APNs delivers to real device | manual (real device) | — | ❌ UAT |
| NPUSH-04 | token register/refresh/unregister ordering | unit (logic), manual (token) | `npx jest .../PushService.test` | ❌ Wave 0 |
| NPUSH-05 | send loop prunes bad tokens, never aborts fan-out | unit (backend, mock firebase-admin) | `npx jest src/notifications/push/fcm.test.js` | ❌ Wave 0 |
| NPUSH-06 | 3 states handled | manual (real device) | — | ❌ UAT |
| NPUSH-07 | cold-start tap → CarDetails | manual (real device) | — | ❌ UAT |
| NPUSH-08 | generic PII-safe body; TOCTOU re-check | unit (backend: assert no PII params in push payload; parity test) | `npx jest src/notifications/__tests__/push-copy-parity.test.js` | ❌ Wave 0 |
| NPRF-06 | pre-prompt fires once; "Not now" never re-asks | unit (mobile, mock RNFB) | `npx jest .../prePrompt.test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest` on the touched test file (backend send loop, push-copy parity, PushService logic, pre-prompt logic).
- **Per wave merge:** `npm test` (full suite, each affected repo).
- **Phase gate:** full suite green in both repos + the real-device HUMAN-UAT checklist signed off before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend src/notifications/push/fcm.test.js` — send loop: prune on registration-token-not-registered/invalid-argument, never-abort-on-one-bad-token, backoff on 429 (mock firebase-admin) — covers NPUSH-05.
- [ ] `backend src/notifications/__tests__/push-copy-parity.test.js` — generic `push_*` keys RU/EN parity + ASSERT no `{makeModel}`/`{price}` tokens in push copy — covers NPUSH-08/D-08b.
- [ ] `backend` device-token route tests (register/unregister, uid-from-token IDOR-safe).
- [ ] `mobile PushService.test.ts` — token register/unregister ordering vs logout idToken-clear — covers NPUSH-04 logic.
- [ ] `mobile prePrompt.test.tsx` — fires once on first sub, "Not now" persists never-re-ask — covers NPRF-06.
- [ ] `13-HUMAN-UAT.md` — real-device checklist for NPUSH-01/03/06/07 (the non-automatable criteria).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Device-token routes derive uid from the verified Bearer (no body uid) — existing pattern |
| V4 Access Control | yes | Token register/unregister + send are uid-scoped; IDOR-safe (mirror NotificationService) |
| V5 Input Validation | yes | Validate `{token, platform}` on register (platform enum already on model) |
| V6 Cryptography | no (delegated) | FCM/APNs transport crypto handled by Google/Apple SDKs; service account is the only secret |
| V8 Data Protection (privacy) | yes | D-08b PII hard-ban — no price/seller/location on the lock screen; assert in tests |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lock-screen PII leakage | Information Disclosure | Generic push body; routing detail only in `data.deeplink` (NPUSH-08/D-08b) |
| Stale token receiving pushes after logout | Information Disclosure | Unregister before idToken-ref clears (NPUSH-04, Pitfall 4) |
| Notifying a hidden/suspended listing | Information Disclosure / TOCTOU | Send-time plain `Car.findById` re-check (already in emit, NPUSH-08) |
| IDOR on device-token routes | Elevation / Tampering | uid from verified token, never from body (existing convention) |
| One poisoned token aborting fan-out | Denial of Service | Per-token isolation; prune dead tokens; never throw on one failure (NPUSH-05) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The same `FIREBASE_SERVICE_ACCOUNT_JSON` used for `verifyIdToken` has FCM send scope | Standard Stack / Runtime State | Send fails in prod with a permission error; verify the service account role in Firebase IAM before relying on it |
| A2 | `RCT_USE_PREBUILT_RNCORE=0` resolves the RN 0.83 prebuilt-core vs static-frameworks conflict for THIS project (bare RN, not Expo) | Pitfall 2 | Spike may need an alternate workaround; this is precisely what the spike must prove — not a blocker, but don't assume it's free |
| A3 | The newer `RCTReactNativeFactory` AppDelegate needs no manual APNs registration forwarding (RNFB swizzling suffices) | iOS APNs | May need AppDelegate edits for token forwarding; confirm in spike |
| A4 | `targetSdkVersion` (from `rootProject.ext`) is ≥33, making POST_NOTIFICATIONS runtime-gated | Android Setup | If <33, runtime request model differs; check the ext block during planning |

## Open Questions

1. **notifee adoption (D-03 — deferred to spike).**
   - What we know: D-03 says the RNFB-built-in-display vs `@notifee/react-native` choice is the spike's output. RNFB displays background/quit notifications natively; foreground display on iOS/Android often needs help.
   - What's unclear: Whether Phase 13's generic-body lock-screen pushes need notifee at all (background/quit display works without it). Foreground display is lower priority (app is open → in-app center is visible).
   - Recommendation: Default to RNFB built-in display (no notifee) for Phase 13; the spike records the decision. notifee is v2 (NOTF2-01). Adopting it adds a pod → re-run the static-frameworks build.

2. **Send-loop placement: synchronous in `emit()` vs queued.**
   - What we know: Phase 12 already calls `fcm.send` synchronously after `Notification.create` for instant cadence (notificationService.js:212).
   - What's unclear: Whether a slow/large fan-out should block the emit path (off the request hot path already per NDOM-04, but still in-process).
   - Recommendation: Keep synchronous-with-isolation for Phase 13 (per-token failures swallowed); the cron/queue refinement is Phase 14 territory.

3. **Backoff strategy depth for 429 (NPUSH-05).**
   - What we know: NPUSH-05 says "exponential backoff on 429"; `sendEachForMulticast` reports per-token errors including `messaging/quota-exceeded`/server-unavailable.
   - Recommendation: Bounded retry (e.g. 3 attempts, jittered exponential) on transient/429 responses only; prune permanently on registration errors. Keep tuning in Claude's discretion (CONTEXT).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-native-firebase/app` + `/messaging` | NPUSH-02 | install on demand | 24.1.0 | — (spike must pass first) |
| `firebase-admin` (backend) | NPUSH-05 | ✓ installed | ^13.8.0 | — |
| `GoogleService-Info.plist` (iOS) | NPUSH-02/03 | ✓ present | — | — |
| `google-services.json` (Android) | NPUSH-02 | ✗ | — | download from Firebase console (human-gated) |
| APNs `.p8` auth key | NPUSH-03 | ✗ (console) | — | upload to Firebase (human-gated) |
| iOS deployment target ≥15 | NPUSH-02 | ✓ 15.1 | — | — |
| Real iOS device + Apple dev account | NPUSH-01/03/06/07 | unknown | — | NO fallback — D-02 abort path if device build can't be proven |

**Missing dependencies with no fallback:**
- A real iOS device + Release-signing capability to PROVE the spike (D-02). If unavailable, the phase cannot validate its gate and should not proceed.

**Missing dependencies with fallback (human-gated console steps):**
- `google-services.json`, APNs `.p8` — downloadable/uploadable from the Firebase console; flag as explicit human tasks in the plan.

## Sources

### Primary (HIGH confidence)
- npm registry — `@react-native-firebase/app` & `/messaging` 24.1.0 (verified 2026-06-06), `firebase-admin` ^13.8.0 (backend package.json), `@notifee/react-native` 9.1.8
- Codebase (this repo): `ios/Podfile`, `App.tsx`, `index.js`, `AuthContext.tsx`, `NotificationSettingsScreen.tsx`, `package.json`, `ios/carEx/{Info.plist,carEx.entitlements,AppDelegate.swift,GoogleService-Info.plist}`, `android/{build.gradle,app/build.gradle,app/src/main/AndroidManifest.xml}`, `src/constants/translations.ts`
- Codebase (backend sibling): `src/notifications/{notificationService.js,push/fcm.js,translations.js,router.js}`, `src/models/DeviceToken.js`, `src/security/firebaseAdmin.js`
- https://rnfirebase.io/ — v24 iOS Podfile static-frameworks requirement, `$RNFirebaseAsStaticFramework`, Android google-services plugin
- https://firebase.google.com/docs/cloud-messaging/send/admin-sdk — `sendEachForMulticast`, token-error handling

### Secondary (MEDIUM confidence)
- GitHub stripe/stripe-react-native#2065 — FollyConvert.h under static frameworks (RN 0.81+)
- GitHub invertase/react-native-firebase #7731 / #8960 — static-linkage + prebuilt-core conflicts, `RCT_USE_PREBUILT_RNCORE=0`
- GitHub firebase/firebase-admin-node — sendEachForMulticast per-token responses + prune pattern

### Tertiary (LOW confidence)
- Web search aggregate (2026) on RN 0.83 prebuilt-core workaround — corroborated by invertase issue but exact incantation for THIS bare-RN project must be proven in the spike (A2).

## Metadata

**Confidence breakdown:**
- Standard stack / versions: HIGH — npm-verified 2026-06-06.
- iOS native-build landmines: HIGH that the conflicts exist (multiple verified sources); MEDIUM that the specific workarounds fully resolve THIS project's combo — that is the spike's job (by design).
- Backend send loop: HIGH — firebase-admin docs + existing firebaseAdmin.js.
- Token lifecycle / permission UX: HIGH — read directly from current source.
- Android targetSdk specifics: MEDIUM — need to read the `ext` block during planning (A4).

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (RNFB / RN 0.83 native-build landscape is fast-moving; re-verify versions and the prebuilt-core workaround at plan time).

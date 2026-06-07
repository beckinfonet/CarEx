# v1.2 Notifications — Domain Pitfalls

**Domain:** Adding FCM push + an in-app notification system to a **bare** RN 0.83.1 app (Stripe + fmt C++17 Podfile hooks) with an Express + Mongoose + MongoDB Atlas backend on Railway, axios, RU/EN i18n.
**Researched:** 2026-06-06
**Overall confidence:** HIGH for native/FCM mechanics (Context-of-record docs + RNFB/Stripe issue trackers), MEDIUM for exact RNFB-vs-RN-0.83 version pin (must be confirmed at Phase 13 install time).

These are the mistakes most likely to bite **this specific stack** when adding the spec at
`docs/superpowers/specs/2026-06-06-notifications-system-design.md`. The spec already encodes several
guards (hide-hook respect, dedup, actor-exclusion, key-not-text i18n, contextual prompt, RN-0.83 compat
gate). Where it does, this file says so and focuses on *how each guard fails in practice*.

---

## Summary — Top 5 Risks (ranked)

1. **`use_frameworks!` static-linking collision with Stripe + fmt C++17 hooks (Phase 13, iOS).**
   react-native-firebase requires `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true`.
   This app already has `@stripe/stripe-react-native` and a `post_install` fmt/C++17 hook in the Podfile.
   On RN 0.81+ there is a **known, open build break**: Stripe's `RCTFollyConvert.h` references
   `react/utils/FollyConvert.h`, which static frameworks no longer expose → `file not found`, build fails.
   This can swallow days. It is the single most likely thing to derail Phase 13. **Confidence: HIGH.**

2. **Silent iOS no-delivery from a missing/wrong APNs auth key (Phase 13, ops).**
   FCM on iOS is just a proxy to APNs. If the APNs **auth key (.p8)** isn't uploaded to the Firebase
   console — or `aps-environment` entitlement / Push Notifications capability is missing — FCM returns
   *success* but nothing arrives. No error, no log. Burns a debugging day chasing code that's fine.
   **Confidence: HIGH.**

3. **Notification spam / fatigue — the #1 opt-out cause (Phase 12 domain, Phase 14 digest).**
   New-listing fan-out + per-edit price-drop pings + a busy seller re-saving a listing = a firehose.
   Users disable push (irrecoverable: re-permission requires a Settings trip) or uninstall. The spec
   names dedup and actor-exclusion as guards, but the *enforcement* lives in the matching/emit path and
   is easy to under-build. **Confidence: HIGH (domain).**

4. **Dead-token accumulation + no pruning on FCM `UNREGISTERED`/`INVALID_ARGUMENT` (Phase 13 send-side).**
   FCM HTTP v1 has **no batch/multicast** anymore (removed June 2024) — you loop one request per token.
   Tokens churn (reinstall, OS clear, logout). Without pruning on 404 `UNREGISTERED` / 400
   `INVALID_ARGUMENT`, the DeviceToken table fills with dead rows, every send wastes N requests, and
   you risk FCM rate-limiting (429). **Confidence: HIGH.**

5. **Cold-start deep-link routing from a push tap (Phase 13 mobile).**
   The three message states (foreground / background / **quit**) use *different* RNFB APIs.
   `getInitialNotification()` (quit→tap) is the one teams forget; the tap then dumps the user on Home
   instead of the watched car / matching listing — defeating the re-engagement goal. Must integrate with
   this app's existing `linking` config (`carex://`, `listing/:carId`). **Confidence: HIGH.**

---

## Native Install (RN 0.83 + Podfile) — Phase 13

### CRITICAL — `use_frameworks!` collides with Stripe + fmt hooks (iOS)
- **What goes wrong:** RNFB on iOS (firebase-ios-sdk v9+) requires `use_frameworks! :linkage => :static`
  and `$RNFirebaseAsStaticFramework = true`. This app's Podfile already carries Stripe + a fmt/C++17
  `post_install` patch. With static frameworks on RN 0.81+, Stripe fails to compile:
  `'react/utils/FollyConvert.h' file not found` (stripe/stripe-react-native#2065, still open). Static
  linking also forces extra header/modulemap juggling that the fmt hook can interact with.
- **Warning signs:** `pod install` succeeds but `xcodebuild` fails with `file not found` on a Folly/React
  header; errors only on Release/archive; "works after I comment out Firebase."
- **Prevention:**
  - Treat the Podfile change as a **spike with a hard timebox** at the *start* of Phase 13, before any
    JS work. Do not assume `pod install` == done.
  - Pin **all three** of: RN-firebase version, firebase-ios-sdk version, Stripe version, and record the
    combo that builds. Check stripe-react-native#2065 for the current patched Stripe version and bump if
    one exists.
  - Keep the existing fmt/C++17 `post_install` hook; layer the Firebase static-framework flags *around*
    it, don't replace it. Verify a clean `pod install --repo-update` + full **Release archive** (not just
    debug sim) — `npm run ios:archive`.
  - Fallback already named in the spec: if the combo can't be made to build, evaluate **notifee + bare FCM**
    (avoids forcing `use_frameworks!`). Decide this *in the spike*, not after committing JS.
  - **New Architecture note:** RNFB compiles under `use_frameworks!` only in bridged/compat mode; confirm
    whether this app runs New Arch and gate accordingly.
- **Confidence:** HIGH.

### CRITICAL — Missing/wrong APNs auth key → silent iOS no-delivery (ops)
- **What goes wrong:** No `.p8` APNs auth key uploaded to Firebase console, or missing Push Notifications
  capability / `aps-environment` entitlement, or sandbox-vs-prod APNs mismatch. FCM accepts the send and
  reports success; the device never rings.
- **Warning signs:** Android receives, iOS doesn't; works in some builds not others; nothing in logs.
- **Prevention:** Phase 13 ops checklist item: upload APNs **auth key** (not legacy cert) to Firebase;
  add Push Notifications + Background Modes (remote notifications) capability in Xcode; confirm
  `aps-environment` flips `development`→`production` for TestFlight/App Store builds. Test on a **real
  device** (push never works on iOS Simulator pre-iOS-16 / without a paid dev account).
- **Confidence:** HIGH.

### Android `google-services` plugin order + minSdk bump
- **What goes wrong:** `com.google.gms.google-services` plugin not applied (or applied in wrong order) in
  `android/app/build.gradle`; classpath missing in root `build.gradle`. Build fails or `google-services.json`
  is ignored. Separately, **RNFB v23 bumps Android minSdk to 23**; this app is `minSdkVersion 24` (OK) and
  **iOS deployment target to 15** (this app is iOS 13.4 → must raise to 15).
- **Warning signs:** `Default FirebaseApp is not initialized`; gradle plugin-not-found; iOS pods refuse to
  resolve on deployment target < 15.
- **Prevention:** Add classpath to root gradle, `apply plugin` at the **bottom** of app gradle (after the
  RN/Android plugins), drop `google-services.json` in `android/app/`. Bump iOS deployment target to 15 in
  the Xcode project + Podfile `platform :ios` line — note this changes `project.pbxproj` (already churns on
  archive). Record minSdk/iOS-target bumps as an explicit migration step.
- **Confidence:** HIGH.

### Android 13+ POST_NOTIFICATIONS runtime permission + channels
- **What goes wrong:** On Android 13 (API 33)+, notifications are **silently dropped** unless the app holds
  the runtime `POST_NOTIFICATIONS` permission. And on Android 8+, a notification with no/unknown **channel**
  is dropped. Teams test on an older emulator, ship, and 13+ users get nothing.
- **Warning signs:** "works on my Android 12 emulator," no notifications on a Pixel running 14, logcat shows
  `No Channel found`.
- **Prevention:** Declare `POST_NOTIFICATIONS` in manifest; request it via the **contextual** prompt
  (same moment as iOS, see UX section) — RNFB `requestPermission()` handles both platforms. Create a
  default notification **channel** at app start (and a second channel if you want digest-vs-instant
  separation). Test on an Android 13+ device/emulator specifically.
- **Confidence:** HIGH.

### Foreground vs background vs quit message handling are three different APIs
- **What goes wrong:** RNFB delivers messages differently by app state: `onMessage` (foreground — **no OS
  banner is shown automatically**, you must render it yourself or via notifee), `setBackgroundMessageHandler`
  (background/quit — must be registered in `index.js` **before** `AppRegistry`, at module top level, not in a
  component), and `getInitialNotification`/`onNotificationOpenedApp` for taps. Mixing these up = "push works
  in dev (foreground) but users see nothing when the app is closed."
- **Warning signs:** Foreground-only delivery; `setBackgroundMessageHandler` warning about being registered
  too late; double notifications.
- **Prevention:** Register `setBackgroundMessageHandler` at top of `index.js`. Decide foreground behavior
  explicitly (often: suppress OS banner, just bump the in-app bell badge, since the user is already in-app).
  Document the three-state matrix in the Phase 13 plan.
- **Confidence:** HIGH.

---

## Device Token Lifecycle — Phase 13

### Not removing token on logout (cross-user leakage)
- **What goes wrong:** User A logs out, User B logs in on the same device; A's token still maps to A's uid
  in DeviceToken → B's device receives A's notifications. Privacy incident on a shared device.
- **Warning signs:** Wrong user's pushes; tokens with stale uid mappings.
- **Prevention:** On logout, call `messaging().deleteToken()` (or at minimum DELETE the DeviceToken row for
  that token) **before** clearing auth. The spec's `NotificationContext` already auto-clears on
  `user.localId` change (mirrors CartContext) — extend that to also fire the token-delete network call.
  **Confidence:** HIGH.

### Token refresh not persisted
- **What goes wrong:** FCM rotates tokens (`onTokenRefresh`); if you only register the token at login, the
  rotated token is never sent to the backend → user silently stops receiving push.
- **Prevention:** Subscribe to `onTokenRefresh` and upsert to backend on every fire, plus register on login.
  Backend `DeviceToken` keyed by unique `token`, upsert on `{uid, token}`. **Confidence:** HIGH.

### Stale / duplicate tokens + multi-device
- **What goes wrong:** Same physical device produces a new token after reinstall/clear-data → duplicate
  rows; one user legitimately has 2–3 devices and you either spam all or drop some.
- **Prevention:** `token` is the unique key (per spec) — upsert on token, not on uid. Keep `lastSeenAt`;
  prune rows untouched for N months in the digest cron. Send to **all** of a user's active tokens (multi-device
  is correct), but dedup the *notification row* per uid, not per device.
- **Confidence:** HIGH.

### Sending to dead tokens without pruning
- **What goes wrong:** No pruning → table bloats, every emit wastes requests, FCM eventually 429s you.
- **Prevention:** On FCM HTTP v1 send, if response is **404 `UNREGISTERED`** or **400 `INVALID_ARGUMENT`**
  (and the payload is otherwise valid — `INVALID_ARGUMENT` can also mean a bad payload, so only prune when
  you're confident the message is well-formed), **delete that DeviceToken row**. Make pruning a deterministic
  part of the send loop, not a separate cleanup job.
- **Confidence:** HIGH.

---

## FCM Send-Side (HTTP v1, pure REST) — Phase 13 (+ Phase 14 for digest send)

### No batch/multicast in HTTP v1 — must loop
- **What goes wrong:** Teams port old `sendMulticast()` / `sendAll()` code; those were **removed June 2024**.
  HTTP v1 takes **one token per request**.
- **Prevention:** Loop per token. For fan-out, batch concurrency at **100–500 simultaneous requests** (HTTP/2
  stream limit); use HTTP/2 keep-alive to the FCM endpoint. Monitor for **429 Resource Exhausted** → exponential
  backoff. This matters in Phase 12's match fan-out design even though sending is Phase 13.
- **Confidence:** HIGH.

### Service-account secret committed / mishandled on Railway
- **What goes wrong:** The FCM HTTP v1 JWT is signed with a **service-account private key**. Easy to commit
  the JSON to the repo or paste it in code → leaked credential with send rights on the whole project.
- **Warning signs:** A `service-account.json` in git; key as a string literal.
- **Prevention:** Store the service-account JSON (or its fields) **only in Railway env vars**, parse at boot.
  Never commit. This aligns with the project's "no new hardcoded keys" constraint. Add it to `.gitignore`
  defensively. Document in the Phase 13 plan as an ops step alongside APNs.
- **Confidence:** HIGH.

### Re-minting the OAuth access token per send
- **What goes wrong:** Each FCM v1 request needs a Bearer token derived from the service-account JWT. Minting
  a fresh OAuth2 access token per push adds latency and can trip Google token-endpoint rate limits during a
  large fan-out.
- **Prevention:** **Cache** the OAuth2 access token (valid ~3600s) and reuse until ~5 min before expiry; mint
  once, share across the fan-out loop. (Mirrors the app's existing single-flight Firebase ID-token refresh
  pattern — reuse that mental model server-side.)
- **Confidence:** HIGH.

### Weak per-token error handling
- **What goes wrong:** One bad token throws and aborts the whole fan-out loop → most users get nothing.
- **Prevention:** Isolate each send (per-token try/catch); collect failures; prune `UNREGISTERED`/`INVALID_ARGUMENT`;
  backoff-retry on 429/5xx; never let one token kill the batch.
- **Confidence:** HIGH.

---

## Notification Domain — spam / dedup / matching / guards (Phase 12 mainly; Phase 14 for digest)

### Spam / fatigue — top opt-out cause
- **What goes wrong:** Fan-out on every new listing + a ping per price edit + back-available churn → user
  drowns, disables push (unrecoverable without a Settings trip) or uninstalls.
- **Prevention:** Per-subscription cadence is the core mitigation (spec). Enforce: Watch = instant but
  **deduped**; Saved Search defaults toward **daily digest** for broad criteria; cap instant Saved-Search
  matches per user per day (overflow → digest). Master toggle + per-category toggles already specced — make
  the daily digest the *recommended* default for Saved Search in the UI copy.
- **Phase:** Phase 12 (cadence plumbing + caps), Phase 14 (digest is the pressure valve).
- **Confidence:** HIGH.

### Not deduping repeated edits
- **What goes wrong:** A seller bumps the price down three times in a minute, or saves the form repeatedly →
  three "price drop" pushes for one car. The spec names dedup as a guard; the failure is under-implementing it.
- **Prevention:** Dedup window per `(uid, carId, event)` — collapse repeats within N minutes to one
  Notification row; for price drops, debounce and notify only on net decrease vs last-notified price (store
  `lastNotifiedPrice` per watch or compute from the latest sent Notification). Don't fire on price *increase*.
- **Phase:** Phase 12.
- **Confidence:** HIGH.

### Notifying the actor about their own action
- **What goes wrong:** Seller edits their own listing price and gets "Price dropped on [their car]!"; or a
  user watching a car they then list themselves. Looks broken, erodes trust.
- **Prevention:** In `notificationService.emit`, exclude `subscription.uid === event.actorUid` from targets.
  The emit hook must receive the acting uid. Spec names this guard — enforce it at the resolve-targets step.
- **Phase:** Phase 12.
- **Confidence:** HIGH.

### Firing for hidden / suspended / moderated listings (Phase 9/v1.1 hide-hook)
- **What goes wrong:** A new-listing or price-drop notification fires for a car owned by a suspended user or a
  moderated/archived listing. The v1.1 read-time `pre(/^find/)` hide hook hides it from browse, but the
  notification emit may read the car via a path that **bypasses the hook** (e.g. `.lean()`, aggregate,
  `findById` inside a transaction, or the event payload itself). Result: a push deep-links to a 404/hidden
  listing.
- **Warning signs:** Push opens to "listing unavailable"; notifications about cars no longer visible in browse.
- **Prevention:** Resolve targets and *re-check listing visibility/status at send time* through the same
  hide-hook-respecting query — do **not** trust the create-event payload's status. Explicitly assert
  `status === active` (and owner-not-suspended) immediately before writing the Notification row AND again at
  push time for instant sends / digest flush (status can change between match and send). This is the v1.1
  TOCTOU pattern applied to notifications.
- **Phase:** Phase 12 (match-time guard), Phase 13 (send-time re-check), Phase 14 (digest-flush re-check).
- **Confidence:** HIGH.

### Matching-engine fan-out cost on new listings
- **What goes wrong:** Each new listing is matched against **all** active Saved Searches; naive
  `find().forEach` over subscriptions doesn't scale and adds latency to the seller's `POST /api/cars` request.
- **Prevention:** Use the specced indexes (`{kind, 'criteria.makeId', 'criteria.modelId'}`); query subscriptions
  *by the new car's make/model* rather than scanning all. Do matching **off the request path** (don't block the
  create response — emit can be fire-and-forget or queued). Spec flags this as an open risk; pre-decide the
  indexed-query approach in Phase 12.
- **Phase:** Phase 12.
- **Confidence:** HIGH.

### Race between listing create and subscription match
- **What goes wrong:** A Saved Search created milliseconds after a listing posts could double-fire or miss;
  or the emit runs before the listing's images/status are fully written (S3 multi-image upload is async here).
- **Prevention:** Emit the new-listing event only **after** the car doc is fully persisted and `status=active`
  (not mid-upload). Match against `createdAt > subscription.createdAt` semantics so a brand-new search doesn't
  retro-fire on existing inventory. Make Notification creation idempotent per `(uid, carId, event)`.
- **Phase:** Phase 12.
- **Confidence:** MEDIUM (depends on exact create/upload sequencing in `POST /api/cars`).

### Digest double-sending or missing items
- **What goes wrong:** The node-cron worker flips `digestPending` and sends; if it crashes mid-run, items are
  either sent-but-not-cleared (double next run) or cleared-but-not-sent (lost). Also: a row created *during*
  the digest run can be missed or double-counted.
- **Prevention:** Make the flush atomic per user — select pending rows by a snapshot `createdAt <= runStart`,
  send, then clear **only those** ids (don't blanket-clear `digestPending`). Set a "claimed/sending" marker
  or use `findOneAndUpdate` to claim before send so a retry/overlapping run won't re-grab. Idempotent send keying.
- **Phase:** Phase 14.
- **Confidence:** HIGH.

### Timezone handling for the daily digest
- **What goes wrong:** Cron fires at server/UTC midnight → users in Kyrgyzstan (UTC+6, the actual audience per
  project memory) get "today's cars" at 6am local or at a weird hour; "daily" means different days for different
  users.
- **Prevention:** Decide the digest reference timezone explicitly. Simplest defensible choice for a KG-centric
  audience: run once daily at a fixed local-morning hour for the primary market (e.g. Asia/Bishkek), since this
  app has **no per-user timezone field** (memory: only device-timezone→city heuristic, no backend city/TZ).
  Don't claim per-user-local digests unless you add a TZ field. Document the choice.
- **Phase:** Phase 14.
- **Confidence:** HIGH (the no-TZ-field constraint is from project memory).

---

## i18n — Phase 12 (keys) + Phase 13/14 (server render)

### Rendering push text in the wrong language
- **What goes wrong:** Push is rendered **server-side** (the device may be asleep), so the backend must know
  the user's language. If it doesn't, everyone gets RU (default) or a hardcoded string.
- **Prevention:** Spec already mandates persisting `language` on the User record, synced from `LanguageContext`.
  Enforce: (1) write `language` on every language toggle AND backfill on login; (2) the send pipeline renders
  `titleKey/bodyKey` from a **backend** translations map using `user.language`, defaulting to RU if absent.
- **Phase:** Phase 12 (persist + backend map), enforced at send (13/14).
- **Confidence:** HIGH.

### Missing RU/EN parity in the backend map
- **What goes wrong:** The client has a parity jest scanner (`src/constants/translations.ts`); the **backend**
  translations map is new and unguarded → a key exists in RU but not EN (or vice versa) → blank/undefined push.
- **Prevention:** Mirror the parity discipline server-side: a backend test that asserts RU and EN key sets are
  identical for the notification map. Store keys+params in Notification rows (spec) so the in-app feed renders
  client-side via `useLanguage().t` — keep the two maps key-aligned.
- **Phase:** Phase 12.
- **Confidence:** HIGH.

### Untranslated server-side interpolation
- **What goes wrong:** Params like make/model/price get formatted server-side (e.g. currency) and leak a wrong
  format — note KGS som, **not** ruble (project memory).
- **Prevention:** Pass raw params; format in the translation template per-language; use KGS/som formatting for
  the KG audience. No Russia-specific terms.
- **Phase:** Phase 12.
- **Confidence:** MEDIUM.

---

## Permission & Deep-Link UX — Phase 13

### Prompting for push on launch
- **What goes wrong:** Cold-launch permission prompt = low opt-in and an App Store review risk (Apple frowns on
  context-free prompts). A denied prompt is hard to recover (Settings trip).
- **Prevention:** Spec already mandates the **contextual** prompt — first Watch or Save-search tap. Enforce:
  never call `requestPermission()` at app start; gate it behind the first subscription action; show a one-line
  rationale before the OS sheet.
- **Phase:** Phase 13.
- **Confidence:** HIGH.

### No graceful handling when permission denied
- **What goes wrong:** User denies; app keeps the subscription but silently never pushes; user thinks it's
  broken. Or app re-prompts (OS won't show the sheet again → looks dead).
- **Prevention:** Detect denied status; let the Saved Search/Watch still work **in-app** (bell + badge) and show
  a soft banner "Enable push in Settings to get instant alerts" with a deep-link to OS settings. Distinguish
  not-determined / denied / authorized. The in-app center working without push is already the spec's Phase 12
  guarantee — lean on it.
- **Phase:** Phase 13 (UX), enabled by Phase 12 (in-app fallback).
- **Confidence:** HIGH.

### Deep-link payload doesn't route on cold start
- **What goes wrong:** Tapping a push when the app is **quit** must be read via `getInitialNotification()`; teams
  only wire `onNotificationOpenedApp` (background) and the cold-start tap lands on Home. The payload must carry a
  `deeplink` (spec's `Notification.data.deeplink`) that this app's existing `linking` config understands
  (`carex://`, `https://www.carexmarket.com/listing/:carId` → `CarDetails`).
- **Warning signs:** "Push works when app is backgrounded but not when fully closed"; tap opens Home.
- **Prevention:** Handle all three: `onMessage` (foreground), `onNotificationOpenedApp` (background→tap),
  `getInitialNotification` (quit→tap). Map `data.deeplink` into the existing `linking` resolver, don't build a
  parallel router. Use `car._id || car.id || carId` semantics (memory: `car.id` unreliable) when constructing
  the deeplink server-side. Test the quit→tap path on a real device explicitly.
- **Phase:** Phase 13.
- **Confidence:** HIGH.

---

## Privacy / Store-Review — Phase 13

### PII leaking on the lock screen
- **What goes wrong:** Push body shows buyer/seller names, prices, or contact info on a locked device → privacy
  exposure; can also draw App Store/Play scrutiny.
- **Prevention:** Keep push bodies generic and listing-centric ("Price dropped on a watched car", "New BMW match")
  — no personal/contact data. Detail lives behind the deep-link after unlock. Aligns with project's secrets/PII
  hygiene posture.
- **Phase:** Phase 13 (copy), Phase 12 (key/param design).
- **Confidence:** MEDIUM.

### Store declarations
- **What goes wrong:** Adding push without declaring it; iOS background-modes / Play data-safety mismatch →
  review rejection.
- **Prevention:** Add Push Notifications + remote-notification background mode (iOS), keep
  `NSAllowsArbitraryLoads:false` intact, update Play Data Safety to reflect device-token collection. Note the
  APNs entitlement flips for prod builds (see APNs pitfall).
- **Phase:** Phase 13.
- **Confidence:** MEDIUM.

---

## Phase Assignment Table (pitfall → prevention → phase)

| # | Pitfall | Prevention (action) | Phase |
|---|---------|---------------------|-------|
| 1 | `use_frameworks!` × Stripe/fmt build break | Timeboxed iOS Podfile spike first; pin RNFB+firebase-ios+Stripe combo; verify Release archive; notifee fallback | **13** |
| 2 | Missing APNs auth key → silent iOS no-delivery | Upload .p8 to Firebase; add Push+Background-modes capability; flip aps-environment for prod; test real device | **13** |
| 3 | Android google-services plugin order / minSdk+iOS-target bumps | Classpath + apply-plugin at bottom; raise iOS target to 15; record minSdk 23 | **13** |
| 4 | Android 13+ POST_NOTIFICATIONS + channels | Declare perm; request in contextual prompt; create default channel at boot; test on API 33+ | **13** |
| 5 | Foreground/background/quit handler confusion | Register `setBackgroundMessageHandler` in index.js top-level; define 3-state matrix; suppress foreground OS banner | **13** |
| 6 | Token not removed on logout (cross-user leak) | `deleteToken()` + DELETE row on logout; hook into NotificationContext clear | **13** |
| 7 | Token refresh not persisted | Subscribe `onTokenRefresh` → upsert backend | **13** |
| 8 | Stale/duplicate tokens, multi-device | Unique-by-token upsert; lastSeenAt prune; send all tokens, dedup row per uid | **13** |
| 9 | No pruning on dead tokens | Delete row on FCM 404 UNREGISTERED / 400 INVALID_ARGUMENT (valid payload) in send loop | **13** |
| 10 | HTTP v1 has no batch/multicast | Loop per token; concurrency 100–500; HTTP/2; 429 backoff | **13** (digest reuse **14**) |
| 11 | Service-account secret committed | Railway env only; never commit; .gitignore | **13** |
| 12 | Re-minting OAuth token per send | Cache access token ~3600s, refresh pre-expiry | **13** |
| 13 | Per-token error aborts fan-out | Per-token try/catch; collect failures; prune/backoff | **13** (**14**) |
| 14 | Spam / fatigue (opt-out) | Per-sub cadence; daily-digest default for broad searches; instant caps; toggles | **12** + **14** |
| 15 | Not deduping repeated edits | Dedup window per (uid,carId,event); price-drop net-decrease only | **12** |
| 16 | Notifying the actor | Exclude `subscription.uid === event.actorUid` in emit | **12** |
| 17 | Firing for hidden/suspended/moderated listings | Re-check visibility via hide-hook-respecting query at match AND send time (TOCTOU) | **12** + **13/14** |
| 18 | Match-engine fan-out cost | Indexed query by car make/model; match off request path | **12** |
| 19 | Create↔match race | Emit only after car fully persisted+active; createdAt> sub.createdAt; idempotent rows | **12** |
| 20 | Digest double-send / missing items | Snapshot createdAt<=runStart; claim-then-send; clear only sent ids | **14** |
| 21 | Digest timezone | Fixed local-morning hour for KG (Asia/Bishkek); no per-user TZ (no field) | **14** |
| 22 | Push in wrong language | Persist User.language; render server-side from it; default RU | **12** (enforce 13/14) |
| 23 | Backend RU/EN parity gap | Backend parity test mirroring client scanner | **12** |
| 24 | Untranslated/KGS-wrong interpolation | Format per-language; KGS som not ruble; no RU-specific terms | **12** |
| 25 | Prompt on launch | Contextual prompt on first Watch/Save-search only | **13** |
| 26 | No denied-permission fallback | Detect denied; keep in-app working; soft "enable in Settings" banner | **13** (relies **12**) |
| 27 | Cold-start deep-link fails | Handle getInitialNotification + onNotificationOpenedApp + onMessage; route via existing `linking`; `car._id||car.id||carId` | **13** |
| 28 | PII on lock screen | Generic listing-centric bodies; detail behind deep-link | **13** (keys **12**) |
| 29 | Store declarations | iOS capabilities/background mode; Play data-safety; keep ATS strict | **13** |

---

## Sources

- [Best practices for FCM registration token management — Firebase](https://firebase.google.com/docs/cloud-messaging/manage-tokens) (HIGH)
- [FCM Error Codes — Firebase](https://firebase.google.com/docs/cloud-messaging/error-codes) (HIGH)
- [FcmErrorCode reference (UNREGISTERED / INVALID_ARGUMENT) — Firebase](https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode) (HIGH)
- [stripe-react-native #2065 — use_frameworks static linking FollyConvert.h not found on RN 0.81+](https://github.com/stripe/stripe-react-native/issues/2065) (HIGH — directly threatens this app)
- [react-native-firebase #7011 — Podfile use_frameworks static linking](https://github.com/invertase/react-native-firebase/discussions/7011) (HIGH)
- [react-native-firebase #8657 — RN 0.81 / Expo 54 build + forceStaticLinking](https://github.com/invertase/react-native-firebase/issues/8657) (MEDIUM)
- [Migrating to v23 — React Native Firebase (minSdk 23, iOS 15)](https://rnfirebase.io/migrating-to-v23) (HIGH)
- [React Native Firebase releases](https://rnfirebase.io/releases) (MEDIUM — confirm exact RN-0.83 pin at install time)
- [Send Multicast via HTTP v1 (no batch; loop, HTTP/2, OAuth cache) — eladnava](https://eladnava.com/send-multicast-notifications-using-node-js-http-2-and-the-fcm-http-v1-api/) (MEDIUM)
- [Firebase HTTP v1 — no batch send anymore (firebase-talk)](https://groups.google.com/g/firebase-talk/c/4GuTzvRT_10) (MEDIUM)
- Project memory: KG/RU audience + KGS som; no per-user timezone field (device-TZ→city only); `car.id` unreliable use `car._id||car.id||carId`; v1.1 hide-hook/TOCTOU pattern. (HIGH — local context)

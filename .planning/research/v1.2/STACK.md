# v1.2 Notifications — Stack Additions

**Researched:** 2026-06-06
**Scope:** ONLY new deps for (1) in-app notification center (pure REST) and (2) OS push via FCM on bare RN 0.83.1 + React 19.2.0. Existing axios/context/AsyncStorage stack is reused, not re-researched.
**Overall confidence:** HIGH on versions and the RN-0.83 verdict; MEDIUM on the exact iOS Podfile sequencing (one-time native integration to validate at Phase 13).

---

## Summary

- **Phase 12 (in-app center):** ZERO new packages. Reuses axios `apiClient`, `NotificationContext` (Cart-pattern), `useLanguage`, existing deep-link `linking`. Backend adds 3 Mongoose models + routes only.
- **Phase 13 (FCM push):** `@react-native-firebase/app@24.x` + `@react-native-firebase/messaging@24.x` (locked-step versions). RN 0.83.1 + React 19.2 is **COMPATIBLE** — peer deps are wildcard (`react-native: '*'`, `react: '*'`); RNFB runs in TurboModule-interop mode on New Arch. No version pin gymnastics needed; install the latest 24.x.
- **The real iOS risk is NOT version compat — it's `use_frameworks!`.** RNFB v15+ forces `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true`. This app currently does NOT use frameworks and has Stripe + fmt post-install hooks. There WAS a hard `stripe-react-native` + static-frameworks build break (`FollyConvert.h not found`) on RN 0.81+, but it is **fixed** (Stripe issue #2065 → PR #2129) and the app is already on `stripe-react-native ^0.62.0` (latest 0.66.0), well past the broken 0.50.3. So the conflict is resolvable, but switching the Podfile to static frameworks is the single highest-risk native step of the milestone.
- **Optional:** `@notifee/react-native@9.x` for rich foreground/local display. **Recommend deferring** — bare `messaging` covers background/quit-state push and basic foreground handling. Add notifee only if design needs styled in-app heads-up banners.
- **Backend send (no SDK):** Confirmed viable. `google-auth-library` (service-account JWT → OAuth token) + axios `POST` to FCM HTTP v1. No `firebase-admin` needed. 2 small deps.
- **Digest:** `node-cron@4.x` in-process in the Express app. Minimal viable; no separate Railway worker.

---

## In-App Center (pure REST)

**New mobile packages: NONE.** Everything maps to existing stack:

| Need | Use (existing) |
|------|----------------|
| HTTP (list / mark-read / unread-count / subscription CRUD) | axios `apiClient` (idToken interceptor already wired) |
| State + auto-clear on `user.localId` change | new `NotificationContext` mirroring `CartContext` |
| i18n rendering of `titleKey`/`bodyKey` | `useLanguage().t` |
| Bell icon / badge | `lucide-react-native` (already in deps) |
| Tap → deep-link | existing `linking` config (`listing/:carId` → CarDetails) |
| Service module | new `NotificationService.ts` (follow `ModerationService` split precedent, per DEBT-01) |

**Backend (separate repo, no new infra):** 3 Mongoose models (`DeviceToken`, `Subscription`, `Notification`) + routes under a new `/api/notifications/*` mount, following the existing router-mount + `verifyIdToken` middleware pattern. No new backend package required for Phase 12.

This phase is fully shippable with no native build at all — de-risks the milestone by isolating all native work in Phase 13.

---

## FCM Push — Mobile (RN 0.83 compat verdict)

### Verdict: COMPATIBLE — install latest `@react-native-firebase` 24.x

| Package | Version | Notes |
|---------|---------|-------|
| `@react-native-firebase/app` | `^24.1.0` (latest verified) | Required core. peerDeps: `react: '*'`, `react-native: '*'`, `expo: '>=47'` (Expo peer is irrelevant — bare RN ignores it). |
| `@react-native-firebase/messaging` | `^24.1.0` | Must match `app` version exactly (peer: `@react-native-firebase/app: '24.1.0'`). Install both at the same minor. |

**Why compatible (HIGH confidence):** RNFB declares no upper RN bound. Invertase tests against New Architecture; RN 0.76+ with New Arch is in widespread use. RNFB runs in TurboModule-interop mode (not yet natively ported to Fabric, but compiles and works). No evidence of an RN-0.83-specific break. There is no need to pin an older version or evaluate `react-native-notifications` as a fallback — the default path works.

**Minimum iOS deployment target:** RNFB v23 raised the floor to **iOS 15** (from 13). This app's Podfile uses `min_ios_version_supported` (RN-derived). Confirm the resulting deployment target is >= 15 at Phase 13; bump if needed.

### iOS native integration

1. **APNs auth key (ops, not code):** Create an APNs `.p8` auth key in the Apple Developer account, upload to Firebase console → Project Settings → Cloud Messaging → APNs Authentication Key. One-time. Prerequisite for any iOS delivery.
2. **Entitlements:** Add `aps-environment` (`development` for debug, `production` for release) to the app's entitlements. Enable Push Notifications + Background Modes (Remote notifications) capabilities in Xcode.
3. **`GoogleService-Info.plist`:** Already committed — confirm it's added to the Xcode target's "Copy Bundle Resources".
4. **`use_frameworks!` — THE conflict to manage (see below).**

### Podfile conflict: `use_frameworks!` vs Stripe + fmt hooks (highest risk)

RNFB requires, at the top of the Podfile:
```ruby
$RNFirebaseAsStaticFramework = true
use_frameworks! :linkage => :static
```
This app currently does NOT call `use_frameworks!` and relies on two post-install hooks:
- `fmt` target → forced `c++17` (Xcode 26 consteval bug)
- `stripe-react-native` target → `-Wno-error=enum-redeclared-with-different-underlying-type`

**Findings:**
- The historically fatal combination — `stripe-react-native` + static frameworks on RN 0.81+ → `'react/utils/FollyConvert.h' file not found` — is **FIXED** (Stripe issue #2065, closed via PR #2129). The app is on `stripe-react-native ^0.62.0` (latest 0.66.0), far past the broken `0.50.3`, so the fix is present. **MEDIUM-HIGH confidence** the Stripe build survives the switch to static frameworks.
- The existing `fmt` and `stripe-react-native` post-install hooks should be **kept** — they patch build settings per-target and are orthogonal to linkage. Re-validate them after enabling frameworks; the c++17/fmt hook in particular may still be needed.
- Switching to `use_frameworks! :linkage => :static` is an app-wide change: every other pod (Stripe, image-picker, reanimated, svg, fast-image, gesture-handler, screens) must also tolerate static frameworks. On RN 0.83 New Arch this is the common, supported path, but it requires a full clean `pod install` + device build verification.

**Recommendation:** Treat the Podfile/`use_frameworks` switch as a dedicated, early Phase-13 task with a rollback checkpoint (commit the working pre-frameworks state first). Build iOS on a real device before wiring any JS.

### Android native integration

| Step | Detail |
|------|--------|
| Gradle plugin | Add `com.google.gms.google-services` classpath to `android/build.gradle`; apply plugin in `android/app/build.gradle`. RNFB autolinks the rest. |
| `google-services.json` | Already committed — confirm in `android/app/`. |
| `POST_NOTIFICATIONS` | Android 13+ (API 33+) requires this runtime permission. App targets SDK 36 → **mandatory**. Request **contextually** (on first Watch / Save-search tap) per the design spec, NOT on launch. Add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` to the manifest. |
| Notification channel | Android 8+ requires a channel before any notification displays. `messaging` will use a default channel for data/notification messages; for a named channel/importance you need notifee OR a small native channel-creation step. For v1.2 a default channel is acceptable. |
| minSdk | App minSdk 24 — fine; RNFB supports it. |

### Permission UX (from spec)
Do NOT prompt on launch. Prompt on first Watch / Save-search. iOS: `messaging().requestPermission()`. Android 13+: runtime `POST_NOTIFICATIONS` request.

### Notifee — defer

`@notifee/react-native@^9.1.8` (peer `react-native: '*'`, RN-0.83 compatible) gives rich local/foreground display, channels, styled banners. **Not required for v1.2** — bare `messaging` handles background/quit push + basic foreground events. Add notifee only if the design calls for custom in-app heads-up banners or named Android channels with specific importance. Adding it later is low-cost.

---

## FCM Send — Backend (no-SDK path)

**Verdict: VIABLE and recommended.** Pure REST via FCM HTTP v1 + service-account JWT. No `firebase-admin`.

| Package | Version | Purpose |
|---------|---------|---------|
| `google-auth-library` | `^10.7.0` | Mint an OAuth2 access token from the service-account credentials (scope `https://www.googleapis.com/auth/firebase.messaging`). Handles JWT signing + token caching/refresh. |
| (existing) `axios` | already present in backend | `POST https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send` with `Authorization: Bearer <token>`. |

Flow:
1. Load service-account JSON from env (secrets hygiene: NOT committed — Railway env var).
2. `new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })` → `getAccessToken()` (auto-cached/refreshed).
3. axios POST the FCM v1 message envelope to each device token.

**Alternative (if you prefer batteries-included):** `firebase-admin@^13.10.0` — `messaging().send()/sendEachForMulticast()`. Heavier dep, but reuses the same `verifyIdToken` infra the backend ALREADY uses for admin auth (firebase-admin is likely already a backend dependency). **Worth confirming in the backend repo** — if `firebase-admin` is already installed for token verification, using its messaging API adds zero new deps and is simpler than the google-auth-library path. The design spec mandates "no server SDK," so default to the `google-auth-library` REST path unless the operator relaxes that.

---

## Digest Scheduling

**Recommendation: `node-cron@^4.2.1` in-process in the Express app.** Minimal viable.

- One `cron.schedule('0 9 * * *', digestJob)` (or chosen daily time) inside the existing Railway service.
- Aggregates each user's `digestPending: true` Notification rows → one digest push → clears flags.
- No separate Railway service, no queue collection (design uses `digestPending` flag on Notification rows).

**Caveats to note for Phase 14:**
- If Railway runs **multiple instances/replicas**, in-process cron fires N times. CarEx is single-instance today → fine, but guard with an advisory lock or a `lastDigestRunAt` document check if scaling later.
- Cron stops if the dyno sleeps/restarts mid-window; daily cadence tolerates this (next run catches pending rows). Acceptable for v1.2.
- A separate Railway cron/worker service is the "correct at scale" answer but is over-engineering for current volume. Defer.

---

## What NOT to Add

- **No Expo modules** — bare RN. (RNFB's `expo` peer dep is ignored; do not add `expo-notifications`.)
- **No new state-management lib** — `NotificationContext` reuses the existing provider+hook pattern.
- **No new networking lib** — extend axios `apiClient` + a new `NotificationService.ts`.
- **No `react-native-notifications` / OneSignal / other push provider** — the design commits to FCM/RNFB, and RNFB is RN-0.83 compatible, so no fallback provider is needed.
- **No `firebase-admin` on the backend** unless it's already present for `verifyIdToken` (confirm). Default to `google-auth-library` REST.
- **No notifee in v1.2** unless rich foreground banners become a requirement.
- **No separate Railway worker service** for the digest — in-process `node-cron` suffices.

---

## Open Verification Items (Phase 13)

1. **[HIGH] `use_frameworks! :linkage => :static` full-app build.** Switch Podfile, keep fmt + stripe hooks, clean `pod install`, build iOS on a real device. Verify Stripe checkout still builds AND runs (the FollyConvert fix should hold on stripe-react-native 0.62+, but confirm on-device). Commit a rollback checkpoint first.
2. **[MED] iOS deployment target >= 15** after enabling RNFB v24 (it raised the floor from 13). Bump `min_ios_version_supported` / project target if the resolved value is lower.
3. **[MED] Re-validate fmt c++17 + stripe `-Wno-error` post-install hooks** survive the frameworks switch; adjust if the static-framework build changes which targets need them.
4. **[MED] Backend: is `firebase-admin` already installed?** If yes (likely — used for `verifyIdToken` on admin routes), reconsider using its `messaging()` API vs the google-auth-library REST path (operator/design call, given "no server SDK" constraint).
5. **[LOW] Android default notification channel** acceptable for v1.2, or does design want a named channel/importance (→ pull in notifee or a small native channel step)?
6. **[LOW] Railway instance count** for node-cron — confirm single-instance before relying on in-process cron without a lock.
7. **[LOW] Pin exact 24.x at install time** — verify `@react-native-firebase/app` and `messaging` resolve to the SAME version (locked-step peer requirement).

---

## Sources

- [react-native-firebase (GitHub)](https://github.com/invertase/react-native-firebase) — New Arch / TurboModule-interop status, version line (HIGH)
- [rnfirebase.io — install / use_frameworks requirement](https://rnfirebase.io/) (HIGH)
- [Migrating to v23 — iOS 15 minimum](https://rnfirebase.io/migrating-to-v23) (HIGH)
- npm registry (verified 2026-06-06): `@react-native-firebase/app` 24.1.0, `@react-native-firebase/messaging` 24.1.0, `@notifee/react-native` 9.1.8, `google-auth-library` 10.7.0, `node-cron` 4.2.1, `firebase-admin` 13.10.0, `@stripe/stripe-react-native` 0.66.0 (HIGH)
- [Stripe RN issue #2065 — FollyConvert + static frameworks (fixed via PR #2129)](https://github.com/stripe/stripe-react-native/issues/2065) (MEDIUM-HIGH)
- [FCM HTTP v1 send API](https://firebase.google.com/docs/cloud-messaging/send/v1-api) + [google-auth-library](https://www.npmjs.com/package/google-auth-library) (HIGH)
- [RNFB use_frameworks static discussion #7011](https://github.com/invertase/react-native-firebase/discussions/7011) (MEDIUM)

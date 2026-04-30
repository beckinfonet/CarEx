---
slug: android-deep-link-broken
status: resolved
created: 2026-04-29
updated: 2026-04-29
resolved: 2026-04-29
trigger: "User can go into listing details page and share the listing with others. A text with make, model year - price along with a link to the listing is sent via text messaging tools. iOS can open the link, but android is not opening. The other problem is that when someone receives this message with a direct link to that specific listing, if that user doesn't have the app installed on their phone, it is not asking the user to install it."
---

# Debug: Android deep link broken + no install prompt

## Symptoms

- **Expected behavior:** Tapping a shared listing SMS link on Android should open the CarEx app directly to the CarDetails screen for that listing (matching iOS behavior). If the recipient does not have the app installed, the OS / web fallback should prompt them to install it from Play Store / App Store.
- **Actual behavior (Android, app installed):** Tapping the link opens www.carexmarket.com in the default browser instead of launching the CarEx app. The app is never offered as an option.
- **Actual behavior (no app installed, either platform):** Link opens www.carexmarket.com directly — no install banner, no smart-app-banner prompt, no Play Store / App Store redirect.
- **Error messages:** None — link opens silently in the browser.
- **Timeline:** Has never worked on Android since the share feature was added. iOS has always worked.
- **Build tested:** Release/signed AAB (Play Store production build).
- **Reproduction:** Open any listing → tap Share → send to a phone via SMS → recipient (Android) taps link → opens browser instead of app.

## Known relevant context (from CLAUDE.md)

- Deep links configured via React Navigation `linking` for `https://www.carexmarket.com` and `carex://` — `listing/:carId` routes to `CarDetails`.
- iOS and Android both declare `carex://` scheme.
- Android also declares https://www.carexmarket.com deep link.
- Web fallback URL: https://www.carexmarket.com.

## Hypotheses to investigate (initial seed — for the debugger to validate)

1. **Android App Links auto-verification missing/broken.** AndroidManifest.xml intent-filter for the https scheme may be missing `android:autoVerify="true"`, OR the `assetlinks.json` file at `https://www.carexmarket.com/.well-known/assetlinks.json` is missing/wrong/has the wrong SHA256 fingerprint for the release signing key. Without verified App Links, Android cannot route the https URL to the app — it falls through to the browser.
2. **Share text uses https URL instead of carex:// scheme.** If the share sheet writes `https://www.carexmarket.com/listing/...` and Android App Links are unverified, the OS treats it as a regular web URL. iOS still works because Universal Links use a different verification mechanism (apple-app-site-association) that may be configured correctly.
3. **No deferred-deep-link / smart banner on the web fallback.** The web target www.carexmarket.com likely has no install-banner code (Branch.io, Firebase Dynamic Links — note FDL is deprecated 2025, smart app banner meta tags, etc.) so users without the app see only the web page.

## Files likely relevant

- `android/app/src/main/AndroidManifest.xml` — intent-filter setup
- `ios/carEx/Info.plist` — URL schemes / Associated Domains
- `App.tsx` — `linking` config for React Navigation
- `src/screens/CarDetailsScreen.tsx` (or wherever Share is implemented) — how the share text/URL is constructed
- `src/constants/config.ts` — `WEB_BASE_URL`, `LISTING_URL`
- (External) `https://www.carexmarket.com/.well-known/assetlinks.json` — Android App Links verification file
- (External) `https://www.carexmarket.com/.well-known/apple-app-site-association` — iOS Universal Links

## Current Focus

```yaml
hypothesis: "assetlinks.json on www.carexmarket.com lists certificate SHA256 fingerprints that DO NOT match the SHA256 of the AAB uploaded to Play Console. Therefore Android's App Links verifier rejects the binding, marks the domain as unverified, and routes https links to the browser. Mobile manifest, entitlements, and share code are all correct."
test: "Compared (a) AndroidManifest.xml intent-filter, (b) iOS Info.plist + entitlements, (c) App.tsx linking config, (d) Share implementation in CarDetailsScreen.tsx, (e) live assetlinks.json content, (f) live AASA content, (g) signing certificate of the local release AAB, (h) Google Digital Asset Links API result."
expecting: "Either (1) Manifest missing autoVerify, (2) Share URL malformed, or (3) assetlinks.json fingerprint mismatch."
next_action: "Surface the certificate-mismatch root cause to user. Recommend updating assetlinks.json on the live web property (out-of-repo) with the correct Play Console fingerprints (App Signing key + Upload key). For the install-prompt issue, recommend smart-app-banner / Play Store redirect on the web fallback (also out-of-repo)."
reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-04-29 cycle 1 — Read `android/app/src/main/AndroidManifest.xml`. The https intent-filter at lines 40–45 already has `android:autoVerify="true"`, with `scheme="https" host="www.carexmarket.com" pathPrefix="/listing"`. Manifest config is correct → **Hypothesis 1a (missing autoVerify) ELIMINATED**.
- timestamp: 2026-04-29 cycle 1 — Read `ios/carEx/Info.plist`: declares `carex://` URL scheme; no Associated Domains in plist (correct — those live in entitlements).
- timestamp: 2026-04-29 cycle 1 — Read `ios/carEx/carEx.entitlements`: contains `com.apple.developer.associated-domains` = `applinks:www.carexmarket.com`. iOS Universal Links are properly declared.
- timestamp: 2026-04-29 cycle 1 — Read `App.tsx` lines 76–84: `linking` config has prefixes `['https://www.carexmarket.com', 'carex://']` and screen `CarDetails: 'listing/:carId'`. Correct.
- timestamp: 2026-04-29 cycle 1 — Read `src/screens/CarDetailsScreen.tsx` `handleShare` (lines 415–429): shares the message `"<make> <model> <year> - <currency><price>\n\n<url>"` where `url = LISTING_URL(car.id) = https://www.carexmarket.com/listing/<carId>`. Share URL is well-formed and uses the App Link domain → **Hypothesis 2 (share URL malformed) ELIMINATED**.
- timestamp: 2026-04-29 cycle 1 — `curl https://www.carexmarket.com/.well-known/assetlinks.json` returned HTTP 200 with body:
  ```json
  [{"relation":["delegate_permission/common.handle_all_urls"],
    "target":{"namespace":"android_app","package_name":"com.carex.market",
      "sha256_cert_fingerprints":[
        "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
        "7C:E2:8E:8A:44:1C:D7:FC:EE:58:7C:A1:CB:8C:29:40:78:90:B4:2E:5D:7B:4C:A5:01:06:E8:45:76:A0:09:3A"
      ]}}]
  ```
- timestamp: 2026-04-29 cycle 1 — `curl https://www.carexmarket.com/.well-known/apple-app-site-association` returned HTTP 200, `Content-Type: application/json`, body:
  ```json
  {"applinks":{"apps":[],"details":[{"appID":"M3W6Y259JR.com.carex.app","paths":["/listing/*"]}]}}
  ```
  AASA is correct → explains why iOS works.
- timestamp: 2026-04-29 cycle 1 — Google Digital Asset Links API (`digitalassetlinks.googleapis.com/v1/statements:list`) successfully parsed the assetlinks.json (returned both statements). MIME type and JSON syntax are correct.
- timestamp: 2026-04-29 cycle 1 — `keytool -list -v -keystore android/app/release.keystore -alias carex-release` shows local upload key SHA256 = `08:02:9D:60:0B:08:0A:08:DA:47:C4:19:F7:5A:0A:6E:26:09:A1:70:96:1B:64:67:2D:E7:84:8A:95:0E:0B:64`.
- timestamp: 2026-04-29 cycle 1 — `keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab` shows the latest built AAB is signed with the same `08:02:9D:60:...:0B:64` (CN=BAKYTBEK TATIBEKOV, ENGINEERING, INSPIRE THE NEXT INC). This is the upload key used to sign every AAB sent to Play.
- timestamp: 2026-04-29 cycle 1 — **MISMATCH:** Neither fingerprint in the live assetlinks.json (`FA:C6:...` or `7C:E2:...`) matches the upload key fingerprint (`08:02:9D:...`). Therefore Android App Links auto-verification fails on installed builds → **Hypothesis 1b (assetlinks fingerprint wrong) CONFIRMED as root cause for problem #1**.
- timestamp: 2026-04-29 cycle 1 — For problem #2 (no install prompt): the web property at www.carexmarket.com is outside this repo (mobile RN repo only). There is no smart-app-banner meta or Play Store/App Store redirect logic that can be added here. Fix must be applied to the carexmarket.com web property repo.

## Eliminated hypotheses

- **H1a (missing autoVerify on Android intent-filter):** `android:autoVerify="true"` is already present (Manifest line 40).
- **H2 (share text uses wrong URL):** Share writes a clean `https://www.carexmarket.com/listing/<carId>` URL via `LISTING_URL` helper. Matches the App Link / Universal Link path pattern.

## Resolution

```yaml
root_cause: |
  Android App Links auto-verification fails because the SHA256 fingerprints listed in
  https://www.carexmarket.com/.well-known/assetlinks.json
    [FA:C6:17:45:..., 7C:E2:8E:8A:...]
  do NOT include the certificate fingerprint actually used to sign the production AAB
    08:02:9D:60:0B:08:0A:08:DA:47:C4:19:F7:5A:0A:6E:26:09:A1:70:96:1B:64:67:2D:E7:84:8A:95:0E:0B:64
  When Play App Signing is enabled, assetlinks.json must include BOTH (a) the App Signing
  key fingerprint shown in Play Console → Setup → App Integrity → "App signing key
  certificate" AND (b) the Upload key fingerprint shown right below it. Without a match,
  Android marks the domain unverified and routes the https URL to the browser instead of
  the app. The mobile-side configuration (Manifest, entitlements, share code, linking
  config) is all correct — the bug is entirely in the published assetlinks.json on the
  carexmarket.com web property.

  A second, independent issue (no install prompt for users without the app) is rooted in
  the web fallback page itself. The carexmarket.com page does not emit any platform
  detection / Play Store + App Store redirect or smart-app-banner meta tag. This repo
  (mobile RN) cannot fix it; it requires changes to the separate carexmarket.com web
  property.
fix: |
  Fix is OUT-OF-REPO for both problems. Mobile code requires no changes.

  Problem 1 — fix steps (carexmarket.com web property):
    1. In Play Console → Setup → App Integrity, copy:
       • "App signing key certificate" SHA-256 fingerprint
       • "Upload key certificate" SHA-256 fingerprint  (should equal 08:02:9D:60:...:0B:64)
    2. Replace the contents of /.well-known/assetlinks.json on www.carexmarket.com with:
       [{
         "relation": ["delegate_permission/common.handle_all_urls"],
         "target": {
           "namespace": "android_app",
           "package_name": "com.carex.market",
           "sha256_cert_fingerprints": [
             "<APP_SIGNING_KEY_FINGERPRINT_FROM_PLAY_CONSOLE>",
             "08:02:9D:60:0B:08:0A:08:DA:47:C4:19:F7:5A:0A:6E:26:09:A1:70:96:1B:64:67:2D:E7:84:8A:95:0E:0B:64"
           ]
         }
       }]
       Served from https://www.carexmarket.com/.well-known/assetlinks.json over HTTPS with
       Content-Type: application/json (current setup already does this — verified via curl
       and Google's Digital Asset Links API).
    3. Verify with:
       curl -I https://www.carexmarket.com/.well-known/assetlinks.json
       and the Google API:
       https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.carexmarket.com&relation=delegate_permission/common.handle_all_urls
    4. On a test Android device (app already installed), force re-verification:
       adb shell pm verify-app-links --re-verify com.carex.market
       adb shell pm get-app-links com.carex.market
       Expect "verified" for www.carexmarket.com.
    5. Tap an https://www.carexmarket.com/listing/<id> link from SMS. Should open the app.

  Problem 2 — fix steps (carexmarket.com web property; document only):
    On the listing/:carId web page, add either:
      (a) iOS smart-app-banner meta tag in <head>:
          <meta name="apple-itunes-app" content="app-id=<APP_STORE_ID>, app-argument=https://www.carexmarket.com/listing/<id>">
      (b) Server-side or client-side redirect when User-Agent indicates Android + app not
          opened (use intent:// fallback URL pattern):
          intent://www.carexmarket.com/listing/<id>#Intent;scheme=https;package=com.carex.market;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.carex.market;end
      (c) Or both. The intent:// pattern is the recommended modern replacement for the
          deprecated Firebase Dynamic Links — it makes Android open the app if installed,
          else jump to the Play Store listing.
    Also: replace the placeholder App Store ID in src/constants/config.ts (APP_STORE_URL
    currently has id000000000) once the iOS app is published, so any future in-app links
    to the store work.

  Optional polish (still mobile-side, low priority):
    - Manifest line 44: change `pathPrefix="/listing"` to `pathPrefix="/listing/"` (or
      `pathPattern="/listing/.*"`) to avoid matching paths like `/listingfoo`. Functional
      impact is near-zero for current URLs but tightens routing.
verification: |
  Once the fingerprint fix is published on the web property:
    1. `curl https://www.carexmarket.com/.well-known/assetlinks.json` → returns JSON with
       both Play Console fingerprints.
    2. Google Digital Asset Links API returns a statement whose
       target.androidApp.certificate.sha256Fingerprint matches the AAB signing cert.
    3. `adb shell pm get-app-links com.carex.market` shows status "verified" for
       www.carexmarket.com after re-verify (or after a fresh install).
    4. Manual test: send `https://www.carexmarket.com/listing/<knownId>` via SMS to a
       device with the app installed; tapping the link opens CarEx directly on
       CarDetailsScreen for that car (no browser, no chooser).
    5. Manual test on a device WITHOUT the app installed: tap the same SMS link; expect
       Play Store listing page (after Problem 2 fix is also applied to the web property).
files_changed:
  - "(none in carEx mobile repo)"
  - "Railway env var ANDROID_SHA256_CERT_FINGERPRINTS on carEx-services service (separate backend repo at /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services)"
```

## Correction to original resolution (2026-04-29)

The session manager's original write-up framed the fix as "out-of-repo on the carexmarket.com web property." That was inaccurate. The actual infrastructure:

- `www.carexmarket.com` is fronted by Vercel, which proxies `/.well-known/*` paths to the Railway-hosted `carEx-services` Express backend (confirmed via matching ETag `W/"165-CILoMQpESrhCytGBZrUOZDJDK9c"` and `x-powered-by: Express` on both `https://www.carexmarket.com/.well-known/assetlinks.json` and `https://carex-services-production.up.railway.app/.well-known/assetlinks.json`).
- The endpoint is implemented at `server.js:241-260` in carEx-services. It reads `process.env.ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated) and emits the JSON.
- The actual fix was therefore a **single env var update on Railway** — no code changes anywhere.

## Verification (post-fix)

- `curl https://www.carexmarket.com/.well-known/assetlinks.json` returns the corrected JSON with both fingerprints:
  - `17:04:A3:A6:4B:CD:4B:2F:5A:7D:10:D5:89:73:7C:94:77:82:8E:F2:F6:84:23:65:72:79:54:A4:EB:13:24:B9` (Play Console App Signing key)
  - `08:02:9D:60:0B:08:0A:08:DA:47:C4:19:F7:5A:0A:6E:26:09:A1:70:96:1B:64:67:2D:E7:84:8A:95:0E:0B:64` (upload key, also signs the production AAB)
- Reinstalled the app on Android device → tapped a shared SMS listing link → app opens directly to the CarDetails screen for the listing. **Confirmed working by user.**

## Outstanding (Problem 2)

Install-prompt for users without the app installed is still open. Fix surface is the rendered web page at `https://www.carexmarket.com/listing/:carId` — needs a smart-app-banner meta tag (iOS) and an Android `intent://` fallback with `S.browser_fallback_url` pointing at the Play Store. To be triaged separately (likely also lives in carEx-services or Vercel — not yet confirmed which renders that page).

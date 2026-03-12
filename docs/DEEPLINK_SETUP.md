# Deep Link Setup: Open Shared Links in the App

For `https://www.carexmarket.com/listing/{carId}` links to open the CarEx app instead of the browser, the verification files are served by **carEx-services** (Node.js/Express backend).

## Backend (carEx-services)

The routes are already implemented in `server.js`:

- `GET /.well-known/apple-app-site-association` – iOS Universal Links
- `GET /.well-known/assetlinks.json` – Android App Links

**Required:** Add `ANDROID_SHA256_CERT_FINGERPRINTS` to your `.env` (comma-separated if multiple certs). See `carEx-services/DEEPLINK.md` for details.

**Deployment:** Ensure carexmarket.com serves these paths—either the backend is at carexmarket.com, or proxy `/.well-known/*` to the backend.

## App Configuration (Already Done)

- **iOS:** Associated Domains entitlement (`applinks:www.carexmarket.com`)
- **Android:** Intent filter with `android:autoVerify="true"`

## Android: Get SHA256 Fingerprint

**Debug (for testing):**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Release:**
```bash
keytool -list -v -keystore /path/to/your/release.keystore -alias your-key-alias
```

Look for `SHA256:` in the output. Add the value to `ANDROID_SHA256_CERT_FINGERPRINTS` in carEx-services `.env`. For multiple certs (e.g. debug + release), use comma-separated values.

> **Note:** If you use Google Play App Signing, add **both** your upload key fingerprint and the Play Store's app signing certificate fingerprint.

## Verification

**iOS:** After deploying AASA, reinstall the app. Universal Links are verified at install time.

**Android:** Verify with:
```bash
adb shell am start -a android.intent.action.VIEW -d "https://www.carexmarket.com/listing/test123" -p com.carex.marketplace
```

Or use [Google's Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator) to validate your assetlinks.json.

## Troubleshooting

- **iOS:** If links still open in Safari, ensure the AASA file is valid JSON and the appID matches (TeamID.BundleID). Try deleting and reinstalling the app.
- **Android:** If verification fails, the user may see an "Open with" dialog. Add both debug and release certificate fingerprints when testing.
- **Both:** Verification happens at app install. Users who had the app installed before the well-known files were deployed may need to reinstall.

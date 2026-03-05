# Release Signing for Google Play

Google Play requires apps to be signed with a **release keystore**, not the debug keystore. Follow these steps to set up release signing for CarEx.

## 1. Generate a release keystore

Run this command (from the project root). You'll be prompted for a password and certificate details:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release.keystore -alias carex-release -keyalg RSA -keysize 2048 -validity 10000
```

**Important:** 
- Choose a strong password and **store it securely**. You cannot recover it if lost.
- Keep the keystore file safe. If you lose it, you cannot update your app on Google Play.
- The `release.keystore` file is gitignored—never commit it.

## 2. Create keystore.properties

Create `android/keystore.properties` with:

```properties
storeFile=release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=carex-release
keyPassword=YOUR_KEY_PASSWORD
```

Replace `YOUR_STORE_PASSWORD` and `YOUR_KEY_PASSWORD` with the passwords you set when generating the keystore.

**Note:** This file is gitignored. Do not commit it to version control.

## 3. Build the release AAB

```bash
./build-android-release.sh
```

The AAB at `android/app/build/outputs/bundle/release/app-release.aab` will now be signed for release and can be uploaded to Google Play.

## Google Play App Signing

If you use [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756), you upload your app signing key (or let Google generate one) on first upload. The Play Console then uses your upload key for subsequent updates. Your release keystore serves as the upload key in this setup.

# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**Authentication:**
- Google Identity Toolkit (Firebase REST API)
  - What it's used for: User registration, login, password reset
  - SDK/Client: Axios (REST calls)
  - Auth: Firebase web API Key hardcoded in `src/services/AuthService.ts` (`API_KEY` constant, starts with `AIzaSy…` — redacted here; see source for value)
  - Endpoints:
    - `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp` - User registration
    - `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` - User login
    - `POST https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode` - Password reset
    - `POST https://identitytoolkit.googleapis.com/v1/accounts:delete` - Account deletion
  - Returns: `idToken`, `localId` (Firebase UID), user data

**Backend API:**
- CarEx Services (Node.js/Express)
  - What it's used for: User profiles, car listings, orders, payments, admin functions
  - SDK/Client: Axios (REST)
  - Auth: Firebase tokens (passed in request bodies or headers via backend)
  - Production URL: `https://carex-services-production.up.railway.app`
  - Dev URL: `http://localhost:5001` (iOS), `http://10.0.2.2:5001` (Android)
  - Config: `src/constants/config.ts`

  **User Endpoints:**
  - `POST /api/users` - Create backend user
  - `GET /api/users/{firebaseUid}` - Fetch user profile
  - `PUT /api/users/{firebaseUid}` - Update user profile
  - `POST /api/users/{firebaseUid}/avatar` - Upload avatar (multipart)
  - `DELETE /api/users/{firebaseUid}` - Delete user account

  **Role Request Endpoints:**
  - `POST /api/users/{firebaseUid}/request-seller` - Request seller status
  - `POST /api/users/{firebaseUid}/request-broker` - Request broker status
  - `POST /api/users/{firebaseUid}/request-logistics` - Request logistics provider status

  **Broker Endpoints:**
  - `GET /api/brokers/{firebaseUid}` - Fetch broker profile
  - `PUT /api/brokers/{firebaseUid}` - Update broker profile

  **Logistics Endpoints:**
  - `GET /api/logistics/{firebaseUid}` - Fetch logistics profile
  - `PUT /api/logistics/{firebaseUid}` - Update logistics profile

  **Payment Endpoints:**
  - `POST /api/payments/create-payment-intent` - Create Stripe payment intent
  - `POST /api/payments/confirm-booking` - Confirm booking after payment

  **Order Endpoints:**
  - `POST /api/orders` - Create orders for services
  - `GET /api/orders/buyer/{firebaseUid}` - Fetch buyer's orders
  - `GET /api/orders/provider/{firebaseUid}` - Fetch provider's orders
  - `PATCH /api/orders/{orderId}/status` - Update order status
  - `PATCH /api/orders/{orderId}/services/{serviceIndex}/status` - Update individual service status

  **Admin Endpoints:**
  - `GET /api/admin/status/{firebaseUid}` - Check admin status
  - `GET /api/admin/requests` - Fetch pending role requests
  - `POST /api/admin/requests/{targetUid}/approve` - Approve role request
  - `POST /api/admin/requests/{targetUid}/reject` - Reject role request
  - `GET /api/admin/users` - Fetch admin users
  - `POST /api/admin/users` - Add admin user
  - `DELETE /api/admin/users/{adminId}` - Remove admin user

  **OTP Endpoints:**
  - `POST /api/otp/send` - Send OTP via SMS (Twilio backend-mediated)
  - `POST /api/otp/verify` - Verify OTP code

**Payment Processing:**
- Stripe (via @stripe/stripe-react-native)
  - What it's used for: Payment processing for car listings and services
  - SDK/Client: @stripe/stripe-react-native 0.62.0
  - Publishable Key: hardcoded `pk_test_…` in `App.tsx` (test mode — redacted here; must be swapped to `pk_live_…` before production release)
  - Location in code: `App.tsx` (StripeProvider wrapper, test key hardcoded)
  - Deep links supported:
    - `carex://stripe-redirect` - Payment return
    - `stripe-connect://` - Stripe Connect flow
    - `link-popup://complete/{appId}` - Link popup completion
    - `stripesdk://payment_return_url/{appId}` - Payment return fallback
    - Various `stripe://` and `stripe-auth://` schemes for authentication flows
  - Android activities configured in `AndroidManifest.xml` for all payment flows

## Data Storage

**Databases:**
- MongoDB Atlas (backend)
  - Connection: Via backend `.env` (MONGODB_URI)
  - Collections: Users, cars, brokers, logistics profiles, orders, admin roles, OTP logs
  - Used for: All persistent application data (cars, users, orders, services)
  - Client: Mongoose ORM (backend-only, not accessible from mobile app)

**Local Client Storage:**
- React Native AsyncStorage
  - What: `@react-native-async-storage/async-storage` 2.2.0
  - Purpose: Store Firebase tokens and user data locally
  - Keys: `userToken`, `userData`
  - Usage: `src/services/AuthService.ts` (saveToken, getToken, getUserData, logout)

**File Storage:**
- AWS S3
  - What it's used for: Car image uploads
  - Client access: Not direct; backend handles S3 uploads via `POST /api/users/{firebaseUid}/avatar` and car image endpoints
  - Backend integration: Via `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME` in backend `.env`
  - Per README.md: "AWS S3 Image Storage"

**Caching:**
- None configured (app relies on network requests and local AsyncStorage)

## Authentication & Identity

**Auth Provider:**
- Google Identity Toolkit (Firebase REST, not SDK)
  - Approach: REST API calls to Firebase Auth endpoints
  - Credentials: Hardcoded API key in `src/services/AuthService.ts`
  - Flow: Email/password registration and login via `AuthService`
  - Returns: Firebase UID (`localId`), ID token, refresh token
  - Phone verification: Separate backend-mediated OTP system (not part of Firebase)

## Phone Verification

**Phone OTP:**
- Backend API mediated via Twilio (optional)
  - What: SMS delivery of one-time passwords
  - SDK/Client: Twilio REST API (backend handles calls)
  - Configuration: Via backend `.env`:
    - `TWILIO_ACCOUNT_SID`
    - `TWILIO_AUTH_TOKEN`
    - `TWILIO_PHONE_NUMBER`
  - Fallback: Without Twilio, backend logs code to console (for development)
  - Test code: `123456` always works in dev
  - App endpoints: `POST /api/otp/send`, `POST /api/otp/verify`
  - Setup: See `PHONE_VERIFICATION_SETUP.md`

## Monitoring & Observability

**Error Tracking:**
- Not detected (no external error tracking service configured)
- Local console logging via `console.error()` in `AuthService.ts`

**Logs:**
- Backend console logs (OTP codes in dev, payment errors, API errors)
- App uses console.error/console.log via React Native

## CI/CD & Deployment

**Hosting:**
- Railway - Backend API hosting
  - URL: `https://carex-services-production.up.railway.app`
  - App ID: `com.carex.market` (Android), `com.carex` (iOS)

**App Distribution:**
- Google Play Store
  - Target: Play Store upload via AAB (Android App Bundle)
  - Build script: `build-android-release.sh`
  - Release signing: `android/keystore.properties` (git-ignored)
  - Version management: `android/version.properties` auto-incremented

- Apple App Store
  - Target: App Store upload via Xcode Organizer
  - Build script: `build-ios-release.sh`
  - Version auto-incremented via build script
  - Signed with development/distribution certificates (configured in Xcode)

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar configured)

## Environment Configuration

**Required env vars (Backend):**
```
PORT=5001
MONGODB_URI=<MongoDB Atlas connection string>
AWS_ACCESS_KEY_ID=<AWS credentials>
AWS_SECRET_ACCESS_KEY=<AWS credentials>
AWS_REGION=<AWS region>
AWS_BUCKET_NAME=<S3 bucket name>
TWILIO_ACCOUNT_SID=<Twilio SID> (optional)
TWILIO_AUTH_TOKEN=<Twilio token> (optional)
TWILIO_PHONE_NUMBER=<Twilio number> (optional)
ANDROID_SHA256_CERT_FINGERPRINTS=<Debug and/or release SHA256 fingerprints>
```

**App Configuration:**
- `src/constants/config.ts` - API URLs and environment switching
- `android/version.properties` - Version code and name
- `.env` files: Present but contents not shown (contains sensitive config)

**Secrets location:**
- Backend `.env` file (git-ignored)
- Android: `android/keystore.properties` (git-ignored)
- iOS: Xcode project configuration (provisioning profiles in Xcode)

## Webhooks & Callbacks

**Incoming:**
- Stripe payment callbacks: Backend receives Stripe webhooks
- Deep link callbacks: App receives deep links via `carex://` and `https://www.carexmarket.com/listing/{carId}`

**Outgoing:**
- Stripe payment intent confirmations: App sends payment data to backend
- OTP verification: App sends phone number and verification code to backend
- Order creation: App sends order data to backend

## Deep Linking & Universal Links

**iOS Universal Links:**
- Domain: `https://www.carexmarket.com`
- Associated domain entitlement: `applinks:www.carexmarket.com`
- Well-known file: `/.well-known/apple-app-site-association` (served by backend)
- Target path: `/listing/{carId}` routes to CarDetails screen

**Android App Links:**
- Domain: `https://www.carexmarket.com`
- Intent filter with `android:autoVerify="true"` in `AndroidManifest.xml`
- Well-known file: `/.well-known/assetlinks.json` (served by backend)
- Requires: SHA256 certificate fingerprints in `ANDROID_SHA256_CERT_FINGERPRINTS`
- Target path: `/listing/{carId}` routes to CarDetails screen

**Custom Schemes:**
- Scheme: `carex://`
- Deep link handlers: `carex://listing/{carId}` for car details
- Intent filters in `AndroidManifest.xml` for custom scheme routing

**Navigation Configuration:**
- Configured in `App.tsx` via React Navigation linking:
  ```typescript
  const linking = {
    prefixes: ['https://www.carexmarket.com', 'carex://'],
    config: {
      screens: {
        Home: '',
        CarDetails: 'listing/:carId',
      },
    },
  };
  ```

**Well-Known Files (Backend-Served):**
- Location: `carEx-services` backend at Railway
- Files:
  - `GET /.well-known/apple-app-site-association` - iOS verification
  - `GET /.well-known/assetlinks.json` - Android verification
- Deployment: If carexmarket.com is a separate web property, must proxy `/.well-known/*` to backend
- Setup: See `docs/DEEPLINK_SETUP.md`

## Permissions & Capabilities

**iOS Permissions (Info.plist):**
- Camera: `NSCameraUsageDescription` - "CarEx uses the camera to let you take photos of your vehicle to create a sales listing."
- Photo Library: `NSPhotoLibraryUsageDescription` - "CarEx needs access to your photos to let you select vehicle images for your sales listing."
- Query schemes allowed: whatsapp, tg (Telegram), mailto, tel

**Android Permissions (AndroidManifest.xml):**
- INTERNET - HTTP/HTTPS network access
- ACCESS_NETWORK_STATE - Check network connectivity
- ACCESS_WIFI_STATE - Check WiFi status
- Custom permission: `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (used internally)

**Device Capabilities (Android):**
- OpenGL ES 2.0 required
- 64-bit ARM (arm64) required per `UIRequiredDeviceCapabilities`

---

*Integration audit: 2026-04-17*

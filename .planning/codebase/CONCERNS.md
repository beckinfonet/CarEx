# Codebase Concerns

**Analysis Date:** 2026-04-17

## Security Issues

**Hardcoded Firebase Web API Key:**
- Issue: Firebase API key is hardcoded directly in source
- Files: `src/services/AuthService.ts:7`
- Code: `const API_KEY = 'AIzaSy…'` (full value redacted in this doc — see `src/services/AuthService.ts:7`)
- Impact: The Firebase Web API key is intended to be public (used for client-side auth), but hardcoding it in source is poor practice. However, this is less critical than server-side keys.
- Recommendation: Move to `src/constants/config.ts` alongside other configuration, make it configurable per environment.

**Stripe Test Key Hardcoded in App:**
- Issue: Stripe test publishable key hardcoded in App.tsx will be shipped to production
- Files: `App.tsx:59`
- Code: `publishableKey="pk_test_…"` (full value redacted in this doc — see `App.tsx:59`)
- Impact: **CRITICAL before App Store release** — Any payment attempts in production will fail or route to test environment. Allows test purchases instead of real transactions.
- Fix approach: Move key to config.ts, set test key for dev, live key for prod. Stripe key must be swapped to `pk_live_...` before release.

**Dev-Bypass OTP Code:**
- Issue: Backend OTP code `123456` always works in development
- Files: `PHONE_VERIFICATION_SETUP.md:36`
- Impact: If backend test code is not disabled for production, anyone can spoof phone verification. Silent production risk.
- Current mitigation: Documentation mentions logging the code to console; unclear if `123456` bypass is still enabled in prod backend.
- Recommendation: Confirm backend OTP handler disables the `123456` always-accept logic before App Store release. Add env var like `ALLOW_TEST_OTP_CODE=false` for production.

**Keystore Files Not Committed:**
- Files: `android/app/release.keystore`, `android/keystore.properties`
- Status: Both are correctly gitignored (`.gitignore:34,36`)
- Impact: No risk; keystore setup is documented correctly in `RELEASE_SIGNING.md`.

## Tech Debt

**God Module – AuthService:**
- Issue: Single 377-line module handles unrelated concerns
- Files: `src/services/AuthService.ts`
- Contains: Firebase auth, backend users, brokers, logistics, OTP, payments, orders, admin
- Impact: Difficult to test, maintain, and reason about; unrelated domain changes conflict in same module.
- Recommendation: Split into focused modules: `FirebaseAuthService.ts`, `UserService.ts`, `BrokerService.ts`, `LogisticsService.ts`, `OtpService.ts`, `PaymentService.ts`, `OrderService.ts`, `AdminService.ts`.

**Loose Type Annotations in Auth Context:**
- Issue: User type is `any`, spreads untyped data
- Files: `src/context/AuthContext.tsx:5,24,49`
- Code: `const [user, setUser] = useState<any>(null)` and `{ ...userData, ...backendUser }`
- Impact: No compile-time safety; merging Firebase user with backend user could cause collisions or missing fields; hard to debug.
- Recommendation: Create strict `User` interface with all required/optional fields, use TypeScript strict mode.

**Untyped AuthService Method Parameters:**
- Issue: Several methods lack parameter types
- Files: `src/services/AuthService.ts:12,25,50,88`
- Examples: `signUp(email, password)`, `saveToken(token, userData)`, `updateBackendUser(firebaseUid: string, data: any)`
- Impact: No autocomplete or type checking; easy to pass wrong arguments.
- Recommendation: Add explicit parameter types to all public methods.

**Manual Environment Toggle:**
- Issue: Hand-toggled flag in code
- Files: `src/constants/config.ts:13`
- Code: `const currentEnv = 'prod'`
- Impact: Easy to forget when switching between local dev and prod; easy to ship a debug build pointed at wrong API.
- Recommendation: Switch to env vars or build-time config injection. Use `process.env.REACT_APP_ENV` or similar pattern.

**Error Handling Inconsistency:**
- Issue: No standardized error handling across AuthService
- Files: `src/services/AuthService.ts` (multiple methods)
- Pattern 1: `createBackendUser:74` — logs error but continues (error swallowed)
- Pattern 2: `signUp:21` — rethrows error with minimal context
- Pattern 3: `deleteAccount:218` — wraps error in new Error
- Impact: Silent failures in user creation after Firebase signup succeeds (user stuck in limbo). Inconsistent error recovery makes debugging harder.
- Recommendation: Standardize error handling: log with context, throw custom error classes, never silently swallow auth failures.

## Fragile Areas

**Single Test File, No Unit/Component Tests:**
- Issue: Only `__tests__/App.test.tsx` exists; Jest is configured but unused
- Files: `__tests__/App.test.tsx`, `jest.config.js`, no other test files
- Impact: No regression safety on 377-line AuthService, 1482-line CarDetailsScreen, or any context/hook. High risk when refactoring.
- Test coverage: 0% on service layer.
- Recommendation: Add unit tests for AuthService methods, hook tests for contexts (useAuth, useCart), snapshot tests for major screens.

**Android Auto-Linking Cache Hack:**
- Issue: Build script manually deletes autolinking cache to work around stale package reference
- Files: `build-android-release.sh:55-56`
- Code: Deletes `android/build/generated/autolinking` and `android/app/build/generated/autolinking`
- Cause: Past package rename from `com.carex` didn't fully clean generated files.
- Impact: Build is fragile; renaming package again will require script update. Future maintainers may not understand why cache deletion is needed.
- Recommendation: Document why in script comments; consider if full clean is necessary, or switch to permanent gradle config fix.

**Reanimated Race Condition Workaround:**
- Issue: Split `gradlew clean` and `gradlew bundleRelease` into separate commands to avoid race condition
- Files: `build-android-release.sh:62-63`
- Related: https://github.com/software-mansion/react-native-reanimated/issues/7317
- Impact: Build reliability depends on external library's unresolved bug. If library fixes it, script becomes redundant.
- Recommendation: Document the issue, monitor react-native-reanimated releases, remove workaround when fixed upstream.

**Version Auto-Bump on Every Build:**
- Issue: Both iOS and Android scripts mutate version files before every archive
- Files: `build-ios-release.sh:37-38`, `build-android-release.sh:43-44`
- Impact: Re-running a failed build still increments version. If build fails midway, you've burned a version number. Hard to track which build succeeded.
- Recommendation: Only bump version on successful build completion, or ask for manual confirmation before bumping.

**CarEx Package Name Reference in Generated Code:**
- Issue: Comments reference past package rename
- Files: `build-android-release.sh:54` comment mentions `com.carex` reference
- Impact: If package name changes again, generated Java will have stale references until autolinking cache is cleared.
- Recommendation: Verify current package name in `android/app/build.gradle`, ensure it's not hardcoded anywhere.

## Configuration & Release Issues

**Deep Link App Store ID Placeholder:**
- Issue: App Store URL contains dummy ID
- Files: `src/constants/config.ts:23`
- Code: `APP_STORE_URL = 'https://apps.apple.com/app/carex/id000000000'`
- Impact: Deep links to App Store will 404 until real ID is filled in.
- Recommendation: Update with actual App Store ID before submitting to App Store.

**Cart Currency Hardcoded to Dollar Symbol:**
- Issue: Default currency fallback is hardcoded symbol
- Files: `src/context/CartContext.tsx:106`
- Code: `map[key] = { provider: item.provider, services: [], subtotal: 0, currency: '$' }`
- Impact: Carts for non-USD markets show `$` instead of localized currency symbol. No fallback to user's locale or device settings.
- Recommendation: Use `Intl.NumberFormat` or imported locale data to determine correct symbol based on user locale or item currency.

## Missing Critical Features

**Authentication Flow Incomplete per README:**
- Issue: README marks User Authentication as `[ ]` pending despite code existing
- Files: `README.md:45`, but signup/login/password reset code exists in screens and AuthService
- Impact: Unclear if signup→login→password-reset end-to-end flow is actually complete and tested.
- Recommendation: Either complete the flow and verify all screens work, or update README to mark as complete.

## Performance Bottlenecks

**Large Screen Components:**
- Issue: Multiple screens exceed 1400 lines; risk of unoptimized renders
- Files: `src/screens/CarDetailsScreen.tsx` (1482 lines), `src/screens/SellCarScreen.tsx` (1434 lines), `src/screens/ServiceProfileScreen.tsx` (958 lines)
- Impact: Hard to debug, prone to slow renders if not memoized, complex prop chains.
- Recommendation: Extract sub-components, use `React.memo` for list items, profile performance with React DevTools Profiler.

**Translation Constants File:**
- Issue: Large translation object in memory
- Files: `src/constants/translations.ts` (795 lines)
- Impact: Entire translation dictionary loaded at app start; no lazy loading or code-splitting per language.
- Recommendation: Consider lazy loading translations by language, or use a more efficient i18n library (e.g., `i18n-js` or `react-i18next`).

## Test Coverage Gaps

**No AuthService Tests:**
- What's not tested: `signUp`, `signIn`, `createBackendUser`, `getBackendUser`, `requestSellerStatus`, `requestBrokerStatus`, `verifyOtp`, `deleteAccount`, `createPaymentIntent`
- Risk: Silent failures in user creation, OTP bypass, payment flow breaks unnoticed.

**No Context Hook Tests:**
- What's not tested: `useAuth` login/signup/logout flow, `useCart` add/remove items, `useLanguage` locale switching
- Risk: Context state mutations break without warning.

**No Component Snapshot Tests:**
- What's not tested: Screens rendering with various states (loading, error, empty), form field validation
- Risk: UI regressions (crashes, layout breaks) slip through.

---

*Concerns audit: 2026-04-17*

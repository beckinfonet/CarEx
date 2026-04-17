# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CarEx — React Native 0.83 / TypeScript app (iOS + Android) for buying/selling cars and booking broker/logistics services. Node >= 20. Backend is a separate service at `backend-services/carEx-services` (not in this repo); production backend is hosted on Railway.

## Common commands

```bash
npm start                 # Metro bundler
npm run start:reset       # Metro with --reset-cache (use after native dep changes)
npm run ios               # Run on iOS sim (requires `cd ios && pod install` first time)
npm run android           # Run on Android emulator/device
npm run lint              # eslint (@react-native config)
npm test                  # Jest (react-native preset)
npx jest path/to/file     # Run a single test file
npm run android:clean     # ./gradlew clean
npm run ios:archive       # Auto-bumps version + creates .xcarchive (see build-ios-release.sh)
npm run android:archive   # Auto-bumps version + builds signed AAB (see build-android-release.sh)
```

Release scripts auto-increment versions in `ios/carEx.xcodeproj/project.pbxproj` (MARKETING_VERSION, CURRENT_PROJECT_VERSION) and `android/version.properties` (VERSION_CODE, VERSION_NAME) — expect those files to change on every archive build. Android release signing requires `android/keystore.properties` (gitignored — see `RELEASE_SIGNING.md`).

## Environment switch

`src/constants/config.ts` contains a hardcoded `currentEnv = 'dev' | 'prod'` flag. Flip it before building a release. iOS dev uses `http://localhost:5001`, Android dev uses `http://10.0.2.2:5001`, prod uses the Railway URL.

## Architecture

**Provider stack (App.tsx).** The root wraps everything in this order — order matters because inner providers depend on outer ones (e.g. `CartProvider` uses `useAuth`):

```
GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider
  → StripeProvider → LanguageProvider → NavigationContainer → Stack.Navigator
```

**Navigation.** Single `createNativeStackNavigator` in `App.tsx`; all route params typed in `src/types/navigation.ts` as `RootStackParamList`. Deep links configured via `linking` for `https://www.carexmarket.com` and `carex://` — `listing/:carId` routes to `CarDetails`.

**Auth model (hybrid).** `src/services/AuthService.ts` is the single axios client for both identity and app data:
- Identity: direct REST calls to Google Identity Toolkit (`identitytoolkit.googleapis.com`) with a hardcoded Firebase web API key. No Firebase native SDK is used. Tokens + user data persisted in `AsyncStorage`.
- App data: every Identity Toolkit user is mirrored as a backend user at `${API_URL}/api/users/:firebaseUid`. `AuthContext` always merges `{ ...identityData, ...backendUser }` into `user`, so `user.localId` is the Firebase UID used as the primary key for all backend calls (cars, orders, payments, broker/logistics profiles, admin, OTP).
- Roles: `isAdmin`/`adminRole` fetched separately via `/api/admin/status/:uid`. Seller/broker/logistics are request-approve flows (`requestSellerStatus`, etc.) gated by admin approval.

**Cart.** `CartContext` holds one `car` + a flat list of `{ provider, service }` items, grouped by `ownerUid+type` at render time via `getProviderGroups()`. It auto-clears when `user.localId` changes (login/logout).

**i18n.** `LanguageContext` defaults to `'RU'`; `t` comes from `src/constants/translations.ts`. User-facing strings should be added there and accessed via `useLanguage().t`.

**Phone verification.** OTP is a backend-only flow (`/api/otp/send`, `/api/otp/verify`) — no native SDK. Backend logs the code to console if Twilio isn't configured; `123456` is a hardcoded dev bypass. See `PHONE_VERIFICATION_SETUP.md`.

**Payments.** Stripe is wired at the root (`StripeProvider` with a test publishable key in `App.tsx`). Payment flow: `AuthService.createPaymentIntent` → Stripe native sheet → `AuthService.confirmBooking` → `AuthService.createOrders`.

**Directory map.**
- `src/screens/` — one file per route; screen names match `RootStackParamList` keys
- `src/components/` — shared UI (CarCard, FilterBar, OfflineNotice, PasswordTextInput, etc.)
- `src/context/` — Auth, Cart, Language (all exposed via `use*` hooks that throw if used outside their provider)
- `src/services/AuthService.ts` — all backend HTTP lives here (not just auth despite the name)
- `src/hooks/` — `useVehicleCatalog` (makes/models from `/api/vehicles`), `useNetwork`
- `src/constants/config.ts` — `API_URL`, `WEB_BASE_URL`, `LISTING_URL`, store URLs
- `src/utils/passwordPolicy.ts` — password validation rules used by signup/reset screens

<!-- GSD:project-start source:PROJECT.md -->
## Project

**CarEx**

CarEx is a React Native mobile marketplace for buying and selling cars, with add-on broker and logistics services booked through the app. The backend is a separate Node/Express + MongoDB + S3 service; identity uses Firebase Identity Toolkit REST. This milestone adds admin moderation controls over approved users (buyers, sellers, brokers, logistics providers) so operators can suspend, revoke, edit, or delete accounts after the initial approval gate.

**Core Value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.

### Constraints

- **Tech stack (mobile):** React Native 0.83 + TypeScript + axios + AsyncStorage. Don't introduce new state-management or networking libs for this milestone. Extend existing `AuthService.ts` or split sensibly; do not rewrite it wholesale.
- **Tech stack (backend):** Node/Express + Mongoose + MongoDB Atlas. New routes mount under `/api/admin/moderation/*`. Follow existing admin-auth pattern (`callerUid` param → `getAdminStatus` check).
- **Auth enforcement:** Admin-only endpoints must validate the caller's admin status server-side on every request — never trust mobile-side `isAdmin`.
- **Data preservation:** Suspending or revoking must never destroy order/audit history. Delete-profile hard-deletes only the provider profile record; orders stay with anonymized seller reference.
- **Order safety:** In-flight orders touching a suspended provider are *paused*, not auto-cancelled. Buyers see a status banner on the order. Admin can manually cancel if needed.
- **i18n:** All moderator and affected-user strings are RU-first and must have EN parity.
- **No breaking changes to existing auth/cart/payments flows:** Moderation adds UI and endpoints; it must not regress signup, login, listing browse, cart, or Stripe checkout.
- **Secrets hygiene:** No new hardcoded keys. Existing `CONCERNS.md` items (Firebase key, Stripe test key) are explicitly *not* addressed here but also must not get worse.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - Application logic, type-safe development
- JavaScript - Configuration files, build scripts
- Kotlin 2.1.20 - Android native integration (via Gradle)
- Objective-C/Swift - iOS native integration (via Xcode/CocoaPods)
- XML - Android manifest and configuration
- Plist - iOS configuration (Info.plist)
- Bash - Build and release scripts
## Runtime
- React Native 0.83.1 - Cross-platform mobile application runtime
- Node.js >= 20 - Development and build tooling
- React 19.2.0 - UI framework
- npm (via `package.json`)
- Lockfile: `package-lock.json` (present)
- CocoaPods (for iOS native dependencies, via `ios/Podfile`)
- Gradle (for Android dependencies, via `android/build.gradle`)
## Frameworks
- React Native 0.83.1 - Mobile application framework
- @react-navigation/native 7.1.28 - Navigation and routing
- @react-navigation/native-stack 7.11.0 - Stack navigation
- lucide-react-native 0.563.0 - Icon library
- react-native-svg 15.15.1 - SVG rendering
- @likashefqet/react-native-image-zoom 4.3.0 - Image zoom functionality
- react-native-fast-image 8.6.3 - Optimized image loading
- react-native-gesture-handler 2.30.0 - Touch and gesture handling
- react-native-reanimated 4.2.2 - Animation library
- react-native-worklets 0.7.4 - Performance optimization
- react-native-safe-area-context 5.6.2 - Safe area management
- react-native-screens 4.20.0 - Native screen components
- @react-native-async-storage/async-storage 2.2.0 - Local persistent storage
- @react-native-community/netinfo 11.4.1 - Network connectivity detection
- react-native-image-picker 8.2.1 - Native image and camera picker
- @stripe/stripe-react-native 0.62.0 - Stripe payment processing
- Jest 29.6.3 - Test runner and framework
- react-test-renderer 19.2.0 - React component testing utilities
- Babel 7.25.x - JavaScript transpiler
- Metro - React Native bundler (included in CLI)
- TypeScript 5.8.3 - Static type checking
- ESLint 8.19.0 - Code linting
- Prettier 2.8.8 - Code formatting
## Key Dependencies
- axios 1.13.4 - HTTP client for API calls and Firebase REST endpoints
- @stripe/stripe-react-native 0.62.0 - Required for payment processing (Stripe)
- react-native-gesture-handler 2.30.0 - Required for navigation and touch handling
- react-native-reanimated 4.2.2 - Required for smooth animations
## Configuration
- Centralized config: `src/constants/config.ts`
- Metro config: `metro.config.js`
- Babel config: `babel.config.js` (includes react-native-worklets plugin)
- TypeScript config: `tsconfig.json`
- ESLint config: `.eslintrc.js` (uses @react-native preset)
- Prettier config: `.prettierrc.js`
- Podfile: `ios/Podfile`
- Post-install hooks for Stripe and fmt library compatibility (C++17 requirement)
- Gemfile for Ruby dependency management: `Gemfile`
- Root Gradle: `android/build.gradle`
- App Gradle: `android/app/build.gradle`
- Version management: `android/version.properties`
- Version code auto-increments via `build-android-release.sh`
- iOS release: `build-ios-release.sh` (auto-increments version)
- Android release: `build-android-release.sh` (auto-increments version code)
- Android release signing: `android/keystore.properties` (git-ignored, created per `RELEASE_SIGNING.md`)
## Platform Requirements
- Node.js >= 20
- CocoaPods (iOS)
- Xcode 15+ (iOS)
- Android SDK 36 (Android)
- Gradle (Android, via Gradle Wrapper)
- iOS 13.4+ (minimum from Xcode config)
- Android 7.0+ (minSdkVersion 24)
- Railway hosting for backend API: `https://carex-services-production.up.railway.app`
## Network & Security
- `NSAllowsArbitraryLoads`: false (enforces HTTPS)
- `NSAllowsLocalNetworking`: true (enables local development)
- `cleartextTraffic`: false (enforces HTTPS in production)
- Allows localhost for development (platform detection in `src/constants/config.ts`)
- iOS: carex:// scheme
- Android: carex:// scheme and https://www.carexmarket.com deep links
- Web fallback: https://www.carexmarket.com
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: PascalCase, e.g. `CarCard.tsx`, `HomeScreen.tsx`, `PasswordTextInput.tsx`
- Hooks: camelCase with `use` prefix, e.g. `useVehicleCatalog.ts`, `useLanguage`, `useAuth`
- Screens: PascalCase with `Screen` suffix, e.g. `HomeScreen.tsx`, `SellCarScreen.tsx`, `ProfileScreen.tsx`
- Services: PascalCase with `Service` suffix, e.g. `AuthService.ts`
- Utilities: camelCase, e.g. `makeLogos.ts`, `passwordPolicy.ts`
- Constants: directories uppercase, e.g. `constants/theme.ts`, `constants/translations.ts`
- Types: directories dedicated, e.g. `types/navigation.ts`
- React components: PascalCase, exported as named or default exports from their file
- Hook functions: camelCase with `use` prefix, returns object/value
- Utility functions: camelCase
- Event handlers: camelCase with `handle` prefix, e.g. `handleCarPress()`, `handleFilterPress()`, `handleSubmit()`
- Callbacks: camelCase with `on` prefix in props, e.g. `onPress`, `onChange`, `onSelect`
- State variables: camelCase, e.g. `selectedMake`, `loading`, `filteredCars`, `activeFilters`
- Boolean flags: camelCase, e.g. `isEditMode`, `isFocused`, `isPhoneVerified`
- Constants: UPPER_SNAKE_CASE, e.g. `COLORS`, `SIZES`, `API_KEY`, `AUTH_URL`
- Interface names: PascalCase, e.g. `CarProps`, `AuthContextType`, `VehicleMake`, `PasswordTextInputProps`
- Type aliases: PascalCase, e.g. `Language = 'RU' | 'EN'`
- Exported interfaces in component files: narrow scope to the component using them
## Code Style
- Prettier preset: React Native defaults
- ESLint config: `@react-native` preset only
- Config file: `.eslintrc.js` in project root
- No custom rules; follows React Native community standards
- Run with: `npm run lint`
- One default export per component file (screens/components)
- Named exports allowed for screens and hooks when re-exported
- StyleSheet definitions inline at bottom of component file
- Memoized components when props are stable: `React.memo()`, e.g. `CarCard` uses memo for perf optimization
## Import Organization
- None configured; relative imports used throughout
- Paths structured by feature: screens, components, services, context, hooks, constants, types, utils
- Example from `HomeScreen.tsx`: `import { COLORS, SIZES } from '../constants/theme';`
## Error Handling
## Logging
- `console.error()` for errors and debug information
- Applied sparingly; typically in catch blocks or when debugging
- Example: `console.error('Failed to fetch makes:', e);` in `useVehicleCatalog.ts`
## Comments
- Function purpose if not self-evident from signature
- Complex logic or workarounds (e.g., model name matching in `HomeScreen.tsx`)
- Commented-out code blocks kept during development (e.g., deprecated styles in `HomeScreen.tsx`)
- Not consistently used; minimal documentation patterns observed
- Used minimally for type exports and service methods
## Function Design
- Functions range from small handlers (< 20 lines) to larger screen components (900+ lines)
- Complex screens like `SellCarScreen.tsx` exceed 1000 lines; no aggressive splitting observed
- Inline handlers favored over extracted utilities in some cases
- Destructuring used for complex props: `({ data }: { data: CarProps })`
- Named parameters with object destructuring for clarity
- Typing: full TypeScript; all parameters and returns typed
- Components return JSX
- Hooks return objects with named properties or arrays
- Service methods return Promise-wrapped data or throw errors
- Memoized components return memo-wrapped JSX
## Module Design
- Components: default or named export (no re-export pattern observed)
- Hooks: named exports, e.g. `export function useVehicleCatalog()`
- Services: object export with methods, e.g. `export const AuthService = { ... }`
- Contexts: Provider component (default) + hook (named), e.g. `LanguageProvider` + `useLanguage()`
- Constants: named exports, e.g. `export const COLORS = { ... }`
- Not used; imports directly from component files
- Example: `import { CarCard } from '../components/CarCard';` not from `../components/index.ts`
## Context + Hook Pattern
- `AuthProvider` → `useAuth()` (throws: "useAuth must be used within an AuthProvider")
- `LanguageProvider` → `useLanguage()` (throws: "useLanguage must be used within a LanguageProvider")
- `CartContext` follows same pattern
## StyleSheet & Theming
- `StyleSheet.create()` defined inline at bottom of each component file
- Theme colors sourced from `src/constants/theme.ts`: `COLORS` and `SIZES`
- All color references use `COLORS.*` constants, never hardcoded hex values (except neutrals like `#000`)
- Spacing uses `SIZES.padding` (16) as baseline
- Border radius: `SIZES.borderRadius` (12)
## Internationalization (i18n)
- Import `useLanguage()` hook in any component needing translations
- Access strings via `const { t } = useLanguage();` then `t.keyName`
- Translation keys defined in `src/constants/translations.ts`
- Supported languages: 'RU' (Russian, default) and 'EN' (English)
- Example from `HomeScreen.tsx`: `<Text>{t.noCars}</Text>`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Context-based state management (Auth, Cart, Language)
- Firebase Identity Toolkit for authentication with backend user mirror
- Axios-based HTTP client (`AuthService`) for all API calls
- Deep linking support via React Navigation
- Hybrid auth model: Google Identity REST + custom backend user records
- Single cart per user session with auto-clear on auth change
## Layers
- Purpose: Render UI and handle user interaction
- Location: `src/screens/` (22 screen files), `src/components/` (18+ component files)
- Contains: Screen components (one per navigation route), reusable UI components
- Depends on: Context hooks (useAuth, useCart, useLanguage), services via AuthService, APIs
- Used by: NavigationContainer and child routes
- Purpose: Global state for authentication, cart, and language
- Location: `src/context/` (3 providers: AuthContext, CartContext, LanguageContext)
- Contains: React Context definitions, hooks (useAuth, useCart, useLanguage)
- Depends on: AuthService, AsyncStorage, React Native NetInfo
- Used by: All screens and components via context hooks
- Purpose: Centralized HTTP client and API abstraction
- Location: `src/services/AuthService.ts` (despite name, handles auth, users, brokers, logistics, admin, OTP, payments, orders)
- Contains: Axios instance with API_URL from config, 40+ async methods
- Depends on: AsyncStorage (token/userData storage), axios, API_URL
- Used by: AuthContext (auth), screens (data fetching), context providers
- Purpose: Shared functions, configuration, theme, translations, mock data
- Location: `src/constants/` (config, theme, translations, mockData), `src/utils/` (makeLogos, passwordPolicy), `src/hooks/` (useNetwork, useVehicleCatalog)
- Contains: Theme colors/sizes, i18n translations (RU/EN), API endpoint config, vehicle logos, password validation
- Depends on: axios (useVehicleCatalog), React, React Native
- Used by: All screens, components, contexts
- Purpose: App routing and deep linking
- Location: `App.tsx` (root), `src/types/navigation.ts` (RootStackParamList)
- Contains: Native stack navigator config, provider stack, deep linking rules
- Depends on: All screens, context providers
- Used by: app entry point (index.js)
## Data Flow
- **User**: Single source in AuthContext, persisted to AsyncStorage
- **Cart**: Flat array in CartContext, reset when user.localId changes
- **Language**: Single language string in LanguageContext, defaults to 'RU'
- **UI state**: Local useState in individual screens (loading, refreshing, filters, modals)
## Key Abstractions
- Purpose: Single axios client wrapping all backend APIs
- Examples: `src/services/AuthService.ts` exports object with 40+ async methods
- Pattern: Method per API endpoint; error handling with try-catch; returns response.data or throws
- Methods group into: Auth (signUp, signIn), User (getBackendUser, updateBackendUser, uploadAvatar), Seller (requestSellerStatus), Broker (getBrokerProfile, updateBrokerProfile, requestBrokerStatus), Logistics (getLogisticsProfile, updateLogisticsProfile, requestLogisticsStatus), OTP (sendOtp, verifyOtp), Admin (getAdminStatus, getAdminRequests, approveRequest, etc.), Payments (createPaymentIntent, confirmBooking), Orders (createOrders, getBuyerOrders, getProviderOrders, updateOrderStatus)
- Purpose: Stack of providers wrapping app for state access
- Examples: `src/context/AuthContext.tsx`, `src/context/CartContext.tsx`, `src/context/LanguageContext.tsx`
- Pattern: Each provider wraps children, exports useHook; dependencies respected (CartProvider uses useAuth)
- Order matters: GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer
- Purpose: Fetch and cache vehicle makes/models from backend
- Examples: `src/hooks/useVehicleCatalog.ts`
- Pattern: useState for makes/models + loading/error; useCallback for fetchMakes/fetchModels; useEffect to auto-fetch makes on mount
- Used by: MakeModelFilterBar, MakeModelSearchBar, MakeModelFormField
- Purpose: Resolve vehicle make logos from DB or CDN with fallback
- Examples: `src/utils/makeLogos.ts`
- Pattern: getMakeLogoUrl() checks DB logo, falls back to CDN by slug; handles slug overrides; needsDarkLogoBg() for display logic
## Entry Points
- Location: `index.js` 
- Triggers: App startup (AppRegistry.registerComponent)
- Responsibilities: Register App component with React Native
- Location: `App.tsx`
- Triggers: Rendered by index.js
- Responsibilities: 
- Location: `src/screens/` (e.g., HomeScreen.tsx, LoginScreen.tsx)
- Triggers: Navigation route activated
- Responsibilities: Fetch data, handle user input, display UI, call AuthService/context methods
## Error Handling
- **Service errors:** AuthService methods wrap axios calls in try-catch, throw error.response?.data?.error or error
- **Context errors:** AuthContext/CartContext catch errors, set errorMessage state or console.error
- **Screen errors:** Screens catch errors from context/services, display Alert.alert() or set errorMessage UI state
- **Firebase errors:** LoginScreen maps Firebase error.message to user-friendly t.invalidCredentials, t.tooManyAttempts, etc.
- **OTP errors:** verifyOtp throws Error with error.response?.data?.message for user feedback
## Cross-Cutting Concerns
- console.error/log calls in AuthService, contexts, and screens
- No centralized logger; ad-hoc logging
- Password: `src/utils/passwordPolicy.ts` with getPasswordRequirementChecks() and passwordMeetsPolicy()
- Email/form: Basic checks in screens (if !email || !password)
- Phone: `src/components/PhoneNumberFormatter.tsx` formats phone input
- Hybrid: Firebase Identity Toolkit REST (identitytoolkit.googleapis.com) + custom backend user at `/api/users/:firebaseUid`
- Token storage: idToken saved to AsyncStorage; sent in Authorization header (implied in service methods)
- Auto-logout: loadStorageData() checks AsyncStorage on app load; logout() clears AsyncStorage
- `src/components/OfflineNotice.tsx` uses useNetwork() hook to display banner when offline
- useNetwork() hook monitors NetInfo.addEventListener()
- API calls fail silently with console.error (no automatic retry/queue)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

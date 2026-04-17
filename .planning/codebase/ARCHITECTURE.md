# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Multi-layered React Native mobile app with context-driven state management and provider composition. Single native-stack navigator with provider-wrapped root component.

**Key Characteristics:**
- Context-based state management (Auth, Cart, Language)
- Firebase Identity Toolkit for authentication with backend user mirror
- Axios-based HTTP client (`AuthService`) for all API calls
- Deep linking support via React Navigation
- Hybrid auth model: Google Identity REST + custom backend user records
- Single cart per user session with auto-clear on auth change

## Layers

**Presentation Layer (Screens & Components):**
- Purpose: Render UI and handle user interaction
- Location: `src/screens/` (22 screen files), `src/components/` (18+ component files)
- Contains: Screen components (one per navigation route), reusable UI components
- Depends on: Context hooks (useAuth, useCart, useLanguage), services via AuthService, APIs
- Used by: NavigationContainer and child routes

**Context/State Management Layer:**
- Purpose: Global state for authentication, cart, and language
- Location: `src/context/` (3 providers: AuthContext, CartContext, LanguageContext)
- Contains: React Context definitions, hooks (useAuth, useCart, useLanguage)
- Depends on: AuthService, AsyncStorage, React Native NetInfo
- Used by: All screens and components via context hooks

**Service Layer:**
- Purpose: Centralized HTTP client and API abstraction
- Location: `src/services/AuthService.ts` (despite name, handles auth, users, brokers, logistics, admin, OTP, payments, orders)
- Contains: Axios instance with API_URL from config, 40+ async methods
- Depends on: AsyncStorage (token/userData storage), axios, API_URL
- Used by: AuthContext (auth), screens (data fetching), context providers

**Utilities & Constants:**
- Purpose: Shared functions, configuration, theme, translations, mock data
- Location: `src/constants/` (config, theme, translations, mockData), `src/utils/` (makeLogos, passwordPolicy), `src/hooks/` (useNetwork, useVehicleCatalog)
- Contains: Theme colors/sizes, i18n translations (RU/EN), API endpoint config, vehicle logos, password validation
- Depends on: axios (useVehicleCatalog), React, React Native
- Used by: All screens, components, contexts

**Navigation Layer:**
- Purpose: App routing and deep linking
- Location: `App.tsx` (root), `src/types/navigation.ts` (RootStackParamList)
- Contains: Native stack navigator config, provider stack, deep linking rules
- Depends on: All screens, context providers
- Used by: app entry point (index.js)

## Data Flow

**Authentication Flow:**

1. User enters email/password in LoginScreen → calls `useAuth().login()`
2. AuthContext calls `AuthService.signIn()` → Firebase Identity Toolkit REST at identitytoolkit.googleapis.com
3. Firebase returns idToken and localId (Firebase UID)
4. AuthContext calls `AuthService.getBackendUser(localId)` → GET `/api/users/:firebaseUid`
5. Backend user data merged with Firebase data and stored in `user` state
6. `AuthService.saveToken()` saves idToken and userData to AsyncStorage
7. Screens use `useAuth()` to access `user` and auth methods

**Cart Flow:**

1. User views service from broker/logistics provider
2. Screen calls `useCart().addItem(provider, service)` 
3. CartProvider stores item in local state array
4. `useEffect` monitors `user.localId` — if changed, cart auto-clears
5. CartContext provides `getProviderGroups()` for render-time grouping (flat items → grouped by provider)
6. ServiceCartScreen fetches grouped items and calls `AuthService.createOrders()` → POST `/api/orders`

**Payment Flow:**

1. CarDetailsScreen calls `AuthService.createPaymentIntent(currency, carId, buyerUid)`
2. Backend returns Stripe payment intent
3. StripeProvider processes payment via Stripe React Native SDK
4. CarDetailsScreen calls `AuthService.confirmBooking(paymentIntentId, carId, buyerUid)` → POST `/api/payments/confirm-booking`
5. Backend creates order and marks car as booked/sold

**Language Flow:**

1. LanguageProvider defaults to 'RU'
2. Screens/components call `useLanguage().t.propertyName` to access translated strings
3. `setLanguage()` updates language state, re-renders all consumers with new translations

**State Management:**

- **User**: Single source in AuthContext, persisted to AsyncStorage
- **Cart**: Flat array in CartContext, reset when user.localId changes
- **Language**: Single language string in LanguageContext, defaults to 'RU'
- **UI state**: Local useState in individual screens (loading, refreshing, filters, modals)

## Key Abstractions

**AuthService (Unified HTTP Client):**
- Purpose: Single axios client wrapping all backend APIs
- Examples: `src/services/AuthService.ts` exports object with 40+ async methods
- Pattern: Method per API endpoint; error handling with try-catch; returns response.data or throws
- Methods group into: Auth (signUp, signIn), User (getBackendUser, updateBackendUser, uploadAvatar), Seller (requestSellerStatus), Broker (getBrokerProfile, updateBrokerProfile, requestBrokerStatus), Logistics (getLogisticsProfile, updateLogisticsProfile, requestLogisticsStatus), OTP (sendOtp, verifyOtp), Admin (getAdminStatus, getAdminRequests, approveRequest, etc.), Payments (createPaymentIntent, confirmBooking), Orders (createOrders, getBuyerOrders, getProviderOrders, updateOrderStatus)

**Context Providers (Composition):**
- Purpose: Stack of providers wrapping app for state access
- Examples: `src/context/AuthContext.tsx`, `src/context/CartContext.tsx`, `src/context/LanguageContext.tsx`
- Pattern: Each provider wraps children, exports useHook; dependencies respected (CartProvider uses useAuth)
- Order matters: GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer

**useVehicleCatalog Hook:**
- Purpose: Fetch and cache vehicle makes/models from backend
- Examples: `src/hooks/useVehicleCatalog.ts`
- Pattern: useState for makes/models + loading/error; useCallback for fetchMakes/fetchModels; useEffect to auto-fetch makes on mount
- Used by: MakeModelFilterBar, MakeModelSearchBar, MakeModelFormField

**makeLogos Utility:**
- Purpose: Resolve vehicle make logos from DB or CDN with fallback
- Examples: `src/utils/makeLogos.ts`
- Pattern: getMakeLogoUrl() checks DB logo, falls back to CDN by slug; handles slug overrides; needsDarkLogoBg() for display logic

## Entry Points

**App Entry:**
- Location: `index.js` 
- Triggers: App startup (AppRegistry.registerComponent)
- Responsibilities: Register App component with React Native

**Root Component:**
- Location: `App.tsx`
- Triggers: Rendered by index.js
- Responsibilities: 
  - Wrap app in provider stack (GestureHandler → SafeArea → Auth → Cart → Stripe → Language → Navigation)
  - Create native-stack navigator with all routes from RootStackParamList
  - Configure deep linking (carex://, https://www.carexmarket.com)
  - Render OfflineNotice overlay

**Screen Components:**
- Location: `src/screens/` (e.g., HomeScreen.tsx, LoginScreen.tsx)
- Triggers: Navigation route activated
- Responsibilities: Fetch data, handle user input, display UI, call AuthService/context methods

## Error Handling

**Strategy:** Try-catch in service methods and context; error messages to user via Toast/Alert/UI state

**Patterns:**
- **Service errors:** AuthService methods wrap axios calls in try-catch, throw error.response?.data?.error or error
- **Context errors:** AuthContext/CartContext catch errors, set errorMessage state or console.error
- **Screen errors:** Screens catch errors from context/services, display Alert.alert() or set errorMessage UI state
- **Firebase errors:** LoginScreen maps Firebase error.message to user-friendly t.invalidCredentials, t.tooManyAttempts, etc.
- **OTP errors:** verifyOtp throws Error with error.response?.data?.message for user feedback

## Cross-Cutting Concerns

**Logging:** 
- console.error/log calls in AuthService, contexts, and screens
- No centralized logger; ad-hoc logging

**Validation:**
- Password: `src/utils/passwordPolicy.ts` with getPasswordRequirementChecks() and passwordMeetsPolicy()
- Email/form: Basic checks in screens (if !email || !password)
- Phone: `src/components/PhoneNumberFormatter.tsx` formats phone input

**Authentication:**
- Hybrid: Firebase Identity Toolkit REST (identitytoolkit.googleapis.com) + custom backend user at `/api/users/:firebaseUid`
- Token storage: idToken saved to AsyncStorage; sent in Authorization header (implied in service methods)
- Auto-logout: loadStorageData() checks AsyncStorage on app load; logout() clears AsyncStorage

**Offline Support:**
- `src/components/OfflineNotice.tsx` uses useNetwork() hook to display banner when offline
- useNetwork() hook monitors NetInfo.addEventListener()
- API calls fail silently with console.error (no automatic retry/queue)

---

*Architecture analysis: 2026-04-17*

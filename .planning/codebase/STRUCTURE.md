# Codebase Structure

**Analysis Date:** 2026-04-17

## Directory Layout

```
carEx/
├── index.js                          # App entry point (AppRegistry.registerComponent)
├── App.tsx                           # Root component with provider stack and navigator
├── app.json                          # React Native app config (name, version)
├── package.json                      # Dependencies (react, react-native, stripe, navigation, etc.)
├── tsconfig.json                     # TypeScript config
├── jest.config.js                    # Jest test runner config
├── metro.config.js                   # Metro bundler config
├── .eslintrc.js                      # ESLint config (extends @react-native)
├── .prettierrc.js                    # Prettier config (singleQuote, trailingComma, etc.)
├── babel.config.js                   # Babel transpiler config
├── react-native.config.js            # React Native linking config
│
├── src/                              # Source code root
│   ├── screens/                      # Navigation screens (22 files, one per route)
│   │   ├── HomeScreen.tsx
│   │   ├── CarDetailsScreen.tsx
│   │   ├── SellCarScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── AccountSettingsScreen.tsx
│   │   ├── FavoritesScreen.tsx
│   │   ├── MyListingsScreen.tsx
│   │   ├── SellerListingsScreen.tsx
│   │   ├── ServicesScreen.tsx
│   │   ├── ServiceApplicationScreen.tsx
│   │   ├── ServiceProfileScreen.tsx
│   │   ├── ServiceDetailsScreen.tsx
│   │   ├── ServiceCartScreen.tsx
│   │   ├── MyOrdersScreen.tsx
│   │   ├── ProviderOrdersScreen.tsx
│   │   ├── AdminDashboardScreen.tsx
│   │   ├── AdminManagementScreen.tsx
│   │   ├── AboutScreen.tsx
│   │   └── MyOrdersScreen.tsx
│   │
│   ├── components/                   # Reusable UI components (18+ files)
│   │   ├── CarCard.tsx               # Car listing card
│   │   ├── FilterBar.tsx             # Filter controls
│   │   ├── FilterModal.tsx           # Filter modal dialog
│   │   ├── MakeModelFilterBar.tsx    # Vehicle make/model selector
│   │   ├── MakeModelFormField.tsx    # Form field for make/model
│   │   ├── MakeModelSearchBar.tsx    # Search bar for makes/models
│   │   ├── CategoryList.tsx          # Category selector (Sedan, SUV, etc.)
│   │   ├── LatestCarousel.tsx        # Carousel of latest listings
│   │   ├── BottomBar.tsx             # Bottom navigation bar
│   │   ├── SearchBar.tsx             # Text search input
│   │   ├── QuickSortFilters.tsx      # Quick sort options
│   │   ├── OfflineNotice.tsx         # Offline banner
│   │   ├── OptimizedImage.tsx        # Image with caching/error handling
│   │   ├── Logo.tsx                  # App logo component
│   │   ├── PasswordTextInput.tsx     # Password input with visibility toggle
│   │   ├── PasswordRequirements.tsx  # Password strength indicator
│   │   ├── PhoneNumberFormatter.tsx  # Phone input formatter
│   │   └── MoreMenu.tsx              # Overflow menu
│   │
│   ├── context/                      # React Context providers
│   │   ├── AuthContext.tsx           # Authentication state (user, login, signup, logout, etc.)
│   │   ├── CartContext.tsx           # Shopping cart state (items, car, providers)
│   │   └── LanguageContext.tsx       # Language/i18n state (RU/EN)
│   │
│   ├── services/                     # API and data services
│   │   └── AuthService.ts            # Unified HTTP client (auth, users, brokers, logistics, admin, payments, orders)
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useNetwork.ts             # Monitor network connectivity
│   │   └── useVehicleCatalog.ts      # Fetch vehicle makes/models
│   │
│   ├── types/                        # TypeScript type definitions
│   │   └── navigation.ts             # RootStackParamList type
│   │
│   ├── constants/                    # Static constants and config
│   │   ├── config.ts                 # API_URL (dev/prod), WEB_BASE_URL, store URLs
│   │   ├── theme.ts                  # COLORS, SIZES (spacing, borderRadius)
│   │   ├── translations.ts           # TRANSLATIONS[RU] and [EN] i18n strings
│   │   └── mockData.ts               # FILTERS, CATEGORIES, CARS mock data
│   │
│   ├── utils/                        # Utility functions
│   │   ├── makeLogos.ts              # getMakeLogoUrl(), needsDarkLogoBg()
│   │   └── passwordPolicy.ts         # PASSWORD_MIN_LENGTH, getPasswordRequirementChecks(), passwordMeetsPolicy()
│   │
│   └── assets/                       # Local image assets
│       ├── car-logo-transparent.png
│       ├── CarExWord.png
│       └── logo.png
│
├── android/                          # Android native project (Gradle, AndroidManifest, resources)
│   └── app/
│       ├── build.gradle
│       ├── src/main/AndroidManifest.xml
│       └── src/main/res/
│
├── ios/                              # iOS native project (Xcode, Podfile, resources)
│   ├── carEx.xcodeproj/
│   ├── carEx/
│   ├── Podfile
│   └── Podfile.lock
│
├── scripts/                          # Build and utility scripts
│   └── generate-icons.js             # Icon generation script
│
├── docs/                             # Documentation
│   ├── DEEPLINK_SETUP.md             # Deep linking configuration
│   └── deeplink-well-known/          # .well-known directory for deep link verification
│
├── __tests__/                        # Test files
│   └── App.test.tsx                  # Jest test for App component
│
├── .planning/                        # GSD planning documents (created by mapper)
│   └── codebase/
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
│
├── vendor/                           # Vendored dependencies
├── node_modules/                     # npm packages
├── .git/                             # Git repository
├── .bundle/                          # Bundle gem cache
│
├── .env files                        # Environment variables (not committed)
├── .npmrc                            # npm config
├── .gitignore                        # Git ignore rules
├── .watchmanconfig                   # Watchman file watcher config
├── Gemfile                           # Ruby gems (CocoaPods)
├── Gemfile.lock
│
├── README.md                         # Project documentation
├── CLAUDE.md                         # Development notes
├── RELEASE_SIGNING.md                # Release build signing guide
├── PHONE_VERIFICATION_SETUP.md       # OTP setup guide
├── build-android-release.sh          # Android release build script
└── build-ios-release.sh              # iOS release build script
```

## Directory Purposes

**src/screens/:**
- Purpose: Navigation target screens, one file per RootStackParamList route
- Contains: TSX files exporting React components that map to Stack.Screen
- Key files: `HomeScreen.tsx` (main listing view), `LoginScreen.tsx` (auth), `CarDetailsScreen.tsx` (detail view), `ServiceCartScreen.tsx` (checkout)
- Naming: `{Name}Screen.tsx` (e.g., ProfileScreen, MyListingsScreen)

**src/components/:**
- Purpose: Reusable UI components shared across screens
- Contains: Presentational components (CarCard, FilterBar, BottomBar) and input components (PasswordTextInput, PhoneNumberFormatter)
- Key files: `CarCard.tsx` (listing card), `FilterModal.tsx` (complex filter UI), `MakeModelFilterBar.tsx` (vehicle selector)
- Pattern: Functional components with StyleSheet.create() for styles; memo() for performance-critical components

**src/context/:**
- Purpose: React Context providers for global state
- Contains: Context definitions, providers, and custom hooks
- AuthContext: Manages user, loading, isAdmin, adminRole; exports useAuth()
- CartContext: Manages car (single), items (flat array), grouping; exports useCart()
- LanguageContext: Manages language string ('RU' or 'EN'); exports useLanguage()

**src/services/:**
- Purpose: API abstraction and HTTP client
- Contains: AuthService singleton object with 40+ async methods
- AuthService wraps axios calls to `${API_URL}/api/*` endpoints
- Methods grouped: Auth (signUp, signIn), User (getBackendUser, updateBackendUser, uploadAvatar, deleteAccount), Seller/Broker/Logistics (request*, get*, update* profile methods), Admin (getAdminStatus, getAdminRequests, approveRequest, rejectRequest, getAdminUsers, addAdminUser, removeAdminUser), OTP (sendOtp, verifyOtp), Payments (createPaymentIntent, confirmBooking), Orders (createOrders, getBuyerOrders, getProviderOrders, updateOrderStatus, updateServiceStatus)

**src/hooks/:**
- Purpose: Custom React hooks for reusable logic
- useNetwork: Returns isConnected boolean from NetInfo listener
- useVehicleCatalog: Returns makes[], models[], loading states, and fetch functions

**src/types/:**
- Purpose: TypeScript type definitions
- RootStackParamList: Union of all navigation route params (Home, CarDetails, Login, Signup, Profile, Services, etc.)

**src/constants/:**
- Purpose: Static config, theme, and i18n
- config.ts: API_URL (dev: localhost:5001 or 10.0.2.2:5001; prod: carex-services-production.up.railway.app), WEB_BASE_URL, store URLs
- theme.ts: COLORS (background, cardBackground, accent, etc.), SIZES (padding: 16, borderRadius: 12)
- translations.ts: TRANSLATIONS object with RU and EN keys; each language has 200+ translation strings
- mockData.ts: FILTERS, CATEGORIES, CARS arrays for defaults

**src/utils/:**
- Purpose: Utility functions for specific domains
- makeLogos.ts: getMakeLogoUrl() resolves car brand logos from DB or CDN; needsDarkLogoBg() logic
- passwordPolicy.ts: PASSWORD_MIN_LENGTH, getPasswordRequirementChecks(), passwordMeetsPolicy()

**src/assets/:**
- Purpose: Static image assets
- Contains: PNG files (logo, CarExWord)

**android/ and ios/:**
- Purpose: Native project code (Gradle, Xcode, resources)
- android/: Gradle build files, AndroidManifest.xml, resource drawables (app icons, strings.xml)
- ios/: Xcode project, Podfile dependencies, Info.plist, app icon assets

**scripts/:**
- Purpose: Build automation
- generate-icons.js: Creates app icons in multiple sizes for iOS/Android

**docs/:**
- Purpose: Configuration and setup documentation
- DEEPLINK_SETUP.md: Deep link configuration for carex:// and web URLs
- deeplink-well-known/: .well-known directory for web deep link verification

**__tests__/:**
- Purpose: Jest unit tests
- App.test.tsx: Basic smoke test
- Pattern: Jest + react-native preset; no extensive test coverage

## Key File Locations

**Entry Points:**
- `index.js`: Registers App component with AppRegistry
- `App.tsx`: Root component with provider stack and navigator
- `src/screens/HomeScreen.tsx`: Default home route

**Configuration:**
- `src/constants/config.ts`: API_URL, environment switching
- `src/constants/theme.ts`: Design tokens (colors, sizes)
- `src/constants/translations.ts`: i18n strings
- `tsconfig.json`: TypeScript compiler options
- `.eslintrc.js`: ESLint rules (extends @react-native)
- `.prettierrc.js`: Code formatting (singleQuote: true, trailingComma: 'all')

**Core Logic:**
- `src/services/AuthService.ts`: All API calls
- `src/context/AuthContext.tsx`: User state and auth methods
- `src/context/CartContext.tsx`: Cart and order state
- `src/context/LanguageContext.tsx`: Language state

**Testing:**
- `__tests__/App.test.tsx`: Basic test
- `jest.config.js`: Jest configuration (preset: react-native)

## Naming Conventions

**Files:**
- Screens: `{Name}Screen.tsx` (e.g., `HomeScreen.tsx`, `LoginScreen.tsx`)
- Components: PascalCase with .tsx (e.g., `CarCard.tsx`, `FilterBar.tsx`)
- Services: `{Feature}Service.ts` (e.g., `AuthService.ts`)
- Hooks: `use{Name}.ts` (e.g., `useNetwork.ts`, `useVehicleCatalog.ts`)
- Constants: camelCase file, UPPERCASE export (e.g., `config.ts` exports API_URL, `theme.ts` exports COLORS)
- Utils: camelCase function names (e.g., `getMakeLogoUrl()`, `passwordMeetsPolicy()`)

**Directories:**
- Plural for collections: `screens/`, `components/`, `context/`, `hooks/`, `services/`, `types/`, `constants/`, `utils/`, `assets/`
- Feature-based: e.g., `android/`, `ios/`
- Special: `node_modules/`, `.git/`, `docs/`, `__tests__/`

**TypeScript & Code:**
- Variables & props: camelCase (e.g., `selectedMake`, `phoneNumber`, `isConnected`)
- Types/Interfaces: PascalCase (e.g., `RootStackParamList`, `AuthContextType`, `CartCarInfo`)
- Constants: UPPERCASE (e.g., `API_URL`, `PASSWORD_MIN_LENGTH`, `COLORS.accent`)
- Functions: camelCase (e.g., `fetchCars()`, `handleLogin()`, `getMakeLogoUrl()`)
- React components: PascalCase (e.g., `<CarCard />`, `<FilterModal />`)

## Where to Add New Code

**New Screen (route in RootStackParamList):**
1. Create file: `src/screens/{Name}Screen.tsx`
2. Export named component: `export const {Name}Screen = () => {...}`
3. Add type to `src/types/navigation.ts` RootStackParamList
4. Import in `App.tsx` and add `<Stack.Screen name="{Name}" component={{Name}Screen} />`
5. Use `useNavigation<NativeStackNavigationProp<RootStackParamList, '{Name}'>>()` for typing

**New Component:**
1. Create file: `src/components/{Name}.tsx`
2. Export named component: `export const {Name} = ({ prop1, prop2 }) => {...}`
3. Define interface for props at top of file
4. Use `React.memo()` if component receives same props frequently
5. Import in screens that use it

**New Context/Provider:**
1. Create file: `src/context/{Feature}Context.tsx`
2. Define ContextType interface, createContext(), Provider component, custom hook
3. Add to provider stack in `App.tsx` (respecting dependency order)
4. Export useHook for consumers

**New API method:**
1. Add method to AuthService object in `src/services/AuthService.ts`
2. Pattern: `async methodName(params) => { await axios.method(url, payload); return response.data; }`
3. Wrap in try-catch; throw error.response?.data?.error
4. Call from context methods or screens via `useAuth()` or direct import

**New Utility function:**
1. Create file: `src/utils/{domain}.ts` (or add to existing)
2. Export function: `export function functionName(args) { ... }`
3. Add TypeScript types for parameters and return
4. Import in components/screens that need it

**Translations:**
1. Add key to both `TRANSLATIONS.RU` and `TRANSLATIONS.EN` in `src/constants/translations.ts`
2. Use in components: `const { t } = useLanguage(); <Text>{t.myNewKey}</Text>`

**Styling:**
1. Define StyleSheet near component: `const styles = StyleSheet.create({ ... })`
2. Use theme constants: `COLORS.textPrimary`, `SIZES.padding`
3. Responsive: Use Dimensions or flex for layout (no fixed widths except images)

**Testing:**
1. Create test file: `__tests__/{Feature}.test.tsx`
2. Use Jest and react-native preset
3. Pattern: `describe('ComponentName', () => { it('should...', () => {...}) })`

## Special Directories

**node_modules/:**
- Purpose: npm package dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)
- Key: react, react-native, @react-navigation/native, stripe-react-native, axios, @react-native-async-storage/async-storage

**android/ and ios/:**
- Purpose: Native platform code
- Generated: Partially (pods install for iOS)
- Committed: Yes (except node_modules, Pods in iOS)
- Modified: For signing keys, provisioning profiles, native dependencies

**docs/deeplink-well-known/:**
- Purpose: Web deep link verification (.well-known/assetlinks.json for Android, apple-app-site-association for iOS)
- Generated: Manual
- Committed: Yes

**__tests__/:**
- Purpose: Jest test files
- Generated: Manual
- Committed: Yes
- Pattern: One test file per feature; jest.config.js preset: react-native

---

*Structure analysis: 2026-04-17*

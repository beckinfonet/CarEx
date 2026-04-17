# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- TypeScript 5.8.3 - Application logic, type-safe development
- JavaScript - Configuration files, build scripts
- Kotlin 2.1.20 - Android native integration (via Gradle)
- Objective-C/Swift - iOS native integration (via Xcode/CocoaPods)

**Secondary:**
- XML - Android manifest and configuration
- Plist - iOS configuration (Info.plist)
- Bash - Build and release scripts

## Runtime

**Environment:**
- React Native 0.83.1 - Cross-platform mobile application runtime
- Node.js >= 20 - Development and build tooling
- React 19.2.0 - UI framework

**Package Manager:**
- npm (via `package.json`)
- Lockfile: `package-lock.json` (present)
- CocoaPods (for iOS native dependencies, via `ios/Podfile`)
- Gradle (for Android dependencies, via `android/build.gradle`)

## Frameworks

**Core:**
- React Native 0.83.1 - Mobile application framework
- @react-navigation/native 7.1.28 - Navigation and routing
- @react-navigation/native-stack 7.11.0 - Stack navigation

**UI & Visualization:**
- lucide-react-native 0.563.0 - Icon library
- react-native-svg 15.15.1 - SVG rendering
- @likashefqet/react-native-image-zoom 4.3.0 - Image zoom functionality
- react-native-fast-image 8.6.3 - Optimized image loading
- react-native-gesture-handler 2.30.0 - Touch and gesture handling
- react-native-reanimated 4.2.2 - Animation library
- react-native-worklets 0.7.4 - Performance optimization

**Safety & Context:**
- react-native-safe-area-context 5.6.2 - Safe area management
- react-native-screens 4.20.0 - Native screen components

**Storage & State:**
- @react-native-async-storage/async-storage 2.2.0 - Local persistent storage
- @react-native-community/netinfo 11.4.1 - Network connectivity detection

**Image Handling:**
- react-native-image-picker 8.2.1 - Native image and camera picker

**Payment:**
- @stripe/stripe-react-native 0.62.0 - Stripe payment processing

**Testing:**
- Jest 29.6.3 - Test runner and framework
- react-test-renderer 19.2.0 - React component testing utilities

**Build/Dev:**
- Babel 7.25.x - JavaScript transpiler
- Metro - React Native bundler (included in CLI)
- TypeScript 5.8.3 - Static type checking
- ESLint 8.19.0 - Code linting
- Prettier 2.8.8 - Code formatting

## Key Dependencies

**Critical:**
- axios 1.13.4 - HTTP client for API calls and Firebase REST endpoints
- @stripe/stripe-react-native 0.62.0 - Required for payment processing (Stripe)

**Infrastructure:**
- react-native-gesture-handler 2.30.0 - Required for navigation and touch handling
- react-native-reanimated 4.2.2 - Required for smooth animations

## Configuration

**Environment:**
- Centralized config: `src/constants/config.ts`
  - API_URL: Points to production backend (Railway) or local dev server
  - WEB_BASE_URL: `https://www.carexmarket.com` for deep linking
  - Environment switching via `currentEnv` variable (dev/prod)

**Build:**
- Metro config: `metro.config.js`
- Babel config: `babel.config.js` (includes react-native-worklets plugin)
- TypeScript config: `tsconfig.json`
- ESLint config: `.eslintrc.js` (uses @react-native preset)
- Prettier config: `.prettierrc.js`
  - Arrow params: avoid
  - Single quotes: true
  - Trailing comma: all

**iOS Build:**
- Podfile: `ios/Podfile`
- Post-install hooks for Stripe and fmt library compatibility (C++17 requirement)
- Gemfile for Ruby dependency management: `Gemfile`
  - CocoaPods >= 1.13
  - activesupport >= 6.1.7.5
  - xcodeproj < 1.26.0

**Android Build:**
- Root Gradle: `android/build.gradle`
  - Build Tools: 36.0.0
  - Compile SDK: 36
  - Min SDK: 24
  - Target SDK: 36
  - NDK: 27.1.12297006
  - Kotlin: 2.1.20
- App Gradle: `android/app/build.gradle`
- Version management: `android/version.properties`
  - VERSION_CODE: Auto-incremented by release scripts
  - VERSION_NAME: 1.0.46
- Version code auto-increments via `build-android-release.sh`

**Release & Signing:**
- iOS release: `build-ios-release.sh` (auto-increments version)
- Android release: `build-android-release.sh` (auto-increments version code)
- Android release signing: `android/keystore.properties` (git-ignored, created per `RELEASE_SIGNING.md`)

## Platform Requirements

**Development:**
- Node.js >= 20
- CocoaPods (iOS)
- Xcode 15+ (iOS)
- Android SDK 36 (Android)
- Gradle (Android, via Gradle Wrapper)

**Production:**
- iOS 13.4+ (minimum from Xcode config)
- Android 7.0+ (minSdkVersion 24)
- Railway hosting for backend API: `https://carex-services-production.up.railway.app`

## Network & Security

**App Transport Security (iOS):**
- `NSAllowsArbitraryLoads`: false (enforces HTTPS)
- `NSAllowsLocalNetworking`: true (enables local development)

**Android Network Security:**
- `cleartextTraffic`: false (enforces HTTPS in production)
- Allows localhost for development (platform detection in `src/constants/config.ts`)

**Deep Linking:**
- iOS: carex:// scheme
- Android: carex:// scheme and https://www.carexmarket.com deep links
- Web fallback: https://www.carexmarket.com

---

*Stack analysis: 2026-04-17*

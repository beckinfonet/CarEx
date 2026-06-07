/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreenV2 as HomeScreen } from './src/screens/HomeScreenV2';
import { SearchResultsRouter } from './src/screens/SearchResultsRouter';
import { CarDetailsScreen } from './src/screens/CarDetailsScreen';
import { SellCarScreen } from './src/screens/SellCarScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { MyListingsScreen } from './src/screens/MyListingsScreen';
import { SellerListingsScreen } from './src/screens/SellerListingsScreen';
import { ServicesScreen } from './src/screens/ServicesScreen';
import { ServiceApplicationScreen } from './src/screens/ServiceApplicationScreen';
import { ServiceProfileScreen } from './src/screens/ServiceProfileScreen';
import { ServiceDetailsScreen } from './src/screens/ServiceDetailsScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AdminManagementScreen } from './src/screens/AdminManagementScreen';
import { AdminModerationScreen } from './src/screens/AdminModerationScreen';
import { AdminUserDetailScreen } from './src/screens/AdminUserDetailScreen';
import { OfflineNotice } from './src/components/OfflineNotice';
import { UserStatusBanner } from './src/components/moderation/UserStatusBanner';
import { RootStackParamList } from './src/types/navigation';
import { LanguageProvider } from './src/context/LanguageContext';
import { PersonalityProvider } from './src/context/PersonalityContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { NotificationProvider } from './src/context/NotificationContext';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ServiceCartScreen } from './src/screens/ServiceCartScreen';
import { MyOrdersScreen } from './src/screens/MyOrdersScreen';
import { ProviderOrdersScreen } from './src/screens/ProviderOrdersScreen';
import { useAppStateRefresh } from './src/hooks/useAppStateRefresh';
import { useAuth } from './src/context/AuthContext';

// Android LayoutAnimation enable — Plan 06-08 / RESEARCH §Pitfall 1.
// Required at module scope so UserStatusBanner's expand-note animation
// (LayoutAnimation.configureNext in UserStatusBanner.onToggleNote) works on
// Android old-arch. No-op on new arch; keep the call regardless per RESEARCH.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Stack = createNativeStackNavigator<RootStackParamList>();

// Phase 13 (NPUSH-07): navigation ref so push-tap handlers can route in-JS via
// navigationRef.navigate (Pitfall 5) rather than Linking.openURL — sidesteps the
// missing carex://search Android intent-filter while still going only through the
// whitelisted screens.
export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

// Saved-search criteria key sets — MUST mirror NotificationsScreen's
// routeNotification (STRING_FILTER_KEYS / NUMERIC_FILTER_KEYS) so the backend's
// discrete URLSearchParams encoding is decoded identically on the push-tap path
// and the in-app notification-center path. Numeric keys are coerced via Number()
// with a NaN guard; string keys are carried as-is.
const PUSH_STRING_FILTER_KEYS = ['makeId', 'modelId', 'bodyType'];
const PUSH_NUMERIC_FILTER_KEYS = [
  'priceMin',
  'priceMax',
  'yearMin',
  'yearMax',
];

/**
 * Minimal `a=1&b=2` → `{ a: '1', b: '2' }` parser (URI-decoded, empty/keyless
 * pairs skipped). Mirrors NotificationsScreen.parseQueryString — avoids relying
 * on the RN runtime's partial URLSearchParams typing/availability.
 */
function parsePushQueryString(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query) return out;
  query.split('&').forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawVal = eq >= 0 ? pair.slice(eq + 1) : '';
    if (!rawKey) return;
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
    } catch {
      out[rawKey] = rawVal;
    }
  });
  return out;
}

/**
 * Parse a push data.deeplink (carex://... or https://www.carexmarket.com/...)
 * into a whitelisted navigation target, then navigate via navigationRef.
 *
 * ONLY the two existing linking targets are honored (do NOT widen, T-13-04-02):
 *   - /listing/:carId            → CarDetails  { carId }
 *   - /search?<criteria>         → SearchResults { initialQuery, initialFilters }
 * Anything else is ignored (untrusted deeplink string → whitelist only).
 *
 * Parsing mirrors NotificationsScreen.routeNotification so a push tap and an
 * in-app notification tap resolve identically:
 *   - DEFECT-a (carex://listing no-op): the old code stripped the scheme then
 *     sliced off the first path segment, collapsing carex://listing/abc to a
 *     single 'abc' segment that matched neither branch. We now match the listing
 *     route directly off the normalized path.
 *   - DEFECT-b (search filters dropped): the old code read params.initialFilters
 *     as a JSON blob, but the backend encodes discrete query params. We now build
 *     initialFilters from the SAME string/numeric key sets as the reference.
 * The https form is normalized by stripping scheme+host first (the dotted host
 * absorbs the leading slash); the carex:// form keeps the host as the route token.
 *
 * Car-id rule ([[car_id_field_unreliable]]): the backend builds the deeplink
 * with car._id || car.id || carId, so the carId path segment is already the
 * resolved id — we never re-derive from a bare car.id here.
 */
function routeDeeplink(deeplink?: string) {
  if (!deeplink || !navigationRef.isReady()) return;
  try {
    // Normalize to a "path?query" string. For carex:// the host IS the first
    // route token (carex://listing/abc, carex://search?...), so only the scheme
    // is stripped. For https the scheme+host are dropped so the path starts at
    // the first segment (https://host/listing/abc → listing/abc).
    let pathAndQuery: string;
    if (/^carex:\/\//i.test(deeplink)) {
      pathAndQuery = deeplink.replace(/^carex:\/\//i, '');
    } else {
      const withoutScheme = deeplink.replace(/^[a-z]+:\/\//i, '');
      const firstSlash = withoutScheme.indexOf('/');
      pathAndQuery = firstSlash >= 0 ? withoutScheme.slice(firstSlash + 1) : '';
    }

    const qIndex = pathAndQuery.indexOf('?');
    const rawPath = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
    const rawQuery = qIndex >= 0 ? pathAndQuery.slice(qIndex + 1) : '';
    const normalizedPath = rawPath.replace(/^\/+|\/+$/g, '');

    // --- WATCH: listing/:carId → CarDetails ---
    const listingMatch = normalizedPath.match(/^listing\/([^/?#]+)/);
    if (listingMatch) {
      navigationRef.navigate('CarDetails', {
        carId: decodeURIComponent(listingMatch[1]),
      });
      return;
    }

    // --- NEW_MATCH: search?<criteria> → SearchResults(filters) ---
    if (normalizedPath === 'search' || normalizedPath.startsWith('search/')) {
      const params = parsePushQueryString(rawQuery);

      const initialFilters: { [key: string]: any } = {};
      PUSH_STRING_FILTER_KEYS.forEach((key) => {
        const v = params[key];
        if (v != null && v !== '') {
          initialFilters[key] = v;
        }
      });
      PUSH_NUMERIC_FILTER_KEYS.forEach((key) => {
        const v = params[key];
        if (v != null && v !== '') {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            initialFilters[key] = n;
          }
        }
      });

      navigationRef.navigate('SearchResults', {
        initialQuery: params.initialQuery || '',
        ...(Object.keys(initialFilters).length > 0 ? { initialFilters } : {}),
      });
      return;
    }
    // Unknown target → ignore (whitelist-only routing).
  } catch (e) {
    console.error('Failed to parse push deeplink', e);
  }
}

/**
 * PushTapRoutingEffect — mounts the 3-state push-tap routing inside the
 * AuthProvider subtree (mirrors AppStateRefreshEffect). Per RESEARCH §Pattern 2:
 *   - getInitialNotification() ONCE on mount → quit/cold-start tap (guarded
 *     against double-handling).
 *   - onNotificationOpenedApp() → background tap.
 *   - onMessage() → foreground.
 * Each reads data.deeplink and routes via routeDeeplink → navigationRef through
 * the existing linking whitelist (NPUSH-06/07). Real-device 3-state + cold-start
 * behavior is deferred to 13-HUMAN-UAT.
 */
export const PushTapRoutingEffect = () => {
  React.useEffect(() => {
    let handledInitial = false;

    // Quit / cold-start: a tap that launched the app. Run ONCE; guard so a
    // later re-mount cannot re-route the same launch notification.
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (handledInitial) return;
        handledInitial = true;
        const deeplink = remoteMessage?.data?.deeplink;
        if (typeof deeplink === 'string') routeDeeplink(deeplink);
      })
      .catch((e) => console.error('getInitialNotification failed', e));

    // Background → foreground via tap.
    const unsubOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      const deeplink = remoteMessage?.data?.deeplink;
      if (typeof deeplink === 'string') routeDeeplink(deeplink);
    });

    // Foreground message. We don't auto-navigate on arrival (the user hasn't
    // tapped); kept here per Pattern 2 so the foreground path is wired and the
    // in-app notification center stays the source of truth while the app is open.
    const unsubMessage = messaging().onMessage(() => {
      // Headless for Phase 13 — display handled by RNFB / in-app center.
    });

    return () => {
      unsubOpened();
      unsubMessage();
    };
  }, []);
  return null;
};

/**
 * AppStateRefreshEffect — mounts the useAppStateRefresh listener inside the AuthProvider subtree.
 * Pattern mirrors OfflineNotice which uses useNetwork inside NavigationContainer.
 *
 * When user is logged in (has localId), passes AuthContext.refreshUser so foreground transitions
 * trigger a user-doc re-fetch. When logged out, passes null (D-16 logged-out skip).
 *
 * 30s cooldown is enforced inside AuthContext.refreshUser (Plan 04-04), not the hook — see
 * 04-PATTERNS cross-cutting note. The cooldownMs option is passed here for API clarity.
 *
 * Exported so __tests__/AppStateRefresh.integration.test.tsx can assert the hook contract
 * without mounting the full App tree.
 */
export const AppStateRefreshEffect = () => {
  const { user, refreshUser } = useAuth();
  useAppStateRefresh(user?.localId ? refreshUser : null, { cooldownMs: 30_000 });
  return null;
};

const linking = {
  prefixes: ['https://www.carexmarket.com', 'carex://'],
  config: {
    screens: {
      Home: '',
      CarDetails: 'listing/:carId',
      // Saved-search / new_match deep-link target (Phase 12 NCEN-03). The
      // backend (12-03) builds a carex://search?... / https://.../search?...
      // URL carrying the saved-search criteria; React Navigation parses the
      // query string into SearchResults route params. The watch deep link
      // above (CarDetails) and this one are the only whitelisted notification
      // routing targets (T-12-06-04). 12-08 owns the in-app tap resolution.
      SearchResults: 'search',
    },
  },
};

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppStateRefreshEffect />
          <PushTapRoutingEffect />
          <CartProvider>
            <FavoritesProvider>
            <StripeProvider publishableKey="pk_live_51LaViqJqBNYq7xofM5BivXtMWqH9VEPRb6l3numSPdGg0JFOzOTXHSxzESBsmuXJOSABDQNijl4f9Kda8WRbmXOx00hkfhEwYG">
            <LanguageProvider>
            <PersonalityProvider>
            <NotificationProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <UserStatusBanner />
              <OfflineNotice />
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right'
                }}
              >
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="SearchResults" component={SearchResultsRouter} />
                <Stack.Screen name="CarDetails" component={CarDetailsScreen} />
                <Stack.Screen name="SellCar" component={SellCarScreen} />
                <Stack.Screen name="About" component={AboutScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="MyListings" component={MyListingsScreen} />
                <Stack.Screen name="SellerListings" component={SellerListingsScreen} />
                <Stack.Screen name="Services" component={ServicesScreen} />
                <Stack.Screen name="ServiceApplication" component={ServiceApplicationScreen} />
                <Stack.Screen name="ServiceProfile" component={ServiceProfileScreen} />
                <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
                <Stack.Screen name="ServiceCart" component={ServiceCartScreen} />
                <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
                <Stack.Screen name="ProviderOrders" component={ProviderOrdersScreen} />
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                <Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
                <Stack.Screen name="AdminModeration" component={AdminModerationScreen} />
                <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
            </NotificationProvider>
            </PersonalityProvider>
            </LanguageProvider>
            </StripeProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

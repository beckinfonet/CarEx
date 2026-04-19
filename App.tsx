/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
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
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
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
    },
  },
};

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppStateRefreshEffect />
          <CartProvider>
            <StripeProvider publishableKey="pk_test_51TEgrOJAS81xgsxjpbIvgoGw67eODe91yRPnNTpRcQrweRvUFBLX5wknw3XsAN2um4bFUsAG7HvFZqPArAQS5Ruf00MUNqZQLy">
            <LanguageProvider>
            <NavigationContainer linking={linking}>
              <UserStatusBanner />
              <OfflineNotice />
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right'
                }}
              >
                <Stack.Screen name="Home" component={HomeScreen} />
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
              </Stack.Navigator>
            </NavigationContainer>
            </LanguageProvider>
            </StripeProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

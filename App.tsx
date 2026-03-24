/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
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
import { OfflineNotice } from './src/components/OfflineNotice';
import { RootStackParamList } from './src/types/navigation';
import { LanguageProvider } from './src/context/LanguageContext';
import { AuthProvider } from './src/context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          <LanguageProvider>
            <NavigationContainer linking={linking}>
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
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="MyListings" component={MyListingsScreen} />
                <Stack.Screen name="SellerListings" component={SellerListingsScreen} />
                <Stack.Screen name="Services" component={ServicesScreen} />
                <Stack.Screen name="ServiceApplication" component={ServiceApplicationScreen} />
                <Stack.Screen name="ServiceProfile" component={ServiceProfileScreen} />
                <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                <Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </LanguageProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

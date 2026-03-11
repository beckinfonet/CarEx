import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { CarCard } from '../components/CarCard';
import { ArrowLeft } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export const MyListingsScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async () => {
    if (!user?.localId) {
      setListings([]);
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/api/cars`);
      const allCars = response.data.map((car: any) => ({
        id: car._id,
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        fuel: car.fuel,
        currency: car.currency,
        image: (car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300'),
        imageUrls: car.imageUrls || (car.imageUrl ? [car.imageUrl] : []),
        listingStatus: car.listingStatus || 'active',
        ...car
      }));
      const myCars = allCars.filter((car: any) => car.sellerId === user.localId);
      setListings(myCars);
    } catch (error) {
      console.error('Failed to fetch listings', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => {
    if (isFocused) {
      fetchListings();
    }
  }, [isFocused, fetchListings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings();
  }, [fetchListings]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t.noAccount}</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginButtonText}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.myListings}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t.noListings}</Text>
          <TouchableOpacity style={styles.sellButton} onPress={() => navigation.navigate('SellCar')}>
            <Text style={styles.sellButtonText}>{t.sellCar}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('CarDetails', { carId: item.id, carData: item })}>
              <CarCard data={item} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  sellButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
  },
  sellButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
    padding: SIZES.padding,
  },
});

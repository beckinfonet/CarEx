import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, useRoute, RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { CarCard } from '../components/CarCard';
import { ArrowLeft } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { RootStackParamList } from '../types/navigation';

type SellerListingsRouteProp = RouteProp<RootStackParamList, 'SellerListings'>;

export const SellerListingsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<SellerListingsRouteProp>();
  const { sellerId, sellerName } = route.params;
  const isFocused = useIsFocused();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async () => {
    if (!sellerId) {
      setListings([]);
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/api/cars`, { params: { sellerId } });
      const apiCars = response.data.map((car: any) => ({
        id: car.id || car._id,
        make: car.make || car.makeName,
        model: car.model || car.modelName,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        fuel: car.fuel,
        currency: car.currency,
        image: (car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300'),
        imageUrls: car.imageUrls || (car.imageUrl ? [car.imageUrl] : []),
        listingStatus: car.listingStatus || 'active',
        ...car,
      }));
      setListings(apiCars);
    } catch (error) {
      console.error('Failed to fetch seller listings', error);
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (isFocused) {
      fetchListings();
    }
  }, [isFocused, fetchListings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings();
  }, [fetchListings]);

  const displayName = sellerName || t.seller;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t.listingsBySeller?.replace('{name}', displayName) || `Listings by ${displayName}`}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t.noCars}</Text>
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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: SIZES.padding,
  },
});

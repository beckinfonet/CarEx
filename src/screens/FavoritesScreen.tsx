import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { CarCard } from '../components/CarCard';
import { ArrowLeft } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';

export const FavoritesScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { favoriteIds } = useFavorites();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const ids = Array.from(favoriteIds);

      if (ids.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch all cars and filter (Not ideal for large DB, but works for now since we don't have batch get endpoint)
      // Alternatively, we could create a new endpoint /api/cars/batch?ids=...
      // For now, let's just fetch all and filter client side as we likely don't have many cars yet.
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
         ...car
       }));

      const idSet = new Set(ids);
      const favCars = allCars.filter((car: any) => idSet.has(car.id));
      setFavorites(favCars);
    } catch (error) {
      console.error('Failed to fetch favorites', error);
    } finally {
      setLoading(false);
    }
  }, [favoriteIds]);

  // Re-fetch whenever the context-backed favorites Set changes — so a heart
  // toggled on HomeScreenV2/SearchResultsV2/CarDetails is reflected here on
  // next visit without needing remount.
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.myFavorites}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t.noCars}</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={8}
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
  },
  listContent: {
    padding: SIZES.padding,
  },
});


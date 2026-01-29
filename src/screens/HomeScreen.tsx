import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { COLORS, SIZES } from '../constants/theme';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { CategoryList } from '../components/CategoryList';
import { CarCard } from '../components/CarCard';
import { BottomBar } from '../components/BottomBar';
import { CARS as MOCK_CARS } from '../constants/mockData';
import { RootStackParamList } from '../types/navigation';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [searchQuery, setSearchQuery] = useState('');
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCars = async () => {
    try {
      // Use localhost for iOS, for Android use 10.0.2.2
      const response = await axios.get('http://localhost:5001/api/cars');

      // Transform API data to match UI component needs if necessary
      const apiCars = response.data.map((car: any) => ({
        id: car._id,
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        fuel: car.fuel,
        currency: car.currency,
        // Use first image from imageUrls array, or single imageUrl, or fallback
        image: (car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300'),
        // Keep full data for details
        ...car
      }));

      setCars(apiCars);
    } catch (error) {
      console.error('Failed to fetch cars:', error);
      // Fallback to mock data if API fails
      setCars(MOCK_CARS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchCars();
    }
  }, [isFocused]);

  const filteredCars = cars.filter(car =>
    car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCarPress = (car: any) => {
    navigation.navigate('CarDetails', { carId: car.id, carData: car });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backButton}>
            <Text style={styles.headerIcon}>←</Text>
          </View>
          <Text style={styles.headerTitle}>CarEx</Text>
          <View style={styles.langSwitch}>
            <Text style={styles.langText}>RU <Text style={styles.langTextInactive}>EN</Text></Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchCars} tintColor={COLORS.accent} />
          }
        >
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          <FilterBar />
          <CategoryList />

          <View style={styles.carList}>
            {loading && cars.length === 0 ? (
              <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : (
              filteredCars.map((car) => (
                <TouchableOpacity key={car.id} onPress={() => handleCarPress(car)}>
                  <CarCard data={car} />
                </TouchableOpacity>
              ))
            )}
            {!loading && filteredCars.length === 0 && (
              <Text style={styles.emptyText}>Нет автомобилей</Text>
            )}
          </View>
        </ScrollView>

        <BottomBar />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerIcon: {
    color: COLORS.accent,
    fontSize: 24,
  },
  headerTitle: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  langSwitch: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  langText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  langTextInactive: {
    color: COLORS.textSecondary,
    fontWeight: 'normal',
  },
  content: {
    flex: 1,
  },
  carList: {
    paddingBottom: 16,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});


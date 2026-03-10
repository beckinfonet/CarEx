import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, RefreshControl, Image, Platform } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { MakeModelSearchBar } from '../components/MakeModelSearchBar';
import { FilterBar } from '../components/FilterBar';
import { CategoryList } from '../components/CategoryList';
import { CarCard } from '../components/CarCard';
import { LatestCarousel } from '../components/LatestCarousel';
import { BottomBar } from '../components/BottomBar';
import { CATEGORIES } from '../constants/mockData';
import { RootStackParamList } from '../types/navigation';
import { ArrowLeft, User, SlidersHorizontal } from 'lucide-react-native';
import { FilterModal } from '../components/FilterModal';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [selectedMake, setSelectedMake] = useState<{ id: string; name: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState<{ id: string; name: string } | null>(null);
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: any }>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const fetchCars = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cars`);
      const apiCars = response.data.map((car: any) => ({
        id: car._id,
        makeId: car.makeId,
        modelId: car.modelId,
        make: car.make || car.makeName,
        model: car.model || car.modelName,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        fuel: car.fuel,
        currency: car.currency,
        image: (car.imageUrls && car.imageUrls.length > 0) ? car.imageUrls[0] : (car.imageUrl || 'https://via.placeholder.com/400x300'),
        imageUrls: car.imageUrls || (car.imageUrl ? [car.imageUrl] : []),
        ...car
      }));
      setCars(apiCars);
    } catch (error) {
      console.error('Failed to fetch cars:', error);
      Alert.alert('Error', 'Failed to load cars from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchCars();
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchCars();
    }
  }, [isFocused]);

  const filteredCars = cars.filter(car => {
    const matchesSearch =
      (!selectedMake && !selectedModel) ||
      (selectedMake && !selectedModel && (
        car.makeId === selectedMake.id ||
        (!car.makeId && car.make?.toLowerCase() === selectedMake.name?.toLowerCase())
      )) ||
      (selectedMake && selectedModel && (
        (car.makeId === selectedMake.id && car.modelId === selectedModel.id) ||
        (!car.makeId && car.make?.toLowerCase() === selectedMake.name?.toLowerCase() && car.model?.toLowerCase() === selectedModel.name?.toLowerCase())
      ));

    // Filter Logic
    let matchesFilters = true;
    if (activeFilters['Год']) {
      const { min, max } = activeFilters['Год'];
      if (min && car.year < parseInt(min)) matchesFilters = false;
      if (max && car.year > parseInt(max)) matchesFilters = false;
    }
    if (activeFilters['Цена']) {
      const { min, max } = activeFilters['Цена'];
      if (min && car.price < parseInt(min)) matchesFilters = false;
      if (max && car.price > parseInt(max)) matchesFilters = false;
    }
    if (activeFilters['Пробег']) {
      const { min, max } = activeFilters['Пробег'];
      if (min && car.mileage < parseInt(min)) matchesFilters = false;
      if (max && car.mileage > parseInt(max)) matchesFilters = false;
    }
    if (activeFilters['Топливо'] && activeFilters['Топливо'] !== car.fuel) matchesFilters = false;
    if (activeFilters['КПП'] && activeFilters['КПП'] !== car.transmission) matchesFilters = false;

    if (!selectedCategory) return matchesSearch && matchesFilters;

    const category = CATEGORIES.find(c => c.id === selectedCategory);
    if (!category) return matchesSearch && matchesFilters;

    const bodyType = car.bodyType || '';
    const matchesCategory = bodyType.toLowerCase().includes(category.name.toLowerCase()) ||
      category.name.toLowerCase().includes(bodyType.toLowerCase()) ||
      (category.id === 2 && bodyType.toLowerCase().includes('suv'));

    return matchesSearch && matchesCategory && matchesFilters;
  });

  const handleCarPress = (car: any) => {
    navigation.navigate('CarDetails', { carId: car.id, carData: car });
  };

  const handleFilterPress = (filter: string) => {
    setCurrentFilterType(filter);
    setModalVisible(true);
  };

  const handleApplyFilter = (filterType: string, value: any) => {
    const newFilters = { ...activeFilters };
    if (value === null || (typeof value === 'object' && !value.min && !value.max)) {
      delete newFilters[filterType];
    } else {
      newFilters[filterType] = value;
    }
    setActiveFilters(newFilters);
  };

  const handleProfilePress = () => {
    if (user) {
        navigation.navigate('Profile');
    } else {
        navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.profileButton, user && styles.profileButtonActive]} 
            onPress={handleProfilePress}
          >
            <User size={24} color={user ? '#FFF' : COLORS.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('../assets/CarExWord.png')}
              style={{ width: 130, height: 70, marginLeft: 0 }}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/car-logo-transparent.png')}
              style={{ width: 60, height: 80 }}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity
            style={styles.langSwitch}
            onPress={() => setLanguage(language === 'RU' ? 'EN' : 'RU')}
          >
            <Text style={[styles.langText, language === 'RU' && styles.activeLang]}>RU</Text>
            <View style={styles.divider} />
            <Text style={[styles.langText, language === 'EN' && styles.activeLang]}>EN</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          style={styles.content}
          showsVerticalScrollIndicator={false}
          data={loading && cars.length === 0 ? [] : filteredCars}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleCarPress(item)}>
              <CarCard data={item} />
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <>
              <View style={styles.searchSection}>
                <View style={styles.searchRow}>
                  <View style={styles.searchBarWrapper}>
                    <MakeModelSearchBar
                      selectedMake={selectedMake}
                      selectedModel={selectedModel}
                      onSelect={(make, model) => {
                        setSelectedMake(make);
                        setSelectedModel(model);
                      }}
                      placeholder={t.searchPlaceholder}
                      t={t}
                      containerStyle={styles.searchBarContainer}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.filterToggleButton, filtersVisible && styles.filterToggleButtonActive]}
                    onPress={() => setFiltersVisible(!filtersVisible)}
                    activeOpacity={0.7}
                  >
                    <SlidersHorizontal size={20} color={filtersVisible ? COLORS.accent : COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
                {filtersVisible && (
                  <>
                    <FilterBar onFilterPress={handleFilterPress} activeFilters={activeFilters} t={t} />
                    <CategoryList
                      selectedCategory={selectedCategory}
                      onSelectCategory={(id) => setSelectedCategory(selectedCategory === id ? null : id)}
                      t={t}
                    />
                  </>
                )}
              </View>
              <View style={styles.carouselSticky}>
                <LatestCarousel
                  cars={cars}
                  onCarPress={handleCarPress}
                  t={t}
                />
              </View>
            </>
          }
          ListEmptyComponent={
            loading && cars.length === 0 ? (
              <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : !loading && filteredCars.length === 0 ? (
              <Text style={styles.emptyText}>{t.noCars}</Text>
            ) : null
          }
          contentContainerStyle={styles.carList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={8}
        />

        <BottomBar t={t} />
      </View>
      <FilterModal
        visible={modalVisible}
        type={currentFilterType}
        onClose={() => setModalVisible(false)}
        onApply={handleApplyFilter}
        currentValue={currentFilterType ? activeFilters[currentFilterType] : null}
        t={t}
      />
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
    paddingVertical: 8,
    marginBottom: 0,
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center', // Center the icon
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  backButton: {
    // Keeping styles just in case, but unused in Home
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  activeLang: {
    backgroundColor: COLORS.accent,
    color: '#000', // Black text on active blue background
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.border,
    marginHorizontal: 2,
  },
  langTextInactive: {
    // Deprecated, keeping for safety if referenced elsewhere, but new logic handles this
    color: COLORS.textSecondary,
    fontWeight: 'normal',
  },
  searchSection: {
    marginBottom: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
    gap: 8,
  },
  searchBarWrapper: {
    flex: 1,
  },
  searchBarContainer: {
    marginBottom: 0,
  },
  filterToggleButton: {
    width: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterToggleButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  carouselSticky: {
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  carList: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});


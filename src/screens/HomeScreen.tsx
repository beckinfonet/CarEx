import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, RefreshControl, Image, Platform, BackHandler, ToastAndroid } from 'react-native';
import { useNavigation, useIsFocused, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { API_URL } from '../constants/config';
import { MakeModelSearchBar } from '../components/MakeModelSearchBar';
import { FilterBar } from '../components/FilterBar';
import { QuickSortFilters } from '../components/QuickSortFilters';
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
type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<HomeScreenRouteProp>();
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
        listingStatus: car.listingStatus || 'active',
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

  // Clear all filters when Home button is pressed (from BottomBar)
  useEffect(() => {
    if (route.params?.clearFilters) {
      setSelectedMake(null);
      setSelectedModel(null);
      setSelectedCategory(null);
      setActiveFilters({});
      setFiltersVisible(false);
      navigation.setParams({ clearFilters: false });
    }
  }, [route.params?.clearFilters]);

  // Android back button: "Press back again to exit" when on main page
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      ToastAndroid.show(t.pressBackAgainToExit, ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, t.pressBackAgainToExit]);

  const filteredCars = cars.filter(car => {
    if (car.listingStatus === 'sold') return false;
    const makeIdStr = car.makeId != null ? String(car.makeId) : null;
    const modelIdStr = car.modelId != null ? String(car.modelId) : null;
    const carMakeLower = car.make?.toLowerCase() ?? '';
    const carModelLower = car.model?.toLowerCase() ?? '';
    const selectedMakeNameLower = selectedMake?.name?.toLowerCase() ?? '';
    const selectedModelNameLower = selectedModel?.name?.toLowerCase() ?? '';

    const modelNameMatches = (a: string, b: string) =>
      a === b || (a && b && (a.startsWith(b) || b.startsWith(a)));

    const matchesSearch =
      (!selectedMake && !selectedModel) ||
      (selectedMake && !selectedModel && (
        makeIdStr === selectedMake.id ||
        carMakeLower === selectedMakeNameLower
      )) ||
      (selectedMake && selectedModel && (
        (makeIdStr === selectedMake.id && modelIdStr === selectedModel.id) ||
        (makeIdStr === selectedMake.id && !modelIdStr && modelNameMatches(carModelLower, selectedModelNameLower)) ||
        (carMakeLower === selectedMakeNameLower && modelNameMatches(carModelLower, selectedModelNameLower))
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

  // Apply sort by price and/or mileage
  const displayedCars = React.useMemo(() => {
    let result = [...filteredCars];
    const sortPrice = activeFilters['sortPrice'];
    const sortMileage = activeFilters['sortMileage'];
    if (sortPrice || sortMileage) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortPrice) {
          const pa = a.price ?? 0;
          const pb = b.price ?? 0;
          cmp = sortPrice === 'asc' ? pa - pb : pb - pa;
          if (cmp !== 0) return cmp;
        }
        if (sortMileage) {
          const ma = a.mileage ?? 0;
          const mb = b.mileage ?? 0;
          cmp = sortMileage === 'asc' ? ma - mb : mb - ma;
        }
        return cmp;
      });
    }
    return result;
  }, [filteredCars, activeFilters]);

  // Models available in current make-only results (for model filter chips)
  const availableModels = React.useMemo(() => {
    if (!selectedMake) return [];
    const makeIdStr = (id: any) => id != null ? String(id) : null;
    const carMakeLower = (c: any) => c.make?.toLowerCase() ?? '';
    const selectedMakeNameLower = selectedMake.name?.toLowerCase() ?? '';
    const matchesMake = (car: any) => {
      if (car.listingStatus === 'sold') return false;
      const mid = makeIdStr(car.makeId);
      const m = carMakeLower(car);
      return mid === selectedMake.id || m === selectedMakeNameLower;
    };
    const carsMatchingMake = cars.filter(c => matchesMake(c));
    const seen = new Set<string>();
    const models: { id: string; name: string }[] = [];
    for (const car of carsMatchingMake) {
      const name = (car.model || car.modelName || '').trim();
      if (!name) continue;
      const key = (car.modelId != null ? String(car.modelId) : name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      models.push({
        id: car.modelId != null ? String(car.modelId) : name,
        name,
      });
    }
    models.sort((a, b) => a.name.localeCompare(b.name));
    return models;
  }, [cars, selectedMake]);

  const handleCarPress = (car: any) => {
    navigation.navigate('CarDetails', { carId: car.id, carData: car });
  };

  const handleFilterPress = (filter: string) => {
    setCurrentFilterType(filter);
    setModalVisible(true);
  };

  const handleQuickSortToggle = (filterType: 'sortPrice' | 'sortMileage') => {
    const current = activeFilters[filterType];
    const next = current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc';
    const newFilters = { ...activeFilters };
    delete newFilters['sortPrice'];
    delete newFilters['sortMileage'];
    if (next) newFilters[filterType] = next;
    setActiveFilters(newFilters);
  };

  const handleQuickSortReset = () => {
    const newFilters = { ...activeFilters };
    delete newFilters['sortPrice'];
    delete newFilters['sortMileage'];
    setActiveFilters(newFilters);
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
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.profileAvatar} />
            ) : (
              <User size={24} color={user ? '#FFF' : COLORS.textSecondary} />
            )}
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
          data={loading && cars.length === 0 ? [] : displayedCars}
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
                {selectedMake && availableModels.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.modelChipsScroll}
                    contentContainerStyle={styles.modelChipsContent}
                  >
                    <TouchableOpacity
                      style={[styles.modelChip, !selectedModel && styles.modelChipActive]}
                      onPress={() => setSelectedModel(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modelChipText, !selectedModel && styles.modelChipTextActive]}>
                        {t.allModels || 'All models'}
                      </Text>
                    </TouchableOpacity>
                    {availableModels.map((model) => (
                      <TouchableOpacity
                        key={model.id}
                        style={[
                          styles.modelChip,
                          selectedModel?.id === model.id && styles.modelChipActive,
                          selectedModel?.name === model.name && styles.modelChipActive,
                        ]}
                        onPress={() => setSelectedModel(model)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.modelChipText,
                            (selectedModel?.id === model.id || selectedModel?.name === model.name) && styles.modelChipTextActive,
                          ]}
                        >
                          {model.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <QuickSortFilters
                  activeFilters={activeFilters}
                  onSortToggle={handleQuickSortToggle}
                  onReset={handleQuickSortReset}
                  t={{ price: t.price, mileage: t.mileage }}
                />
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
            ) : !loading && displayedCars.length === 0 ? (
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
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  modelChipsScroll: {
    marginBottom: 8,
    maxHeight: 40,
  },
  modelChipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  modelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modelChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modelChipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  modelChipTextActive: {
    color: '#000',
    fontWeight: '600',
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


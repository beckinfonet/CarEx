import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, RefreshControl, Image, Platform, BackHandler, ToastAndroid } from 'react-native';
import { useNavigation, useIsFocused, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { MakeModelFilterBar } from '../components/MakeModelFilterBar';
import { FilterBar } from '../components/FilterBar';
import { QuickSortFilters } from '../components/QuickSortFilters';
import { CategoryList } from '../components/CategoryList';
import { CarCard } from '../components/CarCard';
import { LatestCarousel } from '../components/LatestCarousel';
import { BottomBar } from '../components/BottomBar';
import { RootStackParamList } from '../types/navigation';
import { ArrowLeft, User, SlidersHorizontal } from 'lucide-react-native';
import { FilterModal } from '../components/FilterModal';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { V2InviteBanner } from '../components/home/v2/V2InviteBanner';
import { useHomeListings } from '../hooks/useHomeListings';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<HomeScreenRouteProp>();
  const isFocused = useIsFocused();

  const {
    cars,
    loading,
    refreshing,
    refresh: onRefresh,
    selectedMake, setSelectedMake,
    selectedModel, setSelectedModel,
    selectedCategory, setSelectedCategory,
    activeFilters,
    filtersVisible, setFiltersVisible,
    displayedCars,
    availableModels,
    applyFilter: handleApplyFilter,
    toggleQuickSort: handleQuickSortToggle,
    resetQuickSort: handleQuickSortReset,
    clearAll,
  } = useHomeListings();

  const [modalVisible, setModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.clearFilters) {
      clearAll();
      navigation.setParams({ clearFilters: false });
    }
  }, [route.params?.clearFilters, clearAll, navigation]);

  // Android back handler: unwind filters, then exit prompt
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      const hasOtherFilters = selectedCategory != null || Object.keys(activeFilters).length > 0;
      if (selectedMake && selectedModel) { setSelectedModel(null); return true; }
      if (selectedMake || hasOtherFilters) { clearAll(); return true; }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) { BackHandler.exitApp(); return true; }
      lastBackPressRef.current = now;
      ToastAndroid.show(t.pressBackAgainToExit, ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, t.pressBackAgainToExit, selectedMake, selectedModel, selectedCategory, activeFilters, setSelectedModel, clearAll]);

  const handleCarPress = (car: any) => {
    navigation.navigate('CarDetails', { carId: car.id, carData: car });
  };
  const handleFilterPress = (filter: string) => {
    setCurrentFilterType(filter);
    setModalVisible(true);
  };
  const handleProfilePress = () => {
    if (user) navigation.navigate('Profile');
    else navigation.navigate('Login');
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
          <Image
            source={require('../assets/CarExWord.png')}
            style={{ width: 130, height: 70, marginLeft: 0 }}
            resizeMode="contain"
          />
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
              <V2InviteBanner
                headline={t.newDesignAvailable}
                tryLabel={t.tryNow}
                notNowLabel={t.notNow}
              />
              <View style={styles.searchSection}>
                <View style={styles.searchRow}>
                  <View style={styles.searchBarWrapper}>
                    <MakeModelFilterBar
                      selectedMake={selectedMake}
                      selectedModel={selectedModel}
                      onSelect={(make, model) => {
                        setSelectedMake(make);
                        setSelectedModel(model);
                      }}
                      t={{ selectMake: t.selectMake, selectModel: t.selectModel, make: t.brand, model: t.model, searchWithMake: t.searchWithMake }}
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
  modelChipsScroll: {
    marginBottom: 8,
    minHeight: 44,
  },
  modelChipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  modelChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    minHeight: 36,
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

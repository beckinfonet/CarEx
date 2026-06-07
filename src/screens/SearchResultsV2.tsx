import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, StatusBar, TouchableOpacity, Platform, BackHandler } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';

import { useHomeListings } from '../hooks/useHomeListings';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTypography } from '../hooks/useTypography';
import { V2 } from '../components/home/v2/theme';
import { MarketStatsStrip } from '../components/home/v2/MarketStatsStrip';
import { FilterChipRow, FilterChip } from '../components/home/v2/FilterChipRow';
import { BigFeedCard } from '../components/home/v2/BigFeedCard';
import { SmallFeedCard } from '../components/home/v2/SmallFeedCard';
import { SortSheet, SortOption } from '../components/home/v2/SortSheet';
import { FilterModal } from '../components/FilterModal';
import { MakeModelFilterBar } from '../components/MakeModelFilterBar';
import { RootStackParamList } from '../types/navigation';
import { getCityFromTimezone } from '../utils/greetingSubject';
import { SaveSearchBar } from '../components/notifications/SaveSearchBar';
import { CATEGORIES } from '../constants/mockData';

type Nav    = NativeStackNavigationProp<RootStackParamList, 'SearchResults'>;
type RouteT = RouteProp<RootStackParamList, 'SearchResults'>;

function formatStats(cars: any[]): { avg: string; year: string; mileage: string } {
  if (cars.length === 0) return { avg: '—', year: '—', mileage: '—' };
  const avgPrice = cars.reduce((s, c) => s + (c.price ?? 0), 0) / cars.length;
  const years    = cars.map((c) => c.year).filter((y) => Number.isFinite(y));
  const miles    = cars.map((c) => c.mileage).filter((m) => Number.isFinite(m));
  const fmtK = (n: number) => `${(n / 1000).toFixed(1)}k`;
  const yMin = years.length ? Math.min(...years) : 0;
  const yMax = years.length ? Math.max(...years) : 0;
  const mMin = miles.length ? Math.min(...miles) : 0;
  const mMax = miles.length ? Math.max(...miles) : 0;
  return {
    avg:     `$${fmtK(avgPrice)}`,
    year:    `'${String(yMin).slice(-2)}—'${String(yMax).slice(-2)}`,
    mileage: `${Math.round(mMin / 1000)}—${Math.round(mMax / 1000)}k`,
  };
}

export const SearchResultsV2 = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const { t }      = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const typo       = useTypography();

  const {
    displayedCars,
    activeFilters,
    applyFilter,
    selectedMake,
    setSelectedMake,
    selectedModel,
    setSelectedModel,
    selectedCategory,
  } = useHomeListings({ initialFilters: route.params.initialFilters });

  // Resolve the RU category name for the saved-search bodyType criterion
  // (selectedCategory is a CATEGORIES id, not an object).
  const bodyType = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategory)?.name ?? null,
    [selectedCategory],
  );

  const [revealed, setRevealed] = useState(25);
  const [sort,     setSort]     = useState<SortOption>('relevance');
  const [sortVisible, setSortVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const stats = useMemo(() => formatStats(displayedCars), [displayedCars]);
  const visibleResults = displayedCars.slice(0, revealed);
  const total = displayedCars.length;

  const city = useMemo(() => {
    let tz: string | null = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
    return tz ? getCityFromTimezone(tz, t) : null;
  }, [t]);

  const onSortSelect = (opt: SortOption) => {
    setSort(opt);
    if (opt === 'priceAsc' || opt === 'priceDesc') {
      const want = opt === 'priceAsc' ? 'asc' : 'desc';
      applyFilter('sortPrice', want);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', null);
    } else if (opt === 'mileageAsc') {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', 'asc');
      applyFilter('sortYear', null);
    } else if (opt === 'newest') {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', 'desc');
    } else {
      applyFilter('sortPrice', null);
      applyFilter('sortMileage', null);
      applyFilter('sortYear', null);
    }
  };

  const onChipPress = (key: string) => applyFilter(key, null);

  const chips: FilterChip[] = Object.keys(activeFilters)
    .filter((k) => !k.startsWith('sort'))
    .map((k) => ({ key: k, label: k, active: true }));

  const handleCarPress = (car: any) => navigation.navigate('CarDetails', { carId: car.id, carData: car });

  const Header = (
    <>
      <View style={styles.stickyHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <ChevronLeft size={20} color={V2.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
            {route.params.initialQuery || t.allCars}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: typo.mono }]}>
            {total} {t.listingsCount}{city ? ` · ${city}` : ''}
          </Text>
        </View>
      </View>
      <MakeModelFilterBar
        selectedMake={selectedMake}
        selectedModel={selectedModel}
        onSelect={(make, model) => {
          setSelectedMake(make);
          setSelectedModel(model);
        }}
        t={{ selectMake: t.selectMake, selectModel: t.selectModel, make: t.brand, model: t.model, searchWithMake: t.searchWithMake }}
        containerStyle={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}
      />
      <MarketStatsStrip
        avgLabel={t.marketAvg}
        yearLabel={t.yearLabelV2}
        mileageLabel={t.mileageLabelV2}
        avgValue={stats.avg}
        yearValue={stats.year}
        mileageValue={stats.mileage}
      />
      <FilterChipRow
        filtersLabel={t.filters}
        chips={chips}
        onFiltersPress={() => { setCurrentFilterType('Год'); setFilterModalVisible(true); }}
        onChipPress={onChipPress}
      />
      {/* Phase 12 Plan 12-09 (NCEN-06 / NSUB-01/03, CTX D-08/D-09) — sticky
          "Notify me about new matches" save-search bar. Self-hides when no
          filters are active; maps the RU-label activeFilters to canonical
          ObjectId criteria internally (Pitfall 4/5). */}
      <SaveSearchBar
        activeFilters={activeFilters}
        selectedMake={selectedMake}
        selectedModel={selectedModel}
        bodyType={bodyType}
      />
      <View style={styles.sortRow}>
        <Text style={[styles.sortRowLabel, { fontFamily: typo.display }]}>{t.allResults}</Text>
        <TouchableOpacity onPress={() => setSortVisible(true)} style={styles.sortDropdown}>
          <Text style={[styles.sortDropdownText, { fontFamily: typo.display }]}>
            {({
              relevance: t.byRelevance,
              priceAsc: t.priceAsc, priceDesc: t.priceDesc,
              newest: t.newestFirst, mileageAsc: t.mileageAscSort,
            } as Record<SortOption, string>)[sort]}
          </Text>
          <ChevronDown size={14} color={V2.text} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={V2.bg} />
      <FlatList
        data={visibleResults}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          item.promoted
            ? <BigFeedCard car={item} kmSuffix={t.kmShort} ctaLabel={t.open} faved={isFavorite(item.id)} onPress={handleCarPress} onToggleFav={(car) => toggleFavorite(car.id)} />
            : <SmallFeedCard car={item} kmSuffix={t.kmShort} faved={isFavorite(item.id)} onPress={handleCarPress} onToggleFav={(car) => toggleFavorite(car.id)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          revealed < total
            ? (
                <TouchableOpacity onPress={() => setRevealed((r) => r + 25)} style={styles.loadMore}>
                  <Text style={[styles.loadMoreText, { fontFamily: typo.display }]}>
                    {t.showMore} {Math.min(25, total - revealed)} {t.listingsCount}
                  </Text>
                </TouchableOpacity>
              )
            : null
        }
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={8}
      />
      <SortSheet
        visible={sortVisible}
        current={sort}
        labels={{
          relevance: t.byRelevance,
          priceAsc:  t.priceAsc,
          priceDesc: t.priceDesc,
          newest:    t.newestFirst,
          mileageAsc: t.mileageAscSort,
        }}
        onSelect={onSortSelect}
        onClose={() => setSortVisible(false)}
      />
      <FilterModal
        visible={filterModalVisible}
        type={currentFilterType}
        onClose={() => setFilterModalVisible(false)}
        onApply={applyFilter}
        currentValue={currentFilterType ? activeFilters[currentFilterType] : null}
        t={t}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: V2.bg },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: V2.border,
    marginHorizontal: -16,
  },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: V2.surface },
  title:    { fontSize: 19, fontWeight: '800', color: V2.text },
  subtitle: { fontSize: 11.5, color: V2.textMuted, fontWeight: '600', marginTop: 2 },
  sortRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  sortRowLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.textMuted },
  sortDropdown:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortDropdownText:{ fontSize: 13, fontWeight: '700', color: V2.text },
  loadMore: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: V2.borderHi, alignItems: 'center' },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: V2.text },
});

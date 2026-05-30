import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet, StatusBar, Text, Platform, BackHandler, ToastAndroid, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { useNavigation, useRoute, useIsFocused, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHomeListings } from '../hooks/useHomeListings';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTypography } from '../hooks/useTypography';
import { CATEGORIES } from '../constants/mockData';
import { V2 } from '../components/home/v2/theme';
import { getCityFromTimezone, buildGreetingSubject } from '../utils/greetingSubject';
import { rotateVariant, GreetingSlot } from '../utils/greetingVariants';

import { FloatingSearchPill } from '../components/home/v2/FloatingSearchPill';
import { ProfileAvatarButton } from '../components/home/v2/ProfileAvatarButton';
import { GreetingBlock } from '../components/home/v2/GreetingBlock';
import { ActiveFilterChips } from '../components/home/v2/ActiveFilterChips';
import { HeroRotator } from '../components/home/v2/HeroRotator';
import { SmartShelf } from '../components/home/v2/SmartShelf';
import { BigFeedCard } from '../components/home/v2/BigFeedCard';
import { SmallFeedCard } from '../components/home/v2/SmallFeedCard';
import { FeedLoader } from '../components/home/v2/FeedLoader';
import { BottomBar } from '../components/BottomBar';
import { FilterModal } from '../components/FilterModal';
import { LangSwitchV2 } from '../components/home/v2/LangSwitchV2';

import { RootStackParamList } from '../types/navigation';

type Nav    = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type RouteT = RouteProp<RootStackParamList, 'Home'>;

function timeOfDayKey(t: any): string {
  const h = new Date().getHours();
  if (h < 12) return t.goodMorning;
  if (h < 18) return t.goodAfternoon;
  return t.goodEvening;
}

// ---- Quick 260528-hmt — time-of-day pool selector for the rotating greeting kicker ----
type GreetingTimeSlot = Exclude<GreetingSlot, 'headline'>;

function currentGreetingSlot(): GreetingTimeSlot {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function pickGreetingPool(t: any): { slot: GreetingTimeSlot; pool: string[] } {
  const slot = currentGreetingSlot();
  const pool =
    slot === 'morning'   ? t.greetingVariantsMorning :
    slot === 'afternoon' ? t.greetingVariantsAfternoon :
                           t.greetingVariantsEvening;
  return { slot, pool };
}

export const HomeScreenV2 = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const isFocused  = useIsFocused();
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  // ---- Quick 260528-hmt — Rotating greeting + headline ----
  const [greetingText, setGreetingText] = useState<string>(() => {
    const { slot, pool } = pickGreetingPool(t);
    return rotateVariant(slot, pool);
  });
  const [headlineText, setHeadlineText] = useState<string>(() =>
    rotateVariant('headline', t.headlineVariants),
  );

  const rotate = useCallback(() => {
    const { slot, pool } = pickGreetingPool(t);
    setGreetingText(rotateVariant(slot, pool));
    setHeadlineText(rotateVariant('headline', t.headlineVariants));
  }, [t]);

  // Re-pick whenever the language flips so the displayed copy matches the active locale.
  // We intentionally depend on `language` (a stable primitive) rather than `t` (object identity).
  const langMountRef = useRef(true);
  useEffect(() => {
    if (langMountRef.current) { langMountRef.current = false; return; }
    rotate();
  }, [language, rotate]);

  // Rotate when the screen regains focus (e.g. user returns from CarDetails).
  // Skip the initial mount so the initial useState pick isn't immediately replaced.
  const focusMountRef = useRef(true);
  useEffect(() => {
    if (focusMountRef.current) { focusMountRef.current = false; return; }
    if (isFocused) rotate();
  }, [isFocused, rotate]);

  // Rotate when the app returns from background to foreground.
  // Skip the very first 'active' transition (some Android builds fire it at launch).
  useEffect(() => {
    let skippedFirst = false;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') return;
      if (!skippedFirst) { skippedFirst = true; return; }
      rotate();
    });
    return () => sub.remove();
  }, [rotate]);

  const typo       = useTypography();

  const {
    loading, refreshing, refresh,
    selectedMake, setSelectedMake,
    selectedModel, setSelectedModel,
    selectedCategory, setSelectedCategory,
    activeFilters,
    displayedCars,
    applyFilter,
    clearAll,
  } = useHomeListings();

  // Pull-to-refresh: rotate copy AND fetch listings.
  const onRefresh = useCallback(() => {
    rotate();
    return refresh();
  }, [rotate, refresh]);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.clearFilters) {
      clearAll();
      navigation.setParams({ clearFilters: false });
    }
  }, [route.params?.clearFilters, clearAll, navigation]);

  // Android filter unwind back-handler (same logic as v1 HomeScreen)
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (!isFocused || Platform.OS !== 'android') return;
    const onBackPress = () => {
      const hasOtherFilters = selectedCategory != null || Object.keys(activeFilters).filter((k) => !k.startsWith('sort')).length > 0;
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

  // Compose greeting kicker subject: firstName + IANA-timezone-derived city when available.
  const subject = useMemo(() => {
    let tz: string | null = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
    const city = tz ? getCityFromTimezone(tz, t) : null;
    return buildGreetingSubject({ firstName: user?.firstName, city });
  }, [user?.firstName, t]);

  // Slice displayedCars into hero / shelf / feed bands
  const heroCars  = displayedCars.slice(0, 5);
  const shelfCars = displayedCars.slice(5, 13);
  // car.promoted always false today — BigFeedCard never renders.
  const feedCars  = displayedCars.slice(13);

  const handleCarPress  = (car: any) => navigation.navigate('CarDetails', { carId: car.id, carData: car });
  const handleSearchPress = () => navigation.navigate('SearchResults', { initialQuery: '' });
  const handleFiltersPress = () => { setCurrentFilterType('Год'); setFilterModalVisible(true); };

  const Header = (
    <>
      <GreetingBlock
        timeOfDay={greetingText}
        subject={subject}
        headline={headlineText}
        listingsCount={displayedCars.length}
        listingsNoun={t.listingsCount}
        trailing={<LangSwitchV2 language={language} setLanguage={setLanguage} />}
      />
      <ActiveFilterChips
        selectedMake={selectedMake}
        selectedModel={selectedModel}
        selectedCategory={selectedCategory}
        activeFilters={activeFilters}
        categoryName={(id) => CATEGORIES.find((c) => c.id === id)?.name ?? ''}
        clearAllLabel={t.clearAll}
        onClearMake={() => { setSelectedMake(null); setSelectedModel(null); }}
        onClearModel={() => setSelectedModel(null)}
        onClearCategory={() => setSelectedCategory(null)}
        onClearFilter={(key) => applyFilter(key, null)}
        onClearAll={clearAll}
      />
      <HeroRotator
        cars={heroCars as any}
        kicker={t.freshOffer}
        todayLabel={t.today}
        ctaLabel={t.view}
        kmSuffix={t.kmShort}
        onCardPress={handleCarPress}
      />
      <SmartShelf
        kicker={t.justAdded}
        title={t.freshOffers}
        cars={shelfCars as any}
        kmSuffix={t.kmShort}
        onCardPress={handleCarPress}
      />
      <View style={styles.feedHeader}>
        <Text style={[styles.feedKicker, { fontFamily: typo.display }]}>{t.forYou}</Text>
        <Text style={[styles.feedTitle, { fontFamily: typo.display }]}>{t.moreOffers}</Text>
        <Text style={[styles.feedSubtitle, { fontFamily: typo.mono }]}>{t.basedOnActivity}</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={V2.bg} />
      <FloatingSearchPill
        placeholder={t.searchPlaceholderV2}
        onPress={handleSearchPress}
        onFiltersPress={handleFiltersPress}
        leading={<ProfileAvatarButton />}
      />
      <FlatList
        style={styles.list}
        data={feedCars}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          item.promoted
            ? <BigFeedCard car={item} kmSuffix={t.kmShort} ctaLabel={t.open} faved={isFavorite(item.id)} onPress={handleCarPress} onToggleFav={(car) => toggleFavorite(car.id)} />
            : <SmallFeedCard car={item} kmSuffix={t.kmShort} faved={isFavorite(item.id)} onPress={handleCarPress} onToggleFav={(car) => toggleFavorite(car.id)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
        ListFooterComponent={refreshing ? <FeedLoader caption={t.pickingMore} /> : null}
        ListEmptyComponent={!loading ? <Text style={[styles.empty, { fontFamily: typo.display }]}>{t.noCars}</Text> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={V2.blue} />}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={8}
      />
      <BottomBar t={t} />
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
  list: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 120 },
  feedHeader: { paddingTop: 26, paddingBottom: 12 },
  feedKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.blue, marginBottom: 5 },
  feedTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.616, color: V2.text },
  feedSubtitle: { fontSize: 11.5, color: V2.textMuted, marginTop: 4, fontWeight: '600' },
  empty: { color: V2.textMuted, textAlign: 'center', marginTop: 24, fontSize: 16 },
});

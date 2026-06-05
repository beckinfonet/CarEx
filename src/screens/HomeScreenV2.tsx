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
import { rotateVariant } from '../utils/greetingVariants';
import { pickGreetingPool } from '../utils/pickGreetingPool';
import { usePersonality } from '../context/PersonalityContext';
import { AuthService } from '../services/AuthService';
import { formatMembers } from '../utils/formatMembers';

import { FloatingSearchPill } from '../components/home/v2/FloatingSearchPill';
import { ProfileAvatarButton } from '../components/home/v2/ProfileAvatarButton';
import { GreetingBlock } from '../components/home/v2/GreetingBlock';
import { ActiveFilterChips } from '../components/home/v2/ActiveFilterChips';
import { MemberCountStrip } from '../components/home/v2/MemberCountStrip';
import { HeroRotator } from '../components/home/v2/HeroRotator';
import { SmartShelf } from '../components/home/v2/SmartShelf';
import { BigFeedCard } from '../components/home/v2/BigFeedCard';
import { SmallFeedCard } from '../components/home/v2/SmallFeedCard';
import { FeedLoader } from '../components/home/v2/FeedLoader';
import { BottomBar } from '../components/BottomBar';
import { FilterModal } from '../components/FilterModal';
import { LangSwitchV2 } from '../components/home/v2/LangSwitchV2';
import { TierChip } from '../components/home/v2/TierChip';
import { TierPickerSheet } from '../components/home/v2/TierPickerSheet';
import { UnhingedConsentModal } from '../components/home/v2/UnhingedConsentModal';
import { UnhingedSnackbar } from '../components/home/v2/UnhingedSnackbar';

import { RootStackParamList } from '../types/navigation';

type Nav    = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type RouteT = RouteProp<RootStackParamList, 'Home'>;

function timeOfDayKey(t: any): string {
  const h = new Date().getHours();
  if (h < 12) return t.goodMorning;
  if (h < 18) return t.goodAfternoon;
  return t.goodEvening;
}

export const HomeScreenV2 = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const isFocused  = useIsFocused();
  const { t, language, setLanguage } = useLanguage();
  const { tier, setTier, cycleTier, requestTier, acceptUnhinged } = usePersonality();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Quick 260530-bdq — emit snackbar whenever tier transitions into UNHINGED,
  // regardless of which path drove the transition (cycle, picker, or post-consent
  // setTier). This keeps snackbar logic out of the four call-sites that can set
  // tier and avoids double-firing.
  const prevTierRef = useRef(tier);
  useEffect(() => {
    if (prevTierRef.current !== 'unhinged' && tier === 'unhinged') {
      setSnackbarVisible(true);
    }
    prevTierRef.current = tier;
  }, [tier]);
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  // ---- Quick 260528-hmt — Rotating greeting + headline ----
  const [greetingText, setGreetingText] = useState<string>(() => {
    const { slot, pool } = pickGreetingPool(t, tier);
    return rotateVariant(slot, pool);
  });
  const [headlineText, setHeadlineText] = useState<string>(() =>
    rotateVariant('headline', t.headlineVariants[tier]),
  );

  const rotate = useCallback(() => {
    const { slot, pool } = pickGreetingPool(t, tier);
    setGreetingText(rotateVariant(slot, pool));
    setHeadlineText(rotateVariant('headline', t.headlineVariants[tier]));
  }, [t, tier]);

  // Mirror the latest rotate function in a ref so trigger effects don't
  // re-fire when rotate's identity changes (e.g. tier or language flip).
  const rotateRef = useRef(rotate);
  useEffect(() => { rotateRef.current = rotate; });

  // Re-pick whenever the language flips so the displayed copy matches the active locale.
  // We intentionally depend on `language` (a stable primitive) rather than `t` (object identity).
  const langMountRef = useRef(true);
  useEffect(() => {
    if (langMountRef.current) { langMountRef.current = false; return; }
    rotateRef.current();
  }, [language]);

  // Re-pick whenever the tier changes so the displayed copy matches the active tier pool.
  const tierMountRef = useRef(true);
  useEffect(() => {
    if (tierMountRef.current) { tierMountRef.current = false; return; }
    rotateRef.current();
  }, [tier]);

  // Rotate when the screen regains focus (e.g. user returns from CarDetails).
  // Skip the initial mount so the initial useState pick isn't immediately replaced.
  const focusMountRef = useRef(true);
  useEffect(() => {
    if (focusMountRef.current) { focusMountRef.current = false; return; }
    if (isFocused) rotateRef.current();
  }, [isFocused]);

  // Rotate when the app returns from background to foreground.
  // Skip the very first 'active' transition (some Android builds fire it at launch).
  useEffect(() => {
    let skippedFirst = false;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') return;
      if (!skippedFirst) { skippedFirst = true; return; }
      rotateRef.current();
    });
    return () => sub.remove();
  }, []);

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

  // Total registered-member count for the social-proof strip (Option B).
  // Fetched once on mount; null until loaded (or if the backend route isn't
  // reachable yet), in which case the strip simply doesn't render.
  const [memberStats, setMemberStats] = useState<{ count: number; growthPct: number } | null>(null);
  useEffect(() => {
    let active = true;
    AuthService.getMemberStats().then((stats) => { if (active) setMemberStats(stats); });
    return () => { active = false; };
  }, []);

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

  const previews = {
    wholesome: t.greetingVariantsMorning.wholesome[0],
    sarcastic: t.greetingVariantsMorning.sarcastic[0],
    unhinged:  t.greetingVariantsMorning.unhinged[0],
  };

  const tierName =
    tier === 'wholesome' ? t.personalityWholesome :
    tier === 'sarcastic' ? t.personalitySarcastic :
                           t.personalityUnhinged;

  const Header = (
    <>
      <GreetingBlock
        timeOfDay={greetingText}
        subject={subject}
        headline={headlineText}
        listingsCount={displayedCars.length}
        listingsNoun={t.listingsCount}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TierChip
              tier={tier}
              label={tierName}
              onCycle={() => {
                // Quick 260530-bdq — open consent modal if next-in-cycle is UNHINGED
                // and consent has not yet been granted. Snackbar emission for the
                // 'switched' case is handled by the tier-transition useEffect above.
                const result = cycleTier();
                if (result === 'needs-consent') setConsentVisible(true);
              }}
              onOpenPicker={() => setPickerVisible(true)}
              a11yLabel={`${t.personalityTitle}: ${tierName}`}
              a11yHint={t.personalityA11yHint}
            />
            <LangSwitchV2 language={language} setLanguage={setLanguage} />
          </View>
        }
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
      {memberStats && (
        <MemberCountStrip
          countText={formatMembers(memberStats.count, language)}
          noun={t.membersNoun}
          caption={t.membersCaption}
          growthText={`+${memberStats.growthPct}%`}
          periodLabel={t.membersPeriod}
        />
      )}
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
      <TierPickerSheet
        visible={pickerVisible}
        currentTier={tier}
        previews={previews}
        labels={{
          title: t.personalityTitle,
          close: t.personalityClose,
          wholesome: t.personalityWholesome,
          sarcastic: t.personalitySarcastic,
          unhinged:  t.personalityUnhinged,
        }}
        onSelect={(next) => {
          // Quick 260530-bdq — gate the UNHINGED path. If the request is
          // refused, dismiss the picker immediately and surface the consent
          // modal; otherwise behave as before (small delay to let the row
          // highlight before the sheet closes).
          const result = requestTier(next);
          if (result === 'needs-consent') {
            setPickerVisible(false);
            setConsentVisible(true);
          } else {
            setTimeout(() => setPickerVisible(false), 150);
          }
        }}
        onDismiss={() => setPickerVisible(false)}
      />
      <UnhingedConsentModal
        visible={consentVisible}
        labels={{
          title: t.unhingedConsentTitle,
          body: t.unhingedConsentBody,
          accept: t.unhingedConsentAccept,
          cancel: t.unhingedConsentCancel,
        }}
        onAccept={() => {
          // Persist + flip into UNHINGED. Snackbar is fired by the
          // tier-transition useEffect once `tier` updates.
          acceptUnhinged();
          setTier('unhinged');
          setConsentVisible(false);
        }}
        onCancel={() => setConsentVisible(false)}
      />
      <UnhingedSnackbar
        visible={snackbarVisible}
        message={t.unhingedActiveToast}
        onHide={() => setSnackbarVisible(false)}
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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions, Linking, Alert, Modal, Platform, Animated, Share, Image, ActivityIndicator, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { OptimizedImage } from '../components/OptimizedImage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SIZES } from '../constants/theme';
import { CARS } from '../constants/mockData';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MessageCircle, AlertTriangle, Send, X, Edit2, Share2, User, ChevronRight, Briefcase, CreditCard, ShieldAlert } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { AuthService } from '../services/AuthService';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTypography } from '../hooks/useTypography';
import { useCart } from '../context/CartContext';
import { FeatureGateOverlay } from '../components/moderation/FeatureGateOverlay';
import { ListingModerationBottomSheet, ListingModerationAction } from '../components/moderation/ListingModerationBottomSheet';
import { ListingModerationReasonModal, ListingReasonAction } from '../components/moderation/ListingModerationReasonModal';
import { ListingRestoreModal } from '../components/moderation/ListingRestoreModal';
import { TypedConfirmationModal } from '../components/moderation/TypedConfirmationModal';
import { ModerationService } from '../services/moderation/ModerationService';
import { ListingModerationError } from '../services/moderation/errors';
import { buildListingTitle } from '../utils/listingTitle';
import { LISTING_URL, API_URL } from '../constants/config';
import axios from 'axios';
import { apiClient } from '../services/http/client';

export const CarDetailsScreen = () => {
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth() as any;
  const { setCar } = useCart();
  const typo = useTypography();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { carId } = route.params as { carId: string };
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const fullScreenScrollRef = useRef<ScrollView>(null);
  const fullScreenOpacity = useRef(new Animated.Value(1)).current;
  const animateFullScreenOpen = useRef(false);
  const [fetchedCar, setFetchedCar] = useState<any>(null);
  const [carLoading, setCarLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [localListingStatus, setLocalListingStatus] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [sellerAvatarUrl, setSellerAvatarUrl] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [paymentWarningVisible, setPaymentWarningVisible] = useState(false);
  const [contactGateVisible, setContactGateVisible] = useState(false);
  // Phase 10 Plan 08 — admin moderation state.
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [reasonModalAction, setReasonModalAction] = useState<ListingReasonAction | null>(null);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [typedConfirmVisible, setTypedConfirmVisible] = useState(false);
  const [pendingDeletePayload, setPendingDeletePayload] = useState<{ reasonCategory: string; note?: string } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Phase 6 Plan 06-07 — inline contact_seller gate on Telegram + WhatsApp CTAs.
  // Predicate mirrors the full-screen wrapper (Plan 06-05) exactly:
  // state !== 'active' AND (all_writes sentinel OR literal contact_seller key).
  // Keeps CTA-only gating consistent with the full-screen wrapper's predicate
  // behavior; browse body stays interactive (D-04 context preservation).
  // T-06-03 mitigation.
  const state: string = user?.moderationStatus?.state ?? 'active';
  const restricted: string[] = user?.moderationStatus?.restrictedFeatures ?? [];
  const isContactGated =
    state !== 'active' &&
    (restricted.includes('all_writes') || restricted.includes('contact_seller'));

  const car = CARS.find(c => c.id === carId) || (route.params as any).carData || fetchedCar;
  const listingStatus = (localListingStatus ?? car?.listingStatus ?? 'active') as string;
  const isOwner = car?.sellerId && user?.localId === car.sellerId;
  const isBooker = listingStatus === 'booked' && user?.localId &&
    (car?.bookedByUid === user.localId || localListingStatus === 'booked');
  const canAccessBookedCar = listingStatus !== 'booked' || isBooker || isOwner;

  useEffect(() => {
    if (fullScreenVisible && fullScreenScrollRef.current) {
      const doScroll = () => {
        fullScreenScrollRef.current?.scrollTo({
          x: activeImageIndex * width,
          animated: false,
        });
      };

      if (animateFullScreenOpen.current) {
        animateFullScreenOpen.current = false;
        fullScreenOpacity.setValue(0);
        setTimeout(() => {
          doScroll();
          Animated.timing(fullScreenOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        }, 100);
      } else {
        doScroll();
      }
    }
  }, [fullScreenVisible, activeImageIndex, width]);

  const openFullScreenFromGallery = (index: number) => {
    animateFullScreenOpen.current = true;
    setActiveImageIndex(index);
    setFullScreenVisible(true);
    setGalleryVisible(false);
  };

  useEffect(() => {
    checkFavoriteStatus();
  }, [carId]);

  // Fetch car from API when opened via deep link (no carData)
  useEffect(() => {
    const existingCar = CARS.find(c => c.id === carId) || (route.params as any).carData;
    if (carId && !existingCar) {
      setCarLoading(true);
      // Plan 10-05 / RESEARCH §Assumption A6: use the shared apiClient so the
      // request interceptor (Phase 4 D-02) attaches the Bearer header.
      // Without it, the backend's status-aware listing GET (Phase 9 D-08)
      // treats this request as unauthenticated → admin viewers never see
      // the Phase 9 D-07 moderationBadge payload, and Plan 10-08's
      // CarDetails status banner cannot render. baseURL is API_URL.
      apiClient.get(`/api/cars/${carId}`)
        .then(res => {
          const c = res.data;
          setFetchedCar({
            id: c.id || c._id?.toString(),
            makeId: c.makeId,
            modelId: c.modelId,
            make: c.make || c.makeName,
            model: c.model || c.modelName,
            year: c.year,
            price: c.price,
            mileage: c.mileage,
            fuel: c.fuel,
            currency: c.currency,
            imageUrls: c.imageUrls || (c.imageUrl ? [c.imageUrl] : []),
            image: (c.imageUrls?.[0]) || c.imageUrl,
            sellerId: c.sellerId,
            phoneNumber: c.phoneNumber,
            telegramUsername: c.telegramUsername,
            listingId: c.listingId,
            listingStatus: c.listingStatus || 'active',
            ...c,
          });
        })
        .catch(() => setFetchedCar(null))
        .finally(() => setCarLoading(false));
    }
  }, [carId]);

  // Fetch seller profile (name, avatar) when car has sellerId
  useEffect(() => {
    const sid = car?.sellerId;
    if (!sid) return;
    axios.get(`${API_URL}/api/users/${sid}`)
      .then(res => {
        const u = res.data;
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        setSellerName(name || null);
        setSellerAvatarUrl(u.avatarUrl || null);
      })
      .catch(() => {
        setSellerName(null);
        setSellerAvatarUrl(null);
      });
  }, [car?.sellerId]);

  const checkFavoriteStatus = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favorites');
      if (favorites) {
        const parsed = JSON.parse(favorites);
        setIsFavorite(parsed.includes(carId));
      }
    } catch (e) {
      console.error('Failed to load favorites');
    }
  };

  const toggleFavorite = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favorites');
      let parsed = favorites ? JSON.parse(favorites) : [];

      if (isFavorite) {
        parsed = parsed.filter((id: string) => id !== carId);
      } else {
        parsed.push(carId);
      }

      await AsyncStorage.setItem('favorites', JSON.stringify(parsed));
      setIsFavorite(!isFavorite);
    } catch (e) {
      console.error('Failed to toggle favorite');
    }
  };

  // Normalize images to an array
  const images = car?.imageUrls || (car?.image ? [car.image] : []);

  if (!car) {
    return (
      <View style={styles.errorContainer}>
        {carLoading ? (
          <Text style={[styles.errorText, { fontFamily: typo.display }]}>{t.loading || 'Loading...'}</Text>
        ) : (
          <Text style={[styles.errorText, { fontFamily: typo.display }]}>{t.carNotFound || 'Car not found'}</Text>
        )}
      </View>
    );
  }

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setActiveImageIndex(roundIndex);
  };

  const renderSpecItem = (label: string, value: string | number) => (
    <View style={styles.specItem}>
      <Text style={[styles.specLabel, { fontFamily: typo.display }]}>{label}</Text>
      <Text style={[styles.specValue, { fontFamily: typo.display }]}>{value || '-'}</Text>
    </View>
  );

  const handleCallSeller = () => {
    // Phone number from car object or fallback
    const phoneNumber = car.phoneNumber || '821012345678';

    // Clean phone number for WhatsApp: remove all non-numeric characters, include country code
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // @ts-ignore
    const messageTemplate = t.contactMessage || `Hi, I'm interested in your {car} (ID: {id})`;
    const baseMessage = messageTemplate
      .replace('{car}', `${car.make} ${car.model}`)
      .replace('{id}', car.listingId || car.id || '');
    const listingLink = LISTING_URL(car.id);
    const message = `${baseMessage}\n\n${listingLink}`;

    const encodedText = encodeURIComponent(message);
    const whatsappDeepLink = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
    const whatsappWebUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

    // Avoid canOpenURL - it returns false on some Android devices even when WhatsApp is installed,
    // causing wrong fallback to tel: (phone dialer). Try opening WhatsApp directly instead.
    Linking.openURL(whatsappDeepLink).catch(() => {
      // Fallback to wa.me - works in browser and opens WhatsApp when installed
      Linking.openURL(whatsappWebUrl).catch((err) => {
        console.error('Failed to open WhatsApp', err);
        Alert.alert(
          'WhatsApp',
          'Could not open WhatsApp. Please ensure it is installed or try again later.'
        );
      });
    });
  };

  const handleTelegram = () => {
    if (!car.telegramUsername) {
      Alert.alert('No Telegram', 'This seller has not provided a Telegram username.');
      return;
    }

    // Clean username: remove URL parts, @, and whitespace
    let username = car.telegramUsername.trim();
    username = username.replace(/(https?:\/\/)?(t\.me|telegram\.me)\//i, '');
    username = username.replace('@', '');
    
    if (!username) {
         Alert.alert('Invalid Telegram', 'The provided Telegram username is invalid.');
         return;
    }

    // @ts-ignore
    const messageTemplate = t.contactMessage || `Hi, I'm interested in your {car} (ID: {id})`;
    const baseMessage = messageTemplate
      .replace('{car}', `${car.make} ${car.model}`)
      .replace('{id}', car.listingId || car.id || '');
    const listingLink = LISTING_URL(car.id);
    const message = `${baseMessage}\n\n${listingLink}`;

    // Telegram requires the "text" parameter for web links (t.me)
    const webUrl = `https://t.me/${username}?text=${encodeURIComponent(message)}`;

    // Try opening web URL directly as it handles redirection well
    Linking.openURL(webUrl).catch(err => {
      console.error("Failed to open Telegram", err);
      // Fallback to deep link (note: tg:// usually doesn't support pre-filled text reliably across all platforms)
      Linking.openURL(`tg://resolve?domain=${username}`);
    });
  };

  const handleReport = () => {
    Alert.alert(
      'Report Listing',
      'Please select a reason for reporting this listing:',
      [
        {
          text: 'Inappropriate Content',
          onPress: () => confirmReport('Inappropriate Content'),
        },
        {
          text: 'Spam / Fraud',
          onPress: () => confirmReport('Spam / Fraud'),
        },
        {
          text: 'Other',
          onPress: () => confirmReport('Other'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const confirmReport = (reason: string) => {
    // In a real app, this would send an API request to your backend
    Alert.alert(
      'Report Received',
      `Thank you for reporting this listing for "${reason}". We will review it shortly.`,
      [{ text: 'OK' }]
    );
  };

  const updateListingStatus = async (newStatus: 'active' | 'booked' | 'sold') => {
    if (!user?.localId || !car?.id) return;
    setStatusUpdating(true);
    try {
      await axios.patch(`${API_URL}/api/cars/${car.id}/status`, {
        sellerId: user.localId,
        listingStatus: newStatus,
      });
      setLocalListingStatus(newStatus);
    } catch (err) {
      console.error('Update status failed', err);
      Alert.alert(t.error || 'Error', 'Failed to update listing status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleBookIt = () => {
    if (!user) {
      Alert.alert(t.loginRequired, t.loginRequiredDesc, [
        { text: t.cancel, style: 'cancel' },
        { text: t.login, onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    setPaymentWarningVisible(true);
  };

  const handleCurrencySelect = (currency: string) => {
    setCurrencyPickerVisible(false);
    setTimeout(() => processPayment(currency), 600);
  };

  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out`)), ms),
      ),
    ]);

  const processPayment = async (currency: string) => {
    setBookingLoading(true);
    try {
      const carId = car._id || car.id || '';

      const { clientSecret, paymentIntentId } = await withTimeout(
        AuthService.createPaymentIntent(currency, carId, user!.localId),
        30000,
        'Creating payment',
      );

      if (!clientSecret) {
        Alert.alert(t.paymentFailed, 'No client secret returned from server.');
        return;
      }

      const { error: initError } = await withTimeout(
        initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'CarEx',
          returnURL: 'carex://stripe-redirect',
        }),
        30000,
        'Initializing payment sheet',
      );

      if (initError) {
        Alert.alert(t.paymentFailed, initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert(t.paymentFailed, presentError.message);
        }
        return;
      }

      await withTimeout(
        AuthService.confirmBooking(paymentIntentId, carId, user!.localId),
        30000,
        'Confirming booking',
      );
      setLocalListingStatus('booked');

      Alert.alert(t.paymentSuccess, t.paymentSuccessDesc);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || t.error;
      Alert.alert(t.paymentFailed, msg);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleShare = async () => {
    const url = LISTING_URL(car.id);
    const title = `${car.make} ${car.model} ${car.year}`;
    const message = `${title} - ${car.currency}${car.price?.toLocaleString()}\n\n${url}`;
    try {
      await Share.share({
        message,
        title: t.shareListing || 'Share listing',
      });
    } catch (err) {
      if ((err as any)?.message !== 'User did not share') {
        console.error('Share failed', err);
      }
    }
  };

  // Phase 10 Plan 08 — Single source of truth (Pitfall 6) for both the
  // bottom-sheet header AND the TypedConfirmationModal sentinel target.
  // buildListingTitle reads makeName/modelName with makeId/modelId fallbacks
  // so the same canonical string is rendered and matched against typed input.
  const listingTitle = fetchedCar
    ? buildListingTitle(fetchedCar)
    : buildListingTitle({
        year: car?.year,
        makeName: car?.makeName ?? car?.make,
        modelName: car?.modelName ?? car?.model,
        makeId: car?.makeId,
        modelId: car?.modelId,
      });

  // Phase 10 Plan 08 — Optimistic flip + rollback handler (D-16).
  // Snapshots BOTH `status` AND `moderationBadge` (Pitfall 2 — without
  // flipping the badge alongside status, the banner shows a 200ms
  // "status changed but no banner" gap that looks broken).
  // On error, restore BOTH fields. Error mapping per D-15:
  //   - cannot_moderate_own_listing / already_in_state → INLINE banner
  //   - listing_not_found                             → Alert + goBack
  //   - other ListingModerationError                  → Alert.alert(code)
  //   - non-ListingModerationError                    → Alert.alert('Unexpected error')
  const handleListingActionSubmit = async (
    action: 'suspend' | 'archive' | 'delete' | 'restore',
    body?: { reasonCategory?: string; note?: string },
  ) => {
    const prevBadge = fetchedCar?.moderationBadge ?? null;
    const prevStatus = fetchedCar?.status ?? 'active';
    const nextStatus =
      action === 'restore' ? 'active' :
      action === 'delete' ? 'deleted' :
      action === 'suspend' ? 'suspended' : 'archived';

    // Optimistic flip — capture both status + moderationBadge in one update.
    setFetchedCar((c: any) => c ? ({
      ...c,
      status: nextStatus,
      moderationBadge: nextStatus === 'active'
        ? undefined
        : {
            status: nextStatus,
            reasonCategory: body?.reasonCategory,
            moderatedAt: new Date().toISOString(),
          },
    }) : c);
    setBottomSheetVisible(false);
    setReasonModalAction(null);
    setRestoreModalVisible(false);

    try {
      const fn =
        action === 'suspend' ? ModerationService.suspendListing :
        action === 'archive' ? ModerationService.archiveListing :
        action === 'delete'  ? ModerationService.deleteListing  :
        ModerationService.restoreListing;
      const result: any = await fn(carId, (body ?? {}) as any);
      // Merge authoritative response into fetchedCar (replaces optimistic values).
      if (result?.listing) {
        setFetchedCar((c: any) => c ? ({ ...c, ...result.listing }) : c);
      }
    } catch (err: any) {
      // Rollback BOTH status and moderationBadge to pre-flip snapshot.
      setFetchedCar((c: any) => c ? ({
        ...c,
        status: prevStatus,
        moderationBadge: prevBadge ?? undefined,
      }) : c);
      if (err instanceof ListingModerationError) {
        if (err.code === 'cannot_moderate_own_listing' || err.code === 'already_in_state') {
          setErrorBanner(err.code);
        } else if (err.code === 'listing_not_found') {
          Alert.alert(t.error || 'Error', 'Listing not found');
          navigation.goBack();
        } else {
          Alert.alert(t.error || 'Error', err.code);
        }
      } else {
        Alert.alert(t.error || 'Error', 'Unexpected error');
      }
    }
  };

  // Phase 10 Plan 08 — bottom-sheet → action dispatcher.
  //  - Edit:    navigation.navigate('SellCar', { carId, adminEdit: true })
  //             (Plan 09 wires the receiving side)
  //  - Restore: open ListingRestoreModal
  //  - 4 active actions: open ListingModerationReasonModal
  const handleSheetSelect = (action: ListingModerationAction) => {
    if (action === 'edit') {
      setBottomSheetVisible(false);
      navigation.navigate('SellCar', { carId, adminEdit: true });
    } else if (action === 'restore') {
      setBottomSheetVisible(false);
      setRestoreModalVisible(true);
    } else {
      setBottomSheetVisible(false);
      setReasonModalAction(action as ListingReasonAction);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('Home');
            }
          }}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: typo.display }]}>{car.make} {car.model}</Text>
        <View style={styles.headerRight}>
          {/* Phase 10 Plan 08 — Admin Moderate badge (D-LUI-01). Gated ONLY on
              isAdmin; D-02 unconditional — admin viewing their own listing
              STILL sees the badge. Backend is the authority and rejects
              own-listing actions with cannot_moderate_own_listing → inline
              banner per D-15. */}
          {isAdmin && (
            <TouchableOpacity
              testID="moderate-badge"
              style={styles.iconButton}
              onPress={() => setBottomSheetVisible(true)}
              accessibilityLabel="Moderate listing"
            >
              <ShieldAlert size={24} color={COLORS.warning} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
            <Share2 size={24} color={COLORS.accent} />
          </TouchableOpacity>
          {car.sellerId && user?.localId === car.sellerId ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('SellCar', { carId: car.id })}
            >
              <Edit2 size={24} color={COLORS.accent} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={handleReport}>
                <AlertTriangle size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFavorite}>
                <Heart
                  size={24}
                  color={isFavorite ? '#EF4444' : COLORS.accent}
                  fill={isFavorite ? '#EF4444' : 'none'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} removeClippedSubviews={Platform.OS === 'android'}>
        <View style={styles.imageCarousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
          >
            {images.map((img: string, index: number) => (
              <TouchableOpacity
                key={index}
                activeOpacity={1}
                onPress={() => setGalleryVisible(true)}
                style={{ width }}
              >
                <OptimizedImage source={{ uri: img }} style={[styles.mainImage, { width }]} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === activeImageIndex && styles.activeDot
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          {/* Phase 10 Plan 08 — Admin status banner (D-17). Admin-only +
              moderationBadge presence-gated. Renders status/reasonCategory
              chip/moderationReason free-text/setBy admin info. Distinct from
              Phase 11 LBUY-01 buyer variant. */}
          {isAdmin && fetchedCar?.moderationBadge && (
            <View
              testID="admin-status-banner"
              style={[
                styles.adminStatusBanner,
                fetchedCar.moderationBadge.banner?.severity === 'warning' && styles.adminBannerWarning,
                fetchedCar.moderationBadge.banner?.severity === 'neutral' && styles.adminBannerNeutral,
                fetchedCar.moderationBadge.banner?.severity === 'destructive' && styles.adminBannerDestructive,
              ]}
            >
              <Text style={[styles.adminBannerStatus, { fontFamily: typo.display }]}>
                {fetchedCar.moderationBadge.status}
              </Text>
              {fetchedCar.moderationBadge.reasonCategory ? (
                <Text style={[styles.adminBannerChip, { fontFamily: typo.display }]}>
                  {fetchedCar.moderationBadge.reasonCategory}
                </Text>
              ) : null}
              {fetchedCar.moderationBadge.moderationReason ? (
                <Text style={[styles.adminBannerReason, { fontFamily: typo.display }]}>
                  {fetchedCar.moderationBadge.moderationReason}
                </Text>
              ) : null}
              {fetchedCar.moderationBadge.moderatedBy ? (
                <Text style={[styles.adminBannerSetBy, { fontFamily: typo.display }]}>
                  by {fetchedCar.moderationBadge.moderatedBy}
                </Text>
              ) : null}
            </View>
          )}
          {/* Phase 10 Plan 08 — Admin error banner (D-15). Renders for
              cannot_moderate_own_listing + already_in_state; admin keeps
              working. listing_not_found surfaces via Alert + goBack. */}
          {errorBanner && (
            <View testID="admin-error-banner" style={styles.adminErrorBanner}>
              <Text style={[styles.adminErrorBannerText, { fontFamily: typo.display }]}>
                {errorBanner}
              </Text>
              <TouchableOpacity
                onPress={() => setErrorBanner(null)}
                accessibilityLabel="Dismiss error"
              >
                <X size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
          {(listingStatus === 'booked' || listingStatus === 'sold') && (
            <View style={[styles.statusBadge, listingStatus === 'sold' && styles.statusBadgeSold]}>
              <Text style={[styles.statusBadgeText, { fontFamily: typo.display }]}>{listingStatus === 'sold' ? t.sold : t.booked}</Text>
            </View>
          )}
          {isOwner && (
            <View style={styles.statusActions}>
              <Text style={[styles.statusLabel, { fontFamily: typo.display }]}>{t.listingStatus || 'Status'}:</Text>
              <View style={styles.statusButtons}>
                {listingStatus !== 'active' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, styles.statusBtnActive]}
                    onPress={() => updateListingStatus('active')}
                    disabled={statusUpdating}
                  >
                    <Text style={[styles.statusBtnText, { fontFamily: typo.display }]}>{t.markAsAvailable}</Text>
                  </TouchableOpacity>
                )}
                {listingStatus !== 'booked' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, listingStatus === 'booked' && styles.statusBtnSelected]}
                    onPress={() => updateListingStatus('booked')}
                    disabled={statusUpdating}
                  >
                    <Text style={[styles.statusBtnText, { fontFamily: typo.display }]}>{t.markAsBooked}</Text>
                  </TouchableOpacity>
                )}
                {listingStatus !== 'sold' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, styles.statusBtnSold, listingStatus === 'sold' && styles.statusBtnSelected]}
                    onPress={() => updateListingStatus('sold')}
                    disabled={statusUpdating}
                  >
                    <Text style={[styles.statusBtnText, { fontFamily: typo.display }]}>{t.markAsSold}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={3}>{car.make} {car.model}{car.trimLevel ? ` ${car.trimLevel}` : ''} {car.year}</Text>
              </View>
              <Text style={[styles.price, { fontFamily: typo.mono }]}>{car.currency}{car.price.toLocaleString()}</Text>
            </View>
            <View style={styles.subtitleRow}>
              <Text style={[styles.subtitle, { fontFamily: typo.mono }]}>{car.mileage.toLocaleString()} км • {car.fuel}</Text>
              {car.listingId && (
                <View style={styles.listingIdPill}>
                  <Text style={[styles.listingId, { fontFamily: typo.mono }]}>ID: {car.listingId}</Text>
                </View>
              )}
            </View>
            {car.sellerId && (
              <TouchableOpacity
                style={styles.sellerCard}
                onPress={() => navigation.navigate('SellerListings', { sellerId: car.sellerId, sellerName: sellerName || undefined })}
                activeOpacity={0.7}
              >
                <View style={styles.sellerAvatarContainer}>
                  {sellerAvatarUrl ? (
                    <Image source={{ uri: sellerAvatarUrl }} style={styles.sellerAvatar} />
                  ) : (
                    <View style={styles.sellerAvatarPlaceholder}>
                      <User size={24} color={COLORS.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={[styles.sellerLabel, { fontFamily: typo.display }]}>{t.listingOwner}</Text>
                  <Text style={[styles.sellerName, { fontFamily: typo.display }]}>{sellerName || t.seller}</Text>
                  <Text style={[styles.sellerViewAll, { fontFamily: typo.display }]}>{t.viewAllListings}</Text>
                </View>
                <ChevronRight size={22} color={COLORS.accent} style={styles.sellerChevron} />
              </TouchableOpacity>
            )}
          </View>

          {listingStatus !== 'sold' && (
            <View style={styles.actionButtonsRow}>
              {canAccessBookedCar && (
                <TouchableOpacity
                  style={styles.getServicesButton}
                  onPress={() => {
                    setCar({
                      id: car._id || car.id || '',
                      makeName: car.makeName || car.make || '',
                      modelName: car.modelName || car.model || '',
                      year: car.year || 0,
                      price: car.price || 0,
                      currency: car.currency || '$',
                      imageUrl: car.imageUrls?.[0] || car.image || '',
                      listingId: car.listingId || '',
                    });
                    navigation.navigate('Services');
                  }}>
                  <Briefcase size={18} color={COLORS.accent} />
                  <Text style={[styles.getServicesText, { fontFamily: typo.display }]}>{t.getServices}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.bookItButton, listingStatus === 'booked' && styles.bookItButtonDisabled]}
                onPress={handleBookIt}
                disabled={bookingLoading || listingStatus === 'booked'}>
                {bookingLoading ? (
                  <ActivityIndicator size="small" color="#22c55e" />
                ) : (
                  <>
                    <CreditCard size={18} color={listingStatus === 'booked' ? 'rgba(255,255,255,0.4)' : '#22c55e'} />
                    <Text style={[styles.bookItText, listingStatus === 'booked' && styles.bookItTextDisabled, { fontFamily: typo.display }]}>
                      {listingStatus === 'booked' ? t.booked : t.bookIt}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.specsContainer}>
            <Text style={[styles.sectionTitle, { fontFamily: typo.display }]}>{t.specs}</Text>
            <View style={styles.specsGrid}>
              {(car.trimLevel || car.wheelbase) && (
                <>
                  {car.trimLevel && renderSpecItem(t.trimLevel, car.trimLevel)}
                  {car.wheelbase && renderSpecItem(t.wheelbase, car.wheelbase)}
                </>
              )}
              {renderSpecItem(t.bodyType, car.bodyType)}
              {renderSpecItem(t.engine, car.engine || '-')}
              {renderSpecItem(t.transmission, car.transmission)}
              {renderSpecItem(t.drivetrain, car.drivetrain)}
              {renderSpecItem(t.fuelLabel, car.fuel)}
              {renderSpecItem(t.mpgRange, car.mpg)}
              {renderSpecItem(t.owners, car.owners || '1')}
              {/* Note: 'owners' wasn't in upload form, defaulting to 1 or add to schema if needed */}
            </View>
          </View>

          <View style={styles.specsContainer}>
            <Text style={[styles.sectionTitle, { fontFamily: typo.display }]}>{t.condition}</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem(t.condition, car.condition)}
              <View style={styles.fullWidthItem}>
                <Text style={[styles.specLabel, { fontFamily: typo.display }]}>{t.knownIssues}</Text>
                <Text style={[styles.specValue, { fontFamily: typo.display }]}>
                  {car.knownIssues && car.knownIssues.length > 0 ? car.knownIssues.join(', ') : 'Нет'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.specsContainer}>
            <Text style={[styles.sectionTitle, { fontFamily: typo.display }]}>{t.extInt}</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem(t.exteriorColor, car.exteriorColor)}
              {renderSpecItem(t.interiorColor, car.interiorColor)}
              {renderSpecItem(t.interiorMaterial, car.interiorMaterial)}
              {renderSpecItem(t.seats, car.seats)}
              {renderSpecItem(t.doors, car.doors)}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontFamily: typo.display }]}>{t.description}</Text>
            <Text style={[styles.description, { fontFamily: typo.display }]}>
              {car.description || t.noDescription}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {listingStatus === 'sold' ? (
          <View style={styles.soldMessage}>
            <Text style={[styles.soldMessageText, { fontFamily: typo.display }]}>{t.sold}</Text>
          </View>
        ) : canAccessBookedCar ? (
          <>
            <Text style={[styles.contactLabel, { fontFamily: typo.display }]}>{t.contactVia}</Text>
            <View style={styles.contactButtonsRow}>
              {car.telegramUsername && (
                <TouchableOpacity
                  style={[styles.contactButton, styles.telegramButton, isContactGated && { opacity: 0.4 }]}
                  onPress={isContactGated ? () => setContactGateVisible(true) : handleTelegram}
                  disabled={false}
                  testID="car-details-telegram-cta"
                  accessibilityState={{ disabled: isContactGated }}>
                  <Send size={20} color="#FFF" />
                  <Text style={[styles.contactButtonText, { color: '#FFF', fontFamily: typo.display }]}>Telegram</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.contactButton,
                  styles.whatsappButton,
                  car.telegramUsername ? { flex: 1, marginLeft: 2 } : { width: '100%' },
                  isContactGated && { opacity: 0.4 },
                ]}
                onPress={isContactGated ? () => setContactGateVisible(true) : handleCallSeller}
                disabled={false}
                testID="car-details-whatsapp-cta"
                accessibilityState={{ disabled: isContactGated }}>
                <MessageCircle size={20} color="#FFF" />
                <Text style={[styles.contactButtonText, { color: '#FFF', fontFamily: typo.display }]}>{t.whatsapp}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.soldMessage}>
            <Text style={[styles.soldMessageText, { fontFamily: typo.display }]}>{t.booked}</Text>
          </View>
        )}
      </View>

      <Modal
        visible={contactGateVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setContactGateVisible(false)}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setContactGateVisible(false)}
          testID="car-details-contact-gate-modal">
          <FeatureGateOverlay capability="contact_seller" />
        </Pressable>
      </Modal>

      <Modal
        visible={paymentWarningVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPaymentWarningVisible(false)}>
        <View style={styles.warningOverlay}>
          <View style={styles.warningCard}>
            <View style={styles.warningIconWrap}>
              <AlertTriangle size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.warningTitle, { fontFamily: typo.display }]}>{t.paymentWarningTitle}</Text>
            <Text style={[styles.warningMessage, { fontFamily: typo.display }]}>{t.paymentWarningMessage}</Text>
            <View style={styles.warningCardRow}>
              <View style={styles.warningBadge}>
                <Text style={[styles.warningBadgeText, { fontFamily: typo.display }]}>Visa</Text>
              </View>
              <View style={styles.warningBadge}>
                <Text style={[styles.warningBadgeText, { fontFamily: typo.display }]}>Mastercard</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.warningConfirmBtn}
              activeOpacity={0.8}
              onPress={() => {
                setPaymentWarningVisible(false);
                setTimeout(() => setCurrencyPickerVisible(true), 300);
              }}>
              <Text style={[styles.warningConfirmText, { fontFamily: typo.display }]}>{t.paymentWarningConfirm}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.warningCancelBtn}
              activeOpacity={0.7}
              onPress={() => setPaymentWarningVisible(false)}>
              <Text style={[styles.warningCancelText, { fontFamily: typo.display }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={currencyPickerVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCurrencyPickerVisible(false)}>
        <TouchableOpacity
          style={styles.currencyOverlay}
          activeOpacity={1}
          onPress={() => setCurrencyPickerVisible(false)}>
          <View style={styles.currencySheet}>
            <View style={styles.currencyHandle} />
            <Text style={[styles.currencyTitle, { fontFamily: typo.display }]}>{t.chooseCurrency}</Text>
            <Text style={[styles.currencySubtitle, { fontFamily: typo.display }]}>
              {car.make} {car.model} {car.year}
            </Text>

            <TouchableOpacity
              style={styles.currencyOption}
              activeOpacity={0.7}
              onPress={() => handleCurrencySelect('kgs')}>
              <View style={styles.currencyIconWrap}>
                <Text style={styles.currencyFlag}>🇰🇬</Text>
              </View>
              <View style={styles.currencyInfo}>
                <Text style={[styles.currencyName, { fontFamily: typo.mono }]}>KGS</Text>
                <Text style={[styles.currencyDesc, { fontFamily: typo.display }]}>Кыргызский сом</Text>
              </View>
              <Text style={[styles.currencyAmount, { fontFamily: typo.mono }]}>5 000 сом</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.currencyOption}
              activeOpacity={0.7}
              onPress={() => handleCurrencySelect('usd')}>
              <View style={styles.currencyIconWrap}>
                <Text style={styles.currencyFlag}>🇺🇸</Text>
              </View>
              <View style={styles.currencyInfo}>
                <Text style={[styles.currencyName, { fontFamily: typo.mono }]}>USD</Text>
                <Text style={[styles.currencyDesc, { fontFamily: typo.display }]}>US Dollar</Text>
              </View>
              <Text style={[styles.currencyAmount, { fontFamily: typo.mono }]}>~$58</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.currencyCancelBtn}
              onPress={() => setCurrencyPickerVisible(false)}>
              <Text style={[styles.currencyCancelText, { fontFamily: typo.display }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Combined gallery + full-screen modal - single modal prevents iOS flash */}
      <Modal
        visible={galleryVisible || fullScreenVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setGalleryVisible(false);
          setFullScreenVisible(false);
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" />
        {fullScreenVisible ? (
        <GestureHandlerRootView style={styles.fullScreenOverlay}>
          <Animated.View style={[styles.fullScreenOverlay, { opacity: fullScreenOpacity }]}>
            <TouchableOpacity
              style={[styles.fullScreenCloseButton, { top: insets.top + 16 }]}
              onPress={() => { setFullScreenVisible(false); setGalleryVisible(false); }}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <X size={28} color="#FFF" />
            </TouchableOpacity>

            <ScrollView
              ref={fullScreenScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              style={styles.fullScreenScroll}
              removeClippedSubviews={Platform.OS === 'android'}
            >
              {images.map((img: string, index: number) => (
                <View key={index} style={[styles.fullScreenImage, { width, height }]}>
                  <Zoomable
                    minScale={1}
                    maxScale={4}
                    doubleTapScale={2.5}
                    isDoubleTapEnabled
                  >
                    <OptimizedImage
                      source={{ uri: img }}
                      style={[styles.fullScreenImage, { width, height }]}
                      resizeMode="contain"
                    />
                  </Zoomable>
                </View>
              ))}
            </ScrollView>

            {images.length > 1 && (
              <View style={[styles.fullScreenPagination, { bottom: insets.bottom + 24 }]}>
                {images.map((_: any, index: number) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === activeImageIndex && styles.activeDot
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        </GestureHandlerRootView>
        ) : (
        <View style={styles.galleryOverlay}>
          <TouchableOpacity
            style={[styles.fullScreenCloseButton, { top: insets.top + 16 }]}
            onPress={() => setGalleryVisible(false)}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <X size={28} color="#FFF" />
          </TouchableOpacity>
          <ScrollView
            style={styles.galleryScroll}
            contentContainerStyle={styles.galleryScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {images.map((img: string, index: number) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={() => openFullScreenFromGallery(index)}
              >
                <OptimizedImage
                  source={{ uri: img }}
                  style={[styles.galleryImage, { width, height: width * 0.75 }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        )}
      </Modal>

      {/* Phase 10 Plan 08 — Admin moderation modal stack.
          Mounted unconditionally (visible prop drives render). Bottom sheet
          shows 4 actions when fetchedCar has no moderationBadge (active),
          else swaps to single Restore row. Reason modal opens for
          suspend/archive/delete; Delete escalates to TypedConfirmationModal
          (D-07 two-modal stack — reason modal stays mounted while typed
          confirm overlays with keyboardType="default" for Pitfall 3
          mitigation). Restore opens ListingRestoreModal. listingTitle
          derived from buildListingTitle(fetchedCar) (Pitfall 6 single
          source of truth — same string used for sheet header AND sentinel
          target). */}
      <ListingModerationBottomSheet
        visible={bottomSheetVisible}
        listingTitle={listingTitle}
        moderationBadge={fetchedCar?.moderationBadge}
        onSelect={handleSheetSelect}
        onClose={() => setBottomSheetVisible(false)}
      />

      {reasonModalAction && fetchedCar && (
        <ListingModerationReasonModal
          visible={true}
          action={reasonModalAction}
          carId={carId}
          listingTitle={listingTitle}
          onSubmit={(payload) => {
            if (reasonModalAction === 'delete') {
              setPendingDeletePayload(payload);
              setTypedConfirmVisible(true);
            } else {
              handleListingActionSubmit(reasonModalAction, payload);
            }
          }}
          onClose={() => setReasonModalAction(null)}
        />
      )}

      {/* Plan 10-11 CR-01 fix — pass listing-specific copy via override props so admin
          sees "This listing will be permanently deleted" instead of the user-profile
          delete copy. Sentinel match semantics unchanged (targetEmail still carries
          listingTitle; case-insensitive trimmed equality per D-08a). */}
      {typedConfirmVisible && fetchedCar && pendingDeletePayload && (
        <TypedConfirmationModal
          visible={true}
          action="delete_profile"
          targetEmail={listingTitle}
          keyboardType="default"
          bodyKey="typedConfirmListingDeleteBody"
          hintKey="typedConfirmListingHint"
          placeholderKey="typedConfirmListingPlaceholder"
          onConfirm={() => {
            setTypedConfirmVisible(false);
            setReasonModalAction(null);
            handleListingActionSubmit('delete', pendingDeletePayload);
            setPendingDeletePayload(null);
          }}
          onClose={() => {
            setTypedConfirmVisible(false);
            setPendingDeletePayload(null);
          }}
        />
      )}

      {restoreModalVisible && fetchedCar && (
        <ListingRestoreModal
          visible={true}
          carId={carId}
          onSubmit={(body) => handleListingActionSubmit('restore', body)}
          onClose={() => setRestoreModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: COLORS.textPrimary,
    fontSize: 24,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    color: COLORS.accent,
    fontSize: 24,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  imageCarousel: {
    position: 'relative',
    height: 250,
  },
  mainImage: {
    height: 250,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  galleryScroll: {
    flex: 1,
    marginTop: 60,
  },
  galleryScrollContent: {
    paddingBottom: 40,
  },
  galleryImage: {
    marginBottom: 8,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
    justifyContent: 'center',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullScreenScroll: {
    flex: 1,
  },
  fullScreenImage: {
    // width/height set inline from useWindowDimensions for rotation support
  },
  fullScreenPagination: {
    position: 'absolute',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: SIZES.padding,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.borderRadius,
    marginBottom: 12,
  },
  statusBadgeSold: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  statusActions: {
    marginBottom: 16,
  },
  statusLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  statusBtnActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusBtnSold: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusBtnSelected: {
    backgroundColor: COLORS.accent,
  },
  statusBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  soldMessage: {
    padding: 16,
    alignItems: 'center',
  },
  soldMessageText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  titleBlock: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  listingIdPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listingId: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sellerAvatarContainer: {
    marginRight: 14,
  },
  sellerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sellerAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.searchBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sellerInfo: {
    flex: 1,
    minWidth: 0,
  },
  sellerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sellerName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  sellerViewAll: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  sellerChevron: {
    marginLeft: 8,
  },
  price: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  specsContainer: {
    marginBottom: 24,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
  },
  specItem: {
    width: '50%',
    marginBottom: 16,
  },
  fullWidthItem: {
    width: '100%',
    marginBottom: 16,
  },
  specLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  specValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  getServicesButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  getServicesText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  bookItButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  bookItText: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '600',
  },
  bookItButtonDisabled: {
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  bookItTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  warningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  warningCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warningIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  warningMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
  warningCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  warningBadge: {
    backgroundColor: COLORS.searchBackground,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warningBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  warningConfirmBtn: {
    width: '100%',
    backgroundColor: '#22c55e',
    borderRadius: SIZES.borderRadius,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  warningConfirmText: {
    color: '#0F1115',
    fontSize: 16,
    fontWeight: '700',
  },
  warningCancelBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  warningCancelText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  currencyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  currencySheet: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  currencyHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  currencyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  currencySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  currencyFlag: {
    fontSize: 24,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  currencyDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  currencyAmount: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  currencyCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyCancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  contactLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  contactButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  telegramButton: {
    backgroundColor: '#229ED9', // Telegram Blue
    flex: 1,
    marginRight: 2,
  },
  whatsappButton: {
    backgroundColor: '#25D366', // WhatsApp Green
  },
  contactButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    // flex: 1, // Removed to allow centering of content group
    textAlign: 'center',
  },
  // Phase 10 Plan 08 — Admin status banner + error banner styles (D-17, D-15).
  adminStatusBanner: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.spacingSm,
    marginBottom: SIZES.spacingSm,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  adminBannerWarning: {
    backgroundColor: COLORS.moderation.featureLimited.bg,
    borderColor: COLORS.moderation.featureLimited.border,
  },
  adminBannerNeutral: {
    backgroundColor: COLORS.searchBackground,
    borderColor: COLORS.border,
  },
  adminBannerDestructive: {
    backgroundColor: COLORS.moderation.blockedReview.bg,
    borderColor: COLORS.moderation.blockedReview.border,
  },
  adminBannerStatus: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  adminBannerChip: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  adminBannerReason: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  adminBannerSetBy: {
    color: COLORS.textTertiary,
    fontSize: 12,
  },
  adminErrorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.spacingSm,
    marginBottom: SIZES.spacingSm,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.moderation.blockedReview.bg,
    borderWidth: 1,
    borderColor: COLORS.destructive,
  },
  adminErrorBannerText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1,
  },
});

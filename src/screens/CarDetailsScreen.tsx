import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, useWindowDimensions, Linking, Alert, Modal, Platform, Animated, Share, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { OptimizedImage } from '../components/OptimizedImage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SIZES } from '../constants/theme';
import { CARS } from '../constants/mockData';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MessageCircle, AlertTriangle, Send, X, Edit2, Share2, User, ChevronRight } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { LISTING_URL, API_URL } from '../constants/config';
import axios from 'axios';

export const CarDetailsScreen = () => {
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();
  const { user } = useAuth();
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

  const car = CARS.find(c => c.id === carId) || (route.params as any).carData || fetchedCar;
  const listingStatus = (localListingStatus ?? car?.listingStatus ?? 'active') as string;
  const isOwner = car?.sellerId && user?.localId === car.sellerId;

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
      axios.get(`${API_URL}/api/cars/${carId}`)
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
          <Text style={styles.errorText}>{t.loading || 'Loading...'}</Text>
        ) : (
          <Text style={styles.errorText}>{t.carNotFound || 'Car not found'}</Text>
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
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value || '-'}</Text>
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
        <Text style={styles.headerTitle}>{car.make} {car.model}</Text>
        <View style={styles.headerRight}>
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
          {(listingStatus === 'booked' || listingStatus === 'sold') && (
            <View style={[styles.statusBadge, listingStatus === 'sold' && styles.statusBadgeSold]}>
              <Text style={styles.statusBadgeText}>{listingStatus === 'sold' ? t.sold : t.booked}</Text>
            </View>
          )}
          {isOwner && (
            <View style={styles.statusActions}>
              <Text style={styles.statusLabel}>{t.listingStatus || 'Status'}:</Text>
              <View style={styles.statusButtons}>
                {listingStatus !== 'active' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, styles.statusBtnActive]}
                    onPress={() => updateListingStatus('active')}
                    disabled={statusUpdating}
                  >
                    <Text style={styles.statusBtnText}>{t.markAsAvailable}</Text>
                  </TouchableOpacity>
                )}
                {listingStatus !== 'booked' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, listingStatus === 'booked' && styles.statusBtnSelected]}
                    onPress={() => updateListingStatus('booked')}
                    disabled={statusUpdating}
                  >
                    <Text style={styles.statusBtnText}>{t.markAsBooked}</Text>
                  </TouchableOpacity>
                )}
                {listingStatus !== 'sold' && (
                  <TouchableOpacity
                    style={[styles.statusBtn, styles.statusBtnSold, listingStatus === 'sold' && styles.statusBtnSelected]}
                    onPress={() => updateListingStatus('sold')}
                    disabled={statusUpdating}
                  >
                    <Text style={styles.statusBtnText}>{t.markAsSold}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={3}>{car.make} {car.model}{car.trimLevel ? ` ${car.trimLevel}` : ''} {car.year}</Text>
              </View>
              <Text style={styles.price}>{car.currency}{car.price.toLocaleString()}</Text>
            </View>
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitle}>{car.mileage.toLocaleString()} км • {car.fuel}</Text>
              {car.listingId && (
                <View style={styles.listingIdPill}>
                  <Text style={styles.listingId}>ID: {car.listingId}</Text>
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
                  <Text style={styles.sellerLabel}>{t.listingOwner}</Text>
                  <Text style={styles.sellerName}>{sellerName || t.seller}</Text>
                  <Text style={styles.sellerViewAll}>{t.viewAllListings}</Text>
                </View>
                <ChevronRight size={22} color={COLORS.accent} style={styles.sellerChevron} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.specsContainer}>
            <Text style={styles.sectionTitle}>{t.specs}</Text>
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
            <Text style={styles.sectionTitle}>{t.condition}</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem(t.condition, car.condition)}
              <View style={styles.fullWidthItem}>
                <Text style={styles.specLabel}>{t.knownIssues}</Text>
                <Text style={styles.specValue}>
                  {car.knownIssues && car.knownIssues.length > 0 ? car.knownIssues.join(', ') : 'Нет'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.specsContainer}>
            <Text style={styles.sectionTitle}>{t.extInt}</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem(t.exteriorColor, car.exteriorColor)}
              {renderSpecItem(t.interiorColor, car.interiorColor)}
              {renderSpecItem(t.interiorMaterial, car.interiorMaterial)}
              {renderSpecItem(t.seats, car.seats)}
              {renderSpecItem(t.doors, car.doors)}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.description}</Text>
            <Text style={styles.description}>
              {car.description || t.noDescription}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {listingStatus === 'sold' ? (
          <View style={styles.soldMessage}>
            <Text style={styles.soldMessageText}>{t.sold}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.contactLabel}>{t.contactVia}</Text>
            <View style={styles.contactButtonsRow}>
              {car.telegramUsername && (
                <TouchableOpacity style={[styles.contactButton, styles.telegramButton]} onPress={handleTelegram}>
                  <Send size={20} color="#FFF" />
                  <Text style={[styles.contactButtonText, { color: '#FFF' }]}>Telegram</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.contactButton, styles.whatsappButton, car.telegramUsername ? { flex: 1, marginLeft: 2 } : { width: '100%' }]} onPress={handleCallSeller}>
                <MessageCircle size={20} color="#FFF" />
                <Text style={[styles.contactButtonText, { color: '#FFF' }]}>{t.whatsapp}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

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
});

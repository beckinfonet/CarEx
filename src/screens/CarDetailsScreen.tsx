import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, StatusBar, Dimensions, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SIZES } from '../constants/theme';
import { CARS } from '../constants/mockData';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Phone, AlertTriangle } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const CarDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { carId } = route.params as { carId: string };
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  const car = CARS.find(c => c.id === carId) || (route.params as any).carData;

  useEffect(() => {
    checkFavoriteStatus();
  }, [carId]);

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
        <Text style={styles.errorText}>Автомобиль не найден</Text>
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
    // In a real app, this phone number would come from the car/seller object
    const phoneNumber = '1234567890'; // Use international format without + or 00 for whatsapp link logic if needed, but usually just number
    // Clean phone number for WhatsApp: remove all non-numeric characters
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(`Hi, I'm interested in your ${car.make} ${car.model}`)}`;

    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          // Fallback to regular phone call if WhatsApp is not installed
          return Linking.openURL(`tel:${phoneNumber}`);
        }
      })
      .catch((err) => {
        console.error('An error occurred', err);
        // Only fallback if error implies unsupported scheme (though canOpenURL should catch that)
        // But sometimes canOpenURL throws on iOS if scheme not in Info.plist
        Linking.openURL(`tel:${phoneNumber}`).catch(e => console.error("Call failed", e));
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{car.make} {car.model}</Text>
        <View style={styles.headerRight}>
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
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.imageCarousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {images.map((img: string, index: number) => (
              <Image key={index} source={{ uri: img }} style={styles.mainImage} resizeMode="cover" />
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
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{car.make} {car.model} {car.year}</Text>
              <Text style={styles.subtitle}>{car.mileage.toLocaleString()} км • {car.fuel}</Text>
            </View>
            <Text style={styles.price}>{car.currency}{car.price.toLocaleString()}</Text>
          </View>

          <View style={styles.specsContainer}>
            <Text style={styles.sectionTitle}>Характеристики</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem('Кузов', car.bodyType)}
              {renderSpecItem('Двигатель', car.engine || '-')}
              {renderSpecItem('Трансмиссия', car.transmission)}
              {renderSpecItem('Привод', car.drivetrain)}
              {renderSpecItem('Топливо', car.fuel)}
              {renderSpecItem('MPG/Запас', car.mpg)}
              {renderSpecItem('Владельцы', car.owners || '1')}
              {/* Note: 'owners' wasn't in upload form, defaulting to 1 or add to schema if needed */}
            </View>
          </View>

          <View style={styles.specsContainer}>
            <Text style={styles.sectionTitle}>Состояние</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem('Состояние', car.condition)}
              <View style={styles.fullWidthItem}>
                <Text style={styles.specLabel}>Известные проблемы</Text>
                <Text style={styles.specValue}>
                  {car.knownIssues && car.knownIssues.length > 0 ? car.knownIssues.join(', ') : 'Нет'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.specsContainer}>
            <Text style={styles.sectionTitle}>Экстерьер / Интерьер</Text>
            <View style={styles.specsGrid}>
              {renderSpecItem('Цвет кузова', car.exteriorColor)}
              {renderSpecItem('Цвет салона', car.interiorColor)}
              {renderSpecItem('Материал', car.interiorMaterial)}
              {renderSpecItem('Мест', car.seats)}
              {renderSpecItem('Дверей', car.doors)}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Описание</Text>
            <Text style={styles.description}>
              {car.description || 'Описание отсутствует.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.contactButton} onPress={handleCallSeller}>
          <Phone size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.contactButtonText}>Позвонить продавцу</Text>
        </TouchableOpacity>
      </View>
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
    width: width,
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
  detailsContainer: {
    padding: SIZES.padding,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  price: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
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
  contactButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  contactButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

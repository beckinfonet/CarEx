import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { OptimizedImage } from './OptimizedImage';
import { COLORS, SIZES } from '../constants/theme';
import { ChevronDown } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = SIZES.padding * 2 + 32; // screen padding + component padding
const CARD_GAP = 8;
const CARD_WIDTH = Math.max(120, (SCREEN_WIDTH - HORIZONTAL_PADDING - CARD_GAP * 2) / 3);
const CARD_IMAGE_HEIGHT = 100;

interface CarItem {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  currency: string;
  image: string;
  [key: string]: any;
}

interface LatestCarouselProps {
  cars: CarItem[];
  onCarPress: (car: CarItem) => void;
  t: { freshListings: string; collapse: string; expand: string; newBadge: string };
}

export const LatestCarousel = ({ cars, onCarPress, t }: LatestCarouselProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const latestCars = cars.filter((c: CarItem) => c.listingStatus !== 'sold').slice(0, 100);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.min(index, latestCars.length - 1));
  };

  if (latestCars.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.freshListings}</Text>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => setCollapsed(!collapsed)}
          activeOpacity={0.7}
        >
          <Text style={styles.collapseText}>
            {collapsed ? t.expand : t.collapse}
          </Text>
          <ChevronDown
            size={16}
            color={COLORS.textSecondary}
            style={[styles.chevron, collapsed && styles.chevronUp]}
          />
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
          >
            {latestCars.map((car) => (
              <TouchableOpacity
                key={car.id}
                style={styles.card}
                onPress={() => onCarPress(car)}
                activeOpacity={0.8}
              >
                <View style={styles.imageContainer}>
                  <OptimizedImage
                    source={{ uri: car.image }}
                    style={styles.cardImage}
                    resizeMode="cover"
                    priority="high"
                  />
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>{t.newBadge}</Text>
                  </View>
                </View>
                <Text style={styles.carTitle} numberOfLines={1}>
                  {car.make} {car.model} · {car.year}
                </Text>
                <Text style={styles.price}>
                  {car.currency}{car.price.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.pagination}>
            {latestCars.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === activeIndex && styles.activeDot,
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  collapseText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginRight: 4,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  scrollContent: {
    paddingRight: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  imageContainer: {
    position: 'relative',
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  carTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    marginBottom: 2,
  },
  price: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

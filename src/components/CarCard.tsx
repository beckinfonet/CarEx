import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OptimizedImage } from './OptimizedImage';
import { COLORS, SIZES } from '../constants/theme';
import { Gauge, Fuel, ChevronRight } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

interface CarProps {
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: string;
  currency: string;
  image: string;
  listingStatus?: string;
}

export const CarCard = React.memo(({ data }: { data: CarProps }) => {
  const { t } = useLanguage();
  const status = data.listingStatus || 'active';

  return (
    <View style={styles.card}>
      <OptimizedImage source={{ uri: data.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.details}>
        {(status === 'booked' || status === 'sold') && (
          <View style={[styles.statusBadge, status === 'sold' && styles.statusBadgeSold]}>
            <Text style={styles.statusBadgeText}>{status === 'sold' ? t.sold : t.booked}</Text>
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>{data.make} {data.model}</Text>
          <ChevronRight size={20} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.year}>{data.year}</Text>
        <Text style={styles.price}>{data.currency}{data.price.toLocaleString()}</Text>
        <View style={styles.infoRow}>
          <Gauge size={14} color={COLORS.textSecondary} style={styles.icon} />
          <Text style={styles.infoText}>{t.mileageLabel}: {data.mileage.toLocaleString()} км</Text>
        </View>
        <View style={styles.infoRow}>
          <Fuel size={14} color={COLORS.textSecondary} style={styles.icon} />
          <Text style={styles.infoText}>{t.fuelLabel}: {data.fuel}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    marginBottom: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 140,
  },
  image: {
    width: 120,
    height: '100%',
  },
  details: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrow: {
    color: COLORS.textSecondary,
    fontSize: 20,
  },
  year: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  price: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 6,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  statusBadgeSold: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
});


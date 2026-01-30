import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
}

export const CarCard = ({ data }: { data: CarProps }) => {
  const { t } = useLanguage();

  return (
    <View style={styles.card}>
      <Image source={{ uri: data.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.details}>
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
};

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
});


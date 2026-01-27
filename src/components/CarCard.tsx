import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

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
  return (
    <View style={styles.card}>
      <Image source={{ uri: data.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.details}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.make} {data.model}</Text>
          <Text style={styles.arrow}>›</Text>
        </View>
        <Text style={styles.year}>{data.year}</Text>
        <Text style={styles.price}>{data.currency}{data.price.toLocaleString()}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>⚙️ Пробег: {data.mileage.toLocaleString()} км</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>⛽️ Топливо: {data.fuel}</Text>
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
    marginBottom: 2,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});


import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface ShelfCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  image: string;
}

export interface ShelfCardProps {
  car: ShelfCardCar;
  kmSuffix: string;
  onPress: (car: ShelfCardCar) => void;
}

export const ShelfCard: React.FC<ShelfCardProps> = ({ car, kmSuffix, onPress }) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(car)} style={styles.card}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
        <Text style={[styles.priceOverlay, { fontFamily: typo.mono }]}>
          ${car.price.toLocaleString('en-US')}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
          {car.make} {car.model}
        </Text>
        <Text style={[styles.specs, { fontFamily: typo.mono }]}>
          {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: V2.surface,
    borderRadius: V2.radius.shelf,
    borderWidth: 1, borderColor: V2.border,
    overflow: 'hidden',
  },
  photoWrap: { aspectRatio: 4 / 3, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  priceOverlay: {
    position: 'absolute', left: 10, bottom: 10,
    color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.32,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  info:   { padding: 10, paddingHorizontal: 11, paddingBottom: 12 },
  title:  { fontSize: 13, fontWeight: '700', color: V2.text, letterSpacing: -0.234 },
  specs:  { fontSize: 10.5, color: V2.textMuted, marginTop: 2, fontWeight: '500' },
});

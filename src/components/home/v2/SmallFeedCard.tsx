import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, Gauge } from 'lucide-react-native';
import { OptimizedImage } from '../../OptimizedImage';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface SmallFeedCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
}

export interface SmallFeedCardProps {
  car: SmallFeedCardCar;
  kmSuffix: string;
  faved: boolean;
  onPress: (car: SmallFeedCardCar) => void;
  onToggleFav: (car: SmallFeedCardCar) => void;
}

export const SmallFeedCard: React.FC<SmallFeedCardProps> = ({ car, kmSuffix, faved, onPress, onToggleFav }) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(car)} style={styles.row}>
      <View style={styles.photoWrap}>
        <OptimizedImage source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { fontFamily: typo.display }]} numberOfLines={1}>
              {car.make} {car.model}
            </Text>
            <Text style={[styles.specs, { fontFamily: typo.mono }]} numberOfLines={1}>
              {car.year}{car.bodyType ? ` · ${car.bodyType}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onToggleFav(car)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.heartButton}
          >
            <Heart
              size={15}
              color={faved ? V2.favorite : V2.textMuted}
              fill={faved ? V2.favorite : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.mileageRow}>
          <Gauge size={11} color={V2.textFaint} strokeWidth={1.8} />
          <Text style={[styles.mileage, { fontFamily: typo.mono }]}>
            {car.mileage.toLocaleString('en-US')} {kmSuffix}
          </Text>
        </View>
        <Text style={[styles.price, { fontFamily: typo.mono }]}>
          ${car.price.toLocaleString('en-US')}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: V2.surface,
    borderRadius: V2.radius.small,
    borderWidth: 1, borderColor: V2.border,
    overflow: 'hidden',
  },
  photoWrap: { width: 124, aspectRatio: 1, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  info:  { flex: 1, padding: 11, paddingRight: 13, paddingBottom: 12, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  title:    { fontSize: 14, fontWeight: '800', color: V2.text, letterSpacing: -0.28, lineHeight: 16 },
  specs:    { fontSize: 11, color: V2.textMuted, marginTop: 2, fontWeight: '600' },
  heartButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  mileageRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  mileage: { fontSize: 10.5, color: V2.textMuted, fontWeight: '600' },
  price:   { fontSize: 17, fontWeight: '800', color: V2.text, letterSpacing: -0.34, marginTop: 10 },
});

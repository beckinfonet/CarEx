/**
 * BigFeedCard — used in the v2 home feed when `listing.promoted === true`.
 *
 * Today, no backend listing has `promoted=true`, so this component renders
 * zero times in production. The component exists so that when the backend
 * grows a `promoted` flag in a future phase, promoted listings will
 * automatically render as Big cards in the feed (matching the spec's
 * size-as-promotion hierarchy: Big = paid, Small = organic).
 *
 * Visual ornaments that originally signaled "promoted" in the design
 * handoff — gold halo, gold border, ember icon, match-score chip — are
 * intentionally cut here. The size hierarchy alone (Big vs Small) is the
 * signal. See spec §5 cut list.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Heart, ChevronRight } from 'lucide-react-native';
import { OptimizedImage } from '../../OptimizedImage';
import { ListingStatusBadge } from './ListingStatusBadge';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface BigFeedCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
  listingStatus?: string;
}

export interface BigFeedCardProps {
  car: BigFeedCardCar;
  kmSuffix: string;
  ctaLabel: string;
  faved: boolean;
  onPress: (car: BigFeedCardCar) => void;
  onToggleFav: (car: BigFeedCardCar) => void;
}

export const BigFeedCard: React.FC<BigFeedCardProps> = ({
  car, kmSuffix, ctaLabel, faved, onPress, onToggleFav,
}) => {
  const typo = useTypography();
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(car)} style={styles.card}>
      <View style={styles.photoWrap}>
        <OptimizedImage source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
        <ListingStatusBadge status={car.listingStatus} />
        <LinearGradient
          colors={['rgba(8,9,12,0)', 'rgba(8,9,12,0.92)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill as any}
        />
        <TouchableOpacity
          onPress={() => onToggleFav(car)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartButton}
        >
          <Heart size={16} color={faved ? V2.favorite : V2.text} fill={faved ? V2.favorite : 'transparent'} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.bottomBlock}>
          <Text style={[styles.makeModel, { fontFamily: typo.display }]}>{car.make} {car.model}</Text>
          <Text style={[styles.specs, { fontFamily: typo.mono }]}>
            {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}{car.bodyType ? ` · ${car.bodyType}` : ''}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { fontFamily: typo.mono }]}>
              ${car.price.toLocaleString('en-US')}
            </Text>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { fontFamily: typo.display }]}>{ctaLabel}</Text>
              <ChevronRight size={14} color="#08090C" strokeWidth={2.4} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: V2.radius.big,
    overflow: 'hidden',
    backgroundColor: V2.surfaceHi,
    borderWidth: 1, borderColor: V2.border,
  },
  photoWrap: { aspectRatio: 16 / 11, backgroundColor: '#1a1e28' },
  photo:     { width: '100%', height: '100%' },
  heartButton: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(8,9,12,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBlock: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  makeModel: { fontSize: 20, fontWeight: '800', color: V2.text, letterSpacing: -0.5, lineHeight: 21 },
  specs:     { fontSize: 12, color: V2.textMuted, marginTop: 3, fontWeight: '600' },
  priceRow:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  price:     { fontSize: 24, fontWeight: '800', color: V2.text, letterSpacing: -0.72 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: V2.text,
  },
  ctaText: { fontSize: 13, fontWeight: '800', color: '#08090C', letterSpacing: -0.13 },
});

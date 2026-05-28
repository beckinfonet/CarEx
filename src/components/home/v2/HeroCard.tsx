import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface HeroCardCar {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  bodyType?: string;
  price: number;
  image: string;
  createdAt?: string;
}

export interface HeroCardProps {
  car: HeroCardCar;
  /** Localized "СВЕЖЕЕ ПРЕДЛОЖЕНИЕ" kicker. */
  kicker: string;
  /** Localized "Сегодня" label for fresh pill. */
  todayLabel: string;
  /** Localized "Смотреть" CTA. */
  ctaLabel: string;
  /** Localized "км" suffix. */
  kmSuffix: string;
  /** Page indicator: total cards in rotator and current index. */
  pageIndex: number;
  pageCount: number;
  onPress: (car: HeroCardCar) => void;
}

function isFresh(createdAt?: string): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  car, kicker, todayLabel, ctaLabel, kmSuffix, pageIndex, pageCount, onPress,
}) => {
  const typo = useTypography();
  const fresh = isFresh(car.createdAt);

  return (
    <View style={styles.outer}>
      <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(car)} style={styles.card}>
        <View style={styles.photoWrap}>
          <Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(8,9,12,0)', 'rgba(8,9,12,0.55)', 'rgba(8,9,12,0.95)']}
            locations={[0.35, 0.75, 1]}
            style={StyleSheet.absoluteFill as any}
          />
          <View style={styles.topRow}>
            {fresh && (
              <View style={styles.todayPill}>
                <View style={styles.todayDot} />
                <Text style={[styles.todayText, { fontFamily: typo.display }]}>{todayLabel}</Text>
              </View>
            )}
            <View style={styles.pageDots}>
              {Array.from({ length: pageCount }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === pageIndex ? styles.dotActive : styles.dotIdle,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.bottomBlock}>
            <Text style={[styles.kicker, { fontFamily: typo.display, color: V2.blue }]}>
              {kicker}
            </Text>
            <Text style={[styles.makeModel, { fontFamily: typo.display }]}>
              {car.make} {car.model}
            </Text>
            <Text style={[styles.specs, { fontFamily: typo.mono }]}>
              {car.year} · {car.mileage.toLocaleString('en-US')} {kmSuffix}
              {car.bodyType ? ` · ${car.bodyType}` : ''}
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { fontFamily: typo.mono }]}>
                ${car.price.toLocaleString('en-US')}
              </Text>
              <View style={styles.cta}>
                <Text style={[styles.ctaText, { fontFamily: typo.display }]}>{ctaLabel}</Text>
                <ChevronRight size={16} color="#08090C" strokeWidth={2.4} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 14 },
  card: {
    borderRadius: V2.radius.hero,
    overflow: 'hidden',
    backgroundColor: V2.surfaceHi,
    borderWidth: 1,
    borderColor: V2.border,
  },
  photoWrap: { aspectRatio: 5 / 4, backgroundColor: '#1a1e28' },
  photo: { width: '100%', height: '100%' },
  topRow: {
    position: 'absolute', top: 16, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: V2.radius.pill,
    backgroundColor: 'rgba(8,9,12,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: V2.green },
  todayText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: V2.text,
  },
  pageDots: { flexDirection: 'row', gap: 6 },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 22, backgroundColor: V2.text },
  dotIdle:   { width: 6,  backgroundColor: 'rgba(255,255,255,0.35)' },

  bottomBlock: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  kicker: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.32,
    textTransform: 'uppercase', marginBottom: 6,
  },
  makeModel: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.78,
    color: V2.text, marginBottom: 4,
  },
  specs: { fontSize: 13, color: V2.textMuted, marginBottom: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  price: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9, color: V2.text },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: V2.text,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#08090C', letterSpacing: -0.14 },
});

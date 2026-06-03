import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useLanguage } from '../../../context/LanguageContext';
import { useTypography } from '../../../hooks/useTypography';

export interface ListingStatusBadgeProps {
  status?: string;
}

/**
 * Presentational status pill rendered over a V2 feed-card photo (top-left).
 * Mirrors v1 CarCard semantics: only renders for 'booked' or 'sold';
 * 'active'/undefined render nothing. Dark text on a solid V2 fill keeps the
 * label legible over arbitrary photos.
 */
export const ListingStatusBadge: React.FC<ListingStatusBadgeProps> = ({ status }) => {
  const { t } = useLanguage();
  const typo = useTypography();

  if (status !== 'booked' && status !== 'sold') {
    return null;
  }

  const isSold = status === 'sold';

  return (
    <View style={[styles.pill, isSold ? styles.pillSold : styles.pillBooked]}>
      <Text style={[styles.label, { fontFamily: typo.display }]} numberOfLines={1}>
        {isSold ? t.sold : t.booked}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: V2.radius.pill,
  },
  pillBooked: {
    backgroundColor: V2.ember,
    borderWidth: 1,
    borderColor: V2.emberBd,
  },
  pillSold: {
    backgroundColor: V2.green,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: V2.bg,
  },
});

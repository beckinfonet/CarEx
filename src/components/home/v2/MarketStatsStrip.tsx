import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface MarketStatsStripProps {
  /** Localized labels for each cell. */
  avgLabel:     string;
  yearLabel:    string;
  mileageLabel: string;
  /** Pre-formatted values; pass "—" when no data. */
  avgValue:     string;
  yearValue:    string;
  mileageValue: string;
}

export const MarketStatsStrip: React.FC<MarketStatsStripProps> = ({
  avgLabel, yearLabel, mileageLabel, avgValue, yearValue, mileageValue,
}) => {
  const typo = useTypography();
  return (
    <View style={styles.strip}>
      <Cell label={avgLabel}     value={avgValue}     typo={typo} />
      <Divider />
      <Cell label={yearLabel}    value={yearValue}    typo={typo} />
      <Divider />
      <Cell label={mileageLabel} value={mileageValue} typo={typo} />
    </View>
  );
};

const Cell: React.FC<{ label: string; value: string; typo: ReturnType<typeof useTypography> }> = ({ label, value, typo }) => (
  <View style={styles.cell}>
    <Text style={[styles.cellLabel, { fontFamily: typo.display }]}>{label}</Text>
    <Text style={[styles.cellValue, { fontFamily: typo.mono }]}>{value}</Text>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'stretch',
    marginHorizontal: 16, marginTop: 10,
    borderWidth: 1, borderColor: V2.border, borderRadius: 12,
    overflow: 'hidden',
  },
  cell:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  cellLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: V2.textFaint, marginBottom: 2 },
  cellValue: { fontSize: 13, fontWeight: '800', color: V2.text },
  divider:   { width: 1, backgroundColor: V2.border },
});

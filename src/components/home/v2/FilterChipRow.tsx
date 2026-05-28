import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SlidersHorizontal, Check } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface FilterChip {
  key: string;
  label: string;
  active: boolean;
}

export interface FilterChipRowProps {
  filtersLabel: string;
  chips: FilterChip[];
  onFiltersPress: () => void;
  onChipPress: (key: string) => void;
}

export const FilterChipRow: React.FC<FilterChipRowProps> = ({ filtersLabel, chips, onFiltersPress, onChipPress }) => {
  const typo = useTypography();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <TouchableOpacity style={[styles.chip, styles.leading]} onPress={onFiltersPress}>
        <SlidersHorizontal size={14} color={V2.text} strokeWidth={2.2} />
        <Text style={[styles.chipText, { fontFamily: typo.display }]}>{filtersLabel}</Text>
      </TouchableOpacity>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.key}
          style={[styles.chip, c.active && styles.chipActive]}
          onPress={() => onChipPress(c.key)}
        >
          {c.active && <Check size={12} color={V2.blue} strokeWidth={2.4} />}
          <Text
            style={[
              styles.chipText,
              { fontFamily: typo.display, color: c.active ? V2.blue : V2.text },
            ]}
            numberOfLines={1}
          >
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row:   { paddingHorizontal: 16, paddingVertical: 10, gap: 7 },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, height: 32,
    borderRadius: V2.radius.pill,
    backgroundColor: V2.surface,
    borderWidth: 1, borderColor: V2.border,
  },
  leading: { gap: 6 },
  chipActive: { backgroundColor: 'rgba(77,163,255,0.14)', borderColor: 'rgba(77,163,255,0.35)' },
  chipText: { fontSize: 13, fontWeight: '700', color: V2.text },
});

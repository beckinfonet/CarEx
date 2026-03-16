import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

interface QuickSortFiltersProps {
  activeFilters: { [key: string]: any };
  onSortToggle: (filterType: 'sortPrice' | 'sortMileage') => void;
  onReset: () => void;
  t: { price: string; mileage: string };
}

export const QuickSortFilters = ({ activeFilters, onSortToggle, onReset, t }: QuickSortFiltersProps) => {
  const sortPrice = activeFilters['sortPrice'];
  const sortMileage = activeFilters['sortMileage'];
  const hasActiveSort = sortPrice || sortMileage;

  const arrow = (dir: string) => (dir === 'asc' ? ' ↑' : ' ↓');

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.chip, sortPrice && styles.chipActive]}
        onPress={() => onSortToggle('sortPrice')}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, sortPrice && styles.chipTextActive]} numberOfLines={1}>
          {t.price}{sortPrice ? arrow(sortPrice) : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, sortMileage && styles.chipActive]}
        onPress={() => onSortToggle('sortMileage')}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, sortMileage && styles.chipTextActive]} numberOfLines={1}>
          {t.mileage}{sortMileage ? arrow(sortMileage) : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.resetButton, hasActiveSort && styles.resetButtonActive]}
        onPress={onReset}
        activeOpacity={0.7}
      >
        <RotateCcw size={18} color={hasActiveSort ? '#000' : COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  chip: {
    flex: 0.45,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  resetButton: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.searchBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
});

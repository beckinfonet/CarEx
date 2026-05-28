import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import type { ActiveFilters, SelectedRef } from '../../../hooks/useHomeListings';

export interface ActiveFilterChipsProps {
  selectedMake:     SelectedRef;
  selectedModel:    SelectedRef;
  selectedCategory: number | null;
  activeFilters:    ActiveFilters;
  categoryName:     (id: number) => string;
  clearAllLabel:    string;
  onClearMake:      () => void;
  onClearModel:     () => void;
  onClearCategory:  () => void;
  onClearFilter:    (key: string) => void;
  onClearAll:       () => void;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  selectedMake, selectedModel, selectedCategory, activeFilters, categoryName,
  clearAllLabel, onClearMake, onClearModel, onClearCategory, onClearFilter, onClearAll,
}) => {
  const typo = useTypography();
  const filterKeys = Object.keys(activeFilters).filter((k) => !k.startsWith('sort'));
  const hasAny = !!selectedMake || !!selectedModel || selectedCategory != null || filterKeys.length > 0;
  if (!hasAny) return null;

  const renderChip = (label: string, onClear: () => void, key: string) => (
    <TouchableOpacity key={key} style={styles.chip} onPress={onClear} activeOpacity={0.85}>
      <Text style={[styles.chipText, { fontFamily: typo.display }]} numberOfLines={1}>{label}</Text>
      <X size={12} color={V2.text} strokeWidth={2.4} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {selectedMake     && renderChip(selectedMake.name, onClearMake, 'make')}
      {selectedModel    && renderChip(selectedModel.name, onClearModel, 'model')}
      {selectedCategory && renderChip(categoryName(selectedCategory), onClearCategory, 'cat')}
      {filterKeys.map((k) => renderChip(k, () => onClearFilter(k), `f-${k}`))}
      <TouchableOpacity style={styles.clearAll} onPress={onClearAll} activeOpacity={0.85}>
        <Text style={[styles.clearAllText, { fontFamily: typo.display }]}>{clearAllLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 18, paddingVertical: 8, gap: 7, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: V2.radius.pill,
    backgroundColor: 'rgba(77,163,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(77,163,255,0.35)',
  },
  chipText:  { fontSize: 12, fontWeight: '700', color: V2.blue, maxWidth: 140 },
  clearAll:  { paddingHorizontal: 11, paddingVertical: 7 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: V2.textMuted },
});

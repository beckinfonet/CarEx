import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { FILTERS } from '../constants/mockData';

interface FilterBarProps {
  onFilterPress: (filter: string) => void;
  activeFilters: { [key: string]: any };
  t: any;
}

export const FilterBar = ({ onFilterPress, activeFilters, t }: FilterBarProps) => {
  const getFilterLabel = (filter: string) => {
    switch(filter) {
        case 'Год': return t.year;
        case 'Цена': return t.price;
        case 'Топливо': return t.fuel;
        case 'КПП': return t.transmission;
        case 'Пробег': return t.mileage;
        default: return filter;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {FILTERS.map((filter, index) => {
          const isActive = activeFilters[filter] !== undefined && activeFilters[filter] !== null;
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.filterButton, isActive && styles.activeFilterButton]}
              onPress={() => onFilterPress(filter)}
            >
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {getFilterLabel(filter)} {isActive ? '•' : '▼'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: COLORS.searchBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  activeFilterButton: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  activeFilterText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
});


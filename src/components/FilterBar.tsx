import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { FILTERS } from '../constants/mockData';

export const FilterBar = () => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {FILTERS.map((filter, index) => (
          <TouchableOpacity key={index} style={styles.filterButton}>
            <Text style={styles.filterText}>{filter} ▼</Text>
          </TouchableOpacity>
        ))}
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
});


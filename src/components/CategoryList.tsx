import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { CATEGORIES } from '../constants/mockData';

export const CategoryList = () => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {CATEGORIES.map((category) => (
          <TouchableOpacity key={category.id} style={styles.categoryItem}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{category.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 80,
  },
  iconContainer: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  categoryName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});


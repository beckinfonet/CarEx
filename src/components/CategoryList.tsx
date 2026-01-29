import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { CATEGORIES } from '../constants/mockData';
import { Car, Truck, Bus, Tractor } from 'lucide-react-native';

const getIcon = (id: number) => {
  switch (id) {
    case 1: return <Car size={24} color={COLORS.accent} />; // Sedan
    case 2: return <Car size={24} color={COLORS.accent} />; // SUV (using Car as placeholder)
    case 3: return <Bus size={24} color={COLORS.accent} />; // Passenger
    case 4: return <Truck size={24} color={COLORS.accent} />; // Truck
    case 5: return <Tractor size={24} color={COLORS.accent} />; // Special
    default: return <Car size={24} color={COLORS.accent} />;
  }
};

export const CategoryList = () => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {CATEGORIES.map((category) => (
          <TouchableOpacity key={category.id} style={styles.categoryItem}>
            <View style={styles.iconContainer}>
              {getIcon(category.id)}
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


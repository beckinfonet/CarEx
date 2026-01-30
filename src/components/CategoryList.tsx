import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { CATEGORIES } from '../constants/mockData';
import { Car, Truck, Bus, Tractor } from 'lucide-react-native';

interface CategoryListProps {
  selectedCategory: number | null;
  onSelectCategory: (id: number) => void;
  t: any;
}

const getIcon = (id: number, isActive: boolean) => {
  // Active: Accent color (Blue), Inactive: Secondary (Grey)
  const color = isActive ? COLORS.accent : COLORS.textSecondary;
  switch (id) {
    case 1: return <Car size={24} color={color} />; // Sedan
    case 2: return <Car size={24} color={color} />; // SUV (using Car as placeholder)
    case 3: return <Bus size={24} color={color} />; // Passenger
    case 4: return <Truck size={24} color={color} />; // Truck
    case 5: return <Tractor size={24} color={color} />; // Special
    default: return <Car size={24} color={color} />;
  }
};

export const CategoryList = ({ selectedCategory, onSelectCategory, t }: CategoryListProps) => {
  const getCategoryName = (id: number) => {
      switch(id) {
          case 1: return t.sedan;
          case 2: return t.suv;
          case 3: return t.passenger;
          case 4: return t.truck;
          case 5: return t.special;
          default: return '';
      }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          return (
            <TouchableOpacity 
              key={category.id} 
              style={styles.categoryItem}
              onPress={() => onSelectCategory(category.id)}
            >
              <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                {getIcon(category.id, isActive)}
              </View>
              <Text 
                style={[styles.categoryName, isActive && styles.activeCategoryName]}
                numberOfLines={1}
              >
                {getCategoryName(category.id)}
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
    marginBottom: 24,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 80, // Use minWidth instead of fixed width
  },
  iconContainer: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeIconContainer: {
    // Optional: Add background highlight if desired
    // backgroundColor: 'rgba(59, 130, 246, 0.1)',
    // borderRadius: 20,
  },
  categoryName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  activeCategoryName: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
});

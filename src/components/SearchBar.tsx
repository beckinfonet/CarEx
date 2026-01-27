import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

export const SearchBar = ({ value, onChangeText }: { value?: string; onChangeText?: (text: string) => void }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {/* Placeholder for Search Icon */}
        <View style={styles.searchIcon} />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Марка/Модель/VIN"
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconContainer: {
    marginRight: 10,
  },
  searchIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 0, // Remove default padding on Android
  },
});


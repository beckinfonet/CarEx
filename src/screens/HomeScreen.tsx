import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { CategoryList } from '../components/CategoryList';
import { CarCard } from '../components/CarCard';
import { BottomBar } from '../components/BottomBar';
import { CARS } from '../constants/mockData';

export const HomeScreen = () => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredCars = CARS.filter(car => 
    car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backButton}>
            <Text style={styles.headerIcon}>←</Text>
          </View>
          <Text style={styles.headerTitle}>CarEx</Text>
          <View style={styles.langSwitch}>
            <Text style={styles.langText}>RU <Text style={styles.langTextInactive}>EN</Text></Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          <FilterBar />
          <CategoryList />
          
          <View style={styles.carList}>
            {filteredCars.map((car) => (
              <CarCard key={car.id} data={car} />
            ))}
          </View>
        </ScrollView>

        <BottomBar />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerIcon: {
    color: COLORS.accent,
    fontSize: 24,
  },
  headerTitle: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  langSwitch: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  langText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  langTextInactive: {
    color: COLORS.textSecondary,
    fontWeight: 'normal',
  },
  content: {
    flex: 1,
  },
  carList: {
    paddingBottom: 16,
  },
});


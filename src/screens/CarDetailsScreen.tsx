import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { CARS } from '../constants/mockData';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export const CarDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { carId } = route.params as { carId: string };
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const car = CARS.find(c => c.id === carId) || (route.params as any).carData;

  // Normalize images to an array (support legacy mock data and new array structure)
  // In a real app, you would fetch this from the API using carId
  const images = car?.imageUrls || (car?.image ? [car.image] : []);

  if (!car) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Автомобиль не найден</Text>
      </View>
    );
  }

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setActiveImageIndex(roundIndex);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{car.make} {car.model}</Text>
        <TouchableOpacity style={styles.favoriteButton}>
          <Text style={styles.favoriteIcon}>♡</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.imageCarousel}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {images.map((img, index) => (
              <Image key={index} source={{ uri: img }} style={styles.mainImage} resizeMode="cover" />
            ))}
          </ScrollView>
          
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.paginationDot, 
                    index === activeImageIndex && styles.activeDot
                  ]} 
                />
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{car.make} {car.model} {car.year}</Text>
              <Text style={styles.subtitle}>{car.mileage.toLocaleString()} км • {car.fuel}</Text>
            </View>
            <Text style={styles.price}>{car.currency}{car.price.toLocaleString()}</Text>
          </View>

          <View style={styles.specsGrid}>
             <View style={styles.specItem}>
               <Text style={styles.specLabel}>Кузов</Text>
               <Text style={styles.specValue}>{car.bodyType || 'Седан'}</Text>
             </View>
             <View style={styles.specItem}>
               <Text style={styles.specLabel}>Двигатель</Text>
               <Text style={styles.specValue}>2.5 л / {car.fuel}</Text>
             </View>
             <View style={styles.specItem}>
               <Text style={styles.specLabel}>Привод</Text>
               <Text style={styles.specValue}>Передний</Text>
             </View>
             <View style={styles.specItem}>
               <Text style={styles.specLabel}>Владельцы</Text>
               <Text style={styles.specValue}>1</Text>
             </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Описание</Text>
            <Text style={styles.description}>
              {car.description || 'Отличный автомобиль в идеальном состоянии. Прошел полное техническое обслуживание. Не битый, не крашенный. Салон чистый, ухоженный. Богатая комплектация: климат-контроль, подогрев сидений, камера заднего вида. Возможен торг у капота.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.contactButton}>
          <Text style={styles.contactButtonText}>Позвонить продавцу</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: COLORS.textPrimary,
    fontSize: 24,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    color: COLORS.accent,
    fontSize: 24,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  imageCarousel: {
    position: 'relative',
    height: 250,
  },
  mainImage: {
    width: width,
    height: 250,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailsContainer: {
    padding: SIZES.padding,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  price: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
  },
  specItem: {
    width: '50%',
    marginBottom: 16,
  },
  specLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  specValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  contactButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

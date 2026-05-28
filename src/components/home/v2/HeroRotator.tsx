import React, { useState, useCallback } from 'react';
import { FlatList, Dimensions, View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { HeroCard, HeroCardCar } from './HeroCard';

export interface HeroRotatorProps {
  cars: HeroCardCar[];
  kicker: string;
  todayLabel: string;
  ctaLabel: string;
  kmSuffix: string;
  onCardPress: (car: HeroCardCar) => void;
}

export const HeroRotator: React.FC<HeroRotatorProps> = ({
  cars, kicker, todayLabel, ctaLabel, kmSuffix, onCardPress,
}) => {
  const [index, setIndex] = useState(0);
  const { width } = Dimensions.get('window');

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  }, [width]);

  if (cars.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={cars}
        keyExtractor={(c) => c.id}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <HeroCard
              car={item}
              kicker={kicker}
              todayLabel={todayLabel}
              ctaLabel={ctaLabel}
              kmSuffix={kmSuffix}
              pageIndex={index}
              pageCount={cars.length}
              onPress={onCardPress}
            />
          </View>
        )}
        extraData={index}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: 8, marginHorizontal: -18 }, // negate parent HomeScreenV2 FlatList paddingHorizontal: 18 so pagingEnabled snaps at full screen width
});

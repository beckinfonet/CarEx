import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import { ShelfCard, ShelfCardCar } from './ShelfCard';

export interface SmartShelfProps {
  kicker: string;
  title: string;
  cars: ShelfCardCar[];
  kmSuffix: string;
  onCardPress: (car: ShelfCardCar) => void;
}

export const SmartShelf: React.FC<SmartShelfProps> = ({ kicker, title, cars, kmSuffix, onCardPress }) => {
  const typo = useTypography();
  if (cars.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { fontFamily: typo.display }]}>{kicker}</Text>
        <Text style={[styles.title,  { fontFamily: typo.display }]}>{title}</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={cars}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 11 }} />}
        renderItem={({ item }) => (
          <ShelfCard car={item} kmSuffix={kmSuffix} onPress={onCardPress} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: 22 },
  header:  { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  kicker:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: V2.blue, marginBottom: 5 },
  title:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.616, color: V2.text },
  listContent: { paddingHorizontal: 18, paddingBottom: 4 },
});

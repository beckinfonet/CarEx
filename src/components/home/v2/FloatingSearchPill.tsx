import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface FloatingSearchPillProps {
  placeholder: string;
  onPress: () => void;
  onFiltersPress: () => void;
}

export const FloatingSearchPill: React.FC<FloatingSearchPillProps> = ({
  placeholder, onPress, onFiltersPress,
}) => {
  const typo = useTypography();
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.85}>
        <Search size={17} color={V2.text} strokeWidth={2} />
        <Text style={[styles.placeholder, { fontFamily: typo.display, fontWeight: typo.weights.medium }]}>
          {placeholder}
        </Text>
        <TouchableOpacity style={styles.filtersButton} onPress={onFiltersPress}>
          <SlidersHorizontal size={16} color="#04101f" strokeWidth={2.4} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 18,
    paddingRight: 6,
    backgroundColor: 'rgba(19,21,27,0.92)',
    borderWidth: 1,
    borderColor: V2.borderHi,
    borderRadius: V2.radius.pill,
    gap: 10,
  },
  placeholder: {
    flex: 1,
    color: V2.textFaint,
    fontSize: 14,
  },
  filtersButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: V2.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

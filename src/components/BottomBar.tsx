import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { MoreMenu } from './MoreMenu';
import { User, Truck, Menu } from 'lucide-react-native';

interface BottomBarProps {
  t: any;
}

export const BottomBar = ({ t }: BottomBarProps) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleComingSoon = (feature: string) => {
    Alert.alert(t.comingSoon, `${feature}`);
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={() => handleComingSoon(t.registration)}>
          <User size={20} color={COLORS.accent} />
          <Text style={styles.text}>{t.registration}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleComingSoon(t.logistics)}>
          <Truck size={20} color={COLORS.accent} />
          <Text style={styles.text}>{t.logistics}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => setMenuVisible(true)}
        >
          <Menu size={20} color={COLORS.textPrimary} />
          <Text style={styles.text}>{t.more}</Text>
        </TouchableOpacity>
      </View>
      <MoreMenu visible={menuVisible} onClose={() => setMenuVisible(false)} t={t} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  activeButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Blue transparent
  },
  icon: {
    marginRight: 4,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
});


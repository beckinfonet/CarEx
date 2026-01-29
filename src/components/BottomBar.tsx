import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { MoreMenu } from './MoreMenu';
import { User, Truck, Menu } from 'lucide-react-native';

export const BottomBar = () => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button}>
          <User size={20} color={COLORS.accent} />
          <Text style={styles.text}>Регистрация</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Truck size={20} color={COLORS.accent} />
          <Text style={styles.text}>Логистика</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => setMenuVisible(true)}
        >
          <Menu size={20} color={COLORS.textPrimary} />
          <Text style={styles.text}>Ещё</Text>
        </TouchableOpacity>
      </View>
      <MoreMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
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


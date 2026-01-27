import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import { MoreMenu } from './MoreMenu';

export const BottomBar = () => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.icon}>👤</Text>
          <Text style={styles.text}>Регистрация</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.icon}>🚚</Text>
          <Text style={styles.text}>Логистика</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => setMenuVisible(true)}
        >
          <Text style={styles.icon}>☰</Text>
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
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  icon: {
    fontSize: 16,
    marginRight: 4,
    color: COLORS.accent,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
});


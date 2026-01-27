import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Animated, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { id: 1, name: 'Продать авто', icon: '🚘' },
  { id: 2, name: 'Автосервис', icon: '🔧' },
  { id: 3, name: 'Финансы', icon: '💰' },
  { id: 4, name: 'Страхование', icon: '🛡️' },
  { id: 5, name: 'История авто', icon: '📋' },
  { id: 6, name: 'Помощь', icon: '❓' },
];

export const MoreMenu = ({ visible, onClose }: MoreMenuProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.menuContainer}>
              <View style={styles.indicator} />
              <View style={styles.header}>
                <Text style={styles.title}>Все сервисы</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.grid}>
                {MENU_ITEMS.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.menuItem}>
                    <View style={styles.iconContainer}>
                      <Text style={styles.icon}>{item.icon}</Text>
                    </View>
                    <Text style={styles.menuText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SIZES.padding,
    paddingBottom: 40,
    minHeight: 300,
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    backgroundColor: COLORS.searchBackground,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2, // Center visually
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.searchBackground,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: {
    fontSize: 28,
  },
  menuText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});


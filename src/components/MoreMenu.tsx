import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';
import { Car, Wrench, Banknote, Shield, ClipboardList, HelpCircle, X, Info } from 'lucide-react-native';

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  t: any;
}

const getIcon = (id: number) => {
  switch (id) {
    case 1: return <Car size={24} color={COLORS.accent} />;
    case 2: return <Wrench size={24} color={COLORS.accent} />;
    case 3: return <Banknote size={24} color={COLORS.accent} />;
    case 4: return <Shield size={24} color={COLORS.accent} />;
    case 5: return <ClipboardList size={24} color={COLORS.accent} />;
    case 6: return <HelpCircle size={24} color={COLORS.accent} />;
    case 7: return <Info size={24} color={COLORS.accent} />;
    default: return <Car size={24} color={COLORS.accent} />;
  }
};

export const MoreMenu = ({ visible, onClose, t }: MoreMenuProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const MENU_ITEMS = [
    { id: 1, name: t.sellCar, icon: '🚘', route: 'SellCar' },
    { id: 2, name: t.carService, icon: '🔧' },
    { id: 3, name: t.finance, icon: '💰' },
    { id: 4, name: t.insurance, icon: '🛡️' },
    { id: 5, name: t.carHistory, icon: '📋' },
    { id: 6, name: t.help, icon: '❓' },
    { id: 7, name: t.about, icon: 'ℹ️', route: 'About' },
  ];

  const handlePress = (item: typeof MENU_ITEMS[0]) => {
    onClose();
    if (item.id === 6) { // Help
        Linking.openURL('https://www.carexmarket.com/help').catch(err => console.error("Couldn't load page", err));
        return;
    }
    if (item.route) {
        // @ts-ignore
        navigation.navigate(item.route);
    }
  };

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
                <Text style={styles.title}>{t.appName}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.grid}>
                {MENU_ITEMS.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.menuItem}
                    onPress={() => handlePress(item)}
                  >
                    <View style={styles.iconContainer}>
                      {getIcon(item.id)}
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


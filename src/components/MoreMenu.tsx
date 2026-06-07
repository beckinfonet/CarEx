import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';
import { Car, Wrench, Banknote, Shield, ClipboardList, HelpCircle, X, Info, LogIn, LogOut, User, Briefcase, Bell } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationBadge } from './notifications/NotificationBadge';

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  t: any;
}

const getIcon = (id: number) => {
  switch (id) {
    case 1: return <Car size={24} color={COLORS.accent} />;
    case 7: return <Info size={24} color={COLORS.accent} />;
    case 8: return <LogIn size={24} color={COLORS.accent} />;
    case 9: return <User size={24} color={COLORS.accent} />;
    case 10: return <Briefcase size={24} color={COLORS.accent} />;
    case 11: return <Bell size={24} color={COLORS.accent} />;
    default: return <Car size={24} color={COLORS.accent} />;
  }
};

export const MoreMenu = ({ visible, onClose, t }: MoreMenuProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const MENU_ITEMS = [
    { id: 1, name: t.sellCar, icon: '🚘', route: 'SellCar' },
    { id: 10, name: t.services, icon: '💼', route: 'Services' },
    { id: 11, name: t.notificationsMenuLabel, icon: '🔔', route: 'Notifications' },
    { id: 7, name: t.about, icon: 'ℹ️', route: 'About' },
  ];

  if (user) {
    MENU_ITEMS.push({ id: 9, name: t.myProfile, icon: '👤', route: 'Profile' });
  } else {
    MENU_ITEMS.push({ id: 8, name: t.login, icon: '🔑', route: 'Login' });
  }

  const handlePress = async (item: any) => {
    onClose();
    if (item.action) {
        await item.action();
        return;
    }
    if (item.route) {
        // @ts-ignore
        navigation.navigate(item.route);
    } else {
        Alert.alert(t.appName, t.comingSoon);
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
                      {item.route === 'Notifications' && (
                        <NotificationBadge
                          count={unreadCount}
                          mode="count"
                          style={styles.notificationBadge}
                        />
                      )}
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
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  menuText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});

